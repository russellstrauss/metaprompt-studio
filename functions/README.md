# Reference: host project API

This folder is **not** deployed with Metaprompt Studio. The Studio app builds to `dist/` and is typically embedded in another project (e.g. a portfolio) that serves it from a relative path.

The **host project** (the one that serves the Studio `dist/` and is deployed, e.g. to Cloudflare Pages) must provide the Gemini optimize API so the app can work without a client-side API key:

1. **Copy** `api/optimize-prompt.js` (and keep the path `api/optimize-prompt.js` under your project’s `functions/` directory if you use Cloudflare Pages).
2. In the **host** project’s environment (e.g. Cloudflare Pages → Settings → Environment variables), set **`GEMINI_API_KEY`** (encrypted is fine). That project’s runtime will have access to it when the Function runs.
3. The Studio app, when it has no API key in the browser, will call `/api/optimize-prompt` on the **same origin** (the host’s origin). If your host exposes the API at a different path, set **`window.__RUNTIME_CONFIG__.OPTIMIZE_PROXY_URL`** before the app loads (e.g. to `'/api/metaprompt/optimize'`).

The request/response contract: `POST` body `{ summary, developerTemplate, model }`, response `{ prompt }` or `{ error }`.
