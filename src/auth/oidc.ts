import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type User,
} from "oidc-client-ts";

export interface AuthManager {
  events: {
    addUserLoaded(callback: (user: User) => void): void;
    removeUserLoaded(callback: (user: User) => void): void;
    addUserUnloaded(callback: () => void): void;
    removeUserUnloaded(callback: () => void): void;
    addAccessTokenExpired(callback: () => void): void;
    removeAccessTokenExpired(callback: () => void): void;
  };
  getUser(): Promise<User | null>;
  removeUser(): Promise<void>;
  signinRedirect(args?: { state?: unknown }): Promise<void>;
  signinRedirectCallback(): Promise<User>;
  signoutRedirect(args?: { post_logout_redirect_uri?: string }): Promise<void>;
}

export interface OidcConfiguration {
  manager: AuthManager | null;
  issue?: string;
}

function pageUrl(path: string): string {
  return new URL(path.replace(/^\//, ""), document.baseURI).toString();
}

export function createOidcConfiguration(): OidcConfiguration {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY?.trim();
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID?.trim();
  const audience = import.meta.env.VITE_OIDC_AUDIENCE?.trim();

  if (!authority && !clientId) {
    return { manager: null, issue: "OIDC sign-in is not configured for this environment." };
  }
  if (!authority || !clientId) {
    return { manager: null, issue: "OIDC configuration is incomplete: authority and client ID are both required." };
  }

  const authorityUrl = new URL(authority);
  if (authorityUrl.protocol !== "https:" && authorityUrl.hostname !== "localhost" && authorityUrl.hostname !== "127.0.0.1") {
    return { manager: null, issue: "OIDC authority must use HTTPS except during localhost development." };
  }

  const manager = new UserManager({
    authority: authorityUrl.toString(),
    client_id: clientId,
    redirect_uri: pageUrl("auth/callback"),
    post_logout_redirect_uri: pageUrl("resources/roadmaps"),
    response_type: "code",
    scope: "openid profile",
    loadUserInfo: true,
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    // Only the short-lived authorization request state and PKCE verifier cross the redirect.
    // Tokens and the authenticated user are held by the in-memory userStore above.
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    ...(audience ? { extraQueryParams: { audience } } : {}),
  });

  return { manager };
}

export function safeReturnPath(value: unknown): string {
  const fallback = `${import.meta.env.BASE_URL}resources/roadmaps`;
  if (typeof value !== "string") return fallback;

  try {
    const candidate = new URL(value, window.location.origin);
    if (candidate.origin !== window.location.origin || !candidate.pathname.startsWith(import.meta.env.BASE_URL)) {
      return fallback;
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}
