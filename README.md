# EchoOps Portfolio

This is my personal portfolio site. I built it with plain HTML, CSS, and JavaScript because I wanted it fast, easy to host, and not packed with random dependencies I do not need.

The main idea is simple: make the site feel alive with animation, Steam, Spotify, GitHub, market data, news, and security notes, while keeping API keys and private tokens out of the browser.

## What is in here

- Animated portfolio homepage with dark mode.
- Typewriter intro and interactive sections.
- Public GitHub repo feed.
- Steam profile, active/recent games, store radar, stats, and achievement-style sections.
- Spotify now-playing card, playlists, progress bar, and music facts.
- Genius and TheAudioDB enrichment for music details.
- Market watchlist for the S&P 500 plus tech/gaming stocks.
- Gaming, finance, Australian, and breaking news feeds.
- For the Nerds section showing security choices and unique features.
- GitHub Actions workflows that refresh data without exposing secrets.

## Main files

- `index.html` - page structure.
- `styles.css` - the look, layout, animations, and responsive styling.
- `app.js` - renders the interactive parts and loads JSON data.
- `portfolio.config.js` - fallback content and personal site settings.
- `data/*.json` - generated Steam, Spotify, market, and news data.
- `scripts/*.mjs` - data refresh scripts used by GitHub Actions.
- `.github/workflows/*.yml` - deploy and refresh workflows.
- `_headers` - security/cache headers for hosts that support them.

## Running it locally

From PowerShell:

```powershell
cd "C:\Users\Alvis ICT\Desktop\resume website github"
py -m http.server 8010 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8010
```

## Things I edit by hand

Most of the personal content lives in `portfolio.config.js`.

Useful things to update there:

- Name, alias, location, intro, and about text.
- GitHub username.
- Discord link.
- Project cards.
- Manual Steam account value.
- Fallback Steam/Spotify text.
- LinkedIn or resume links when I want to add them.
- Market/news fallback text if the APIs are down.

## Steam setup

Steam data is generated into `data/steam.json` so the public site can show Steam info without putting my Steam API key in browser code.

GitHub secret needed:

```text
STEAM_API_KEY
```

Optional GitHub variable:

```text
STEAM_ACCOUNT_VALUE
```

Notes for future me:

- `.github/workflows/steam.yml` refreshes active/recent Steam data.
- `data/steam.json` keeps the last good values if Steam breaks.
- SteamDB is linked as a reference, but the site does not scrape SteamDB.
- The Steam Store Radar uses Steam public store feeds for sales, top sellers, new releases, and coming soon games.

## Spotify setup

Spotify is handled through GitHub Actions so my client secret and refresh token stay private.

In the Spotify Developer Dashboard, add this redirect URI:

```text
http://127.0.0.1:3000
```

Then run the helper:

```powershell
cd "C:\Users\Alvis ICT\Desktop\resume website github"
$env:SPOTIFY_CLIENT_ID="your-client-id"
$env:SPOTIFY_CLIENT_SECRET="your-client-secret"
.\scripts\spotify-local-auth.ps1
```

After approving Spotify, add these GitHub secrets:

```text
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_REFRESH_TOKEN
```

If PowerShell blocks the script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\spotify-local-auth.ps1
```

Manual backup method:

```powershell
cd "C:\Users\Alvis ICT\Desktop\resume website github"
$env:SPOTIFY_CLIENT_ID="your-client-id"
.\scripts\spotify-auth-url.ps1
```

After approving, the browser might say `127.0.0.1 refused to connect`. That is fine. Copy the `code` from the address bar and exchange it:

```powershell
cd "C:\Users\Alvis ICT\Desktop\resume website github"
$env:SPOTIFY_CLIENT_ID="your-client-id"
$env:SPOTIFY_CLIENT_SECRET="your-client-secret"
$env:SPOTIFY_AUTH_CODE="the-code-from-the-url"
.\scripts\spotify-refresh-token.ps1
```

The scopes I use:

```text
user-read-currently-playing user-read-playback-state playlist-read-private
```

If Spotify starts saying `invalid_grant`, redo the auth flow and replace `SPOTIFY_REFRESH_TOKEN`.

## Music facts

The Spotify card can pull extra facts from Genius and TheAudioDB.

Genius secret:

```text
GENIUS_ACCESS_TOKEN
```

If Genius asks for a redirect URL:

```text
http://127.0.0.1:8888/callback
```

TheAudioDB uses the free v1 test key by default:

```text
https://www.theaudiodb.com/api/v1/json/123/search.php?s=coldplay
```

If I ever upgrade TheAudioDB, add:

```text
AUDIODB_API_KEY
```

Only cleaned-up facts, links, artwork URLs, and source labels get published to `data/spotify.json`.

## Markets and news

Market and news data are generated into:

```text
data/market.json
data/news.json
```

GitHub secret needed:

```text
FINNHUB_API_KEY
```

The market section uses:

- Finnhub for keyed quote/news data.
- `yfinance` as the Yahoo Finance cross-check/fallback.
- One-week charts for the S&P 500 and tech/gaming stocks.
- A rotating stock deck for the gaming/tech companies.
- AI-style research prompts for educational signals only.

The news section uses:

- NewsAPI.
- Mediastack.
- Finnhub finance news.
- RSS fallbacks.
- AU-focused Australian news.
- English-only breaking worldwide news.

Optional news secrets:

```text
NEWSAPI_KEY
NEWS_API_KEY
MEDIASTACK_API_KEY
MEDIASTACK_ACCESS_KEY
```

Optional RSS overrides:

```text
NEWS_BREAKING_WORLDWIDE_RSS=https://feeds.bbci.co.uk/news/world/rss.xml
NEWS_GAMING_RSS=http://feeds.ign.com/ign/all
NEWS_FINANCE_RSS=https://finance.yahoo.com/news/rssindex
NEWS_AUSTRALIA_RSS=https://feeds.abcnews.com/abcnews/politicsheadlines
```

Important note: GitHub Actions scheduled workflows cannot run every minute. The fastest schedule GitHub supports is every 5 minutes. The browser checks market data every minute, but the deployed JSON can only update after the workflow runs and GitHub Pages serves the new files.

Also, the market stuff is not financial advice. It is just research prompts and watchlist context.

## GitHub Pages deploy

This repo deploys through GitHub Actions.

On GitHub:

1. Open the repo.
2. Go to Settings -> Pages.
3. Set Source to GitHub Actions.
4. Push to `main`.

The main deploy workflow keeps deploys faster by preserving the last generated Steam, Spotify, market, and news JSON instead of regenerating every API feed every time I push a small visual change.

The browser also keeps a tiny last-good snapshot in `localStorage`. If GitHub Pages serves a temporary 404, empty fallback JSON, or placeholder data while Actions is queued, returning visitors still see the last useful Steam Store, RSS/news, market, and Spotify rows until the next good refresh lands.

## If the live API sections look broken

Check the JSON files first:

```text
data/steam.json
data/spotify.json
data/market.json
data/news.json
```

If they say `fallback`, `missing secrets`, or `not connected`, the page is doing what it was told and the generated data did not refresh properly.

Fast recovery steps:

1. Go to GitHub -> Actions.
2. Run `Refresh All Portfolio Data` manually.
3. Check that the needed secrets are set:

```text
STEAM_API_KEY
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_REFRESH_TOKEN
FINNHUB_API_KEY
NEWSAPI_KEY
MEDIASTACK_API_KEY
GENIUS_ACCESS_TOKEN
```

RSS, Steam Store, and yfinance can still work without private keys, but Spotify live listening and Steam active game detection need their secrets.

## Security choices

Stuff I want to keep doing right:

- No API secrets in browser JavaScript.
- No Discord bot tokens in the site.
- GitHub repo data only comes from the public GitHub API.
- Dynamic content is rendered with DOM APIs and `textContent`.
- Security headers live in `_headers` for hosts that support them.
- GitHub Pages does not support custom response headers for project pages, so the in-page CSP still helps, but a host like Netlify or Cloudflare Pages is better if I want full response headers.
- External links use safe attributes where needed.
- The site keeps fallback data so API failures do not make sections look broken.

## Quick reminder

When I change something and want it live:

```powershell
git status
git add .
git commit -m "Update portfolio"
git push
```

Then check the Actions tab on GitHub if the site takes a while to update.
