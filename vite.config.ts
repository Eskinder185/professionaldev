import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Configure the base path so that assets and routes resolve correctly when
// deploying to a subfolder (e.g. GitHub Pages). Here the project is
// hosted at /professionaldev/ under the user's GitHub Pages site.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backendPort = env.ROADMAP_API_PORT || "8080";

  if (!/^\d+$/.test(backendPort)) {
    throw new Error("ROADMAP_API_PORT must be a numeric TCP port");
  }

  // The opt-in home-lab FastAPI service (apps/careeros-api). Separate from the roadmap API above.
  const careerosPort = env.CAREEROS_API_PORT || "8000";
  if (!/^\d+$/.test(careerosPort)) {
    throw new Error("CAREEROS_API_PORT must be a numeric TCP port");
  }

  return {
    base: "/professionaldev/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
        "/careeros": {
          target: `http://127.0.0.1:${careerosPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
