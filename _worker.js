/**
 * NirvTrack 2.0 Serverless Edge Gateway
 * Powered by Cloudflare Workers with Static Assets & PayMongo Integration
 * [FEAT-65 v2] End-to-End PayMongo Subscription & Webhook Fulfillment Pipeline
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-paymongo-signature',
  'Content-Type': 'application/json'
};

const DEFAULT_SUPABASE_URL = 'https://jftyzfdmlkagyhxbrqab.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHl6ZmRtbGthZ3loeGJycWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODk5NDEsImV4cCI6MjEwODI2NTk0MX0.ly8iWjUnECn60NAUZfzXr5arb7qYD69EXXV5B4NvN1U';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // 1. API: PayMongo Checkout Session Proxy
    if (path === '/api/paymongo-checkout' && request.method === 'POST') {
      return handlePayMongoCheckout(request, env, url);
    }

    // 2. API: PayMongo Webhook Endpoint
    if (path === '/api/paymongo-webhook' && request.method === 'POST') {
      return handlePayMongoWebhook(request, env);
    }

    // 3. API: PayMongo Status / Verification
    if (path === '/api/paymongo-verify' && (request.method === 'GET' || request.method === 'POST')) {
      return handlePayMongoVerify(request, env, url);
    }

    // 4. Default: Forward all requests to Cloudflare static asset pipeline (HTML, CSS, JS, manifest)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('NirvTrack 2.0 Workstation Ready', { status: 200 });
  }
};

/**
 * Handles PayMongo Checkout Session creation
 */
async function handlePayMongoCheckout(request, env, url) {
  try {
    const secretKey = (env && env.PAYMONGO_SECRET_KEY) || '';
    const body = await request.json().catch(() => ({}));
    const targetTier = (body.tier === 'executive') ? 'executive' : 'pro';
    const amountInCentavos = (targetTier === 'executive') ? 59900 : 19900;
    const tierName = (targetTier === 'executive') ? 'NirvTrack Executive Wealth Plan' : 'NirvTrack Budget Pro Plan';
    const description = (targetTier === 'executive')
      ? '30-Day Executive Access • Multi-Workspace & AI Copilot'
      : '30-Day Pro Access • 5 Workspaces & Cloud Sync';

    // If no secret key is set on the Cloudflare environment, tell client to use fallback link
    if (!secretKey) {
      return new Response(JSON.stringify({
        status: 'fallback',
        message: 'PAYMONGO_SECRET_KEY not configured in worker environment. Using fallback direct checkout.',
        fallback_link: (targetTier === 'executive')
          ? 'https://storefront.paymongo.com/nirvtrack-executive-plan'
          : 'https://storefront.paymongo.com/nirvtrack-pro-plan'
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const origin = url.origin;
    const successUrl = `${origin}/?payment=success&tier=${targetTier}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/?payment=cancelled`;

    const paymongoPayload = {
      data: {
        attributes: {
          billing: body.userEmail ? { email: body.userEmail } : undefined,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          payment_method_types: ['gcash', 'paymaya', 'card', 'qrph', 'billease'],
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              name: tierName,
              quantity: 1,
              description: description
            }
          ],
          description: description,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            user_id: body.userId || '',
            email: body.userEmail || '',
            tier: targetTier,
            source: 'nirvtrack_v2_edge'
          }
        }
      }
    };

    const authHeader = 'Basic ' + btoa(`${secretKey}:`);
    const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymongoPayload)
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok) {
      return new Response(JSON.stringify({
        status: 'error',
        error: pmData.errors || 'PayMongo API error',
        fallback_link: (targetTier === 'executive')
          ? 'https://storefront.paymongo.com/nirvtrack-executive-plan'
          : 'https://storefront.paymongo.com/nirvtrack-pro-plan'
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const checkoutUrl = pmData?.data?.attributes?.checkout_url;
    return new Response(JSON.stringify({
      status: 'success',
      checkout_url: checkoutUrl,
      session_id: pmData?.data?.id
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * Handles PayMongo Webhook events
 */
async function handlePayMongoWebhook(request, env) {
  try {
    const rawBody = await request.text();
    let event = null;
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const eventData = event?.data?.attributes?.data;
    const eventType = event?.data?.attributes?.type || '';

    let tier = 'pro';
    let userId = '';
    let userEmail = '';
    let amount = 0;

    if (eventData) {
      const attrs = eventData.attributes || {};
      const metadata = attrs.metadata || {};

      userId = metadata.user_id || '';
      userEmail = metadata.email || attrs.billing?.email || '';
      tier = metadata.tier || '';
      amount = attrs.amount || attrs.payments?.[0]?.attributes?.amount || 0;

      // Deduce tier from amount if not specified in metadata (amounts in centavos)
      if (!tier) {
        if (amount >= 50000) {
          tier = 'executive';
        } else if (amount >= 15000) {
          tier = 'pro';
        } else {
          tier = 'pro';
        }
      }
    }

    // Update Supabase if userId or userEmail is found
    const supabaseUrl = (env && env.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    const supabaseKey = (env && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) || DEFAULT_SUPABASE_ANON_KEY;

    let updatedUsers = 0;
    if (supabaseUrl && supabaseKey && (userId || userEmail)) {
      const nowIso = new Date().toISOString();
      const filter = userId
        ? `id=eq.${encodeURIComponent(userId)}`
        : `email=eq.${encodeURIComponent(userEmail.toLowerCase())}`;

      const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?${filter}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          tier: tier,
          updated_at: nowIso
        })
      });

      if (patchRes.ok) {
        const patchData = await patchRes.json().catch(() => []);
        updatedUsers = patchData.length;
      }
    }

    return new Response(JSON.stringify({
      received: true,
      event_type: eventType,
      tier: tier,
      user_id: userId,
      email: userEmail,
      updated_in_supabase: updatedUsers
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * Handles PayMongo Session Verification
 */
async function handlePayMongoVerify(request, env, url) {
  try {
    const sessionId = url.searchParams.get('session_id') || '';
    const secretKey = (env && env.PAYMONGO_SECRET_KEY) || '';

    if (!sessionId) {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'NirvTrack PayMongo Edge Verifier'
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (!secretKey) {
      return new Response(JSON.stringify({
        status: 'unverified',
        message: 'No secret key to query PayMongo session'
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const authHeader = 'Basic ' + btoa(`${secretKey}:`);
    const pmRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    const pmData = await pmRes.json();
    return new Response(JSON.stringify(pmData), {
      status: pmRes.status,
      headers: CORS_HEADERS
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
