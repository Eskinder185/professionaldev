# Repository Identity and Deployment

Verified on 2026-10-23.

## What this repository is

- Local directory: `C:\Users\eskew\github\professionaldev`
- Git remote: `https://github.com/Eskinder185/professionaldev.git`
- Package name: `professional-dev-site`
- Product title and browser metadata: **Roadmap to Role**
- Framework: React 18, TypeScript, and Vite
- Vite public base: `/professionaldev/`
- Documented live application: `https://eskinder185.github.io/professionaldev/`

The public GitHub repository describes Roadmap to Role and links to the same GitHub Pages URL. The public application returns the title “Roadmap to Role.” These facts align the repository, product, and GitHub Pages application.

## Relationship to eskinder.dev

`src/data/siteContact.ts` links to `https://eskinder.dev/` as a portfolio. A live metadata check returned the title “Portfolio” for that domain, while the GitHub Pages application returned “Roadmap to Role.” No tracked `CNAME` file or deployment setting in this repository connects the custom-domain root to this build.

Therefore:

- `professionaldev` is the source repository.
- Roadmap to Role is the product built from this repository.
- The GitHub Pages subpath is the evidenced deployment target.
- `eskinder.dev` is a separate portfolio experience unless external DNS or Pages settings—not visible in this repository—prove otherwise.

## Deployment behavior

The tracked workflow uses GitHub Pages Actions. It installs from `package-lock.json`, validates the application, builds `dist/`, uploads a Pages artifact, and deploys only for non-pull-request workflow runs. The existing push-to-`main` and manual triggers remain unchanged.

The repository also retains a `gh-pages` npm script. It is an alternative deployment mechanism, not the mechanism selected by the tracked workflow. Running both approaches against the same Pages site could create conflicting sources.

## Remaining uncertainty

GitHub's repository source proves the workflow and public repository identity, but this audit did not change or infer account-level Pages settings, custom-domain DNS, or deployment credentials. Those settings must be confirmed in the repository's GitHub Pages administration screen before changing `base`, routing fallbacks, or domains.
