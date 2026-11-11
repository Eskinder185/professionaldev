import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extRoot = path.resolve(__dirname, "..");

/**
 * Generates a valid solid-color RGBA PNG buffer (#2563eb primary blue) of width x height.
 */
function createSolidPng(width, height, r = 37, g = 99, b = 235) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = 255;
    }
  }

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", iend),
  ]);
}

const manifest = {
  manifest_version: 3,
  name: "CareerOS AutoApply",
  version: "1.0.0",
  description:
    "Privacy-conscious, human-in-the-loop job application autofill and tracking companion for ProfessionalDev CareerOS.",
  permissions: ["activeTab", "scripting", "storage", "sidePanel"],
  // The ATS hosts are listed here (not only in content_scripts) so the side panel can read the
  // active tab's URL on supported application sites. Other sites are only readable after the user
  // opens CareerOS on them (activeTab).
  host_permissions: [
    "https://eskinder185.github.io/*",
    "http://127.0.0.1/*",
    "http://localhost/*",
    "https://boards.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
  ],
  // Ongoing access to a site is never granted at install. The person approves one https site at a
  // time from the side panel; Chrome shows its own prompt, and the permission can be removed.
  optional_host_permissions: ["https://*/*"],
  minimum_chrome_version: "116",
  externally_connectable: {
    matches: [
      "https://eskinder185.github.io/professionaldev/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
    ],
  },
  background: {
    service_worker: "background.js",
    type: "module",
  },
  content_scripts: [
    {
      matches: [
        "https://eskinder185.github.io/professionaldev/*",
        "http://127.0.0.1/*",
        "http://localhost/*",
        "https://boards.greenhouse.io/*",
        "https://job-boards.greenhouse.io/*",
        "https://jobs.lever.co/*",
      ],
      js: ["content.js"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "CareerOS AutoApply",
    default_popup: "popup/index.html",
    default_icon: {
      16: "icons/icon-16.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  side_panel: {
    default_path: "sidepanel/index.html",
  },
  options_ui: {
    page: "options/index.html",
    open_in_tab: true,
  },
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
};

async function buildExtensionToDir(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "icons"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "popup"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "sidepanel"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "options"), { recursive: true });

  // Write icons to public/icons and output icons/
  const publicIconsDir = path.join(extRoot, "public", "icons");
  fs.mkdirSync(publicIconsDir, { recursive: true });
  for (const size of [16, 48, 128]) {
    const png = createSolidPng(size, size);
    fs.writeFileSync(path.join(publicIconsDir, `icon-${size}.png`), png);
    fs.writeFileSync(path.join(outDir, "icons", `icon-${size}.png`), png);
  }

  // Write manifest.json
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Bundle background.ts
  await esbuild({
    entryPoints: [path.join(extRoot, "entrypoints", "background.ts")],
    outfile: path.join(outDir, "background.js"),
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
  });

  // Bundle content.ts
  await esbuild({
    entryPoints: [path.join(extRoot, "entrypoints", "content.ts")],
    outfile: path.join(outDir, "content.js"),
    bundle: true,
    format: "iife",
    target: "es2022",
    platform: "browser",
  });

  // Bundle popup, sidepanel, options
  for (const page of ["popup", "sidepanel", "options"]) {
    const tsx = path.join(extRoot, "entrypoints", page, "main.tsx");
    const entry = fs.existsSync(tsx) ? tsx : path.join(extRoot, "entrypoints", page, "main.ts");
    await esbuild({
      entryPoints: [entry],
      outfile: path.join(outDir, page, "main.js"),
      bundle: true,
      format: "esm",
      target: "es2022",
      platform: "browser",
      jsx: "automatic",
      minify: false,
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "warning",
    });

    const htmlSrc = fs.readFileSync(
      path.join(extRoot, "entrypoints", page, "index.html"),
      "utf8",
    );
    const htmlOut = htmlSrc.replace('./main.ts', './main.js');
    fs.writeFileSync(path.join(outDir, page, "index.html"), htmlOut);
  }

  await esbuild({
    entryPoints: [path.join(extRoot, "entrypoints", "options", "ai.tsx")],
    outfile: path.join(outDir, "options", "ai.js"),
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    jsx: "automatic",
    minify: false,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
}

async function main() {
  const distDir = path.join(extRoot, "dist");
  const wxtOutDir = path.join(extRoot, ".output", "chrome-mv3");
  await buildExtensionToDir(distDir);
  await buildExtensionToDir(wxtOutDir);
  console.log("CareerOS AutoApply MV3 extension built to:");
  console.log(" -", distDir);
  console.log(" -", wxtOutDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
