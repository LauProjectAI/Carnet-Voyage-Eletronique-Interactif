/**
 * auth_service.js — Couche d'authentification & portail multi-voyages Voyages Girardot
 * ------------------------------------------------------------------------------------
 * Architecture abstraite (prête pour migration future vers un backend Voyages Girardot) :
 *  - Registre JSON léger (voyages/access_registry.json) mis en cache dans IndexedDB (offline-first)
 *  - Fusion transparente avec d'éventuelles modifications locales admin (LOCAL_REGISTRY_KEY)
 *  - Écran de connexion unique intelligent (Voyageur vs Conducteur/Accompagnateur)
 *  - Portail multi-voyages ("Mes Voyages" / "Mes Départs Assignés")
 *  - Cloisonnement strict des données locales par (userId + tripId)
 */

(function(global) {
  'use strict';

  const SESSION_KEY = 'girardot_auth_session_v1';
  const REGISTRY_CACHE_KEY = 'girardot_access_registry_cache';
  const LOCAL_REGISTRY_KEY = 'girardot_local_access_registry';
  const REGISTRY_URL = 'voyages/access_registry.json';

  let inMemoryRegistry = null;

  function createEmptyRegistry() {
    return {
      version: 1,
      updatedAt: null,
      tripsAccess: {},
      staffAccounts: [],
      travelerAccounts: []
    };
  }

  function normalizeId(val) {
    return String(val || '').trim().toLowerCase();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // HACHAGE SHA-256 (Web Crypto API avec repli pur JS pour HTTP local non-HTTPS)
  // ---------------------------------------------------------------------------
  function pureSha256Hex(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }

    // Encodage UTF-8 vers chaîne d'octets
    const utf8 = unescape(encodeURIComponent(String(ascii || '')));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = '';

    const words = [];
    const asciiBitLength = utf8.length * 8;

    let hash = pureSha256Hex.h = pureSha256Hex.h || [];
    const k = pureSha256Hex.k = pureSha256Hex.k || [];
    let primeCounter = k.length;

    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    const padded = utf8 + '\x80';
    let padStr = padded;
    while ((padStr.length % 64) - 56) padStr += '\x00';
    for (let i = 0; i < padStr.length; i++) {
      const j = padStr.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;

    hash = hash.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = hash.slice(0);

      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];

        const a = hash[0];
        const e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (let i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  async function hashPassword(plain) {
    const clean = String(plain || '').trim();
    if (!clean) return '';
    try {
      if (global.crypto && global.crypto.subtle && typeof TextEncoder !== 'undefined') {
        const data = new TextEncoder().encode(clean);
        const digest = await global.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (e) {}
    return pureSha256Hex(clean);
  }

  function generateReadablePassword(length = 6) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // CHARGEMENT & FUSION DU REGISTRE (Serveur + Cache IndexedDB + Brouillon Local)
  // ---------------------------------------------------------------------------
  function mergeRegistries(baseReg, overrideReg) {
    const base = Object.assign(createEmptyRegistry(), baseReg || {});
    const ov = overrideReg || {};
    const merged = {
      version: Math.max(base.version || 1, ov.version || 1),
      updatedAt: ov.updatedAt || base.updatedAt || null,
      tripsAccess: Object.assign({}, base.tripsAccess || {}, ov.tripsAccess || {}),
      staffAccounts: [],
      travelerAccounts: []
    };

    const staffMap = new Map();
    (base.staffAccounts || []).forEach(a => {
      const key = a.id || normalizeId(a.login);
      if (key) staffMap.set(key, a);
    });
    (ov.staffAccounts || []).forEach(a => {
      const key = a.id || normalizeId(a.login);
      if (key) staffMap.set(key, a);
    });
    merged.staffAccounts = Array.from(staffMap.values());

    const travMap = new Map();
    (base.travelerAccounts || []).forEach(a => {
      const key = a.id || normalizeId(a.login);
      if (key) travMap.set(key, a);
    });
    (ov.travelerAccounts || []).forEach(a => {
      const key = a.id || normalizeId(a.login);
      if (key) travMap.set(key, a);
    });
    merged.travelerAccounts = Array.from(travMap.values());

    return merged;
  }

  async function readStoredJson(key) {
    if (global.GirardotStorage) {
      try {
        const val = await global.GirardotStorage.get(key, null);
        if (val) return val;
      } catch (e) {}
    }
    try {
      const raw = global.localStorage ? global.localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async function writeStoredJson(key, val) {
    if (global.GirardotStorage) {
      try {
        await global.GirardotStorage.set(key, val);
      } catch (e) {}
    }
    try {
      if (global.localStorage) {
        const str = JSON.stringify(val);
        if (str.length < 400000) {
          global.localStorage.setItem(key, str);
        }
      }
    } catch (e) {}
  }

  async function loadRegistry(forceRefresh = false) {
    if (inMemoryRegistry && !forceRefresh) {
      return inMemoryRegistry;
    }

    let remoteData = null;
    if (typeof fetch === 'function') {
      try {
        const res = await fetch(`${REGISTRY_URL}?_t=${Date.now()}`, { cache: 'no-cache' });
        if (res && res.ok) {
          remoteData = await res.json();
          await writeStoredJson(REGISTRY_CACHE_KEY, remoteData);
        }
      } catch (e) {
        // Hors-ligne ou environnement sans HTTP : repli transparent sur cache
      }
    }

    if (!remoteData) {
      remoteData = await readStoredJson(REGISTRY_CACHE_KEY);
    }

    const localOverrides = await readStoredJson(LOCAL_REGISTRY_KEY);
    inMemoryRegistry = mergeRegistries(remoteData || createEmptyRegistry(), localOverrides);
    return inMemoryRegistry;
  }

  async function saveLocalRegistry(reg) {
    const clean = mergeRegistries(createEmptyRegistry(), reg);
    clean.updatedAt = new Date().toISOString();
    await writeStoredJson(LOCAL_REGISTRY_KEY, clean);
    inMemoryRegistry = null;
    return loadRegistry(false);
  }

  // ---------------------------------------------------------------------------
  // GESTION DE SESSION & AUTHENTIFICATION
  // ---------------------------------------------------------------------------
  function getSession() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(SESSION_KEY) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && parsed.userId && parsed.role) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  async function restoreSessionAsync() {
    const sync = getSession();
    if (sync) return sync;
    const stored = await readStoredJson(SESSION_KEY);
    if (stored && stored.userId && stored.role) {
      try {
        if (global.localStorage) global.localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      } catch (e) {}
      return stored;
    }
    return null;
  }

  async function persistSession(session) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch (e) {}
    if (global.GirardotStorage) {
      try {
        await global.GirardotStorage.set(SESSION_KEY, session);
      } catch (e) {}
    }
  }

  async function logout() {
    try {
      if (global.localStorage) global.localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    if (global.GirardotStorage) {
      try {
        await global.GirardotStorage.remove(SESSION_KEY);
      } catch (e) {}
    }
  }

  function buildTravelerSession(acc, matchDossier = '') {
    const trips = Array.isArray(acc.trips) ? acc.trips : [];
    const tripsMap = {};
    const tripIds = [];
    trips.forEach(t => {
      if (t && t.tripId) {
        tripsMap[t.tripId] = t;
        if (!tripIds.includes(t.tripId)) tripIds.push(t.tripId);
      }
    });
    return {
      userId: acc.id || ('trav-' + normalizeId(acc.login || acc.dossierRef)),
      login: acc.login || acc.dossierRef || '',
      role: 'traveler',
      firstName: acc.firstName || '',
      lastName: acc.lastName || '',
      displayName: acc.displayName || [acc.firstName, acc.lastName].filter(Boolean).join(' ') || acc.login || 'Voyageur',
      dossierRef: matchDossier || acc.dossierRef || '',
      assignedTripIds: tripIds,
      travelerTripsMap: tripsMap,
      loggedInAt: Date.now()
    };
  }

  async function login(identifier, password, options = {}) {
    const normId = normalizeId(identifier);
    const cleanPwd = String(password || '').trim();
    if (!normId || !cleanPwd) {
      return { ok: false, error: 'Veuillez saisir votre identifiant et votre mot de passe.' };
    }

    const reg = await loadRegistry(false);
    const pwdHash = await hashPassword(cleanPwd);

    // 1. Comptes Conducteurs / Accompagnateurs / Admin
    const staff = (reg.staffAccounts || []).find(acc => {
      if (!acc || acc.active === false) return false;
      return normalizeId(acc.login) === normId && acc.passwordHash === pwdHash;
    });
    if (staff) {
      const session = {
        userId: staff.id || ('staff-' + normalizeId(staff.login)),
        login: staff.login,
        role: staff.role || 'driver',
        firstName: staff.firstName || '',
        lastName: staff.lastName || '',
        displayName: staff.displayName || [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.login,
        assignedTripIds: Array.isArray(staff.assignedTrips) ? staff.assignedTrips.slice() : [],
        travelerTripsMap: {},
        loggedInAt: Date.now()
      };
      await persistSession(session);
      return { ok: true, session };
    }

    // 2. Comptes Voyageurs (email ou n° de dossier global ou n° de dossier d'un départ)
    const traveler = (reg.travelerAccounts || []).find(acc => {
      if (!acc || acc.active === false) return false;
      if (acc.passwordHash !== pwdHash) return false;
      if (normalizeId(acc.login) === normId) return true;
      if (acc.dossierRef && normalizeId(acc.dossierRef) === normId) return true;
      if (Array.isArray(acc.trips)) {
        return acc.trips.some(t => t && t.dossierRef && normalizeId(t.dossierRef) === normId);
      }
      return false;
    });
    if (traveler) {
      const session = buildTravelerSession(traveler);
      await persistSession(session);
      return { ok: true, session };
    }

    // 3. Repli : voyageurs embarqués directement dans le JSON du voyage courant
    const tripObj = options.tripObj || null;
    if (tripObj && tripObj.accessControl && Array.isArray(tripObj.accessControl.travelers)) {
      const embedded = tripObj.accessControl.travelers.find(t => {
        if (!t) return false;
        const idMatch = normalizeId(t.login) === normId || normalizeId(t.email) === normId || normalizeId(t.dossierRef) === normId;
        return idMatch && t.passwordHash === pwdHash;
      });
      if (embedded) {
        const session = buildTravelerSession({
          id: embedded.id || ('emb-' + normId),
          login: embedded.login || embedded.email || embedded.dossierRef,
          firstName: embedded.firstName || '',
          lastName: embedded.lastName || '',
          displayName: embedded.displayName || [embedded.firstName, embedded.lastName].filter(Boolean).join(' '),
          dossierRef: embedded.dossierRef || '',
          trips: [Object.assign({ tripId: tripObj.id }, embedded)]
        });
        await persistSession(session);
        return { ok: true, session };
      }
    }

    return {
      ok: false,
      error: 'Identifiant ou mot de passe incorrect. Vérifiez les informations transmises par Voyages Girardot.'
    };
  }

  // ---------------------------------------------------------------------------
  // CONTRÔLE D'ACCÈS HYBRIDE & CLOISONNEMENT DES CLÉS
  // ---------------------------------------------------------------------------
  async function isTripProtected(tripId, tripObj = null) {
    if (tripObj && tripObj.accessControl && typeof tripObj.accessControl.requireAuth === 'boolean') {
      return tripObj.accessControl.requireAuth === true;
    }
    const reg = await loadRegistry(false);
    const entry = (reg.tripsAccess && tripId) ? reg.tripsAccess[tripId] : null;
    return !!(entry && entry.requireAuth === true);
  }

  function canSessionAccessTrip(session, tripId, context = 'client') {
    if (!session || !tripId) return false;
    const assigned = Array.isArray(session.assignedTripIds) ? session.assignedTripIds : [];
    const hasTrip = assigned.includes('*') || assigned.includes(tripId);

    if (context === 'driver') {
      const isProRole = session.role === 'driver' || session.role === 'guide' || session.role === 'admin';
      return isProRole && hasTrip;
    }
    return hasTrip;
  }

  function getSessionTripPersonalization(tripId) {
    const session = getSession();
    if (!session || session.role !== 'traveler' || !tripId) return null;
    return (session.travelerTripsMap && session.travelerTripsMap[tripId]) ? session.travelerTripsMap[tripId] : null;
  }

  function getUserScopeId() {
    const session = getSession();
    return (session && session.userId) ? session.userId : 'guest';
  }

  function getScopedStorageKey(baseName, tripId) {
    const cleanTrip = tripId || 'default';
    const session = getSession();
    if (session && session.userId) {
      return `girardot_u_${session.userId}_${baseName}_${cleanTrip}`;
    }
    return `girardot_${baseName}_${cleanTrip}`;
  }

  // ---------------------------------------------------------------------------
  // RÉSOLUTION MÉTADONNÉES VOYAGES POUR LE PORTAIL
  // ---------------------------------------------------------------------------
  function resolveTripMeta(tripId) {
    const list = [];
    if (Array.isArray(global.AVAILABLE_TRIPS)) list.push(...global.AVAILABLE_TRIPS);
    try {
      const custom = JSON.parse((global.localStorage && global.localStorage.getItem('girardot_trips_catalog')) || '[]');
      if (Array.isArray(custom)) list.push(...custom);
    } catch (e) {}

    const found = list.find(t =>
      t && (t.id === tripId || t.alias === tripId || (Array.isArray(t.aliases) && t.aliases.includes(tripId)))
    );

    if (found) {
      return {
        id: found.id || tripId,
        title: found.title || tripId,
        subtitle: found.subtitle || '',
        dates: found.dates || '',
        file: found.file || `voyages/${tripId}.json`
      };
    }

    return {
      id: tripId,
      title: tripId,
      subtitle: 'Carnet de voyage Girardot',
      dates: '',
      file: `voyages/${tripId}.json`
    };
  }

  function getExpandableAssignedTrips(session) {
    if (!session) return [];
    const assigned = Array.isArray(session.assignedTripIds) ? session.assignedTripIds : [];
    if (assigned.includes('*')) {
      const all = (Array.isArray(global.AVAILABLE_TRIPS) ? global.AVAILABLE_TRIPS : []).map(t => t.id);
      return Array.from(new Set(all)).map(resolveTripMeta);
    }
    return assigned.map(resolveTripMeta);
  }

  // ---------------------------------------------------------------------------
  // INTERFACE UNIFIÉE : ÉCRAN DE CONNEXION & PORTAIL MULTI-VOYAGES
  // ---------------------------------------------------------------------------
  function ensurePortalStyles() {
    if (typeof document === 'undefined' || document.getElementById('girardot-auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'girardot-auth-styles';
    style.textContent = `
      .ga-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(13, 44, 33, 0.84);
        backdrop-filter: blur(6px);
        font-family: 'Archivo', 'Segoe UI', system-ui, sans-serif;
      }
      .ga-overlay.ga-theme-driver {
        background: rgba(11, 17, 32, 0.92);
      }
      .ga-card {
        width: 100%;
        max-width: 460px;
        max-height: 92vh;
        background: #ffffff;
        border-radius: 22px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        color: #18221b;
      }
      .ga-theme-driver .ga-card {
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
      }
      .ga-head {
        background: linear-gradient(135deg, #144534 0%, #1d5c46 100%);
        color: white;
        padding: 20px 22px 18px;
        position: relative;
        border-bottom: 3px solid #c29958;
      }
      .ga-theme-driver .ga-head {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border-bottom-color: #38bdf8;
      }
      .ga-kicker {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #f7f1e6;
        opacity: 0.9;
        margin-bottom: 4px;
      }
      .ga-theme-driver .ga-kicker { color: #38bdf8; }
      .ga-title {
        font-size: 1.25rem;
        font-weight: 800;
        line-height: 1.2;
        margin: 0;
      }
      .ga-sub {
        font-size: 0.8rem;
        color: #d1fae5;
        margin-top: 4px;
      }
      .ga-theme-driver .ga-sub { color: #94a3b8; }
      .ga-close {
        position: absolute;
        top: 14px;
        right: 14px;
        background: rgba(255,255,255,0.14);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ga-body {
        padding: 20px 22px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ga-field label {
        display: block;
        font-size: 0.78rem;
        font-weight: 800;
        color: #334155;
        margin-bottom: 5px;
      }
      .ga-theme-driver .ga-field label { color: #cbd5e1; }
      .ga-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      .ga-input {
        width: 100%;
        padding: 11px 13px;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        font-size: 0.92rem;
        font-family: inherit;
        background: #f8fafc;
        color: #0f172a;
        outline: none;
      }
      .ga-input:focus {
        border-color: #144534;
        background: #ffffff;
      }
      .ga-theme-driver .ga-input {
        background: #0f172a;
        border-color: #334155;
        color: #f8fafc;
      }
      .ga-theme-driver .ga-input:focus {
        border-color: #38bdf8;
      }
      .ga-eye-btn {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px 6px;
        font-size: 0.95rem;
      }
      .ga-btn-primary {
        width: 100%;
        padding: 12px 16px;
        border-radius: 12px;
        border: none;
        background: #144534;
        color: white;
        font-size: 0.95rem;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-family: inherit;
      }
      .ga-theme-driver .ga-btn-primary {
        background: #0284c7;
      }
      .ga-btn-secondary {
        padding: 8px 13px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .ga-theme-driver .ga-btn-secondary {
        background: #0f172a;
        border-color: #334155;
        color: #cbd5e1;
      }
      .ga-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
        border-radius: 10px;
        padding: 9px 12px;
        font-size: 0.82rem;
        font-weight: 600;
        display: none;
      }
      .ga-info {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #78350f;
        border-radius: 10px;
        padding: 9px 12px;
        font-size: 0.8rem;
        line-height: 1.4;
      }
      .ga-theme-driver .ga-info {
        background: rgba(56, 189, 248, 0.1);
        border-color: rgba(56, 189, 248, 0.35);
        color: #bae6fd;
      }
      .ga-trip-item {
        background: #f8fafc;
        border: 1.5px solid #dce4de;
        border-radius: 14px;
        padding: 13px 15px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ga-theme-driver .ga-trip-item {
        background: #0f172a;
        border-color: #334155;
      }
      .ga-trip-item.is-active {
        border-color: #144534;
        background: #eef7f2;
      }
      .ga-theme-driver .ga-trip-item.is-active {
        border-color: #38bdf8;
        background: #172554;
      }
      .ga-trip-title {
        font-size: 0.98rem;
        font-weight: 800;
        color: #144534;
      }
      .ga-theme-driver .ga-trip-title { color: #f8fafc; }
      .ga-trip-meta {
        font-size: 0.78rem;
        color: #64748b;
      }
      .ga-theme-driver .ga-trip-meta { color: #94a3b8; }
      .ga-trip-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .ga-footer-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      }
      .ga-theme-driver .ga-footer-bar { border-top-color: #334155; }
    `;
    document.head.appendChild(style);
  }

  function closeAuthOverlay() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('girardot-auth-overlay');
    if (existing) existing.remove();
  }

  function mountAuthPortal(config = {}) {
    if (typeof document === 'undefined') return;
    ensurePortalStyles();
    closeAuthOverlay();

    const mode = config.mode || (getSession() ? 'portal' : 'login');
    const theme = config.theme || 'client';
    const blocking = config.blocking === true;
    const session = getSession();

    const overlay = document.createElement('div');
    overlay.id = 'girardot-auth-overlay';
    overlay.className = 'ga-overlay' + (theme === 'driver' ? ' ga-theme-driver' : '');

    if (!blocking) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAuthOverlay();
      });
    }

    if (mode === 'portal' && session) {
      const isPro = session.role === 'driver' || session.role === 'guide' || session.role === 'admin';
      const trips = getExpandableAssignedTrips(session);
      const heading = isPro ? 'Mes Départs Assignés' : 'Mes Voyages';
      const subText = isPro
        ? `Connecté : ${session.displayName} • Espace Équipe Girardot`
        : `Bonjour ${session.displayName} • Sélectionnez votre carnet`;

      const listHtml = trips.length > 0
        ? trips.map(t => {
            const isCurrent = config.activeTripId && config.activeTripId === t.id;
            const pers = (!isPro && session.travelerTripsMap) ? session.travelerTripsMap[t.id] : null;
            const dossierBadge = (pers && pers.dossierRef) ? `<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:6px; font-size:0.7rem; font-weight:800;">Dossier ${escapeHtml(pers.dossierRef)}</span>` : '';

            return `
              <div class="ga-trip-item ${isCurrent ? 'is-active' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div class="ga-trip-title">${escapeHtml(t.title)}</div>
                    ${t.subtitle ? `<div class="ga-trip-meta">${escapeHtml(t.subtitle)}</div>` : ''}
                    ${t.dates ? `<div class="ga-trip-meta" style="margin-top:2px;"><i class="fa-regular fa-calendar"></i> ${escapeHtml(t.dates)}</div>` : ''}
                  </div>
                  ${dossierBadge}
                </div>
                <div class="ga-trip-actions">
                  ${isPro ? `
                    <button type="button" class="ga-btn-primary" style="flex:1; padding:9px 12px; font-size:0.84rem;" data-open-driver="${escapeHtml(t.id)}">
                      <i class="fa-solid fa-bus"></i> Ouvrir Dossier Conducteur
                    </button>
                    <button type="button" class="ga-btn-secondary" data-open-client="${escapeHtml(t.id)}">
                      <i class="fa-solid fa-eye"></i> Aperçu Client
                    </button>
                  ` : `
                    <button type="button" class="ga-btn-primary" style="padding:9px 12px; font-size:0.86rem;" data-open-client="${escapeHtml(t.id)}">
                      <i class="fa-solid fa-book-open"></i> ${isCurrent ? 'Continuer ce carnet' : 'Ouvrir ce carnet'}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')
        : `<div class="ga-info">Aucun voyage assigné à votre compte pour le moment. Contactez votre conseiller Voyages Girardot.</div>`;

      overlay.innerHTML = `
        <div class="ga-card">
          <div class="ga-head">
            <div class="ga-kicker">Voyages Girardot • Espace Personnel</div>
            <h2 class="ga-title">${escapeHtml(heading)}</h2>
            <div class="ga-sub">${escapeHtml(subText)}</div>
            ${!blocking ? '<button type="button" class="ga-close" id="ga-close-btn" title="Fermer">&times;</button>' : ''}
          </div>
          <div class="ga-body">
            ${listHtml}
            <div class="ga-footer-bar">
              <button type="button" class="ga-btn-secondary" id="ga-switch-account-btn">
                <i class="fa-solid fa-right-from-bracket"></i> Déconnexion / Changer de compte
              </button>
              ${!blocking ? '<button type="button" class="ga-btn-secondary" id="ga-dismiss-btn">Fermer</button>' : ''}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeBtn = document.getElementById('ga-close-btn');
      if (closeBtn) closeBtn.onclick = () => closeAuthOverlay();
      const dismissBtn = document.getElementById('ga-dismiss-btn');
      if (dismissBtn) dismissBtn.onclick = () => closeAuthOverlay();

      const switchBtn = document.getElementById('ga-switch-account-btn');
      if (switchBtn) {
        switchBtn.onclick = async () => {
          await logout();
          if (typeof config.onLogout === 'function') {
            config.onLogout();
          } else {
            mountAuthPortal(Object.assign({}, config, { mode: 'login' }));
          }
        };
      }

      overlay.querySelectorAll('[data-open-client]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-open-client');
          if (typeof config.onSelectTrip === 'function') {
            config.onSelectTrip(id, 'client', session);
          } else {
            global.location.href = `index.html?id=${encodeURIComponent(id)}`;
          }
        });
      });

      overlay.querySelectorAll('[data-open-driver]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-open-driver');
          if (typeof config.onSelectTrip === 'function') {
            config.onSelectTrip(id, 'driver', session);
          } else {
            global.location.href = `conducteur.html?id=${encodeURIComponent(id)}`;
          }
        });
      });
      return;
    }

    // MODE LOGIN UNIQUE INTELLIGENT (Voyageur ou Conducteur / Accompagnateur)
    const infoMsg = config.reasonText || (blocking
      ? 'Ce carnet est protégé. Connectez-vous avec l’identifiant (e-mail ou n° de dossier) et le mot de passe fournis par Voyages Girardot.'
      : 'Connectez-vous pour retrouver tous vos voyages en un seul endroit ou accéder à votre espace Conducteur / Accompagnateur.');

    overlay.innerHTML = `
      <div class="ga-card">
        <div class="ga-head">
          <div class="ga-kicker">Voyages Girardot • Depuis 1920</div>
          <h2 class="ga-title">Accès Carnet de Voyage</h2>
          <div class="ga-sub">Voyageurs &amp; Équipe Conducteurs / Accompagnateurs</div>
          ${!blocking ? '<button type="button" class="ga-close" id="ga-close-btn" title="Fermer">&times;</button>' : ''}
        </div>
        <form class="ga-body" id="ga-login-form">
          <div class="ga-info">
            <i class="fa-solid fa-shield-halved"></i> ${escapeHtml(infoMsg)}
          </div>
          <div class="ga-error" id="ga-login-error"></div>
          <div class="ga-field">
            <label for="ga-login-id">Identifiant (E-mail ou N° de dossier) :</label>
            <input type="text" id="ga-login-id" class="ga-input" autocomplete="username" placeholder="Ex: dupont@client.demo ou GIR-2026-001" required>
          </div>
          <div class="ga-field">
            <label for="ga-login-pwd">Mot de passe :</label>
            <div class="ga-input-wrap">
              <input type="password" id="ga-login-pwd" class="ga-input" autocomplete="current-password" placeholder="Saisissez votre mot de passe" required style="padding-right:40px;">
              <button type="button" class="ga-eye-btn" id="ga-toggle-pwd" title="Afficher / masquer">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="ga-btn-primary" id="ga-submit-btn">
            <i class="fa-solid fa-right-to-bracket"></i> Se connecter
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('ga-close-btn');
    if (closeBtn) closeBtn.onclick = () => closeAuthOverlay();

    const pwdInput = document.getElementById('ga-login-pwd');
    const eyeBtn = document.getElementById('ga-toggle-pwd');
    if (eyeBtn && pwdInput) {
      eyeBtn.onclick = () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        eyeBtn.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    }

    const form = document.getElementById('ga-login-form');
    const errBox = document.getElementById('ga-login-error');
    const submitBtn = document.getElementById('ga-submit-btn');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errBox) errBox.style.display = 'none';
        const idVal = document.getElementById('ga-login-id') ? document.getElementById('ga-login-id').value : '';
        const pwdVal = pwdInput ? pwdInput.value : '';

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vérification...';
        }

        const result = await login(idVal, pwdVal, { tripObj: config.tripObj || null });

        if (!result.ok) {
          if (errBox) {
            errBox.textContent = result.error;
            errBox.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Se connecter';
          }
          return;
        }

        closeAuthOverlay();
        if (typeof config.onAuthenticated === 'function') {
          config.onAuthenticated(result.session);
        }
      });
    }

    setTimeout(() => {
      const idEl = document.getElementById('ga-login-id');
      if (idEl) idEl.focus();
    }, 60);
  }

  global.GirardotAuth = {
    SESSION_KEY,
    REGISTRY_CACHE_KEY,
    LOCAL_REGISTRY_KEY,
    hashPassword,
    pureSha256Hex,
    generateReadablePassword,
    loadRegistry,
    saveLocalRegistry,
    login,
    logout,
    getSession,
    restoreSessionAsync,
    isTripProtected,
    canSessionAccessTrip,
    getSessionTripPersonalization,
    getUserScopeId,
    getScopedStorageKey,
    resolveTripMeta,
    getExpandableAssignedTrips,
    mountAuthPortal,
    closeAuthOverlay
  };

})(typeof window !== 'undefined' ? window : global);
