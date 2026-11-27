/**
 * admin_access.js — Gestion Back-Office "Voyageurs & Accès" (Lot 3)
 * ----------------------------------------------------------------------------
 * Fonctionnalités :
 *  - Édition des fiches individuelles voyageurs (ID, MDP, ramassage, siège, chambre/cabine,
 *    options datées, documents nominatifs avec pièce jointe / QR Code)
 *  - Synchronisation 1 clic depuis Liste Passagers & Rooming List du dossier conducteur
 *  - Import CSV / Excel LogiTO & modèle CSV téléchargeable
 *  - Export CSV prêt pour publipostage (UTF-8 BOM, séparateur ;)
 *  - Gestion des comptes nominatifs Équipe Conducteurs & Accompagnateurs
 *  - Publication sécurisée (passwordHash SHA-256 uniquement) de voyages/access_registry.json sur GitHub
 */

(function(global) {
  'use strict';

  const PLAIN_PWD_CACHE_KEY = 'girardot_admin_plain_pwds_cache';
  let adminRegistry = null;
  let activeAccessSubTab = 'travelers';

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normHeader(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------------------------
  // CACHE LOCAL DES MOTS DE PASSE EN CLAIR (UNIQUEMENT SUR LE POSTE AGENCE)
  // ---------------------------------------------------------------------------
  function getPlainPwdMap() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(PLAIN_PWD_CACHE_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getPlainPwd(accountId) {
    if (!accountId) return '';
    const map = getPlainPwdMap();
    return map[accountId] || '';
  }

  function setPlainPwd(accountId, plain) {
    if (!accountId) return;
    const map = getPlainPwdMap();
    if (plain) {
      map[accountId] = String(plain);
    } else {
      delete map[accountId];
    }
    try {
      if (global.localStorage) {
        global.localStorage.setItem(PLAIN_PWD_CACHE_KEY, JSON.stringify(map));
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // ASSAINISSEMENT STRICT AVANT PUBLICATION GITHUB (ZÉRO MDP EN CLAIR)
  // ---------------------------------------------------------------------------
  function sanitizeRegistryForPublish(reg) {
    const src = reg || {};
    const cleanTripsAccess = {};
    if (src.tripsAccess && typeof src.tripsAccess === 'object') {
      Object.keys(src.tripsAccess).forEach(k => {
        const item = src.tripsAccess[k];
        if (item && typeof item === 'object') {
          cleanTripsAccess[k] = { requireAuth: item.requireAuth === true };
        }
      });
    }

    const cleanStaff = (Array.isArray(src.staffAccounts) ? src.staffAccounts : []).map(acc => ({
      id: acc.id || '',
      login: acc.login || '',
      passwordHash: acc.passwordHash || '',
      role: acc.role || 'driver',
      firstName: acc.firstName || '',
      lastName: acc.lastName || '',
      displayName: acc.displayName || '',
      active: acc.active !== false,
      assignedTrips: Array.isArray(acc.assignedTrips) ? acc.assignedTrips.slice() : []
    }));

    const cleanTravelers = (Array.isArray(src.travelerAccounts) ? src.travelerAccounts : []).map(acc => ({
      id: acc.id || '',
      login: acc.login || '',
      dossierRef: acc.dossierRef || '',
      passwordHash: acc.passwordHash || '',
      role: 'traveler',
      firstName: acc.firstName || '',
      lastName: acc.lastName || '',
      displayName: acc.displayName || '',
      active: acc.active !== false,
      trips: (Array.isArray(acc.trips) ? acc.trips : []).map(t => ({
        tripId: t.tripId || '',
        dossierRef: t.dossierRef || '',
        pickupPoint: t.pickupPoint || '',
        pickupTime: t.pickupTime || '',
        seatNumber: t.seatNumber || '',
        roomNumber: t.roomNumber || '',
        cabinNumber: t.cabinNumber || '',
        options: Array.isArray(t.options) ? t.options.map(o => {
          if (typeof o === 'string') return o;
          return {
            title: o.title || '',
            day: (o.day !== undefined && o.day !== null && o.day !== '') ? Number(o.day) : null,
            time: o.time || '',
            details: o.details || ''
          };
        }) : [],
        personalDocs: Array.isArray(t.personalDocs) ? t.personalDocs.map(d => ({
          id: d.id || '',
          type: d.type || 'other',
          title: d.title || '',
          reference: d.reference || '',
          date: d.date || '',
          notes: d.notes || '',
          qrCode: d.qrCode || '',
          fileUrl: d.fileUrl || ''
        })) : []
      }))
    }));

    return {
      version: Math.max(1, Number(src.version) || 1),
      updatedAt: new Date().toISOString(),
      tripsAccess: cleanTripsAccess,
      staffAccounts: cleanStaff,
      travelerAccounts: cleanTravelers
    };
  }

  // ---------------------------------------------------------------------------
  // PARSEUR CSV / EXCEL LOGITO
  // ---------------------------------------------------------------------------
  function detectCsvDelimiter(firstLine) {
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
    }
    if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) return ';';
    if (counts['\t'] >= counts[',']) return '\t';
    return ',';
  }

  function parseCsvRows(text, delimiter) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          currentField += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (ch === '\r' && next === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some(c => c !== '')) rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
        } else if (ch === '\n' || ch === '\r') {
          currentRow.push(currentField.trim());
          if (currentRow.some(c => c !== '')) rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += ch;
        }
      }
    }
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c !== '')) rows.push(currentRow);
    return rows;
  }

  function parseOptionTokens(rawOptionsStr) {
    if (!rawOptionsStr || !String(rawOptionsStr).trim()) return [];
    return String(rawOptionsStr)
      .split(/\s*[|+]\s*/)
      .map(tok => tok.trim())
      .filter(Boolean)
      .map(tok => {
        const dayMatch = tok.match(/^(?:j|jour)\s*(\d{1,2})\s*[:\-–]\s*(.+)$/i);
        if (dayMatch) {
          return {
            title: dayMatch[2].trim(),
            day: Number(dayMatch[1]),
            time: '',
            details: ''
          };
        }
        return {
          title: tok,
          day: null,
          time: '',
          details: ''
        };
      });
  }

  function mapLogitoColumnKey(headerNorm) {
    if (!headerNorm) return null;
    if (['dossier', 'ref', 'reference', 'n dossier', 'num dossier', 'numero dossier', 'booking', 'code dossier'].includes(headerNorm)) return 'dossierRef';
    if (['nom', 'lastname', 'nom famille', 'passager', 'client', 'voyageur', 'nom client'].includes(headerNorm)) return 'lastName';
    if (['prenom', 'firstname', 'first name'].includes(headerNorm)) return 'firstName';
    if (['nom affiche', 'intitule', 'displayname', 'display name'].includes(headerNorm)) return 'displayName';
    if (['email', 'e mail', 'mail', 'courriel', 'identifiant', 'login'].includes(headerNorm)) return 'login';
    if (['mdp', 'mot de passe', 'password', 'code acces'].includes(headerNorm)) return 'password';
    if (['ramassage', 'prise en charge', 'pickup', 'montee', 'lieu depart', 'point de montee'].includes(headerNorm)) return 'pickupPoint';
    if (['heure', 'horaire', 'heure ramassage', 'pickup time', 'heure depart'].includes(headerNorm)) return 'pickupTime';
    if (['siege', 'place', 'fauteuil', 'seat', 'n place', 'numero place'].includes(headerNorm)) return 'seatNumber';
    if (['chambre', 'room', 'n chambre', 'type chambre'].includes(headerNorm)) return 'roomNumber';
    if (['cabine', 'cabin', 'n cabine'].includes(headerNorm)) return 'cabinNumber';
    if (['options', 'option', 'excursions', 'excursion', 'facultatives'].includes(headerNorm)) return 'options';
    return null;
  }

  function parseLogitoTravelersCsv(csvText) {
    const clean = String(csvText || '').replace(/^\uFEFF/, '');
    if (!clean.trim()) return [];

    const firstBreak = clean.search(/\r?\n/);
    const firstLine = firstBreak === -1 ? clean : clean.slice(0, firstBreak);
    const delimiter = detectCsvDelimiter(firstLine);
    const rows = parseCsvRows(clean, delimiter);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => mapLogitoColumnKey(normHeader(h)));
    const results = [];

    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const item = {
        dossierRef: '',
        lastName: '',
        firstName: '',
        displayName: '',
        login: '',
        password: '',
        pickupPoint: '',
        pickupTime: '',
        seatNumber: '',
        roomNumber: '',
        cabinNumber: '',
        options: []
      };

      headers.forEach((fieldKey, colIdx) => {
        if (!fieldKey) return;
        const val = cells[colIdx] !== undefined ? String(cells[colIdx]).trim() : '';
        if (!val) return;
        if (fieldKey === 'options') {
          item.options = parseOptionTokens(val);
        } else {
          item[fieldKey] = val;
        }
      });

      if (!item.login && item.dossierRef) {
        item.login = item.dossierRef;
      }
      if (!item.displayName) {
        item.displayName = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.login || item.dossierRef;
      }

      if (item.login || item.dossierRef || item.lastName || item.displayName) {
        results.push(item);
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATEUR CSV PUBLIPOSTAGE (UTF-8 BOM, SÉPARATEUR ;)
  // ---------------------------------------------------------------------------
  function csvEscapeCell(val) {
    const s = String(val === undefined || val === null ? '' : val);
    if (/[;"\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildMailMergeCsv(trip, travelerEntries, plainPwdMap, basePublicUrl) {
    const tripId = (trip && trip.id) ? trip.id : '';
    const baseUrl = String(basePublicUrl || '').replace(/\/+$/, '');
    const loginLink = tripId
      ? (baseUrl ? `${baseUrl}/index.html?id=${encodeURIComponent(tripId)}` : `index.html?id=${encodeURIComponent(tripId)}`)
      : (baseUrl ? `${baseUrl}/index.html?login=1` : 'index.html?login=1');

    const header = [
      'Dossier', 'Nom', 'Prenom', 'Nom_Affiche', 'Identifiant',
      'Mot_de_Passe', 'Lien_Connexion', 'Prise_en_Charge',
      'Horaire', 'Siege', 'Chambre', 'Cabine', 'Options'
    ].join(';');

    const lines = [header];

    (travelerEntries || []).forEach(acc => {
      const tripEntry = (Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripId) : null) || {};
      const dossier = tripEntry.dossierRef || acc.dossierRef || '';
      const plain = (plainPwdMap && acc.id && plainPwdMap[acc.id])
        ? plainPwdMap[acc.id]
        : (acc.passwordHash ? '(MDP déjà défini — régénérer si besoin)' : '');
      const optionsStr = (Array.isArray(tripEntry.options) ? tripEntry.options : []).map(o => {
        if (typeof o === 'string') return o;
        if (!o || !o.title) return '';
        return o.day ? `J${o.day}: ${o.title}` : o.title;
      }).filter(Boolean).join(' | ');

      const row = [
        dossier,
        acc.lastName || '',
        acc.firstName || '',
        acc.displayName || '',
        acc.login || dossier,
        plain,
        loginLink,
        tripEntry.pickupPoint || '',
        tripEntry.pickupTime || '',
        tripEntry.seatNumber || '',
        tripEntry.roomNumber || '',
        tripEntry.cabinNumber || '',
        optionsStr
      ].map(csvEscapeCell).join(';');

      lines.push(row);
    });

    return '\uFEFF' + lines.join('\r\n');
  }

  // ---------------------------------------------------------------------------
  // GESTION DU REGISTRE EN MÉMOIRE & SYNCHRO LOCALE
  // ---------------------------------------------------------------------------
  async function ensureAdminRegistryLoaded(force = false) {
    if (adminRegistry && !force) return adminRegistry;
    if (global.GirardotAuth && typeof global.GirardotAuth.loadRegistry === 'function') {
      adminRegistry = await global.GirardotAuth.loadRegistry(force);
    } else {
      adminRegistry = { version: 1, updatedAt: null, tripsAccess: {}, staffAccounts: [], travelerAccounts: [] };
    }
    return adminRegistry;
  }

  async function persistAdminRegistryLocally() {
    if (!adminRegistry) return;
    if (global.GirardotAuth && typeof global.GirardotAuth.saveLocalRegistry === 'function') {
      adminRegistry = await global.GirardotAuth.saveLocalRegistry(adminRegistry);
    }
  }

  async function syncCurrentTripAccessIntoRegistry() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.id) return;
    await ensureAdminRegistryLoaded(false);
    if (!adminRegistry.tripsAccess) adminRegistry.tripsAccess = {};
    adminRegistry.tripsAccess[tripData.id] = {
      requireAuth: !!(tripData.accessControl && tripData.accessControl.requireAuth)
    };
    await persistAdminRegistryLocally();
  }

  function getActiveTripTravelerAccounts() {
    if (!adminRegistry || typeof tripData === 'undefined' || !tripData || !tripData.id) return [];
    return (adminRegistry.travelerAccounts || []).filter(acc =>
      Array.isArray(acc.trips) && acc.trips.some(t => t.tripId === tripData.id)
    );
  }

  function findOrCreateTravelerAccountIndex(matchObj) {
    const accounts = adminRegistry.travelerAccounts || (adminRegistry.travelerAccounts = []);
    const loginNorm = normHeader(matchObj.login);
    const dossierNorm = normHeader(matchObj.dossierRef);

    return accounts.findIndex(acc => {
      if (loginNorm && normHeader(acc.login) === loginNorm) return true;
      if (dossierNorm && normHeader(acc.dossierRef) === dossierNorm) return true;
      if (dossierNorm && Array.isArray(acc.trips)) {
        return acc.trips.some(t => normHeader(t.dossierRef) === dossierNorm);
      }
      return false;
    });
  }

  async function upsertTravelerForTrip(tripId, payload) {
    await ensureAdminRegistryLoaded(false);
    const accounts = adminRegistry.travelerAccounts || (adminRegistry.travelerAccounts = []);
    const idx = findOrCreateTravelerAccountIndex(payload);

    let acc;
    let isNew = false;
    if (idx >= 0) {
      acc = accounts[idx];
      if (payload.firstName) acc.firstName = payload.firstName;
      if (payload.lastName) acc.lastName = payload.lastName;
      if (payload.displayName) acc.displayName = payload.displayName;
      if (payload.login) acc.login = payload.login;
      if (payload.dossierRef && !acc.dossierRef) acc.dossierRef = payload.dossierRef;
    } else {
      isNew = true;
      const uid = 'trav-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      acc = {
        id: uid,
        login: payload.login || payload.dossierRef || uid,
        dossierRef: payload.dossierRef || '',
        passwordHash: '',
        role: 'traveler',
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        displayName: payload.displayName || [payload.firstName, payload.lastName].filter(Boolean).join(' ') || 'Voyageur',
        active: true,
        trips: []
      };
      accounts.push(acc);
    }

    if (payload.password) {
      acc.passwordHash = await global.GirardotAuth.hashPassword(payload.password);
      setPlainPwd(acc.id, payload.password);
    } else if (!acc.passwordHash) {
      const gen = global.GirardotAuth.generateReadablePassword(6);
      acc.passwordHash = await global.GirardotAuth.hashPassword(gen);
      setPlainPwd(acc.id, gen);
    }

    if (!Array.isArray(acc.trips)) acc.trips = [];
    const tIdx = acc.trips.findIndex(t => t.tripId === tripId);
    const existingTripEntry = tIdx >= 0 ? acc.trips[tIdx] : {};

    const mergedTripEntry = {
      tripId: tripId,
      dossierRef: payload.dossierRef || existingTripEntry.dossierRef || acc.dossierRef || '',
      pickupPoint: payload.pickupPoint !== undefined ? payload.pickupPoint : (existingTripEntry.pickupPoint || ''),
      pickupTime: payload.pickupTime !== undefined ? payload.pickupTime : (existingTripEntry.pickupTime || ''),
      seatNumber: payload.seatNumber !== undefined ? payload.seatNumber : (existingTripEntry.seatNumber || ''),
      roomNumber: payload.roomNumber !== undefined ? payload.roomNumber : (existingTripEntry.roomNumber || ''),
      cabinNumber: payload.cabinNumber !== undefined ? payload.cabinNumber : (existingTripEntry.cabinNumber || ''),
      options: (payload.options && payload.options.length > 0) ? payload.options : (existingTripEntry.options || []),
      personalDocs: Array.isArray(existingTripEntry.personalDocs) ? existingTripEntry.personalDocs : []
    };

    if (tIdx >= 0) acc.trips[tIdx] = mergedTripEntry;
    else acc.trips.push(mergedTripEntry);

    return { acc, isNew };
  }

  // ---------------------------------------------------------------------------
  // SYNCHRONISATION PASSAGERS / ROOMING LIST & IMPORT CSV LOGITO
  // ---------------------------------------------------------------------------
  async function syncTravelersFromDriverDossier() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.id) {
      alert('Aucun carnet actif.');
      return;
    }
    const dossier = tripData.driverDossier || {};
    const passengers = Array.isArray(dossier.passengersList) ? dossier.passengersList : [];
    const rooming = Array.isArray(dossier.roomingList) ? dossier.roomingList : [];

    if (passengers.length === 0) {
      alert("La liste des passagers du Dossier Conducteur est vide.\nImportez d'abord les passagers dans « Dossier Conducteur (Pro) » ou importez un CSV LogiTO.");
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const fullName = String(p.name || '').trim();
      if (!fullName) continue;

      const nameTokens = normHeader(fullName).split(' ').filter(w => w.length >= 2);
      let matchedRoom = '';
      if (rooming.length > 0 && nameTokens.length > 0) {
        const roomObj = rooming.find(r => {
          const occNorm = normHeader(r.occupants || '');
          return nameTokens.some(tok => occNorm.includes(tok));
        });
        if (roomObj) {
          matchedRoom = [roomObj.roomNumber ? `Ch. ${roomObj.roomNumber}` : '', roomObj.type || ''].filter(Boolean).join(' • ');
        }
      }

      const parts = fullName.split(/\s+/);
      const lastName = parts[0] || fullName;
      const firstName = parts.slice(1).join(' ');
      const slugName = normHeader(fullName).replace(/\s+/g, '.');
      const fallbackRef = `${(tripData.id || 'GIR').toUpperCase().slice(0, 8)}-${String(i + 1).padStart(3, '0')}`;
      const loginVal = (p.email && p.email.trim()) ? p.email.trim() : `${slugName || ('voyageur' + (i + 1))}@dossier.girardot`;

      const res = await upsertTravelerForTrip(tripData.id, {
        login: loginVal,
        dossierRef: p.dossierRef || fallbackRef,
        lastName: lastName,
        firstName: firstName,
        displayName: fullName,
        pickupPoint: p.pickup || '',
        seatNumber: p.seatNumber || '',
        roomNumber: matchedRoom
      });
      if (res.isNew) createdCount++;
      else updatedCount++;
    }

    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
    alert(`✓ Synchronisation terminée : ${createdCount} fiche(s) créée(s), ${updatedCount} mise(s) à jour pour "${tripData.title}".`);
  }

  function triggerLogitoCsvImport() {
    const inp = document.getElementById('adm-travelers-csv-input');
    if (inp) {
      inp.value = '';
      inp.click();
    }
  }

  async function handleLogitoCsvFileSelected(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file || typeof tripData === 'undefined' || !tripData || !tripData.id) return;

    const text = await file.text();
    const parsedRows = parseLogitoTravelersCsv(text);
    if (parsedRows.length === 0) {
      alert("⚠️ Aucune ligne voyageur valide détectée dans le fichier CSV.\nVérifiez que la première ligne contient des en-têtes (Dossier, Nom, Prenom, Email/Identifiant, Ramassage, Siege, Chambre, Options...).");
      return;
    }

    let created = 0;
    let updated = 0;
    for (const row of parsedRows) {
      const res = await upsertTravelerForTrip(tripData.id, row);
      if (res.isNew) created++;
      else updated++;
    }

    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
    alert(`✓ Import LogiTO réussi : ${created} voyageur(s) créé(s) et ${updated} mis à jour.`);
  }

  function downloadLogitoCsvTemplate() {
    const sample = '\uFEFF' + [
      'Dossier;Nom;Prenom;Email;Mot_de_Passe;Ramassage;Horaire;Siege;Chambre;Cabine;Options',
      'GIR-2026-101;MARTIN;Claire;claire.martin@exemple.fr;;Chalon-sur-Saône (Gare);06h15;6A;Double Vue Mer;;J4: Survol Hélicoptère | J7: Dîner Spectacle',
      'GIR-2026-102;BERNARD;Luc;luc.bernard@exemple.fr;LUC2026;Beaune (Péage);06h45;6B;Individuelle;;'
    ].join('\r\n');
    downloadTextFile('modele-import-voyageurs-logito.csv', sample, 'text/csv;charset=utf-8');
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function getBasePublicSiteUrl() {
    if (typeof getGitHubConfig === 'function') {
      const cfg = getGitHubConfig();
      const parts = (cfg.repo || '').split('/');
      const owner = (parts[0] || 'lauprojectai').toLowerCase();
      const repoName = parts[1] || 'Carnet-Voyage-Eletronique-Interactif';
      return `https://${owner}.github.io/${repoName}`;
    }
    return 'https://lauprojectai.github.io/Carnet-Voyage-Eletronique-Interactif';
  }

  async function exportMailMergeCsvClick() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.id) return;
    await ensureAdminRegistryLoaded(false);
    const travelers = getActiveTripTravelerAccounts();
    if (travelers.length === 0) {
      alert('Aucun voyageur inscrit sur ce départ à exporter.');
      return;
    }
    const csv = buildMailMergeCsv(tripData, travelers, getPlainPwdMap(), getBasePublicSiteUrl());
    downloadTextFile(`publipostage-acces-${tripData.id}.csv`, csv, 'text/csv;charset=utf-8');
  }

  async function generateMissingPasswordsForTrip() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.id) return;
    await ensureAdminRegistryLoaded(false);
    const travelers = getActiveTripTravelerAccounts();
    let count = 0;
    for (const acc of travelers) {
      if (!acc.passwordHash || !getPlainPwd(acc.id)) {
        const pwd = global.GirardotAuth.generateReadablePassword(6);
        acc.passwordHash = await global.GirardotAuth.hashPassword(pwd);
        setPlainPwd(acc.id, pwd);
        count++;
      }
    }
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
    alert(`✓ ${count} mot(s) de passe généré(s) et prêt(s) pour l'export publipostage.`);
  }

  // ---------------------------------------------------------------------------
  // ACTIONS D'ÉDITION DES FICHES VOYAGEURS
  // ---------------------------------------------------------------------------
  async function addNewTravelerAccount() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.id) return;
    await ensureAdminRegistryLoaded(false);
    const pwd = global.GirardotAuth.generateReadablePassword(6);
    const hash = await global.GirardotAuth.hashPassword(pwd);
    const id = 'trav-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const num = getActiveTripTravelerAccounts().length + 1;
    const ref = `${(tripData.id || 'GIR').toUpperCase().slice(0, 6)}-${String(num).padStart(3, '0')}`;

    const acc = {
      id: id,
      login: '',
      dossierRef: ref,
      passwordHash: hash,
      role: 'traveler',
      firstName: '',
      lastName: '',
      displayName: `Voyageur ${num}`,
      active: true,
      trips: [{
        tripId: tripData.id,
        dossierRef: ref,
        pickupPoint: '',
        pickupTime: '',
        seatNumber: '',
        roomNumber: '',
        cabinNumber: '',
        options: [],
        personalDocs: []
      }]
    };
    adminRegistry.travelerAccounts.push(acc);
    setPlainPwd(acc.id, pwd);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function updateTravelerAccountField(accountId, field, value) {
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    if (!acc) return;
    acc[field] = value;
    if ((field === 'firstName' || field === 'lastName') && (!acc.displayName || acc.displayName.startsWith('Voyageur '))) {
      acc.displayName = [acc.firstName, acc.lastName].filter(Boolean).join(' ') || acc.displayName;
    }
    await persistAdminRegistryLocally();
  }

  async function updateTravelerTripField(accountId, field, value) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    if (!acc || !Array.isArray(acc.trips)) return;
    const entry = acc.trips.find(t => t.tripId === tripData.id);
    if (!entry) return;
    entry[field] = value;
    await persistAdminRegistryLocally();
  }

  async function setCustomTravelerPassword(accountId, newPlain) {
    const clean = String(newPlain || '').trim();
    if (!clean) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    if (!acc) return;
    acc.passwordHash = await global.GirardotAuth.hashPassword(clean);
    setPlainPwd(acc.id, clean);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function regenerateTravelerPassword(accountId) {
    const pwd = global.GirardotAuth.generateReadablePassword(6);
    await setCustomTravelerPassword(accountId, pwd);
  }

  async function removeTravelerFromCurrentTrip(accountId) {
    if (typeof tripData === 'undefined' || !tripData) return;
    if (!confirm('Retirer ce voyageur de ce départ ?')) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    if (!acc || !Array.isArray(acc.trips)) return;
    acc.trips = acc.trips.filter(t => t.tripId !== tripData.id);
    if (acc.trips.length === 0) {
      adminRegistry.travelerAccounts = adminRegistry.travelerAccounts.filter(a => a.id !== accountId);
    }
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function addTravelerOptionForTrip(accountId) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry) return;
    if (!Array.isArray(entry.options)) entry.options = [];
    entry.options.push({ title: 'Nouvelle option / excursion', day: 1, time: '', details: '' });
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function updateTravelerOptionField(accountId, optIdx, field, val) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry || !Array.isArray(entry.options) || entry.options[optIdx] === undefined) return;
    if (typeof entry.options[optIdx] === 'string') {
      entry.options[optIdx] = { title: entry.options[optIdx], day: null, time: '', details: '' };
    }
    entry.options[optIdx][field] = field === 'day' ? (val ? Number(val) : null) : val;
    await persistAdminRegistryLocally();
  }

  async function removeTravelerOption(accountId, optIdx) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry || !Array.isArray(entry.options)) return;
    entry.options.splice(optIdx, 1);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function addTravelerPersonalDoc(accountId) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry) return;
    if (!Array.isArray(entry.personalDocs)) entry.personalDocs = [];
    entry.personalDocs.push({
      id: 'nom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      type: 'flight',
      title: 'E-Ticket / Document nominatif',
      reference: '',
      date: '',
      notes: '',
      qrCode: '',
      fileUrl: ''
    });
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function updateTravelerDocField(accountId, docIdx, field, val) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry || !Array.isArray(entry.personalDocs) || !entry.personalDocs[docIdx]) return;
    entry.personalDocs[docIdx][field] = val;
    await persistAdminRegistryLocally();
  }

  function handleTravelerDocFileUpload(accountId, docIdx, event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      await updateTravelerDocField(accountId, docIdx, 'fileUrl', e.target.result);
      await renderAdminAccessTab();
    };
    reader.readAsDataURL(file);
  }

  async function removeTravelerDoc(accountId, docIdx) {
    if (typeof tripData === 'undefined' || !tripData) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    const entry = acc && Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    if (!entry || !Array.isArray(entry.personalDocs)) return;
    entry.personalDocs.splice(docIdx, 1);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  function copyTravelerCredentials(accountId) {
    if (!adminRegistry || typeof tripData === 'undefined' || !tripData) return;
    const acc = (adminRegistry.travelerAccounts || []).find(a => a.id === accountId);
    if (!acc) return;
    const entry = Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
    const pwd = getPlainPwd(acc.id) || '(Mot de passe déjà transmis — utilisez Régénérer si oublié)';
    const url = `${getBasePublicSiteUrl()}/index.html?id=${encodeURIComponent(tripData.id)}`;
    const txt = [
      `Bonjour ${acc.displayName || ''},`,
      `Voici vos accès personnels pour votre carnet de voyage "${tripData.title}" :`,
      `• Lien : ${url}`,
      `• Identifiant : ${acc.login || (entry && entry.dossierRef) || acc.dossierRef}`,
      `• Mot de passe : ${pwd}`,
      entry && entry.pickupPoint ? `• Prise en charge : ${entry.pickupPoint}${entry.pickupTime ? ' à ' + entry.pickupTime : ''}` : '',
      entry && entry.seatNumber ? `• Place autocar : ${entry.seatNumber}` : ''
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(txt).then(() => {
      alert('✓ Message et identifiants copiés dans le presse-papier !');
    }).catch(() => {
      prompt('Copiez ces accès :', txt);
    });
  }

  // ---------------------------------------------------------------------------
  // GESTION ÉQUIPE PRO (CONDUCTEURS & ACCOMPAGNATEURS)
  // ---------------------------------------------------------------------------
  function getAllKnownTripsForAssignment() {
    const map = new Map();
    if (Array.isArray(global.AVAILABLE_TRIPS)) {
      global.AVAILABLE_TRIPS.forEach(t => {
        if (t && t.id) map.set(t.id, { id: t.id, title: t.title || t.id, dates: t.dates || '' });
      });
    }
    try {
      const custom = JSON.parse((global.localStorage && global.localStorage.getItem('girardot_trips_catalog')) || '[]');
      if (Array.isArray(custom)) {
        custom.forEach(t => {
          if (t && t.id && !map.has(t.id)) map.set(t.id, { id: t.id, title: t.title || t.id, dates: t.dates || '' });
        });
      }
    } catch (e) {}
    if (typeof tripData !== 'undefined' && tripData && tripData.id) {
      map.set(tripData.id, { id: tripData.id, title: tripData.title || tripData.id, dates: tripData.dates || '' });
    }
    return Array.from(map.values());
  }

  async function addNewStaffAccount() {
    await ensureAdminRegistryLoaded(false);
    const pwd = global.GirardotAuth.generateReadablePassword(6);
    const hash = await global.GirardotAuth.hashPassword(pwd);
    const id = 'staff-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    const num = (adminRegistry.staffAccounts || []).length + 1;

    const acc = {
      id: id,
      login: `equipier${num}@girardot.pro`,
      passwordHash: hash,
      role: 'driver',
      firstName: '',
      lastName: '',
      displayName: `Équipier ${num}`,
      active: true,
      assignedTrips: (typeof tripData !== 'undefined' && tripData && tripData.id) ? [tripData.id] : []
    };
    adminRegistry.staffAccounts.push(acc);
    setPlainPwd(acc.id, pwd);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function updateStaffAccountField(staffId, field, value) {
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.staffAccounts || []).find(s => s.id === staffId);
    if (!acc) return;
    acc[field] = value;
    if ((field === 'firstName' || field === 'lastName') && (!acc.displayName || acc.displayName.startsWith('Équipier '))) {
      acc.displayName = [acc.firstName, acc.lastName].filter(Boolean).join(' ') || acc.displayName;
    }
    await persistAdminRegistryLocally();
  }

  async function toggleStaffTripAssignment(staffId, tripId, checked) {
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.staffAccounts || []).find(s => s.id === staffId);
    if (!acc) return;
    if (!Array.isArray(acc.assignedTrips)) acc.assignedTrips = [];
    if (checked) {
      if (!acc.assignedTrips.includes(tripId)) acc.assignedTrips.push(tripId);
    } else {
      acc.assignedTrips = acc.assignedTrips.filter(id => id !== tripId);
    }
    await persistAdminRegistryLocally();
  }

  async function setCustomStaffPassword(staffId, newPlain) {
    const clean = String(newPlain || '').trim();
    if (!clean) return;
    await ensureAdminRegistryLoaded(false);
    const acc = (adminRegistry.staffAccounts || []).find(s => s.id === staffId);
    if (!acc) return;
    acc.passwordHash = await global.GirardotAuth.hashPassword(clean);
    setPlainPwd(acc.id, clean);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  async function regenerateStaffPassword(staffId) {
    const pwd = global.GirardotAuth.generateReadablePassword(6);
    await setCustomStaffPassword(staffId, pwd);
  }

  async function deleteStaffAccount(staffId) {
    if (!confirm('Supprimer définitivement ce compte Conducteur / Accompagnateur ?')) return;
    await ensureAdminRegistryLoaded(false);
    adminRegistry.staffAccounts = (adminRegistry.staffAccounts || []).filter(s => s.id !== staffId);
    await persistAdminRegistryLocally();
    await renderAdminAccessTab();
  }

  function copyStaffCredentials(staffId) {
    if (!adminRegistry) return;
    const acc = (adminRegistry.staffAccounts || []).find(s => s.id === staffId);
    if (!acc) return;
    const pwd = getPlainPwd(acc.id) || '(Mot de passe déjà défini — cliquez Régénérer si oublié)';
    const url = `${getBasePublicSiteUrl()}/conducteur.html`;
    const txt = [
      `Accès Dossier Conducteur / Accompagnateur — Voyages Girardot`,
      `• Portail pro : ${url}`,
      `• Identifiant : ${acc.login}`,
      `• Mot de passe : ${pwd}`,
      `• Départs assignés : ${(acc.assignedTrips || []).join(', ') || 'Aucun'}`
    ].join('\n');

    navigator.clipboard.writeText(txt).then(() => {
      alert('✓ Accès Pro copiés dans le presse-papier !');
    }).catch(() => {
      prompt('Copiez ces accès :', txt);
    });
  }

  // ---------------------------------------------------------------------------
  // RENDU DE L'ONGLET "VOYAGEURS & ACCÈS"
  // ---------------------------------------------------------------------------
  function switchAccessSubTab(sub) {
    activeAccessSubTab = sub === 'staff' ? 'staff' : 'travelers';
    const pTrav = document.getElementById('adm-access-panel-travelers');
    const pStaff = document.getElementById('adm-access-panel-staff');
    const bTrav = document.getElementById('access-tab-btn-travelers');
    const bStaff = document.getElementById('access-tab-btn-staff');

    if (pTrav) pTrav.style.display = activeAccessSubTab === 'travelers' ? 'block' : 'none';
    if (pStaff) pStaff.style.display = activeAccessSubTab === 'staff' ? 'block' : 'none';
    if (bTrav) {
      bTrav.style.background = activeAccessSubTab === 'travelers' ? '#144534' : '#f1f5f9';
      bTrav.style.color = activeAccessSubTab === 'travelers' ? '#ffffff' : '#334155';
    }
    if (bStaff) {
      bStaff.style.background = activeAccessSubTab === 'staff' ? '#0284c7' : '#f1f5f9';
      bStaff.style.color = activeAccessSubTab === 'staff' ? '#ffffff' : '#334155';
    }
  }

  async function renderAdminAccessTab() {
    await ensureAdminRegistryLoaded(false);
    const travelersListEl = document.getElementById('adm-access-travelers-list');
    const staffListEl = document.getElementById('adm-access-staff-list');
    const countTravEl = document.getElementById('access-count-travelers');
    const countStaffEl = document.getElementById('access-count-staff');
    const modeBadgeEl = document.getElementById('adm-access-status-badge');

    if (modeBadgeEl && typeof tripData !== 'undefined' && tripData) {
      const isProt = !!(tripData.accessControl && tripData.accessControl.requireAuth);
      modeBadgeEl.innerHTML = isProt
        ? '<span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:800;"><i class="fa-solid fa-lock"></i> Carnet protégé par ID + MDP</span>'
        : '<span style="background:#fef3c7; color:#92400e; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:800;"><i class="fa-solid fa-lock-open"></i> Accès libre (?id=...)</span>';
    }

    const activeTravelers = getActiveTripTravelerAccounts();
    const staff = adminRegistry.staffAccounts || [];

    if (countTravEl) countTravEl.innerText = activeTravelers.length;
    if (countStaffEl) countStaffEl.innerText = staff.length;

    if (travelersListEl) {
      if (activeTravelers.length === 0) {
        travelersListEl.innerHTML = `
          <div style="background:white; border:1px dashed #cbd5e1; border-radius:12px; padding:26px; text-align:center; color:#64748b;">
            <i class="fa-solid fa-users-slash" style="font-size:2rem; color:#94a3b8; margin-bottom:8px;"></i>
            <div style="font-weight:800; color:#1e293b; margin-bottom:4px;">Aucun voyageur encore rattaché à ce départ</div>
            <p style="font-size:0.82rem; margin-bottom:12px;">Cliquez sur <strong>« Synchro Passagers / Rooming »</strong>, importez un export <strong>CSV LogiTO</strong> ou ajoutez une fiche manuellement.</p>
          </div>
        `;
      } else {
        travelersListEl.innerHTML = activeTravelers.map(acc => {
          const entry = acc.trips.find(t => t.tripId === tripData.id) || {};
          const otherCount = acc.trips.length - 1;
          const plainPwd = getPlainPwd(acc.id);
          const opts = Array.isArray(entry.options) ? entry.options : [];
          const docs = Array.isArray(entry.personalDocs) ? entry.personalDocs : [];

          return `
            <div class="section-box" style="border-left:4px solid var(--primary-color); background:white; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong style="font-size:1rem; color:var(--primary-dark);">${esc(acc.displayName || 'Voyageur')}</strong>
                  ${entry.dossierRef ? `<span style="background:#fef3c7; color:#92400e; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:999px;">Dossier ${esc(entry.dossierRef)}</span>` : ''}
                  ${otherCount > 0 ? `<span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:999px;">+${otherCount} autre(s) voyage(s)</span>` : ''}
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button type="button" onclick="openSendClientEmailModal('${esc(acc.id)}')" class="btn-secondary" style="font-size:0.74rem; padding:4px 10px; background:#ecfdf5; color:#047857; border-color:#86efac; font-weight:800;">
                    <i class="fa-solid fa-paper-plane"></i> Envoyer Client
                  </button>
                  <button type="button" onclick="copyTravelerCredentials('${esc(acc.id)}')" class="btn-secondary" style="font-size:0.74rem; padding:4px 10px; background:#eff6ff; color:#0369a1; border-color:#bae6fd; font-weight:700;">
                    <i class="fa-solid fa-copy"></i> Copier accès
                  </button>
                  <button type="button" onclick="removeTravelerFromCurrentTrip('${esc(acc.id)}')" class="btn-secondary" style="font-size:0.74rem; padding:4px 10px; color:#dc2626; border-color:#fca5a5;">
                    <i class="fa-solid fa-trash"></i> Retirer
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Nom affiché (accueil « Bonjour ... ») :</label>
                  <input type="text" class="form-control" value="${esc(acc.displayName || '')}" onchange="updateTravelerAccountField('${esc(acc.id)}', 'displayName', this.value)">
                </div>
                <div class="form-group">
                  <label>Prénom &amp; Nom (pour CSV publipostage) :</label>
                  <div style="display:flex; gap:6px;">
                    <input type="text" class="form-control" placeholder="Prénom" value="${esc(acc.firstName || '')}" onchange="updateTravelerAccountField('${esc(acc.id)}', 'firstName', this.value)">
                    <input type="text" class="form-control" placeholder="Nom" value="${esc(acc.lastName || '')}" onchange="updateTravelerAccountField('${esc(acc.id)}', 'lastName', this.value)">
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Identifiant de connexion (E-mail ou Dossier) :</label>
                  <input type="text" class="form-control" value="${esc(acc.login || '')}" onchange="updateTravelerAccountField('${esc(acc.id)}', 'login', this.value)">
                </div>
                <div class="form-group">
                  <label>N° Dossier sur ce départ :</label>
                  <input type="text" class="form-control" value="${esc(entry.dossierRef || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'dossierRef', this.value)">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Mot de passe (haché SHA-256 à la publication) :</label>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" class="form-control" id="pwd-inp-${esc(acc.id)}" value="${esc(plainPwd)}" placeholder="${acc.passwordHash ? 'Défini (saisir pour remplacer)' : 'Aucun MDP'}" style="font-family:monospace; font-weight:700;">
                    <button type="button" onclick="setCustomTravelerPassword('${esc(acc.id)}', document.getElementById('pwd-inp-${esc(acc.id)}').value)" class="btn-secondary" style="white-space:nowrap; font-size:0.75rem; padding:6px 10px;">
                      Appliquer
                    </button>
                    <button type="button" onclick="regenerateTravelerPassword('${esc(acc.id)}')" class="btn-secondary" style="white-space:nowrap; font-size:0.75rem; padding:6px 10px; background:#fef3c7; color:#92400e; border-color:#fcd34d; font-weight:700;">
                      <i class="fa-solid fa-dice"></i> Régénérer
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Prise en charge &amp; Horaire :</label>
                  <div style="display:flex; gap:6px;">
                    <input type="text" class="form-control" placeholder="Lieu (ex: Chalon Gare)" value="${esc(entry.pickupPoint || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'pickupPoint', this.value)">
                    <input type="text" class="form-control" placeholder="06h15" style="max-width:105px;" value="${esc(entry.pickupTime || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'pickupTime', this.value)">
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Place autocar :</label>
                  <input type="text" class="form-control" placeholder="Ex: 4A / 4B" value="${esc(entry.seatNumber || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'seatNumber', this.value)">
                </div>
                <div class="form-group">
                  <label>Chambre hôtel / Cabine croisière :</label>
                  <div style="display:flex; gap:6px;">
                    <input type="text" class="form-control" placeholder="Chambre (ex: 104 Double)" value="${esc(entry.roomNumber || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'roomNumber', this.value)">
                    <input type="text" class="form-control" placeholder="Cabine (si croisière)" value="${esc(entry.cabinNumber || '')}" onchange="updateTravelerTripField('${esc(acc.id)}', 'cabinNumber', this.value)">
                  </div>
                </div>
              </div>

              <!-- Options & excursions facultatives réservées -->
              <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 12px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#92400e;"><i class="fa-solid fa-star"></i> Options &amp; Excursions réservées (${opts.length})</strong>
                  <button type="button" onclick="addTravelerOptionForTrip('${esc(acc.id)}')" class="btn-secondary" style="font-size:0.72rem; padding:3px 9px; background:white;">
                    + Ajouter une option
                  </button>
                </div>
                ${opts.map((o, oIdx) => {
                  const obj = typeof o === 'string' ? { title: o, day: '', time: '', details: '' } : (o || {});
                  return `
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; align-items:center;">
                      <input type="number" class="form-control" placeholder="Jour" style="max-width:70px; font-size:0.78rem;" value="${obj.day || ''}" onchange="updateTravelerOptionField('${esc(acc.id)}', ${oIdx}, 'day', this.value)">
                      <input type="text" class="form-control" placeholder="Heure" style="max-width:80px; font-size:0.78rem;" value="${esc(obj.time || '')}" onchange="updateTravelerOptionField('${esc(acc.id)}', ${oIdx}, 'time', this.value)">
                      <input type="text" class="form-control" placeholder="Intitulé de l'option" style="flex:1; min-width:160px; font-size:0.78rem;" value="${esc(obj.title || '')}" onchange="updateTravelerOptionField('${esc(acc.id)}', ${oIdx}, 'title', this.value)">
                      <input type="text" class="form-control" placeholder="Détails (lieu, rang...)" style="flex:1; min-width:150px; font-size:0.78rem;" value="${esc(obj.details || '')}" onchange="updateTravelerOptionField('${esc(acc.id)}', ${oIdx}, 'details', this.value)">
                      <button type="button" onclick="removeTravelerOption('${esc(acc.id)}', ${oIdx})" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:5px 8px; cursor:pointer;">&times;</button>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Documents nominatifs individuels -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#1e293b;"><i class="fa-solid fa-id-badge" style="color:#0284c7;"></i> Documents Nominatifs Individuels (${docs.length})</strong>
                  <button type="button" onclick="addTravelerPersonalDoc('${esc(acc.id)}')" class="btn-secondary" style="font-size:0.72rem; padding:3px 9px; background:white;">
                    + Ajouter un document nominatif
                  </button>
                </div>
                ${docs.map((d, dIdx) => `
                  <div style="background:white; border:1px solid #cbd5e1; border-radius:8px; padding:8px; margin-bottom:6px;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
                      <select class="form-control" style="max-width:150px; font-size:0.76rem;" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'type', this.value)">
                        <option value="flight" ${d.type === 'flight' ? 'selected' : ''}>Billet d'avion</option>
                        <option value="ticket" ${d.type === 'ticket' ? 'selected' : ''}>Billet / Entrée</option>
                        <option value="voucher" ${d.type === 'voucher' ? 'selected' : ''}>Voucher / Hôtel</option>
                        <option value="visa" ${d.type === 'visa' ? 'selected' : ''}>Visa / ESTA</option>
                        <option value="other" ${(!d.type || d.type === 'other') ? 'selected' : ''}>Autre doc</option>
                      </select>
                      <input type="text" class="form-control" placeholder="Titre du document" style="flex:1; min-width:160px; font-size:0.76rem;" value="${esc(d.title || '')}" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'title', this.value)">
                      <input type="text" class="form-control" placeholder="Référence / PNR" style="max-width:140px; font-size:0.76rem;" value="${esc(d.reference || '')}" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'reference', this.value)">
                      <input type="text" class="form-control" placeholder="Date" style="max-width:105px; font-size:0.76rem;" value="${esc(d.date || '')}" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'date', this.value)">
                      <button type="button" onclick="removeTravelerDoc('${esc(acc.id)}', ${dIdx})" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:5px 8px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                      <input type="text" class="form-control" placeholder="Texte QR Code (optionnel)" style="max-width:190px; font-size:0.75rem; font-family:monospace;" value="${esc(d.qrCode || '')}" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'qrCode', this.value)">
                      <input type="text" class="form-control" placeholder="Notes (siège, terminal...)" style="flex:1; min-width:150px; font-size:0.75rem;" value="${esc(d.notes || '')}" onchange="updateTravelerDocField('${esc(acc.id)}', ${dIdx}, 'notes', this.value)">
                      <label class="btn-secondary" style="margin:0; font-size:0.72rem; padding:4px 8px; cursor:pointer; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd;">
                        <i class="fa-solid fa-paperclip"></i> ${d.fileUrl ? 'Fichier joint ✓' : 'Joindre PDF/Img'}
                        <input type="file" accept="image/*,.pdf" style="display:none;" onchange="handleTravelerDocFileUpload('${esc(acc.id)}', ${dIdx}, event)">
                      </label>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (staffListEl) {
      const knownTrips = getAllKnownTripsForAssignment();
      if (staff.length === 0) {
        staffListEl.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">Aucun compte Conducteur / Accompagnateur configuré.</div>`;
      } else {
        staffListEl.innerHTML = staff.map(s => {
          const assigned = Array.isArray(s.assignedTrips) ? s.assignedTrips : [];
          const plainPwd = getPlainPwd(s.id);
          return `
            <div class="section-box" style="border-left:4px solid #0284c7; background:white; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:1rem; color:#0f172a;">${esc(s.displayName || s.login)}</strong>
                  <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:999px;">
                    ${s.role === 'guide' ? 'Accompagnateur' : 'Conducteur'}
                  </span>
                </div>
                <div style="display:flex; gap:6px;">
                  <button type="button" onclick="copyStaffCredentials('${esc(s.id)}')" class="btn-secondary" style="font-size:0.74rem; padding:4px 10px; background:#eff6ff; color:#0369a1; border-color:#bae6fd; font-weight:700;">
                    <i class="fa-solid fa-copy"></i> Copier accès pro
                  </button>
                  <button type="button" onclick="deleteStaffAccount('${esc(s.id)}')" class="btn-secondary" style="font-size:0.74rem; padding:4px 10px; color:#dc2626; border-color:#fca5a5;">
                    <i class="fa-solid fa-trash"></i> Supprimer
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Nom affiché :</label>
                  <input type="text" class="form-control" value="${esc(s.displayName || '')}" onchange="updateStaffAccountField('${esc(s.id)}', 'displayName', this.value)">
                </div>
                <div class="form-group">
                  <label>Fonction :</label>
                  <select class="form-control" onchange="updateStaffAccountField('${esc(s.id)}', 'role', this.value)">
                    <option value="driver" ${s.role !== 'guide' ? 'selected' : ''}>Conducteur</option>
                    <option value="guide" ${s.role === 'guide' ? 'selected' : ''}>Accompagnateur</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Identifiant Pro :</label>
                  <input type="text" class="form-control" value="${esc(s.login || '')}" onchange="updateStaffAccountField('${esc(s.id)}', 'login', this.value)">
                </div>
                <div class="form-group">
                  <label>Mot de passe Pro :</label>
                  <div style="display:flex; gap:6px;">
                    <input type="text" class="form-control" id="staff-pwd-${esc(s.id)}" value="${esc(plainPwd)}" placeholder="${s.passwordHash ? 'Défini (saisir pour remplacer)' : 'Aucun MDP'}" style="font-family:monospace; font-weight:700;">
                    <button type="button" onclick="setCustomStaffPassword('${esc(s.id)}', document.getElementById('staff-pwd-${esc(s.id)}').value)" class="btn-secondary" style="font-size:0.75rem; padding:6px 10px;">Appliquer</button>
                    <button type="button" onclick="regenerateStaffPassword('${esc(s.id)}')" class="btn-secondary" style="font-size:0.75rem; padding:6px 10px; background:#fef3c7; color:#92400e; border-color:#fcd34d; font-weight:700;">
                      <i class="fa-solid fa-dice"></i> Régénérer
                    </button>
                  </div>
                </div>
              </div>

              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
                <strong style="font-size:0.78rem; color:#334155; display:block; margin-bottom:6px;">
                  <i class="fa-solid fa-route" style="color:#0284c7;"></i> Départs assignés à ce compte :
                </strong>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                  <label style="display:inline-flex; align-items:center; gap:5px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:4px 9px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                    <input type="checkbox" ${assigned.includes('*') ? 'checked' : ''} onchange="toggleStaffTripAssignment('${esc(s.id)}', '*', this.checked)">
                    Tous les départs (*)
                  </label>
                  ${knownTrips.map(kt => `
                    <label style="display:inline-flex; align-items:center; gap:5px; background:white; border:1px solid #cbd5e1; border-radius:8px; padding:4px 9px; font-size:0.76rem; font-weight:600; cursor:pointer;">
                      <input type="checkbox" ${assigned.includes(kt.id) ? 'checked' : ''} onchange="toggleStaffTripAssignment('${esc(s.id)}', '${esc(kt.id)}', this.checked)">
                      ${esc(kt.title)}
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    switchAccessSubTab(activeAccessSubTab);
  }

  // ---------------------------------------------------------------------------
  // PUBLICATION SÉCURISÉE DU REGISTRE SUR GITHUB
  // ---------------------------------------------------------------------------
  async function publishAccessRegistryToGitHub(repoArg, branchArg, tokenArg) {
    const cfg = (typeof getGitHubConfig === 'function') ? getGitHubConfig() : {};
    const repo = repoArg || cfg.repo;
    const branch = branchArg || cfg.branch || 'main';
    const token = tokenArg || cfg.token;
    if (!token || !repo) throw new Error('Token ou dépôt GitHub non configuré.');

    await syncCurrentTripAccessIntoRegistry();
    const sanitized = sanitizeRegistryForPublish(adminRegistry);
    const jsonString = JSON.stringify(sanitized, null, 2);
    const regPath = 'voyages/access_registry.json';
    const cleanRegPath = regPath.split('/').map(encodeURIComponent).join('/');

    let existingSha = (typeof getGitHubFileSha === 'function')
      ? await getGitHubFileSha(repo, regPath, branch, token)
      : null;

    const putBody = {
      message: 'chore(auth): mise à jour du registre voyageurs & accès',
      content: (typeof encodeUtf8Base64 === 'function')
        ? encodeUtf8Base64(jsonString)
        : window.btoa(unescape(encodeURIComponent(jsonString))),
      branch: branch
    };
    if (existingSha) putBody.sha = existingSha;

    let res = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanRegPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(putBody)
    });

    if (!res.ok && (res.status === 422 || res.status === 409) && typeof getGitHubFileSha === 'function') {
      const freshSha = await getGitHubFileSha(repo, regPath, branch, token);
      if (freshSha) {
        putBody.sha = freshSha;
        res = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanRegPath}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(putBody)
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Échec publication access_registry.json (${res.status}) : ${err.message}`);
    }
    return true;
  }

  async function publishAccessRegistryButtonClick() {
    const cfg = (typeof getGitHubConfig === 'function') ? getGitHubConfig() : {};
    if (!cfg.token) {
      alert('Veuillez d’abord renseigner votre jeton GitHub dans « Synchro GitHub » en haut à droite.');
      if (typeof openGitHubConfigModal === 'function') openGitHubConfigModal();
      return;
    }
    const btn = document.getElementById('btn-publish-access-github');
    const prev = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publication...';
    }
    try {
      await publishAccessRegistryToGitHub(cfg.repo, cfg.branch, cfg.token);
      alert('✓ Registre des accès (voyageurs, conducteurs et mots de passe hachés SHA-256) publié sur GitHub !');
    } catch (e) {
      alert('❌ ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATEUR D'E-MAIL PERSONNALISÉ « ENVOYER CLIENT »
  // ---------------------------------------------------------------------------
  function buildClientEmailDraft(trip, travelerAcc, plainPwd, overrides) {
    const t = trip || {};
    const ov = overrides || {};
    const branding = (t.branding && typeof t.branding === 'object') ? t.branding : {};
    const brandName = (branding.partnerName && String(branding.partnerName).trim())
      ? String(branding.partnerName).trim()
      : 'Voyages Girardot';
    const isWhiteLabel = Boolean(branding.hideGirardotBrand);
    const welcomeMessage = (branding.welcomeMessage && String(branding.welcomeMessage).trim())
      ? String(branding.welcomeMessage).trim()
      : '';

    const tripId = t.id || '';
    const defaultLink = tripId
      ? `${getBasePublicSiteUrl()}/index.html?id=${encodeURIComponent(tripId)}`
      : `${getBasePublicSiteUrl()}/index.html`;
    const link = (ov.link && String(ov.link).trim()) ? String(ov.link).trim() : defaultLink;

    const entry = (travelerAcc && Array.isArray(travelerAcc.trips))
      ? travelerAcc.trips.find(item => item.tripId === tripId)
      : null;

    const defaultTo = (travelerAcc && travelerAcc.login && String(travelerAcc.login).includes('@'))
      ? String(travelerAcc.login).trim()
      : '';
    const to = ov.to !== undefined ? String(ov.to).trim() : defaultTo;

    const fallbackName = travelerAcc
      ? (travelerAcc.displayName || [travelerAcc.firstName, travelerAcc.lastName].filter(Boolean).join(' '))
      : '';
    const clientName = ov.clientName !== undefined
      ? String(ov.clientName).trim()
      : String(fallbackName || '').trim();

    const tripTitle = t.title || 'Votre voyage';
    const subject = `Votre Carnet de Voyages interactif — ${tripTitle}${t.dates ? ` (${t.dates})` : ''}`;

    const lines = [];
    lines.push(clientName ? `Bonjour ${clientName},` : 'Bonjour Madame, Monsieur,');
    lines.push('');

    const detailsParts = [t.subtitle ? String(t.subtitle).trim() : '', t.dates ? String(t.dates).trim() : ''].filter(Boolean);
    lines.push(
      `Nous avons le plaisir de vous transmettre votre Carnet de Voyages interactif pour votre départ « ${tripTitle} »${detailsParts.length ? ` (${detailsParts.join(' • ')})` : ''}.`
    );

    if (welcomeMessage) {
      lines.push('');
      lines.push(welcomeMessage);
    }

    lines.push('');
    lines.push(`👉 Accéder à votre Carnet de Voyages : ${link}`);

    const requiresAuth = Boolean(t.accessControl && t.accessControl.requireAuth);
    if (travelerAcc || requiresAuth) {
      const loginVal = travelerAcc
        ? (travelerAcc.login || (entry && entry.dossierRef) || travelerAcc.dossierRef || '')
        : '(Votre identifiant personnel)';
      const pwdVal = plainPwd
        ? String(plainPwd)
        : '(utilisez le mot de passe communiqué ou demandez sa réinitialisation)';
      const dossierVal = (entry && entry.dossierRef) || (travelerAcc && travelerAcc.dossierRef) || '';

      lines.push('');
      lines.push('🔐 Vos accès personnels :');
      if (loginVal) lines.push(`• Identifiant : ${loginVal}`);
      lines.push(`• Mot de passe : ${pwdVal}`);
      if (dossierVal) lines.push(`• N° de dossier : ${dossierVal}`);
    }

    if (entry) {
      const persLines = [];
      if (entry.pickupPoint) {
        persLines.push(`• Prise en charge : ${entry.pickupPoint}${entry.pickupTime ? ` à ${entry.pickupTime}` : ''}`);
      }
      if (entry.seatNumber) persLines.push(`• Place autocar : ${entry.seatNumber}`);
      if (entry.cabinNumber) persLines.push(`• Cabine : ${entry.cabinNumber}`);
      if (entry.roomNumber) persLines.push(`• Chambre : ${entry.roomNumber}`);
      const opts = (Array.isArray(entry.options) ? entry.options : []).map(o => {
        if (typeof o === 'string') return o.trim();
        if (!o || !o.title) return '';
        return o.day ? `Jour ${o.day} : ${o.title}` : o.title;
      }).filter(Boolean);
      if (opts.length > 0) persLines.push(`• Options réservées : ${opts.join(' | ')}`);

      if (persLines.length > 0) {
        lines.push('');
        lines.push('🧳 Vos informations personnalisées :');
        persLines.forEach(l => lines.push(l));
      }
    }

    lines.push('');
    lines.push(
      '💡 Astuce pratique : ouvrez ce lien une première fois sur votre smartphone avant le départ (ou ajoutez-le à votre écran d’accueil) pour le consulter ensuite 100 % hors-ligne tout au long du voyage. Vous pouvez également l’imprimer en PDF ou télécharger votre carnet souvenir numérique directement depuis l’en-tête.'
    );
    lines.push('');
    lines.push('Bon voyage !');
    lines.push(`L’équipe ${brandName}`);

    if (!isWhiteLabel && t.contacts && t.contacts.agence) {
      const ag = t.contacts.agence;
      const agInfo = [ag.phone || '', ag.email || ''].filter(Boolean).join(' • ');
      if (agInfo) lines.push(agInfo);
    }

    return {
      to,
      clientName,
      link,
      subject,
      body: lines.join('\n')
    };
  }

  function encodeRfc2047Utf8(str) {
    const raw = String(str || '');
    if (!raw) return '';
    let b64 = '';
    if (typeof Buffer !== 'undefined') {
      b64 = Buffer.from(raw, 'utf8').toString('base64');
    } else if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
      const bytes = new TextEncoder().encode(raw);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      b64 = btoa(bin);
    } else {
      return raw;
    }
    return `=?UTF-8?B?${b64}?=`;
  }

  function buildEmlFileContent(params) {
    const p = params || {};
    const to = String(p.to || '').replace(/[\r\n]+/g, ' ').trim();
    const subject = String(p.subject || 'Votre Carnet de Voyages').replace(/[\r\n]+/g, ' ').trim();
    const body = String(p.body || '').replace(/\r?\n/g, '\r\n');

    const headers = [
      'X-Unsent: 1',
      'MIME-Version: 1.0'
    ];
    if (to) headers.push(`To: ${to}`);
    headers.push(`Subject: ${encodeRfc2047Utf8(subject)}`);
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 8bit');

    return headers.join('\r\n') + '\r\n\r\n' + body + '\r\n';
  }

  function getActiveClientShareLinkForEmail() {
    const inputEl = typeof document !== 'undefined' ? document.getElementById('client-share-link') : null;
    if (inputEl && inputEl.value && /^https?:\/\//i.test(inputEl.value.trim())) {
      return inputEl.value.trim();
    }
    if (typeof tripData !== 'undefined' && tripData && tripData.id) {
      return `${getBasePublicSiteUrl()}/index.html?id=${encodeURIComponent(tripData.id)}`;
    }
    return `${getBasePublicSiteUrl()}/index.html`;
  }

  function installSendEmailDialogFallback() {
    if (typeof document === 'undefined' || typeof HTMLDialogElement === 'undefined') return;
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const dialog = document.getElementById('send-client-email-modal');
    if (!dialog || dialog.dataset.lightDismissBound === '1') return;
    dialog.dataset.lightDismissBound = '1';
    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => { pressedOutside = isOutside(e); });
    dialog.addEventListener('pointerup', (e) => { if (pressedOutside && isOutside(e)) dialog.close(); });
  }

  function applySelectedTravelerToEmailModal(preserveManualFields) {
    if (typeof document === 'undefined' || typeof tripData === 'undefined' || !tripData) return;
    const sel = document.getElementById('email-traveler-select');
    const toInput = document.getElementById('email-to-input');
    const nameInput = document.getElementById('email-client-name-input');
    const linkInput = document.getElementById('email-trip-link-input');
    const subjectInput = document.getElementById('email-subject-input');
    const bodyEl = document.getElementById('email-body-textarea');
    const hintEl = document.getElementById('email-access-hint');
    const feedbackEl = document.getElementById('send-email-feedback');

    const accountId = sel ? sel.value : '';
    const acc = accountId && adminRegistry
      ? (adminRegistry.travelerAccounts || []).find(a => a.id === accountId)
      : null;
    const plainPwd = acc ? getPlainPwd(acc.id) : '';

    const overrides = {
      link: (linkInput && linkInput.value.trim()) ? linkInput.value.trim() : getActiveClientShareLinkForEmail()
    };
    if (preserveManualFields) {
      if (toInput) overrides.to = toInput.value;
      if (nameInput) overrides.clientName = nameInput.value;
    }

    const draft = buildClientEmailDraft(tripData, acc, plainPwd, overrides);

    if (!preserveManualFields) {
      if (toInput) toInput.value = draft.to;
      if (nameInput) nameInput.value = draft.clientName;
      if (linkInput) linkInput.value = draft.link;
    }
    if (subjectInput) subjectInput.value = draft.subject;
    if (bodyEl) bodyEl.value = draft.body;
    if (feedbackEl) feedbackEl.textContent = '';

    if (hintEl) {
      const requiresAuth = Boolean(tripData.accessControl && tripData.accessControl.requireAuth);
      if (acc) {
        hintEl.innerHTML = plainPwd
          ? '<span style="color:#047857; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Identifiant, mot de passe et fiche nominative inclus dans le message.</span>'
          : '<span style="color:#b45309; font-weight:700;"><i class="fa-solid fa-key"></i> Mot de passe déjà défini : pensez à le régénérer dans « Voyageurs &amp; Accès » si le client l’a oublié.</span>';
      } else if (requiresAuth) {
        hintEl.innerHTML = '<span style="color:#b45309; font-weight:700;"><i class="fa-solid fa-lock"></i> Ce carnet est protégé par ID/MDP : sélectionnez un voyageur ci-dessus pour inclure ses accès.</span>';
      } else {
        hintEl.innerHTML = '<span style="color:#0369a1; font-weight:700;"><i class="fa-solid fa-lock-open"></i> Accès direct par lien (?id=...) prêt à envoyer au client.</span>';
      }
    }
  }

  function regenerateClientEmailBody() {
    applySelectedTravelerToEmailModal(true);
    const feedbackEl = document.getElementById('send-email-feedback');
    if (feedbackEl) {
      feedbackEl.style.color = '#0369a1';
      feedbackEl.textContent = '✓ Texte de l’e-mail actualisé.';
    }
  }

  async function openSendClientEmailModal(accountId = '') {
    if (typeof document === 'undefined' || typeof tripData === 'undefined' || !tripData) {
      alert('Aucun voyage actif sélectionné.');
      return;
    }
    await ensureAdminRegistryLoaded(false);

    const dialog = document.getElementById('send-client-email-modal');
    if (!dialog) return;

    installSendEmailDialogFallback();

    const sel = document.getElementById('email-traveler-select');
    const linkInput = document.getElementById('email-trip-link-input');
    if (linkInput) linkInput.value = getActiveClientShareLinkForEmail();

    if (sel) {
      const travelers = getActiveTripTravelerAccounts();
      const optsHtml = ['<option value="">— Message générique (lien direct du carnet) —</option>'];
      travelers.forEach(acc => {
        const entry = Array.isArray(acc.trips) ? acc.trips.find(t => t.tripId === tripData.id) : null;
        const dossier = (entry && entry.dossierRef) || acc.dossierRef || '';
        const label = `${acc.displayName || acc.login || 'Voyageur'}${dossier ? ` (Dossier ${dossier})` : ''}`;
        optsHtml.push(`<option value="${esc(acc.id)}">${esc(label)}</option>`);
      });
      sel.innerHTML = optsHtml.join('');
      sel.value = accountId || '';
    }

    applySelectedTravelerToEmailModal(false);

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }
  }

  function closeSendClientEmailModal() {
    const dialog = typeof document !== 'undefined' ? document.getElementById('send-client-email-modal') : null;
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function getModalEmailFields() {
    const toEl = document.getElementById('email-to-input');
    const subjectEl = document.getElementById('email-subject-input');
    const bodyEl = document.getElementById('email-body-textarea');
    return {
      to: toEl ? toEl.value.trim() : '',
      subject: subjectEl ? subjectEl.value.trim() : '',
      body: bodyEl ? bodyEl.value : ''
    };
  }

  function sendClientEmailViaMailto() {
    const { to, subject, body } = getModalEmailFields();
    const feedbackEl = document.getElementById('send-email-feedback');
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (mailtoUrl.length > 1850 && feedbackEl) {
      feedbackEl.style.color = '#b45309';
      feedbackEl.textContent = '⚠ Message long pour mailto: — si votre messagerie le tronque, utilisez « Brouillon Outlook (.eml) » ou « Copier l’e-mail ».';
    } else if (feedbackEl) {
      feedbackEl.style.color = '#047857';
      feedbackEl.textContent = '✓ Ouverture de votre client de messagerie...';
    }

    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadClientEmailEml() {
    const { to, subject, body } = getModalEmailFields();
    const eml = buildEmlFileContent({ to, subject, body });
    const slug = (typeof tripData !== 'undefined' && tripData && tripData.id) ? tripData.id : 'voyage';
    downloadTextFile(`Email-Carnet-${slug}.eml`, eml, 'message/rfc822;charset=utf-8');
    const feedbackEl = document.getElementById('send-email-feedback');
    if (feedbackEl) {
      feedbackEl.style.color = '#047857';
      feedbackEl.textContent = '✓ Brouillon .eml téléchargé (double-cliquez dessus pour l’ouvrir dans Outlook).';
    }
  }

  function copyClientEmailToClipboard() {
    const { subject, body } = getModalEmailFields();
    const fullText = `Objet : ${subject}\n\n${body}`;
    const feedbackEl = document.getElementById('send-email-feedback');
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(fullText).then(() => {
        if (feedbackEl) {
          feedbackEl.style.color = '#047857';
          feedbackEl.textContent = '✓ Objet et message copiés dans le presse-papier !';
        }
      }).catch(() => {
        prompt('Copiez l’e-mail ci-dessous :', fullText);
      });
    } else {
      prompt('Copiez l’e-mail ci-dessous :', fullText);
    }
  }

  // Expositions globales pour HTML inline et admin.js
  global.renderAdminAccessTab = renderAdminAccessTab;
  global.switchAccessSubTab = switchAccessSubTab;
  global.syncCurrentTripAccessIntoRegistry = syncCurrentTripAccessIntoRegistry;
  global.publishAccessRegistryToGitHub = publishAccessRegistryToGitHub;
  global.publishAccessRegistryButtonClick = publishAccessRegistryButtonClick;
  global.syncTravelersFromDriverDossier = syncTravelersFromDriverDossier;
  global.triggerLogitoCsvImport = triggerLogitoCsvImport;
  global.handleLogitoCsvFileSelected = handleLogitoCsvFileSelected;
  global.downloadLogitoCsvTemplate = downloadLogitoCsvTemplate;
  global.exportMailMergeCsvClick = exportMailMergeCsvClick;
  global.generateMissingPasswordsForTrip = generateMissingPasswordsForTrip;
  global.addNewTravelerAccount = addNewTravelerAccount;
  global.updateTravelerAccountField = updateTravelerAccountField;
  global.updateTravelerTripField = updateTravelerTripField;
  global.setCustomTravelerPassword = setCustomTravelerPassword;
  global.regenerateTravelerPassword = regenerateTravelerPassword;
  global.removeTravelerFromCurrentTrip = removeTravelerFromCurrentTrip;
  global.addTravelerOptionForTrip = addTravelerOptionForTrip;
  global.updateTravelerOptionField = updateTravelerOptionField;
  global.removeTravelerOption = removeTravelerOption;
  global.addTravelerPersonalDoc = addTravelerPersonalDoc;
  global.updateTravelerDocField = updateTravelerDocField;
  global.handleTravelerDocFileUpload = handleTravelerDocFileUpload;
  global.removeTravelerDoc = removeTravelerDoc;
  global.copyTravelerCredentials = copyTravelerCredentials;
  global.openSendClientEmailModal = openSendClientEmailModal;
  global.closeSendClientEmailModal = closeSendClientEmailModal;
  global.applySelectedTravelerToEmailModal = applySelectedTravelerToEmailModal;
  global.regenerateClientEmailBody = regenerateClientEmailBody;
  global.sendClientEmailViaMailto = sendClientEmailViaMailto;
  global.downloadClientEmailEml = downloadClientEmailEml;
  global.copyClientEmailToClipboard = copyClientEmailToClipboard;
  global.addNewStaffAccount = addNewStaffAccount;
  global.updateStaffAccountField = updateStaffAccountField;
  global.toggleStaffTripAssignment = toggleStaffTripAssignment;
  global.setCustomStaffPassword = setCustomStaffPassword;
  global.regenerateStaffPassword = regenerateStaffPassword;
  global.deleteStaffAccount = deleteStaffAccount;
  global.copyStaffCredentials = copyStaffCredentials;

  global.GirardotAdminAccess = {
    parseLogitoTravelersCsv,
    buildMailMergeCsv,
    buildClientEmailDraft,
    buildEmlFileContent,
    sanitizeRegistryForPublish,
    upsertTravelerForTrip,
    ensureAdminRegistryLoaded,
    getPlainPwd,
    setPlainPwd,
    getRegistrySnapshot: () => adminRegistry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.GirardotAdminAccess;
  }

})(typeof window !== 'undefined' ? window : global);
