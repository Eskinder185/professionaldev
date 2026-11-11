# Copilot manual checks

Automation cannot do these, so each release needs a person to confirm them in a real Chrome window.

1. **Native permission prompt.** Load the built extension (`npm run ext:build`, then load `apps/extension/dist`).
   Open a job posting on an `https` site that is not Greenhouse or Lever. Open the side panel, Page tab.
   - Click **Always assist on this site**: Chrome shows its prompt for that one site. Allow it.
   - Reload the page: the Page card still says "Always on for this site" and the job card fills in.
   - Click **Turn off for this site**: the card returns to "This page only"; `chrome://extensions` → Details →
     Site access no longer lists the site.
   - Click the button again and **Deny**: the panel says access was not granted and nothing is saved.
   - Grant again, then remove access in `chrome://extensions`: open tabs on the site stop answering within
     a moment and the panel explains it.
2. **Restricted sites.** On a banking, webmail or password-manager page the Page card says CareerOS does not
   assist there and offers no button.
3. **Docked side panel.** Open the real docked side panel (toolbar icon) next to a job page and confirm the
   Page tab at ~360 px wide, in light and dark. Navigate within a single-page application and confirm the
   panel updates without a reload.
4. **Service-worker restart.** In `chrome://serviceworker-internals` stop the extension worker, then
   open a page on an approved site: the page still works and the approved-sites list is intact.
5. **Real AI provider.** With Ollama or LM Studio running, connect it from the AI tab and confirm a real reply
   before the card says Ready. (Automated tests use a simulated provider only.)

## Added for Copilot 2.1

6. **Analyze visible page (real capture).** Chrome allows `tabs.captureVisibleTab` only after the toolbar
   icon is clicked on the page (`activeTab`). Automated tests replace that one call with a real screenshot.
   Manually: with a vision-capable local model connected, open a page CareerOS cannot read (for example a
   canvas-drawn posting), click the toolbar icon, open the Ask tab → Analyze visible page → Capture. Confirm the
   preview appears, hiding a region blacks it out, nothing is sent until you press Send, and the picture disappears
   afterwards.
7. **Acceptance checklist in installed Chrome** (record the date, Chrome version and what you saw below, separately
   from the automated results):
   - Click the toolbar icon → one-time access on a permitted job page → Analyze this page.
   - Always assist on a supported employer site → navigate to another job on it → the Page tab updates.
   - Revoke (panel button or `chrome://extensions`) → open tabs on that site stop responding.
   - Reopen the docked side panel and confirm state is correct.

### Observations (to be filled in by a person)

Not performed yet: automation cannot operate Chrome's toolbar icon or native permission prompt.
