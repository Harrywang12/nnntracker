/* eslint-disable no-undef */
// Cross-browser API alias
const api = typeof browser !== 'undefined' ? browser : chrome;

// Minimal 1x1 transparent PNG for notifications (keeps package small and cross-browser)
const TINY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';

const STORAGE_KEYS = {
  lastVisitDate: 'lastVisitDate',
  customSites: 'customSites',
  visitHistory: 'visitHistory'
};

// Default detection keywords for adult content (substring match, case-insensitive)
const DEFAULT_KEYWORDS = [
  'porn',
  'xxx',
  'adult',
  'nsfw',
  'sex',
  'erotic'
];

// Dynamic rule ID bases for DNR
const RULE_IDS = {
  keywordBase: 1000,
  customBase: 2000
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toHostname(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeDomain(domainOrUrl) {
  const host = toHostname(domainOrUrl);
  if (host) return host;
  return String(domainOrUrl || '').toLowerCase().trim();
}

function storageGet(keys) {
  return new Promise((resolve) => {
    api.storage.local.get(keys, (items) => resolve(items || {}));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    api.storage.local.set(items, () => resolve());
  });
}

async function ensureInitialized() {
  const items = await storageGet([
    STORAGE_KEYS.lastVisitDate,
    STORAGE_KEYS.customSites,
    STORAGE_KEYS.visitHistory
  ]);
  const updates = {};
  if (!Array.isArray(items[STORAGE_KEYS.customSites])) {
    updates[STORAGE_KEYS.customSites] = [];
  }
  if (!Array.isArray(items[STORAGE_KEYS.visitHistory])) {
    updates[STORAGE_KEYS.visitHistory] = [];
  }
  // initialize dates as null if absent
  if (typeof items[STORAGE_KEYS.lastVisitDate] === 'undefined') {
    updates[STORAGE_KEYS.lastVisitDate] = null;
  }
  if (Object.keys(updates).length) {
    await storageSet(updates);
  }
}

function includesKeyword(hostname, keywords) {
  const lower = hostname.toLowerCase();
  return keywords.some((kw) => kw && lower.includes(String(kw).toLowerCase()));
}

function matchesCustomSites(hostname, customSites) {
  if (!Array.isArray(customSites) || customSites.length === 0) return false;
  const lower = hostname.toLowerCase();
  return customSites.some((site) => {
    const normalized = normalizeDomain(site);
    return normalized && lower.includes(normalized);
  });
}

async function isAdultUrl(urlString) {
  const hostname = toHostname(urlString);
  if (!hostname) return false;
  const items = await storageGet([STORAGE_KEYS.customSites]);
  const customSites = items[STORAGE_KEYS.customSites] || [];
  return includesKeyword(hostname, DEFAULT_KEYWORDS) || matchesCustomSites(hostname, customSites);
}

function escapeForRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegexForDomain(domain) {
  const d = normalizeDomain(domain);
  if (!d) return null;
  // Match http/https and any subdomain for the target domain, anchored at start
  // Example: ^https?://([^.]+\.)*example\.com/
  return `^https?://([^.]+\\.)*${escapeForRegex(d)}/`;
}

async function updateBlockRules() {
  const items = await storageGet([STORAGE_KEYS.customSites]);
  const customSites = items[STORAGE_KEYS.customSites] || [];

  // Build keyword rules (broad URL substring match)
  const keywordRules = DEFAULT_KEYWORDS.map((kw, idx) => ({
    id: RULE_IDS.keywordBase + idx,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: kw,
      resourceTypes: ['main_frame']
    }
  }));

  // Build custom site rules
  const customRules = [];
  let customIdx = 0;
  for (const site of customSites) {
    const regex = buildRegexForDomain(site);
    if (!regex) continue;
    customRules.push({
      id: RULE_IDS.customBase + customIdx,
      priority: 1,
      action: { type: 'block' },
      condition: {
        regexFilter: regex,
        resourceTypes: ['main_frame']
      }
    });
    customIdx += 1;
  }

  // Remove existing rules in our ID ranges, then add current rules
  try {
    const existing = await api.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .filter(r => (r.id >= RULE_IDS.keywordBase && r.id < RULE_IDS.keywordBase + 1000) ||
                   (r.id >= RULE_IDS.customBase && r.id < RULE_IDS.customBase + 2000))
      .map(r => r.id);
    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: [...keywordRules, ...customRules]
    });
  } catch {
    // Ignore errors (not supported in some browsers)
  }
}

async function recordDetectionAndNotify() {
  const today = getTodayIsoDate();
  const items = await storageGet([
    STORAGE_KEYS.lastVisitDate,
    STORAGE_KEYS.visitHistory,
    // Supabase auth/session
    'accessToken',
    'refreshToken',
    'userId',
    'userEmail',
    'supabaseUrl',
    'supabaseAnonKey'
  ]);

  const visitHistory = Array.isArray(items[STORAGE_KEYS.visitHistory])
    ? items[STORAGE_KEYS.visitHistory].slice()
    : [];

  if (!visitHistory.includes(today)) {
    visitHistory.push(today);
  }

  await storageSet({
    [STORAGE_KEYS.lastVisitDate]: today,
    [STORAGE_KEYS.visitHistory]: visitHistory
  });

  // Send notification every time detection occurs
  try {
    api.notifications.create('', {
      type: 'basic',
      title: 'Streak broken',
      message: 'You visited an adult content site.',
      iconUrl: TINY_ICON_DATA_URL,
      priority: 2
    });
  } catch {
    // Swallow notification errors to avoid crashing the worker
  }

  // If logged in, send detection event to backend
  const accessToken = items['accessToken'];
  const refreshToken = items['refreshToken'];
  const supabaseUrl = items['supabaseUrl'];
  const supabaseAnonKey = items['supabaseAnonKey'];
  const userId = items['userId'];
  const userEmail = items['userEmail'];
  if (accessToken && supabaseUrl && supabaseAnonKey && userId) {
    try {
      // Insert into Supabase 'detections' table via PostgREST
      let resp = await fetch(`${supabaseUrl}/rest/v1/detections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          email: userEmail || null,
          date: today
        })
      });
      // If token expired, try refresh once
      if (resp && resp.status === 401 && refreshToken) {
        try {
          const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          const data = await r.json().catch(() => ({}));
          if (r.ok && data && data.access_token) {
            await storageSet({
              accessToken: data.access_token,
              refreshToken: data.refresh_token || refreshToken
            });
            // retry insert with new token
            await fetch(`${supabaseUrl}/rest/v1/detections`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${data.access_token}`,
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                user_id: userId,
                email: userEmail || null,
                date: today
              })
            });
          }
        } catch {
          // ignore refresh errors
        }
      }
    } catch {
      // Ignore network errors
    }
  }
}

function daysBetween(fromIso, toIso) {
  try {
    const from = new Date(fromIso + 'T00:00:00Z').getTime();
    const to = new Date(toIso + 'T00:00:00Z').getTime();
    const diff = Math.max(0, to - from);
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

async function computeStreak() {
  const today = getTodayIsoDate();
  const items = await storageGet([STORAGE_KEYS.lastVisitDate]);
  const lastVisitDate = items[STORAGE_KEYS.lastVisitDate];
  if (!lastVisitDate) return { streakDays: null, lastVisitDate: null };
  if (lastVisitDate === today) return { streakDays: 0, lastVisitDate };
  return { streakDays: daysBetween(lastVisitDate, today), lastVisitDate };
}

// Handle messages from popup
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'getState') {
      await ensureInitialized();
      const today = getTodayIsoDate();
      const { streakDays, lastVisitDate } = await computeStreak();
      const data = await storageGet([STORAGE_KEYS.customSites, STORAGE_KEYS.visitHistory]);
      sendResponse({
        today,
        streakDays,
        lastVisitDate,
        customSites: data[STORAGE_KEYS.customSites] || [],
        visitHistory: data[STORAGE_KEYS.visitHistory] || []
      });
      return;
    }
    if (message && message.type === 'addCustomSite') {
      const site = normalizeDomain(message.site || '');
      if (!site) {
        sendResponse({ ok: false });
        return;
      }
      const data = await storageGet([STORAGE_KEYS.customSites]);
      const customSites = Array.isArray(data[STORAGE_KEYS.customSites]) ? data[STORAGE_KEYS.customSites] : [];
      if (!customSites.includes(site)) {
        customSites.push(site);
        await storageSet({ [STORAGE_KEYS.customSites]: customSites });
        await updateBlockRules();
      }
      sendResponse({ ok: true, customSites });
      return;
    }
    if (message && message.type === 'removeCustomSite') {
      const site = normalizeDomain(message.site || '');
      const data = await storageGet([STORAGE_KEYS.customSites]);
      const customSites = (Array.isArray(data[STORAGE_KEYS.customSites]) ? data[STORAGE_KEYS.customSites] : []).filter(
        (s) => normalizeDomain(s) !== site
      );
      await storageSet({ [STORAGE_KEYS.customSites]: customSites });
       await updateBlockRules();
      sendResponse({ ok: true, customSites });
      return;
    }
    if (message && message.type === 'resetStreak') {
      const today = getTodayIsoDate();
      const data = await storageGet([STORAGE_KEYS.visitHistory]);
      const visitHistory = Array.isArray(data[STORAGE_KEYS.visitHistory]) ? data[STORAGE_KEYS.visitHistory] : [];
      if (!visitHistory.includes(today)) visitHistory.push(today);
      await storageSet({
        [STORAGE_KEYS.lastVisitDate]: today,
        [STORAGE_KEYS.visitHistory]: visitHistory
      });
      sendResponse({ ok: true });
      return;
    }
    // Unknown message
    sendResponse({ ok: false });
  })();
  // return true to indicate async response
  return true;
});

// Initialize storage on install/update
api.runtime.onInstalled.addListener(async () => {
  await ensureInitialized();
  await updateBlockRules();
});

// Detect visits using webNavigation
api.webNavigation.onCommitted.addListener(async (details) => {
  try {
    if (details.frameId !== 0) return; // only top-level navigations
    if (!details.url) return;
    const adult = await isAdultUrl(details.url);
    if (adult) {
      await recordDetectionAndNotify();
    }
  } catch {
    // Avoid throwing from event handlers
  }
});

// Detect attempts (even if blocked) using webRequest observer
try {
  api.webRequest.onBeforeRequest.addListener(
    async (details) => {
      try {
        if (details.type !== 'main_frame' || !details.url) return;
        const adult = await isAdultUrl(details.url);
        if (adult) {
          await recordDetectionAndNotify();
        }
      } catch {
        // ignore
      }
    },
    { urls: ['<all_urls>'] }
  );
} catch {
  // webRequest may not be available in all MV3 contexts
}


