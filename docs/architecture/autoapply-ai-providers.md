# AutoApply AI provider audit and current state

## Reused architecture

- The website's `AIAdapter` interface and provider-specific Ollama, OpenAI-compatible, Gemini, and Anthropic adapters live under `src/features/ai/`. The extension imports the local adapters; it does not create a second wire protocol.
- The versioned website-to-extension protocol is in `packages/careeros-shared/types` and `apps/extension/src/messaging/protocol.ts`. It syncs non-secret AI connection metadata, selected models, task overrides, and approved profile data through separate actions. Website and extension storage are distinct.
- The side panel already had a consent-gated local cover-letter draft and a deterministic autofill engine. The new AI tab and Options section expose model selection, discovery, test, disconnect, Local Only mode, and per-task overrides. The answer assistant uses the same approved profile subset and never writes a field until the user accepts the draft.
- The website no longer overwrites an extension-selected model on mount. Settings provides explicit send/load controls. A profile and analysis sync only includes the website AI connection if it is actually connected.
- The existing Interview Studio transcript review now uses the interview-analysis task model override. No audio or video is sent through that text adapter.

## Credential boundary

The extension makes keyless requests only to validated loopback URLs for Ollama, LM Studio, or a custom OpenAI-compatible server. It never accepts a cloud key. The website also blocks cloud requests because this repository has no authenticated companion or backend that stores credentials in an OS keychain. Selecting a cloud provider shows Setup Required. A loopback URL alone does not prove that a proxy is secure or that it keeps requests on the device. Users should inspect the local server's own forwarding settings.

The source tree has cloud adapters for future use, with provider-specific request formats, but those are not a working secure cloud connection. No production credential service was built in this change.

## Provider references checked

- [Ollama API](https://docs.ollama.com/api) and [OpenAI compatibility](https://docs.ollama.com/api/openai-compat)
- [LM Studio OpenAI-compatible model listing](https://lmstudio.ai/docs/developer/openai-compat/models)
- [OpenAI models API](https://platform.openai.com/docs/api-reference/models/list)
- [Gemini API reference](https://ai.google.dev/api) and [model listing](https://ai.google.dev/api/models)
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) and [models API](https://docs.anthropic.com/en/api/models-list)

## Test and rollout notes

The reported missing `@vitest/runner` folder did not reproduce as a failing Vitest installation in this checkout. The lockfile installs Vitest 5.0.5 without a separate `@vitest/runner` package; `npm.cmd run test` succeeds. No dependency change was made. The extension settings browser test uses a synthetic loopback OpenAI-compatible server. It does not establish a real Ollama or LM Studio installation, nor a cloud credential transport. The existing AutoApply browser suite exercises the docked-panel code as an extension page in headless Chromium; manually docking the panel in visible Chrome remains a separate check.

Rollback: restore the previous UI and helper files, leaving saved extension state intact. The new AI metadata fields are optional and older extension state readers ignore them. Existing autofill runs without an AI connection.

Known limits: cloud AI is setup-required; direct local servers may forward data elsewhere; task capability badges are estimates until specific structured-output and tool-call tests are implemented; agent planning is never marked ready without a controlled check; no background agent was added; website/extension model changes require explicit send/load synchronization.
