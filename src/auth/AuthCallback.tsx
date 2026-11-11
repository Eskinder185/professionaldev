import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export default function AuthCallback() {
  const auth = useAuth();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void auth.completeSignIn()
      .then((returnPath) => window.location.replace(returnPath))
      .catch(() => setError("Sign-in could not be completed. Return to roadmaps and try again."));
  }, [auth]);

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <h1 className="font-semibold text-ink dark:text-white">Sign-in failed</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        <a className="btn btn-primary mt-4 inline-flex" href={`${import.meta.env.BASE_URL}resources/roadmaps`}>Return to roadmaps</a>
      </div>
    );
  }

  return <p role="status" className="py-16 text-center text-sm text-ink-muted">Completing secure sign-in...</p>;
}
