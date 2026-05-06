const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(require('cors')());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g, /sk-[a-zA-Z0-9]{32,}/g, /ghp_[a-zA-Z0-9]{36}/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
];
function shield(data) {
  let s = data;
  for (const p of SECRET_PATTERNS) s = s.replace(p, '[REDACTED]');
  return s;
}

async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data } = await supabase.from('auth_tokens').select('*').eq('token', token).single();
  return data;
}

// Health
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// GitHub OAuth
app.get('/api/auth-github', (_, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.SERVER_URL}/api/auth-callback`,
    scope: 'read:user',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/api/auth-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
    });
    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const ghUser = await userRes.json();
    const userId = `gh_${ghUser.id}`;
    await supabase.from('users').upsert({ id: userId, github_id: String(ghUser.id), username: ghUser.login, avatar_url: ghUser.avatar_url });
    const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('user_id', userId).single();
    if (!existingSub) {
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 7);
      await supabase.from('subscriptions').insert({ id: `sub_${userId}`, user_id: userId, plan: 'trial', status: 'active', trial_ends_at: trialEnd.toISOString() });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await supabase.from('auth_tokens').upsert({ token, user_id: userId, username: ghUser.login, avatar_url: ghUser.avatar_url });
    res.redirect(`${process.env.FRONTEND_URL}/?token=${token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
  } catch (err) { console.error(err); res.status(500).send('Auth failed'); }
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

// Stats
app.get('/api/stats', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { data: sessions } = await supabase.from('sessions').select('start_time,end_time,peak_viewers').eq('user_id', user.user_id);
  res.json({
    totalSessions: sessions?.length ?? 0,
    totalMinutes: sessions?.reduce((a, s) => s.end_time ? a + Math.floor((new Date(s.end_time) - new Date(s.start_time)) / 60000) : a, 0) ?? 0,
    totalViewers: sessions?.reduce((a, s) => a + (s.peak_viewers ?? 0), 0) ?? 0,
  });
});

// Sessions
app.get('/api/sessions', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { data } = await supabase.from('sessions').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false });
  res.json(data ?? []);
});

app.post('/api/sessions', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const sessionId = crypto.randomBytes(4).toString('hex');
  const name = req.body?.name || `Session ${sessionId}`;
  await supabase.from('sessions').insert({ id: sessionId, user_id: user.user_id, name, status: 'active', start_time: new Date().toISOString() });
  res.json({ id: sessionId, name, viewerUrl: `${process.env.VIEWER_URL}/view/${sessionId}`, status: 'active' });
});

app.patch('/api/sessions/:id', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.body?.status === 'completed') {
    await supabase.from('sessions').update({ status: 'completed', end_time: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', user.user_id);
  }
  res.json({ success: true });
});

app.delete('/api/sessions/:id', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  await supabase.from('sessions').delete().eq('id', req.params.id).eq('user_id', user.user_id);
  res.json({ success: true });
});

// Subscription
app.get('/api/subscription', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.user_id).single();
  res.json(data ?? { plan: 'trial', status: 'active' });
});

// Stream push
app.post('/api/stream/push', async (req, res) => {
  const { session_id, data } = req.body;
  if (!session_id || !data) return res.status(400).json({ error: 'Missing fields' });
  const sanitized = shield(data);
  await supabase.from('session_buffer').insert({ session_id, chunk: sanitized });
  await supabase.channel(`session:${session_id}`).send({ type: 'broadcast', event: 'terminal_data', payload: { data: sanitized } });
  res.json({ ok: true });
});

// Rewind
app.get('/api/stream/rewind', async (req, res) => {
  const { session_id } = req.query;
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase.from('session_buffer').select('chunk,created_at').eq('session_id', session_id).gte('created_at', since).order('created_at');
  res.json(data ?? []);
});

// Stripe
app.post('/api/billing/create-checkout', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const priceId = req.body?.plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_BASIC_PRICE_ID;
  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/?billing=cancelled`,
    metadata: { userId: user.user_id },
  });
  res.json({ url: session.url });
});

app.post('/api/billing/webhook', async (req, res) => {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.metadata?.userId) await supabase.from('subscriptions').upsert({ id: s.subscription, user_id: s.metadata.userId, stripe_customer_id: s.customer, stripe_subscription_id: s.subscription, plan: 'basic', status: 'active' });
    }
    if (event.type === 'customer.subscription.deleted') {
      const s = event.data.object;
      await supabase.from('subscriptions').update({ status: 'cancelled', plan: 'trial' }).eq('stripe_subscription_id', s.id);
    }
    res.json({ received: true });
  } catch (err) { res.status(400).send('Webhook error'); }
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`tty.live running on port ${PORT}`));
