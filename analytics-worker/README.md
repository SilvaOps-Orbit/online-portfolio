# Anonymous portfolio analytics

This Worker powers the React and TypeScript audience panel in **For the Nerds**. D1 counts anonymous browsers, one qualifying view per browser each UTC day, coarse browser/device categories, Easter egg finders, and full Technical Achievement Vault completions.

It does **not** store raw IP addresses, full user-agent strings, cookies, names, email addresses, or the raw browser identifier. The browser creates a random local ID; the Worker combines it with the private `ANALYTICS_PEPPER` secret and stores only the resulting SHA-256 hash.

> Existing Worker safeguard: the live `silvaops-api` Worker currently uses a separately created D1 schema and returns `{ views, easter_eggs }`. The portfolio client supports that response directly. Do not run this folder's schema or deploy this richer Worker over the live service until the existing D1 tables have been compared and backed up.

## First setup

From PowerShell inside `analytics-worker`:

```powershell
npm install
npx wrangler login
npx wrangler d1 create echoops-portfolio-analytics
```

Copy the returned `database_id` into `wrangler.jsonc`, replacing the all-zero placeholder. Then initialise the remote database:

```powershell
npm run db:init
```

Generate a private pepper and add it as an encrypted Worker secret:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npx wrangler secret put ANALYTICS_PEPPER
```

Paste the generated value only into the Wrangler secret prompt. Never put it in this repository. Deploy the Worker:

```powershell
npm run deploy
```

When upgrading an existing analytics database from the original three achievements to the Snake-enabled four-achievement vault, run this once before deploying:

```powershell
npm run db:migrate
```

Fresh databases created with `npm run db:init` already include Snake and do not need that migration.

## Connect the portfolio

1. Copy the deployed HTTPS Worker URL into `analytics.endpoint` in `portfolio.config.js`.
2. Add that exact Worker origin to `connect-src` in both the CSP meta tag in `index.html` and the CSP line in `_headers`.
3. Rebuild with `npm run build:react`, then deploy the portfolio normally.

The allowed production origin is already set to `https://silvaops-orbit.github.io`. Localhost origins are accepted for development. The browser calls `/api/track`, `/api/easter-egg`, and `/api/stats` without a secret; the Worker validates the origin and accesses D1 through its private binding. The previous `/api/view` and `/api/achievement` routes remain as compatibility aliases.

Never put an `X-API-Key`, Cloudflare token, or Worker secret in `portfolio.config.js` or browser JavaScript. Browser-delivered values are visible in DevTools. If one has been published or shared, rotate it before deploying this Worker.

## Accuracy and abuse limits

“Unique browsers” is intentionally more accurate than saying “individual people”. One person using multiple browsers/devices, private browsing, or cleared storage can be counted more than once. One browser used by multiple people can be counted once. The endpoint validates payloads, restricts origins, stores aggregate-safe fields, and deduplicates daily views, but public analytics can still be spammed. Cloudflare rate limiting can be added later if abuse appears.

Cloudflare references: [D1 bindings](https://developers.cloudflare.com/d1/get-started/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
