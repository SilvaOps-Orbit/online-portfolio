# Interactive Portfolio

A secure, dependency-light personal portfolio built with plain HTML, CSS, and JavaScript.

## Personalize it

Edit `portfolio.config.js`:

- Replace `Your Name`, `YN`, and the summary with your real details.
- Set `githubUsername` to your GitHub username to show live public repositories.
- Set `discordUrl` to a public Discord profile or server link.
- Add real project links under `projects`.
- Add your Steam profile, current games, wishlist, most played games, and achievements under `steam`.
- Add `linkedinUrl` and `resumeUrl` when you have them.

## Steam stats

The Steam section can refresh during GitHub Pages deployment without exposing your Steam API key.

1. Create a Steam Web API key.
2. In GitHub, open this repo -> Settings -> Secrets and variables -> Actions.
3. Add repository secret `STEAM_API_KEY`.
4. Optionally add repository variable `STEAMDB_ACCOUNT_VALUE` for the account value shown beside the SteamDB link.

Steam data is generated into `data/steam.json` by `.github/workflows/pages.yml` on push, manual dispatch, and a daily schedule. SteamDB account value is not scraped because SteamDB does not provide a stable public API for that calculator value.

## GitHub Pages

This repo includes `.github/workflows/pages.yml`. After you push it to GitHub:

1. Open the repository on GitHub.
2. Go to Settings -> Pages.
3. Set Source to GitHub Actions.
4. Push to `main`; the workflow deploys the site.

## Security notes

- No npm dependencies are required.
- No secrets or GitHub tokens are used in browser code.
- GitHub repository data comes from the public GitHub API.
- Dynamic data is rendered with DOM APIs and `textContent`.
- A restrictive CSP is included in `index.html`.
- `_headers` is included for hosts that support custom security headers, such as Netlify or Cloudflare Pages.

GitHub Pages does not let projects set custom HTTP security headers. The in-page CSP still helps, but use Netlify, Cloudflare Pages, or another host if you need full response headers.
