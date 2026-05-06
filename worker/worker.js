import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
];

function shield(data) {
  let s = data;
  for (const p of SECRET_PATTERNS) s = s.replace(p, '[REDACTED]');
  return s;
}

async function getUser(request, supabase) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data } = await supabase.from('auth_tokens').select('*').eq('token', token).single();
  return data;
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Health
    if (path === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // GitHub OAuth - redirect to GitHub
    if (path === '/api/auth-github') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${env.SERVER_URL}/api/auth-callback`,
        scope: 'read:user',
      });
      return redirect(`https://github.com/login/oauth/authorize?${params}`);
    }

    // GitHub OAuth - callback
    if (path === '/api/auth-callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Missing code', { status: 400 });
      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
        });
        const tokenData = await tokenRes.json();
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const ghUser = await userRes.json();
        const userId = `gh_${ghUser.id}`;

        await supabase.from('users').upsert({ id: userId, github_id: String(ghUser.id), username: ghUser.login, avatar_url: ghUser.avatar_url });

        const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('user_id', userId).single();
        if (!existingSub) {
          const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 7);
          await supabase.from('subscriptions').insert({ id: `sub_${userId}`, user_id: userId, plan: 'trial', status: 'active', trial_ends_at: trialEnd.toISOString() });
        }

        const token = randomHex(32);
        await supabase.from('auth_tokens').upsert({ token, user_id: userId, username: ghUser.login, avatar_url: ghUser.avatar_url });
        return redirect(`${env.FRONTEND_URL}/?token=${token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
      } catch (err) {
        return new Response('Auth failed: ' + err.message, { status: 500 });
      }
    }

    // Stats
    if (path === '/api/stats' && request.method === 'GET') {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: sessions } = await supabase.from('sessions').select('start_time,end_time,peak_viewers').eq('user_id', user.user_id);
      return json({
        totalSessions: sessions?.length ?? 0,
        totalMinutes: sessions?.reduce((a, s) => s.end_time ? a + Math.floor((new Date(s.end_time) - new Date(s.start_time)) / 60000) : a, 0) ?? 0,
        totalViewers: sessions?.reduce((a, s) => a + (s.peak_viewers ?? 0), 0) ?? 0,
      });
    }

    // Sessions list
    if (path === '/api/sessions' && request.method === 'GET') {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data } = await supabase.from('sessions').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false });
      return json(data ?? []);
    }

    // Start session
    if (path === '/api/sessions' && request.method === 'POST') {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const sessionId = randomHex(4);
      const name = body.name || `Session ${sessionId}`;
      await supabase.from('sessions').insert({ id: sessionId, user_id: user.user_id, name, status: 'active', start_time: new Date().toISOString() });
      return json({ id: sessionId, name, viewerUrl: `${env.VIEWER_URL}/view/${sessionId}`, status: 'active' });
    }

    // Update/delete session
    const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const sessionId = sessionMatch[1];
      if (request.method === 'DELETE') {
        await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', user.user_id);
        return json({ success: true });
      }
      if (request.method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        if (body.status === 'completed') {
          await supabase.from('sessions').update({ status: 'completed', end_time: new Date().toISOString() }).eq('id', sessionId).eq('user_id', user.user_id);
          await supabase.channel(`session:${sessionId}`).send({ type: 'broadcast', event: 'session_stopped', payload: { duration: 0 } });
        }
        return json({ success: true });
      }
    }

    // Subscription
    if (path === '/api/subscription') {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.user_id).single();
      return json(data ?? { plan: 'trial', status: 'active' });
    }

    // Stream push
    if (path === '/api/stream/push' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { session_id, data } = body;
      if (!session_id || !data) return json({ error: 'Missing fields' }, 400);
      const sanitized = shield(data);
      await supabase.from('session_buffer').insert({ session_id, chunk: sanitized });
      await supabase.channel(`session:${session_id}`).send({ type: 'broadcast', event: 'terminal_data', payload: { data: sanitized } });
      return json({ ok: true });
    }

    // Rewind
    if (path === '/api/stream/rewind') {
      const session_id = url.searchParams.get('session_id');
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase.from('session_buffer').select('chunk,created_at').eq('session_id', session_id).gte('created_at', since).order('created_at');
      return json(data ?? []);
    }

    // Stripe checkout
    if (path === '/api/billing/create-checkout' && request.method === 'POST') {
      const user = await getUser(request, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const priceId = body.plan === 'pro' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_BASIC_PRICE_ID;
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'subscription',
          'payment_method_types[]': 'card',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          success_url: `${env.FRONTEND_URL}/?billing=success`,
          cancel_url: `${env.FRONTEND_URL}/?billing=cancelled`,
          'metadata[userId]': user.user_id,
        }),
      });
      const session = await stripeRes.json();
      return json({ url: session.url });
    }

    return json({ error: 'Not found' }, 404);
  }
};
