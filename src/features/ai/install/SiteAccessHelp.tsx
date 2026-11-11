import { SOURCES } from "./catalog";
import CopyButton from "./CopyButton";

/**
 * What to do when an AI app is open but this website cannot reach it.
 * Steps come from each app's own documentation (verified 2026-11-10): Ollama's FAQ describes
 * OLLAMA_ORIGINS and how to set environment variables per platform; LM Studio's docs describe
 * starting the server from the Developer tab.
 */
export default function SiteAccessHelp({ origin, apps }: { origin: string; apps: Array<"ollama" | "lmstudio"> }) {
  const site = origin || "this website";
  return (
    <div className="ai-access">
      <p className="cos-muted">
        A browser can’t tell a closed app from one that is blocking this website, so both look the same here. If the app is open, it may need to allow {site}. Your browser may also ask whether this site can reach devices on your local network. Choose Allow.
      </p>
      {apps.includes("ollama") ? (
        <section aria-labelledby="access-ollama">
          <h4 id="access-ollama">Ollama</h4>
          <p className="cos-muted">
            Ollama allows <code>127.0.0.1</code> by default, but other websites need to be added with a setting called <code>OLLAMA_ORIGINS</code>. See <a href={SOURCES.ollamaFaq} target="_blank" rel="noopener noreferrer">Ollama’s FAQ</a>.
          </p>
          <div className="ai-fix-row">
            <span className="cos-muted">macOS: run this in Terminal, then restart Ollama</span>
            <div className="cos-code">
              <code>{`launchctl setenv OLLAMA_ORIGINS "${origin}"`}</code>
              <CopyButton text={`launchctl setenv OLLAMA_ORIGINS "${origin}"`} label="Copy macOS command" />
            </div>
          </div>
          <div className="ai-fix-row">
            <span className="cos-muted">Windows: quit Ollama from the taskbar, search for “environment variables”, choose “Edit environment variables for your account”, add a new variable, then start Ollama again</span>
            <div className="cos-code">
              <code>OLLAMA_ORIGINS</code>
              <CopyButton text="OLLAMA_ORIGINS" label="Copy variable name" />
            </div>
            <div className="cos-code">
              <code>{origin}</code>
              <CopyButton text={origin} label="Copy variable value" />
            </div>
          </div>
        </section>
      ) : null}
      {apps.includes("lmstudio") ? (
        <section aria-labelledby="access-lmstudio">
          <h4 id="access-lmstudio">LM Studio</h4>
          <p className="cos-muted">
            Open the Developer tab and switch on “Start server”. If CareerOS still can’t reach it, look for a “CORS” option in the server settings and turn it on. See <a href={SOURCES.lmStudioServer} target="_blank" rel="noopener noreferrer">LM Studio’s guide</a>.
          </p>
        </section>
      ) : null}
    </div>
  );
}
