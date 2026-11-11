/**
 * Endpoint validation for user-supplied AI servers.
 *
 * Rules:
 * - http: or https: only.
 * - No embedded credentials (https://user:pass@host) — keys go in the Authorization header only.
 * - No query string or fragment; the base URL is a path prefix we append to.
 * - Remote hosts must use HTTPS. Plain HTTP is allowed only for loopback addresses
 *   (same device), never for LAN or public hosts.
 */

export interface ValidEndpoint {
  ok: true;
  /** Normalised base URL without a trailing slash, e.g. "http://127.0.0.1:11434/v1". */
  baseUrl: string;
  origin: string;
  /** Host shown to the user in consent and status text. */
  host: string;
  isLoopback: boolean;
}

export interface InvalidEndpoint {
  ok: false;
  error: string;
}

export type EndpointCheck = ValidEndpoint | InvalidEndpoint;

/** localhost, *.localhost, 127.0.0.0/8 and ::1. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  const m = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

export function validateEndpoint(input: string): EndpointCheck {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter the server’s base URL." };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That isn’t a valid URL. Include the scheme, e.g. https://api.example.com/v1." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// URLs are supported." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove the username or password from the URL. Put an API key in the API key field instead." };
  }
  if (url.search || url.hash || raw.includes("?") || raw.includes("#")) {
    return { ok: false, error: "Remove the query string or # fragment. Enter only the base URL." };
  }
  const isLoopback = isLoopbackHost(url.hostname);
  if (url.protocol === "http:" && !isLoopback) {
    return { ok: false, error: "Remote servers must use HTTPS. Plain HTTP is only allowed for servers on this device (localhost or 127.0.0.1)." };
  }
  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, baseUrl: `${url.origin}${path}`, origin: url.origin, host: url.host, isLoopback };
}
