import type { Page } from "@playwright/test";

export type ContrastProblem = { text: string; ratio: number; color: string; background: string; selector: string; kind: "text" | "placeholder" | "bright-surface" };

/**
 * Measures real rendered contrast inside `scope`.
 *
 * - Text: every visible element that directly contains text is compared with its effective
 *   background (ancestor backgrounds composited, including translucent layers). WCAG 2.2 AA:
 *   4.5:1, or 3:1 for large text (≥24px, or ≥18.66px bold).
 * - Placeholders: empty inputs with a placeholder must reach 4.5:1 too.
 * - Dark theme only: any sizeable box with a near-white background is reported, which catches
 *   "white card left behind in dark mode" defects even when the text inside happens to be dark.
 *
 * Disabled controls are exempt (WCAG), as are elements over images or gradients, whose
 * background cannot be computed reliably.
 */
export async function auditContrast(page: Page, scope = "main", options: { dark?: boolean; allowBright?: string } = {}): Promise<ContrastProblem[]> {
  return page.evaluate(
    ({ scope, dark, allowBright }) => {
      type RGBA = [number, number, number, number];
      const canvas = document.createElement("canvas").getContext("2d")!;
      const parse = (value: string): RGBA => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (match) {
          const parts = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
          return [parts[0], parts[1], parts[2], parts[3] === undefined ? 1 : parts[3]];
        }
        // color(srgb …), oklch(…) and friends: let the canvas resolve them.
        canvas.fillStyle = "#000";
        canvas.fillStyle = value;
        canvas.clearRect(0, 0, 1, 1);
        canvas.fillRect(0, 0, 1, 1);
        const data = canvas.getImageData(0, 0, 1, 1).data;
        return [data[0], data[1], data[2], data[3] / 255];
      };
      const over = (top: RGBA, bottom: RGBA): RGBA => {
        const alpha = top[3] + bottom[3] * (1 - top[3]);
        if (!alpha) return [0, 0, 0, 0];
        return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha).concat(alpha) as RGBA;
      };
      const luminance = ([r, g, b]: RGBA) => {
        const channel = (value: number) => {
          const s = value / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const ratio = (a: RGBA, b: RGBA) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const css = ([r, g, b]: RGBA) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
      const pageBackground = parse(getComputedStyle(document.body).backgroundColor);
      const rootBackground = parse(getComputedStyle(document.documentElement).backgroundColor);
      const base: RGBA = over(pageBackground, rootBackground[3] ? rootBackground : dark ? [11, 16, 32, 1] : [255, 255, 255, 1]);

      /** Effective background, or null when an image/gradient makes it unknowable. */
      const backgroundOf = (element: Element): RGBA | null => {
        const layers: RGBA[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.backgroundImage !== "none") return null;
          const color = parse(style.backgroundColor);
          if (color[3] > 0) layers.push(color);
          if (color[3] >= 1) break;
        }
        return layers.reduceRight((acc, layer) => over(layer, acc), base);
      };
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) return false;
          if (node.getAttribute("aria-hidden") === "true") return false;
        }
        return true;
      };
      const describe = (element: Element) => {
        const id = element.getAttribute("data-testid");
        const cls = (element.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        return `${element.tagName.toLowerCase()}${id ? `[data-testid=${id}]` : cls ? `.${cls}` : ""}`;
      };
      const opacityOf = (element: Element) => {
        let opacity = 1;
        for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        return opacity;
      };

      const problems: ContrastProblem[] = [];
      const seen = new Set<string>();
      const roots = Array.from(document.querySelectorAll(scope));
      for (const root of roots) {
        for (const element of Array.from(root.querySelectorAll("*"))) {
          if (!visible(element)) continue;
          const disabled = element.closest(":disabled, [aria-disabled='true']");
          const style = getComputedStyle(element);

          // Bright leftovers in dark mode.
          if (dark && !(allowBright && element.closest(allowBright))) {
            const own = parse(style.backgroundColor);
            const rect = element.getBoundingClientRect();
            if (own[3] > 0.6 && luminance(own) > 0.55 && rect.width * rect.height > 2400) {
              const key = `bright:${describe(element)}`;
              if (!seen.has(key)) {
                seen.add(key);
                problems.push({ kind: "bright-surface", text: (element.textContent || "").trim().slice(0, 50), ratio: 0, color: css(own), background: css(own), selector: describe(element) });
              }
            }
          }
          if (disabled || (allowBright && element.closest(allowBright))) continue;

          const hasText = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0);
          const input = element as HTMLInputElement;
          const isField = /^(INPUT|TEXTAREA)$/.test(element.tagName) && !/^(checkbox|radio|range|file|color|hidden)$/.test(input.type);
          if (!hasText && !isField) continue;
          const background = backgroundOf(element);
          if (!background) continue;

          const check = (kind: "text" | "placeholder", colorValue: string, label: string) => {
            let color = parse(colorValue);
            color = [color[0], color[1], color[2], color[3] * opacityOf(element)];
            const effective = over(color, background);
            const value = ratio(effective, background);
            const size = parseFloat(style.fontSize);
            const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
            const needed = kind === "text" && large ? 3 : 4.5;
            if (value + 0.01 < needed) {
              const key = `${kind}:${describe(element)}:${css(effective)}:${css(background)}`;
              if (seen.has(key)) return;
              seen.add(key);
              problems.push({ kind, text: label.trim().slice(0, 50), ratio: Math.round(value * 100) / 100, color: css(effective), background: css(background), selector: describe(element) });
            }
          };
          if (hasText) check("text", style.color, element.textContent || "");
          if (isField) {
            if (input.value) check("text", style.color, input.value);
            else if (input.placeholder) check("placeholder", getComputedStyle(element, "::placeholder").color, input.placeholder);
          }
        }
      }
      return problems;
    },
    { scope, dark: Boolean(options.dark), allowBright: options.allowBright ?? "" },
  );
}

export async function setTheme(page: Page, theme: "light" | "dark" | "system") {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("pd-theme-pref", value);
      if (value !== "system") localStorage.setItem("pd-theme", value);
      else localStorage.removeItem("pd-theme");
    } catch {
      // ignore
    }
  }, theme);
}
