# Quick Deploy Guide (Vite + React on GitHub Pages)

1) In `vite.config.ts`, set:
```ts
export default defineConfig({
  base: '/professionaldev/',
  plugins: [react()],
})
```

2) (Recommended) Use `HashRouter` for routes:
```tsx
import { HashRouter } from 'react-router-dom'
// ...
<HashRouter>
  <App />
</HashRouter>
```

Or keep `BrowserRouter` **and** add the provided `404.html` to your project root.

3) Commit these changes and add the GitHub Actions workflow:
- Create `.github/workflows/deploy.yml` and paste the file from this folder.

4) Push to GitHub:
```
git add .
git commit -m "Configure GH Pages deploy"
git push origin main
```

5) In your repo on GitHub:
- Go to **Settings → Pages**
- Set **Source** to **GitHub Actions** (if it's not already)
- After the workflow runs, your site will be live at:
  `https://<your-username>.github.io/professionaldev/`