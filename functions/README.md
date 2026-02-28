# Reference: host project API

This folder is **not** deployed with Metaprompt Studio. The Studio app builds to `dist/` and is typically embedded in another project (e.g. a portfolio) that serves it from a relative path.

**The API key is never in the build.** For production, the app fetches it at runtime from a config endpoint that reads your existing env var.

## Production: config endpoint (required)

1. **Copy** `api/metaprompt-config.js` into your **host** project as `functions/api/metaprompt-config.js` (same path).
2. In the host’s Cloudflare Pages → **Settings → Environment variables**, set **`GEMINI_API_KEY`** (encrypted is fine).
3. Deploy from source so `functions/` is deployed. The app will call `GET /api/metaprompt-config` and receive `{ GEMINI_API_KEY: "..." }` from your env. No key is in the build or in git.

That is the only change needed. The app uses that key to call Gemini directly from the client.

## Optional: proxy instead of config

If you prefer the key to stay entirely server-side, you can instead add `api/optimize-prompt.js` as a **proxy**: the app sends the prompt to your Function, which calls Gemini with `context.env.GEMINI_API_KEY` and returns the result. Then the client never sees the key. Contract: `POST` body `{ summary, developerTemplate, model }`, response `{ prompt }` or `{ error }`. If you use a different path, set `window.__RUNTIME_CONFIG__.OPTIMIZE_PROXY_URL` before the app loads.

## Security

**Never commit your Gemini/Google API key.** Use only your host’s environment variables. Do not put the key in committed files or in the build. If a key was ever committed, rotate it immediately in [Google AI Studio](https://aistudio.google.com).
