// Google sign-in via Supabase Auth.
// The publishable key is safe to ship in browser code; access is controlled by Supabase.
(() => {
  'use strict';

  const SUPABASE_URL = 'https://cgjqyuyobcgkavdjqtdh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_P58ip-diVZaPIHUJTqH25Q_PwQpnSx2';

  const $ = (id) => document.getElementById(id);
  const el = {
    login: $('login'), logout: $('logout'), profile: $('profile'),
    avatar: $('avatar'), fallback: $('avatar-fallback'), name: $('user-name'), auth: $('auth'),
  };

  if (!window.supabase) {
    // Supabase library failed to load (offline/blocked); the game still works without login.
    showError('Sign-in unavailable');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  });

  function showError(text) {
    let span = document.querySelector('.auth-error');
    if (!span) {
      span = document.createElement('span');
      span.className = 'auth-error';
      el.auth.appendChild(span);
    }
    span.textContent = text;
  }

  function render(user) {
    el.login.classList.toggle('hidden', !!user);
    el.profile.classList.toggle('hidden', !user);
    if (!user) return;

    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || user.email || 'Player';
    el.name.textContent = fullName.split(' ')[0];
    el.profile.title = `Signed in as ${fullName}${user.email ? ` (${user.email})` : ''}`;

    const picture = meta.avatar_url || meta.picture;
    el.fallback.textContent = fullName.trim().charAt(0).toUpperCase();
    if (picture) {
      el.avatar.src = picture;
      el.avatar.alt = fullName;
      el.avatar.classList.remove('hidden');
      el.fallback.classList.add('hidden');
    } else {
      el.avatar.classList.add('hidden');
      el.fallback.classList.remove('hidden');
    }
  }

  // If the profile picture can't load, show the initial instead.
  el.avatar.addEventListener('error', () => {
    el.avatar.classList.add('hidden');
    el.fallback.classList.remove('hidden');
  });

  el.login.addEventListener('click', async () => {
    el.login.disabled = true;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      console.error(error);
      showError('Sign-in failed. Please try again.');
      el.login.disabled = false;
    }
  });

  el.logout.addEventListener('click', async () => {
    await client.auth.signOut();
    render(null);
  });

  client.auth.onAuthStateChange((_event, session) => {
    render(session ? session.user : null);
    // Remove the ?code=... left in the address bar after the Google redirect.
    if (session && new URLSearchParams(location.search).has('code')) {
      history.replaceState(null, '', location.pathname);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error(error);
      showError('Sign-in failed. Please try again.');
    }
    render(data && data.session ? data.session.user : null);
  });
})();
