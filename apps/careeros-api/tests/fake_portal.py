"""A local imitation of a Workday-style candidate portal, for tests only.

It follows the layout the Workday adapter's SELECTORS expect, so it proves the flow, parsing and
safety behaviour. It does not prove that any real employer's portal works. No real site is ever used.
"""

from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROWS = [
    # (id, title, status text)
    ("R-100", "Cloud Support Engineer", "Interview Scheduled"),
    ("R-200", "Data Center Technician", "Under Review"),
    ("R-300", "Network Analyst", "Not Selected"),
    ("R-400", "Mystery Role", "Awaiting committee"),
    ("R-999", "Someone Else's Job", "Application Received"),
]

LOGIN = """<!doctype html><title>Sign in</title><h1>Candidate sign in</h1>
<div data-automation-id="utilityButtonSignIn" role="button" style="display:none"></div>
<input data-automation-id="email" type="text" aria-label="Email"><input data-automation-id="password" type="password" aria-label="Password">
<div data-automation-id="click_filter" role="button" tabindex="0">Sign In</div><div data-automation-id="errorMessage" style="display:none"></div>
<script>
document.querySelector('[data-automation-id="click_filter"]').addEventListener('click', async () => {{
  const r = await fetch('/login', {{method: 'POST', headers: {{'content-type': 'application/json'}}, body: JSON.stringify({{u: document.querySelector('[data-automation-id=email]').value, p: document.querySelector('[data-automation-id=password]').value}})}});
  if (r.ok) {{ location.href = '/userHome'; }} else {{ const e = document.querySelector('[data-automation-id=errorMessage]'); e.style.display = 'block'; e.textContent = 'Invalid credentials'; }}
}});
</script>{extra}"""

HOME = """<!doctype html><title>Candidate Home</title><h1 data-automation-id="applicationsSectionHeading">My Applications</h1>
<table data-automation-id="applicationsTable"><thead><tr><th>Job</th><th>Status</th></tr></thead><tbody>{rows}</tbody></table>
<button data-automation-id="withdrawApplication" onclick="fetch('/withdraw',{{method:'POST'}})">Withdraw application</button>
<button data-automation-id="submitApplication" onclick="fetch('/submit',{{method:'POST'}})">Submit application</button>
<div data-automation-id="utilityMenuButton"></div><a data-automation-id="signOut" href="/logout">Sign out</a>"""

ROW = '<tr><td><a data-automation-id="applicationTitle" href="/job/Acme_{slug}_{rid}">{title}</a></td><td data-automation-id="applicationStatus">{status}</td></tr>'


class FakePortal:
    """mode: normal | captcha | mfa | badlogin | layout"""

    def __init__(self, mode: str = "normal", rows=ROWS) -> None:
        self.mode = mode
        self.rows = rows
        self.requests: list[tuple[str, str]] = []
        self.logins = 0
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def base_url(self) -> str:
        assert self._server
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def hits(self, path: str) -> int:
        return sum(1 for _, p in self.requests if p == path)

    def __enter__(self) -> "FakePortal":
        portal = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):  # keep test output quiet
                pass

            def _send(self, body: str, status: int = 200, headers: dict[str, str] | None = None) -> None:
                data = body.encode()
                self.send_response(status)
                self.send_header("content-type", "text/html; charset=utf-8")
                self.send_header("content-length", str(len(data)))
                for k, v in (headers or {}).items():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(data)

            def _signed_in(self) -> bool:
                return "sid=ok" in (self.headers.get("cookie") or "")

            def do_GET(self):  # noqa: N802
                portal.requests.append(("GET", self.path.split("?")[0]))
                if self.path.startswith("/userHome"):
                    if portal.mode == "captcha":
                        return self._send('<h1>Checking your browser</h1><iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe><p>Please verify you are human.</p>')
                    if not self._signed_in():
                        return self._send(LOGIN.format(extra=""))
                    if portal.mode == "layout":
                        return self._send("<h1 data-automation-id='applicationsSectionHeading'>My Applications</h1><p>We changed everything.</p>")
                    rows = "".join(
                        ROW.format(rid=rid, slug=title.replace(" ", "").replace("'", ""), title=title, status=status) for rid, title, status in portal.rows
                    )
                    return self._send(HOME.format(rows=rows))
                if self.path.startswith("/logout"):
                    return self._send("<p>Signed out</p>", headers={"set-cookie": "sid=; Max-Age=0; Path=/"})
                return self._send("<p>Not found</p>", 404)

            def do_POST(self):  # noqa: N802
                portal.requests.append(("POST", self.path))
                length = int(self.headers.get("content-length") or 0)
                body = self.rfile.read(length).decode() if length else ""
                if self.path == "/login":
                    portal.logins += 1
                    if portal.mode == "badlogin" or "wrong" in body:
                        return self._send("no", 401)
                    return self._send("ok", 200, {"set-cookie": "sid=ok; Path=/"})
                return self._send("changed!", 200)  # /withdraw, /submit: the job must never reach these

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *_) -> None:
        assert self._server
        self._server.shutdown()
        self._server.server_close()
