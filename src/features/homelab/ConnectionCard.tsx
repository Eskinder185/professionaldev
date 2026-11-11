import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { ApiError, checkHealth, forgetToken, getApiBase, getToken, listApplications, parseApiBase, saveConnection, type ApplicationSummary } from "./api";

/**
 * Connect this page to your home-lab API. The address is saved on this device; the token only for
 * this tab (it is cleared when the tab closes). Nothing is sent anywhere until you press Connect.
 */
export default function ConnectionCard({ onConnected, onDisconnected }: { onConnected: (applications: ApplicationSummary[]) => void; onDisconnected?: () => void }) {
  const [address, setAddress] = useState(getApiBase());
  const [token, setToken] = useState(getToken());
  const [state, setState] = useState<"idle" | "checking" | "connected" | "error">("idle");
  const [message, setMessage] = useState("");

  const connect = async (signal?: AbortSignal) => {
    const parsed = parseApiBase(address);
    if (!parsed.ok) {
      setState("error");
      setMessage(parsed.message);
      return;
    }
    if (!token.trim()) {
      setState("error");
      setMessage("Enter your API token.");
      return;
    }
    setState("checking");
    setMessage("");
    saveConnection(parsed.base, token.trim());
    try {
      await checkHealth(signal);
      const page = await listApplications(signal);
      setState("connected");
      setMessage(`Connected. ${page.total} application${page.total === 1 ? "" : "s"} available.`);
      onConnected(page.items);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "Couldn’t connect.");
    }
  };

  // Reconnect automatically when a token from this tab is still around.
  useEffect(() => {
    if (getToken()) {
      const controller = new AbortController();
      void connect(controller.signal);
      return () => controller.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="career-panel lab-connect" aria-labelledby="lab-connect-h" data-testid="lab-connect">
      <div className="career-panel-heading">
        <h2 id="lab-connect-h"><Plug size={18} aria-hidden /> Your home-lab API</h2>
        <span className={`lab-status lab-status-${state}`} role="status" data-testid="lab-status">
          {state === "connected" ? "Connected" : state === "checking" ? "Checking…" : state === "error" ? "Not connected" : "Not connected"}
        </span>
      </div>
      <p className="career-muted">This optional service runs on your own machine. Your token stays in this tab only and is never put in a link.</p>
      <form
        className="lab-connect-form"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <label>
          API address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="http://127.0.0.1:8000 (leave empty to use this site’s dev proxy)" inputMode="url" autoComplete="off" data-testid="lab-address" />
        </label>
        <label>
          API token
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} data-testid="lab-token" />
        </label>
        <div className="lab-row">
          <button type="submit" className="lab-btn" disabled={state === "checking"} data-testid="lab-connect-btn">Connect</button>
          {state === "connected" ? (
            <button
              type="button"
              className="lab-btn lab-btn-secondary"
              onClick={() => {
                forgetToken();
                setToken("");
                setState("idle");
                setMessage("Token forgotten for this tab.");
                onDisconnected?.();
              }}
            >
              Forget token
            </button>
          ) : null}
        </div>
      </form>
      <p className={state === "error" ? "lab-error" : "career-muted"} role={state === "error" ? "alert" : "status"} data-testid="lab-message">{message}</p>
    </section>
  );
}
