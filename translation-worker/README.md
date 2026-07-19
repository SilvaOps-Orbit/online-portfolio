# Site translation gateway

This small Cloudflare Worker keeps the RapidAPI key out of GitHub Pages. It accepts an allowlisted batch of public page text at `POST /api/translate`, calls the configured RapidAPI translator, and caches successful translations at the edge.

The browser never receives `RAPIDAPI_KEY`. Do not add that value to `portfolio.config.js`, a workflow variable, or any browser JavaScript.

## Deploy

```powershell
cd translation-worker
npm install
npx wrangler login
npx wrangler secret put RAPIDAPI_KEY
npm run check
npm run deploy
```

The portfolio is configured for `https://echoops-translation-gateway.alvis-dev.workers.dev`. The same origin is allowlisted in `connect-src` in `index.html` and `_headers`.

## GitHub Actions deployment

The `Deploy Translation Worker` workflow maps the repository secret `X_RAPIDAPI_KEY` to the Worker's private `RAPIDAPI_KEY` binding. It also needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. The secret value is never written to the generated site or workflow logs.

The free translator plan is described as personal/educational use only by its provider. Check the current RapidAPI plan before using the portfolio commercially.
