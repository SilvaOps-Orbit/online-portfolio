# CounterAPI gateway

This small Cloudflare Worker keeps the CounterAPI V2 token out of the public portfolio. The browser can increment or read one fixed counter; it cannot choose a workspace, counter name, upstream URL, or credential.

The GitHub deployment workflow maps the repository secret named `CounterAPI` to the encrypted Worker secret `COUNTERAPI_TOKEN`. The token is never written to a generated JSON file or browser bundle.

Before the first deployment, add these repository secrets as well:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The configured CounterAPI workspace slug is `web-portfolio-tracker` (display name: `web portfolio tracker`) and the counter name is `page-views`. Workspace slugs are case-sensitive and URL-encoded by the Worker.

The gateway is still a public raw page-load counter and can be intentionally inflated. Cloudflare D1 remains the portfolio's primary anonymous aggregate source.
