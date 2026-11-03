// "My Profile" tab: signed-in players create and edit their profile (Supabase `profiles` table).
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    tabs: $('tabs'), tabPlay: $('tab-play'), tabProfile: $('tab-profile'),
    playView: $('play-view'), profileView: $('profile-view'),
    form: $('profile-form'), title: $('pf-title'), email: $('pf-email'), avatar: $('pf-avatar'),
    displayName: $('pf-display-name'), username: $('pf-username'), favoriteCard: $('pf-favorite-card'),
    bio: $('pf-bio'), bioCount: $('pf-bio-count'), save: $('pf-save'), status: $('pf-status'),
    dates: $('pf-dates'), greeting: $('profile'),
  };

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  let currentUser = null;
  let existing = null; // the saved profile row, or null if not created yet

  const auth = () => window.bjAuth;

  // ---------- Tabs ----------
  function showTab(name) {
    const profile = name === 'profile';
    el.tabPlay.classList.toggle('active', !profile);
    el.tabProfile.classList.toggle('active', profile);
    el.tabPlay.setAttribute('aria-selected', String(!profile));
    el.tabProfile.setAttribute('aria-selected', String(profile));
    el.playView.classList.toggle('hidden', profile);
    el.profileView.classList.toggle('hidden', !profile);
    if (profile) el.displayName.focus({ preventScroll: true });
  }
  el.tabPlay.addEventListener('click', () => showTab('play'));
  el.tabProfile.addEventListener('click', () => showTab('profile'));
  // Clicking the greeting in the header also opens the profile.
  el.greeting.querySelector('.greeting').addEventListener('click', () => showTab('profile'));

  // ---------- Form helpers ----------
  function setStatus(text, tone) {
    el.status.textContent = text;
    el.status.className = `form-status ${tone || ''}`;
  }

  function suggestUsername(user) {
    const base = (user.email || '').split('@')[0] || 'player';
    return base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 20).padEnd(3, '0');
  }

  function googlePicture(user) {
    const meta = user.user_metadata || {};
    return meta.avatar_url || meta.picture || '';
  }

  function fillForm() {
    const user = currentUser;
    const meta = user.user_metadata || {};
    const p = existing;
    el.title.textContent = p ? `@${p.username}` : 'Create your profile';
    el.email.textContent = user.email || '';
    el.save.textContent = p ? 'Save changes' : 'Create profile';
    el.displayName.value = p ? p.display_name : meta.full_name || meta.name || '';
    el.username.value = p ? p.username : suggestUsername(user);
    el.favoriteCard.value = p && p.favorite_card ? p.favorite_card : '';
    el.bio.value = p && p.bio ? p.bio : '';
    el.bioCount.textContent = el.bio.value.length;
    const pic = (p && p.avatar_url) || googlePicture(user);
    el.avatar.classList.toggle('hidden', !pic);
    if (pic) el.avatar.src = pic;
    el.dates.textContent = p
      ? `Member since ${new Date(p.created_at).toLocaleDateString()} · Last updated ${new Date(p.updated_at).toLocaleString()}`
      : '';
  }

  el.bio.addEventListener('input', () => (el.bioCount.textContent = el.bio.value.length));
  el.username.addEventListener('input', () => {
    el.username.value = el.username.value.toLowerCase().replace(/\s/g, '_');
  });
  el.avatar.addEventListener('error', () => el.avatar.classList.add('hidden'));

  // ---------- Load / save ----------
  async function loadProfile() {
    setStatus('Loading…');
    const { data, error } = await auth().client
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (error) {
      console.error(error);
      setStatus('Could not load your profile.', 'error');
      return;
    }
    setProfile(data);
    fillForm();
    setStatus(data ? '' : 'Welcome! Set up your player profile.');
  }

  function setProfile(p) {
    existing = p;
    auth().profile = p;
    document.dispatchEvent(new CustomEvent('bj:profile', { detail: { profile: p } }));
  }

  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const row = {
      id: currentUser.id,
      display_name: el.displayName.value.trim(),
      username: el.username.value.trim(),
      favorite_card: el.favoriteCard.value || null,
      bio: el.bio.value.trim() || null,
      avatar_url: (existing && existing.avatar_url) || googlePicture(currentUser) || null,
    };

    if (!row.display_name) return setStatus('Please enter a display name.', 'error');
    if (!USERNAME_RE.test(row.username)) {
      return setStatus('Username must be 3–20 lowercase letters, numbers, or underscores.', 'error');
    }

    el.save.disabled = true;
    setStatus('Saving…');
    const { data, error } = await auth().client
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    el.save.disabled = false;

    if (error) {
      console.error(error);
      if (error.code === '23505') return setStatus('That username is taken — try another.', 'error');
      return setStatus('Could not save your profile. Please try again.', 'error');
    }
    const created = !existing;
    setProfile(data);
    fillForm();
    setStatus(created ? 'Profile created!' : 'Profile saved!', 'success');
  });

  // ---------- React to sign-in / sign-out ----------
  function onAuth(user) {
    currentUser = user;
    el.tabs.classList.toggle('hidden', !currentUser);
    if (!currentUser) {
      existing = null;
      if (auth()) auth().profile = null;
      el.form.reset();
      setStatus('');
      showTab('play');
      return;
    }
    loadProfile();
  }

  document.addEventListener('bj:auth', (e) => onAuth(e.detail.user));
  // The session may have been restored before this script loaded.
  if (auth() && auth().user) onAuth(auth().user);
})();
