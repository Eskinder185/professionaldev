import http from "node:http";
import { expect, test } from "@playwright/test";
import { launchWithExtension, panelUrl, readExtensionState } from "./helpers/extension";

test("extension discovers and tests a keyless local model without sending a cloud request", async ({ isMobile }) => {
  test.skip(isMobile, "Extension runs in desktop Chromium");
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url ?? "");
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    if (req.url === "/v1/models") res.end(JSON.stringify({ data: [{ id: "synthetic-local-7b" }] }));
    else res.end(JSON.stringify({ choices: [{ message: { content: "ready" } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const h = await launchWithExtension();
  try {
    const panel = await h.context.newPage();
    await panel.goto(panelUrl(h.extId));
    await panel.getByTestId("tab-ai").click();
    // The simple screen comes first; the technical controls are under Advanced settings.
    await expect(panel.getByTestId("ai-home")).toBeVisible();
    await expect(panel.getByTestId("ai-settings")).toBeHidden();
    await panel.getByTestId("ai-advanced").locator("summary").click();
    await expect(panel.getByTestId("ai-settings")).toBeVisible();
    await panel.getByLabel("Provider").selectOption("custom");
    await panel.getByRole("textbox", { name: "Endpoint" }).fill(`http://127.0.0.1:${port}/v1`);
    await panel.getByRole("textbox", { name: "Endpoint" }).blur();
    await panel.getByRole("checkbox", { name: /authorize this extension/ }).check();
    await panel.getByRole("button", { name: "Load models" }).click();
    await expect(panel.getByRole("status").filter({ hasText: "Found 1 model" })).toBeVisible();
    await panel.getByLabel("Model", { exact: true }).fill("synthetic-local-7b");
    await panel.getByRole("button", { name: "Test connection" }).click();
    await expect(panel.getByText("Connected to loopback endpoint")).toBeVisible();
    const state = await readExtensionState<{ aiConnection: { provider: string; connected: boolean; model: string; keyless: boolean; taskModels: Record<string, string> } }>(h.worker);
    expect(state.aiConnection).toMatchObject({ provider: "custom", connected: true, model: "synthetic-local-7b", keyless: true });
    expect(requests).toContain("/v1/models");
    expect(requests.every((url) => url.startsWith("/v1/"))).toBe(true);

    await panel.getByLabel("Provider").selectOption("openai");
    await expect(panel.getByText(/Cloud setup required/).first()).toBeVisible();
    await expect(panel.getByRole("button", { name: "Test connection" })).toBeDisabled();
    const options = await h.context.newPage();
    await options.goto(`chrome-extension://${h.extId}/options/index.html`);
    await expect(options.getByTestId("options-ai-settings")).toBeVisible();
    await options.getByTestId("ai-advanced").locator("summary").click();
    await expect(options.getByLabel("Provider")).toHaveValue("openai");
  } finally {
    await h.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
