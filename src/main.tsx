import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { runMigrations } from "./utils/migrations";
import { mirrorLegacyRecords, recoverInterruptedRestore } from "./features/storage/backup";
import { AuthProvider } from "./auth/AuthProvider";

import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/tailwind.css";
import "./styles/careeros.css";
import "./styles/careeros-polish.css";
import "./styles/homelab.css";

function render() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Start-up order matters for data safety:
// 1. Roll back an interrupted restore, so nothing reads half-restored records.
// 2. Run the non-destructive migrations.
// 3. Render.
// 4. Make the verified, non-destructive IndexedDB copy. localStorage stays the authoritative store.
void recoverInterruptedRestore()
  .then((result) => {
    if (result.recovered) console.warn("CareerOS rolled back an interrupted restore; your previous records were put back.");
  })
  .catch((error: unknown) => console.warn("CareerOS could not check for an interrupted restore.", error))
  .then(() => {
    try {
      runMigrations();
    } catch (error) {
      // A failed migration must never leave the user with a blank page; their records are untouched.
      console.warn("CareerOS migration failed; continuing with existing records.", error);
    }
    render();
    return mirrorLegacyRecords();
  })
  .catch((error: unknown) => {
    console.warn("CareerOS IndexedDB copy failed; original browser records remain available.", error);
  });
