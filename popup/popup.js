/* eslint-disable no-undef */
(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const els = {
    tabs: Array.from(document.querySelectorAll('.tab-btn')),
    panes: Array.from(document.querySelectorAll('.tab-pane')),
    streakValue: document.getElementById('streakValue'),
    lastVisit: document.getElementById('lastVisit'),
    monthLabel: document.getElementById('monthLabel'),
    calendarBody: document.getElementById('calendarBody'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    addSiteForm: document.getElementById('addSiteForm'),
    siteInput: document.getElementById('siteInput'),
    sitesList: document.getElementById('sitesList'),
    resetBtn: document.getElementById('resetBtn'),
    // Leaderboard
    leaderboardInfo: document.getElementById('leaderboardInfo'),
    leaderboardList: document.getElementById('leaderboardList'),
    refreshLeaderboardBtn: document.getElementById('refreshLeaderboardBtn'),
    // Account
    accountState: document.getElementById('accountState'),
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    signupForm: document.getElementById('signupForm'),
    suEmailInput: document.getElementById('suEmailInput'),
    suPasswordInput: document.getElementById('suPasswordInput'),
    logoutBtn: document.getElementById('logoutBtn')
  };

  let appState = {
    today: null,
    lastVisitDate: null,
    streakDays: null,
    customSites: [],
    visitHistory: [],
    viewMonthOffset: 0, // 0 = current month; -1 = prev; +1 = next
    // auth (Supabase)
    supabaseUrl: (window.EXT_CONFIG && window.EXT_CONFIG.SUPABASE_URL) || '',
    supabaseAnonKey: (window.EXT_CONFIG && window.EXT_CONFIG.SUPABASE_ANON_KEY) || '',
    accessToken: null,
    refreshToken: null,
    userId: null,
    userEmail: null
  };

  // -------- API helpers --------
  async function storageGet(keys) {
    return new Promise((resolve) => {
      api.storage.local.get(keys, (items) => resolve(items || {}));
    });
  }
  async function storageSet(items) {
    return new Promise((resolve) => {
      api.storage.local.set(items, () => resolve());
    });
  }
  // -------- Supabase REST helpers --------
  function ensureSupabaseConfig() {
    if (!appState.supabaseUrl || !appState.supabaseAnonKey) {
      throw new Error('Supabase not configured (popup/config.js)');
    }
  }
  async function sbSignup(email, password) {
    ensureSupabaseConfig();
    const resp = await fetch(`${appState.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': appState.supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    // Normalize possible shapes from GoTrue
    if (data && data.session && data.session.access_token) {
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user
      };
    }
    return data; // may or may not include tokens depending on email confirmation settings
  }
  async function sbLogin(email, password) {
    ensureSupabaseConfig();
    const resp = await fetch(`${appState.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': appState.supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error_description || data.error || `HTTP ${resp.status}`);
    return data; // { access_token, refresh_token, user }
  }
  async function sbUser(accessToken) {
    ensureSupabaseConfig();
    const resp = await fetch(`${appState.supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': appState.supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    return data; // { id, email, ... }
  }
  async function sbLeaderboard(accessToken) {
    ensureSupabaseConfig();
    // Expect a view 'leaderboard_view' with columns: name, detections
    const url = `${appState.supabaseUrl}/rest/v1/leaderboard_view?select=name,detections&order=detections.desc&limit=100`;
    const resp = await fetch(url, {
      headers: {
        'apikey': appState.supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    const data = await resp.json().catch(() => ([]));
    if (!resp.ok) throw new Error((data && data.message) || `HTTP ${resp.status}`);
    return data;
  }

  // Username helpers via PostgREST
  async function sbGetUsername(accessToken, userId) {
    ensureSupabaseConfig();
    const url = `${appState.supabaseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&select=username`;
    const resp = await fetch(url, {
      headers: {
        'apikey': appState.supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    const rows = await resp.json().catch(() => ([]));
    if (!resp.ok) throw new Error((rows && rows.message) || `HTTP ${resp.status}`);
    return rows.length ? rows[0].username : null;
  }
  async function sbSetUsername(accessToken, userId, username) {
    ensureSupabaseConfig();
    const resp = await fetch(`${appState.supabaseUrl}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': appState.supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([{ id: userId, username }])
    });
    const rows = await resp.json().catch(() => ([]));
    if (!resp.ok) throw new Error((rows && rows.message) || `HTTP ${resp.status}`);
    return rows[0]?.username || username;
  }

  function fmtDate(iso) {
    if (!iso) return '–';
    try {
      const d = new Date(iso + 'T00:00:00Z');
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return iso;
    }
  }

  // Check if error is JWT expiration and return user-friendly message
  function getJWTErrorMessage(error) {
    const msg = String(error?.message || error || '').toLowerCase();
    const isJWTError = 
      msg.includes('jwt') ||
      msg.includes('expired') ||
      msg.includes('token') && (msg.includes('invalid') || msg.includes('expired')) ||
      msg.includes('unauthorized') ||
      msg.includes('401') ||
      msg === 'http 401';
    return isJWTError ? 'Please login again' : error?.message || String(error || 'Unknown error');
  }

  async function getState() {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type: 'getState' }, (resp) => resolve(resp));
    });
  }

  async function addCustomSite(site) {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type: 'addCustomSite', site }, (resp) => resolve(resp));
    });
  }

  async function removeCustomSite(site) {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type: 'removeCustomSite', site }, (resp) => resolve(resp));
    });
  }

  async function resetStreak() {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type: 'resetStreak' }, (resp) => resolve(resp));
    });
  }

  function renderHeader() {
    if (appState.streakDays === null) {
      els.streakValue.textContent = '–';
    } else {
      els.streakValue.textContent = `${appState.streakDays} day${appState.streakDays === 1 ? '' : 's'} clean`;
    }
    els.lastVisit.textContent = `Last visit: ${appState.lastVisitDate ? fmtDate(appState.lastVisitDate) : 'Never'}`;
  }

  function getMonthInfo(offset) {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + offset);
    const year = base.getFullYear();
    const month = base.getMonth(); // 0..11
    const firstDayIdx = new Date(year, month, 1).getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const label = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { year, month, firstDayIdx, daysInMonth, label };
  }

  function renderCalendar() {
    const { label, firstDayIdx, daysInMonth, year, month } = getMonthInfo(appState.viewMonthOffset);
    els.monthLabel.textContent = label;
    els.calendarBody.innerHTML = '';

    const lastVisit = appState.lastVisitDate;
    const todayIso = appState.today;

    let day = 1;
    for (let row = 0; row < 6; row++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < 7; col++) {
        const td = document.createElement('td');
        if (row === 0 && col < firstDayIdx) {
          td.className = 'empty';
        } else if (day > daysInMonth) {
          td.className = 'empty';
        } else {
          const thisIso = toIso(year, month, day);
          td.className = 'day';
          td.textContent = String(day);

          // Style: broken = last visit; clean = after last visit up to today
          if (lastVisit && thisIso === lastVisit) {
            td.classList.add('broken');
          } else if (lastVisit && thisIso > lastVisit && thisIso <= todayIso) {
            td.classList.add('clean');
          }
          day++;
        }
        tr.appendChild(td);
      }
      els.calendarBody.appendChild(tr);
      if (day > daysInMonth) break;
    }
  }

  function toIso(year, monthZeroBased, day) {
    const m = (monthZeroBased + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  function renderSites() {
    els.sitesList.innerHTML = '';
    if (!appState.customSites || appState.customSites.length === 0) {
      const li = document.createElement('li');
      li.className = 'site-item';
      li.innerHTML = '<span class="site-host" style="color:#9ca3af">No custom sites added</span>';
      els.sitesList.appendChild(li);
      return;
    }
    for (const host of appState.customSites) {
      const li = document.createElement('li');
      li.className = 'site-item';
      const span = document.createElement('span');
      span.className = 'site-host';
      span.textContent = host;
      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.textContent = 'Remove';
      btn.addEventListener('click', async () => {
        await removeCustomSite(host);
        await refresh();
      });
      li.appendChild(span);
      li.appendChild(btn);
      els.sitesList.appendChild(li);
    }
  }

  async function refresh() {
    const state = await getState();
    appState.today = state.today;
    appState.lastVisitDate = state.lastVisitDate;
    appState.streakDays = state.streakDays ?? null;
    appState.customSites = state.customSites || [];
    appState.visitHistory = state.visitHistory || [];
    renderHeader();
    renderCalendar();
    renderSites();
  }

  function setActiveTab(tabId) {
    els.tabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    els.panes.forEach((pane) => {
      pane.classList.toggle('hidden', pane.id !== tabId);
    });
  }

  function renderAccountState() {
    if (appState.accessToken && appState.userEmail) {
      els.accountState.textContent = `Logged in as ${appState.userEmail}`;
    } else {
      els.accountState.textContent = 'Not logged in';
    }
  }

  async function refreshUsernameUI() {
    const usernameState = document.getElementById('usernameState');
    if (appState.accessToken && appState.userId) {
      try {
        const uname = await sbGetUsername(appState.accessToken, appState.userId);
        usernameState.textContent = uname ? `Username: ${uname}` : 'No username set';
      } catch (e) {
        const errorMsg = getJWTErrorMessage(e);
        if (errorMsg === 'Please login again') {
          // Clear auth state on JWT expiration
          appState.accessToken = null;
          appState.refreshToken = null;
          appState.userId = null;
          appState.userEmail = null;
          await storageSet({ accessToken: null, refreshToken: null, userEmail: null, userId: null });
          renderAccountState();
        }
        usernameState.textContent = `Error fetching username: ${errorMsg}`;
      }
    } else {
      usernameState.textContent = 'No username set';
    }
  }

  async function refreshAuthFromStorage() {
    const data = await storageGet(['accessToken', 'refreshToken', 'userId', 'userEmail', 'supabaseUrl', 'supabaseAnonKey']);
    appState.accessToken = data.accessToken || null;
    appState.refreshToken = data.refreshToken || null;
    appState.userId = data.userId || null;
    appState.userEmail = data.userEmail || null;
    if (data.supabaseUrl) appState.supabaseUrl = data.supabaseUrl;
    if (data.supabaseAnonKey) appState.supabaseAnonKey = data.supabaseAnonKey;
    renderAccountState();
    await refreshUsernameUI();
  }

  async function updateLeaderboardUI() {
    els.leaderboardList.innerHTML = '';
    if (!appState.accessToken) {
      els.leaderboardInfo.textContent = 'Log in to see the leaderboard.';
      return;
    }
    try {
      els.leaderboardInfo.textContent = 'Loading...';
      const rows = await sbLeaderboard(appState.accessToken);
      els.leaderboardList.innerHTML = '';
      rows.forEach((row, idx) => {
        const li = document.createElement('li');
        const label = row.name || 'unknown';
        li.textContent = `${idx + 1}. ${label} — ${row.detections} detections`;
        els.leaderboardList.appendChild(li);
      });
      els.leaderboardInfo.textContent = '';
    } catch (e) {
      const errorMsg = getJWTErrorMessage(e);
      if (errorMsg === 'Please login again') {
        // Clear auth state on JWT expiration
        appState.accessToken = null;
        appState.refreshToken = null;
        appState.userId = null;
        appState.userEmail = null;
        await storageSet({ accessToken: null, refreshToken: null, userEmail: null, userId: null });
        renderAccountState();
      }
      els.leaderboardInfo.textContent = `Error: ${errorMsg}`;
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = (els.emailInput.value || '').trim();
    const password = (els.passwordInput.value || '').trim();
    if (!email || !password) return;
    try {
      const data = await sbLogin(email, password);
      appState.accessToken = data.access_token;
      appState.refreshToken = data.refresh_token;
      // Fetch user details
      const user = await sbUser(appState.accessToken);
      appState.userId = user.id;
      appState.userEmail = user.email || email;
      await storageSet({
        accessToken: appState.accessToken,
        refreshToken: appState.refreshToken,
        userId: appState.userId,
        userEmail: appState.userEmail,
        supabaseUrl: appState.supabaseUrl,
        supabaseAnonKey: appState.supabaseAnonKey
      });
      renderAccountState();
      await updateLeaderboardUI();
      await refreshUsernameUI();
      els.emailInput.value = '';
      els.passwordInput.value = '';
    } catch (err) {
      const msg = String(err && err.message ? err.message : 'Unknown error');
      const hint = /confirm/i.test(msg) ? '\nHint: Disable email confirmations in Supabase Auth settings, or confirm your email.' : '';
      alert(`Login failed: ${msg}${hint}`);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    const email = (els.suEmailInput.value || '').trim();
    const password = (els.suPasswordInput.value || '').trim();
    if (!email || !password) return;
    try {
      const signupData = await sbSignup(email, password);
      // If signup returns tokens (email verification disabled), auto-login
      if (signupData.access_token) {
        appState.accessToken = signupData.access_token;
        appState.refreshToken = signupData.refresh_token;
        const user = await sbUser(appState.accessToken);
        appState.userId = user.id;
        appState.userEmail = user.email;
        await storageSet({
          accessToken: appState.accessToken,
          refreshToken: appState.refreshToken,
          userId: appState.userId,
          userEmail: appState.userEmail,
          supabaseUrl: appState.supabaseUrl,
          supabaseAnonKey: appState.supabaseAnonKey
        });
        renderAccountState();
        await updateLeaderboardUI();
        await refreshUsernameUI();
        alert('Sign up successful! You are now logged in.');
      } else {
        alert('Sign up successful. Please log in.');
      }
      els.suEmailInput.value = '';
      els.suPasswordInput.value = '';
    } catch (err) {
      alert(`Signup failed: ${err.message}`);
    }
  }

  async function handleLogout() {
    appState.accessToken = null;
    appState.userEmail = null;
    appState.refreshToken = null;
    appState.userId = null;
    await storageSet({ accessToken: null, refreshToken: null, userEmail: null, userId: null });
    renderAccountState();
    await updateLeaderboardUI();
    await refreshUsernameUI();
  }

  function wireEvents() {
    els.tabs.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        setActiveTab(tab);
        if (tab === 'leaderboardTab') {
          updateLeaderboardUI();
        }
      });
    });
    els.prevMonth.addEventListener('click', () => {
      appState.viewMonthOffset -= 1;
      renderCalendar();
    });
    els.nextMonth.addEventListener('click', () => {
      appState.viewMonthOffset += 1;
      renderCalendar();
    });
    els.addSiteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = (els.siteInput.value || '').trim().toLowerCase();
      if (!value) return;
      els.siteInput.value = '';
      await addCustomSite(value);
      await refresh();
    });
    els.resetBtn.addEventListener('click', async () => {
      await resetStreak();
      await refresh();
    });
    els.loginForm.addEventListener('submit', handleLoginSubmit);
    els.signupForm.addEventListener('submit', handleSignupSubmit);
    els.logoutBtn.addEventListener('click', handleLogout);
    els.refreshLeaderboardBtn.addEventListener('click', updateLeaderboardUI);
    // Username save
    const usernameForm = document.getElementById('usernameForm');
    const usernameInput = document.getElementById('usernameInput');
    usernameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = (usernameInput.value || '').trim();
      if (!val || !appState.accessToken || !appState.userId) return;
      try {
        await sbSetUsername(appState.accessToken, appState.userId, val);
        await refreshUsernameUI();
        usernameInput.value = '';
        alert('Username saved.');
      } catch (err) {
        const errorMsg = getJWTErrorMessage(err);
        if (errorMsg === 'Please login again') {
          // Clear auth state on JWT expiration
          appState.accessToken = null;
          appState.refreshToken = null;
          appState.userId = null;
          appState.userEmail = null;
          await storageSet({ accessToken: null, refreshToken: null, userEmail: null, userId: null });
          renderAccountState();
          await refreshUsernameUI();
        }
        alert(`Save failed: ${errorMsg}`);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wireEvents();
    await refreshAuthFromStorage();
    await refresh();
  });
})();


