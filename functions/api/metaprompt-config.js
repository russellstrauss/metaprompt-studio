/**
 * Reference: host project config endpoint.
 * Copy to your host repo as functions/api/metaprompt-config.js.
 * GET returns { GEMINI_API_KEY } from the same env var you set in Cloudflare Pages.
 * The Studio app fetches this at runtime so the key is never in the build.
 */

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestGet(context) {
  const origin = context.request.headers.get('Origin') || '*'
  const key = (context.env.GEMINI_API_KEY || '').trim()
  return new Response(JSON.stringify({ GEMINI_API_KEY: key || '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
