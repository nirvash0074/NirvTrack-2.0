/**
 * NirvTrack 2.0 Serverless Edge Gateway
 * Powered by Cloudflare Workers with Static Assets
 */
export default {
  async fetch(request, env) {
    // Forward all requests to Cloudflare static asset pipeline (HTML, CSS, JS, manifest)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response('NirvTrack 2.0 Workstation Ready', { status: 200 });
  }
};
