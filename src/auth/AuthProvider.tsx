import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { createOidcConfiguration, safeReturnPath, type AuthManager } from "./oidc";

export type AuthStatus = "loading" | "unavailable" | "anonymous" | "authenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  displayName?: string;
  message?: string;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  completeSignIn(): Promise<string>;
  getAccessToken(): string | null;
  expireSession(): Promise<void>;
}

const unavailableValue: AuthContextValue = {
  status: "unavailable",
  message: "OIDC sign-in is not configured for this environment.",
  signIn: async () => undefined,
  signOut: async () => undefined,
  completeSignIn: async () => `${import.meta.env.BASE_URL}resources/roadmaps`,
  getAccessToken: () => null,
  expireSession: async () => undefined,
};

const AuthContext = createContext<AuthContextValue>(unavailableValue);

interface AuthProviderProps {
  children: ReactNode;
  manager?: AuthManager | null;
  configurationIssue?: string;
}

function displayNameFor(user: User): string {
  const profile = user.profile;
  return (typeof profile.name === "string" && profile.name.trim()) ||
    (typeof profile.preferred_username === "string" && profile.preferred_username.trim()) ||
    "Signed-in learner";
}

export function AuthProvider({ children, manager: suppliedManager, configurationIssue }: AuthProviderProps) {
  const configuration = useMemo(
    () => suppliedManager === undefined ? createOidcConfiguration() : {
      manager: suppliedManager,
      issue: configurationIssue,
    },
    [configurationIssue, suppliedManager],
  );
  const manager = configuration.manager;
  const userRef = useRef<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(manager ? "loading" : "unavailable");
  const [displayName, setDisplayName] = useState<string>();
  const [message, setMessage] = useState(configuration.issue);

  const clearUser = useCallback(() => {
    userRef.current = null;
    setDisplayName(undefined);
    setStatus(manager ? "anonymous" : "unavailable");
  }, [manager]);

  const acceptUser = useCallback((user: User) => {
    if (user.expired || !user.access_token) {
      clearUser();
      return;
    }
    userRef.current = user;
    setDisplayName(displayNameFor(user));
    setMessage(undefined);
    setStatus("authenticated");
  }, [clearUser]);

  useEffect(() => {
    if (!manager) return;
    let active = true;
    const unloaded = () => active && clearUser();
    const expired = () => {
      if (!active) return;
      setMessage("Your session expired. Sign in again to continue saving progress.");
      void manager.removeUser().finally(clearUser);
    };
    const loaded = (user: User) => active && acceptUser(user);

    manager.events.addUserLoaded(loaded);
    manager.events.addUserUnloaded(unloaded);
    manager.events.addAccessTokenExpired(expired);
    void manager.getUser()
      .then((user) => {
        if (!active) return;
        if (user) acceptUser(user);
        else clearUser();
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setMessage("The saved authentication session could not be read. Please sign in again.");
      });

    return () => {
      active = false;
      manager.events.removeUserLoaded(loaded);
      manager.events.removeUserUnloaded(unloaded);
      manager.events.removeAccessTokenExpired(expired);
    };
  }, [acceptUser, clearUser, manager]);

  const signIn = useCallback(async () => {
    if (!manager) return;
    setMessage(undefined);
    await manager.signinRedirect({ state: { returnPath: safeReturnPath(window.location.href) } });
  }, [manager]);

  const completeSignIn = useCallback(async () => {
    if (!manager) throw new Error(configuration.issue ?? "OIDC is not configured");
    const user = await manager.signinRedirectCallback();
    acceptUser(user);
    const state = user.state as { returnPath?: unknown } | undefined;
    return safeReturnPath(state?.returnPath);
  }, [acceptUser, configuration.issue, manager]);

  const signOut = useCallback(async () => {
    if (!manager) return;
    try {
      await manager.signoutRedirect({
        post_logout_redirect_uri: new URL("resources/roadmaps", document.baseURI).toString(),
      });
    } catch {
      await manager.removeUser();
      clearUser();
    }
  }, [clearUser, manager]);

  const expireSession = useCallback(async () => {
    if (manager) await manager.removeUser();
    clearUser();
    setMessage("Your session is no longer valid. Sign in again to continue.");
  }, [clearUser, manager]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    displayName,
    message,
    signIn,
    signOut,
    completeSignIn,
    getAccessToken: () => userRef.current?.access_token ?? null,
    expireSession,
  }), [completeSignIn, displayName, expireSession, message, signIn, signOut, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
