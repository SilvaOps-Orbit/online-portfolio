# Interactive Portfolio

A secure, dependency-light personal portfolio built with plain HTML, CSS, and JavaScript.

## Personalize it

Edit `portfolio.config.js`:

- Replace `Your Name`, `YN`, and the summary with your real details.
- Set `githubUsername` to your GitHub username to show live public repositories.
- Set `discordUrl` to a public Discord profile or server link.
- Add real project links under `projects`.
- Add your Steam profile, current games, most played games, achievements, and 100% games under `steam`.
- Set `steam.accountValue.value` to the manual account value you want displayed.
- Add Spotify fallback text under `spotify`.
- Add `linkedinUrl` and `resumeUrl` when you have them.

## Steam stats

The Steam section can refresh during GitHub Pages deployment without exposing your Steam API key.

1. Create a Steam Web API key.
2. In GitHub, open this repo -> Settings -> Secrets and variables -> Actions.
3. Add repository secret `STEAM_API_KEY`.
4. Optionally add repository variable `STEAM_ACCOUNT_VALUE` if you want the deploy script to write a manual account value into `data/steam.json`.

Steam data is generated into `data/steam.json` by `.github/workflows/pages.yml` on push, manual dispatch, and a daily schedule. The site prefers the manual value in `portfolio.config.js`, so you can edit it directly without depending on SteamDB.

The deploy script now keeps the last successful Steam values when a refresh fails. SteamDB is linked as a reference, but it is not scraped.

The Steam Store Radar uses Steam's public featured categories feed to show sales, top sellers, new releases, and coming soon games in a single animated ticker. The faster Steam activity workflow also refreshes/preserves that ticker data.

The Pre-Order / Top 20 Games Watch card uses the same Steam Store feed. It randomizes coming-soon/pre-order entries with Steam's current top 20 sellers, links directly to the store page, and enriches the card with price and edition data when Steam exposes it.

## Spotify stats

Spotify data is generated into `data/spotify.json` by GitHub Actions so API credentials never run in the browser.

1. Create a Spotify app in the Spotify Developer Dashboard.
2. Add `http://127.0.0.1:3000` as a redirect URI in the Spotify app settings.
3. Run the local authorization helper:
   ```powershell
   cd "C:\Users\Alvis ICT\Desktop\resume website github"
   $env:SPOTIFY_CLIENT_ID="your-client-id"
   $env:SPOTIFY_CLIENT_SECRET="your-client-secret"
   .\scripts\spotify-local-auth.ps1
   ```
4. Approve Spotify in the browser. The helper catches the redirect locally and prints `SPOTIFY_REFRESH_TOKEN`.
5. Add repository secrets:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`

If you prefer the manual setup, create the authorization URL:

   ```powershell
   cd "C:\Users\Alvis ICT\Desktop\resume website github"
   $env:SPOTIFY_CLIENT_ID="your-client-id"
   .\scripts\spotify-auth-url.ps1
   ```
After approving, the browser may show `127.0.0.1 refused to connect`; that is okay. Copy the `code` value from the address bar and exchange it:

   ```powershell
   cd "C:\Users\Alvis ICT\Desktop\resume website github"
   $env:SPOTIFY_CLIENT_ID="your-client-id"
   $env:SPOTIFY_CLIENT_SECRET="your-client-secret"
   $env:SPOTIFY_AUTH_CODE="the-code-from-the-url"
   .\scripts\spotify-refresh-token.ps1
   ```

If PowerShell blocks the helper scripts, run them with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\spotify-local-auth.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\spotify-refresh-token.ps1
```

The requested scopes are `user-read-currently-playing user-read-playback-state playlist-read-private`. Spotify currently documents refresh tokens as lasting 6 months, so if the workflow starts reporting `invalid_grant`, repeat the authorization steps and replace `SPOTIFY_REFRESH_TOKEN`.

If the scope list changes, run `spotify-local-auth.ps1` again and replace `SPOTIFY_REFRESH_TOKEN` because old refresh tokens do not automatically gain new permissions.

The main Pages workflow refreshes Spotify data on deploy. `.github/workflows/spotify.yml` also runs every 5 minutes to keep Spotify closer to live. The browser checks `data/spotify.json` every few seconds, but on GitHub Pages the song can only change after that workflow generates and deploys a new JSON file.

Steam activity has its own `.github/workflows/steam.yml` workflow that runs every 5 minutes. It preserves the heavier Steam stats from the last full deploy and only refreshes the active/recently played game card.

On page startup, the browser preloads `data/steam.json` and `data/spotify.json` before revealing the site. If either generated data file is missing or slow, the page falls back to `portfolio.config.js` so it still opens without exposing API secrets.

### Music enrichment

Genius and TheAudioDB facts are generated in GitHub Actions, not in the browser.

For Genius, add this repository secret in GitHub -> Settings -> Secrets and variables -> Actions:

- `GENIUS_ACCESS_TOKEN` - used for Genius song and artist facts.

If Genius asks for a redirect URL while creating the app, use:

```text
http://127.0.0.1:8888/callback
```

TheAudioDB v1 uses the free key `123` by default:

```text
https://www.theaudiodb.com/api/v1/json/123/search.php?s=coldplay
```

No GitHub secret is required for the free key. If you ever upgrade, add your premium key as `AUDIODB_API_KEY` and the workflow will use it automatically.

Only sanitized facts, Genius source links, artwork URLs, and a source audit are published to `data/spotify.json`. The published song and artist facts are mixed from Spotify, Genius, and TheAudioDB when they match, while the audit records which source was used for playback, progress, artwork, facts, and links.

## Market and news data

The markets and news sections are generated into `data/market.json` and `data/news.json` by GitHub Actions. The browser only reads those JSON files.

1. Create or copy your Finnhub API key from the Finnhub dashboard.
2. In GitHub, open this repo -> Settings -> Secrets and variables -> Actions.
3. Add repository secret `FINNHUB_API_KEY`.

The stock watchlist uses Finnhub as the keyed quote source and `yfinance` as the Yahoo Finance cross-reference/fallback. `yfinance` also publishes one week of closing prices so each stock card can draw a compact chart, with the S&P 500 card shown as the larger market baseline. The Finance news row also uses Finnhub's market news API. GitHub Actions installs `yfinance` during the market/news workflow, so no Yahoo key is exposed in the site.

`.github/workflows/market-news.yml` refreshes market and news data hourly. The news feed is split into Breaking Worldwide, Gaming, Finance, and Australia rows, with three visible cards at a time and a conveyor animation showing more articles. Breaking worldwide headlines are English-only and tagged with an inferred affected country/region, plus a conflict tag when the headline/snippet appears war-related. RSS fallbacks are displayed by publisher name, such as ABC News or IGN, and article photos are shown when a feed/API provides a safe image URL.

Optional RSS overrides can be added as workflow environment variables:

```text
NEWS_GAMING_RSS=http://feeds.ign.com/ign/all
NEWS_GAMING_RSS=https://pcgamer.com
NEWS_GAMING_RSS=
NEWS_AUSTRALIA_RSS=https://feeds.abcnews.com/abcnews/politicsheadlines
```

Finance signals are educational research prompts only. They are not personal financial advice or automated trading instructions.

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
# my-portfolio-template
# my-portfolio-template
