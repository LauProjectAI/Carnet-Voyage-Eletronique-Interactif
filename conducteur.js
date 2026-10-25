// Application Dossier Conducteur & Accompagnateur — Voyages Girardot
let driverTrip = null;
let currentActiveDay = 0;
let boardedPassengers = new Set();

document.addEventListener('DOMContentLoaded', () => {
  loadDriverTripData();
  initDriverApp();
});

// Chargement des données du voyage
function loadDriverTripData() {
  const urlParams = new URLSearchParams(window.location.search);
  const tripParam = urlParams.get('trip');
  const idParam = urlParams.get('id');

  // 1. Paramètre Base64 complet dans l'URL (?trip=...)
  if (tripParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(tripParam))));
      driverTrip = decoded;
      return;
    } catch (e) {
      console.warn("Impossible de décoder le voyage base64:", e);
    }
  }

  // 2. Paramètre ID dans l'URL (?id=...)
  if (idParam) {
    const stored = localStorage.getItem(`girardot_trip_data_${idParam}`);
    if (stored) {
      try {
        driverTrip = JSON.parse(stored);
        return;
      } catch (e) {}
    }
    // Vérifier si présent dans les voyages préenregistrés ou dans voyages/<id>.json
    const foundPredefined = (window.AVAILABLE_TRIPS || []).find(t => t.id === idParam || t.alias === idParam || (t.aliases && t.aliases.includes(idParam)));
    const targetFile = (foundPredefined && foundPredefined.file) ? foundPredefined.file : `voyages/${idParam}.json`;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', encodeURI(targetFile), false);
      xhr.send(null);
      if (xhr.status === 200 || xhr.status === 0) {
        driverTrip = JSON.parse(xhr.responseText);
        return;
      }
    } catch (err) {}
  }

  // 3. Dernier voyage actif en cache
  const activeId = localStorage.getItem('girardot_active_trip_id');
  if (activeId) {
    const storedTrip = localStorage.getItem(`girardot_trip_data_${activeId}`);
    if (storedTrip) {
      try {
        driverTrip = JSON.parse(storedTrip);
        return;
      } catch (e) {}
    }
  }

  const legacyStored = localStorage.getItem('girardot_active_carnet');
  if (legacyStored) {
    try {
      driverTrip = JSON.parse(legacyStored);
      return;
    } catch (e) {}
  }

  // 4. Par défaut : données de référence
  driverTrip = window.defaultTravelData;
}

function ensureDriverDataStructure() {
  if (!driverTrip.driverDossier || typeof driverTrip.driverDossier !== 'object') {
    driverTrip.driverDossier = {
      busModel: "Mercedes Tourismo 16 RHD • 53 Places",
      busCapacity: 53,
      busPlanUrl: "",
      busNotes: "1er rang réservé aux personnes prioritaires / accès PMR.",
      roomingList: [
        { roomNumber: "101", type: "Double (Grand Lit)", occupants: "M. & Mme Passager", notes: "Chambre calme côté jardin" },
        { roomNumber: "102", type: "Twin (2 lits séparés)", occupants: "M. Dupont / M. Martin", notes: "Régime sans gluten" },
        { roomNumber: "103", type: "Individuelle (Single)", occupants: "Mme Leroy", notes: "" }
      ],
      roomingFileUrl: "",
      passengersList: [
        { name: "Passager Jean", pickup: "Chalon-sur-Saône (Gare)", phone: "+33 6 12 34 56 78", seatNumber: "3A", notes: "" },
        { name: "Passager Marie", pickup: "Chalon-sur-Saône (Gare)", phone: "+33 6 12 34 56 79", seatNumber: "3B", notes: "" },
        { name: "Dupont Alain", pickup: "Beaune (Péage)", phone: "+33 6 22 33 44 55", seatNumber: "5C", notes: "Végétarien" },
        { name: "Martin Bernard", pickup: "Beaune (Péage)", phone: "+33 6 33 44 55 66", seatNumber: "5D", notes: "Sans gluten" },
        { name: "Leroy Sophie", pickup: "Dijon (Palais des Congrès)", phone: "+33 6 98 76 54 32", seatNumber: "7A", notes: "" }
      ]
    };
  }

  // Restaurer l'état du pointage passager pour ce voyage
  const storageKey = `girardot_driver_boarded_${driverTrip.id || 'default'}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  boardedPassengers = new Set(saved);
}

function initDriverApp() {
  if (!driverTrip) return;
  ensureDriverDataStructure();

  // En-tête
  document.getElementById('driver-trip-title').innerText = driverTrip.title || "Circuit Girardot";
  document.getElementById('driver-trip-subtitle').innerText = driverTrip.subtitle || "";
  document.getElementById('driver-trip-dates').innerText = driverTrip.dates || "";

  const d = driverTrip.driverDossier;
  document.getElementById('driver-bus-model').innerText = d.busModel || "Autocar Girardot";
  document.getElementById('driver-bus-capacity').innerText = d.busCapacity ? `${d.busCapacity} Fauteuils` : "53 Fauteuils";

  renderDriverRouteDayPills();
  renderDriverRouteDayContent(0);
  renderDriverPassengersList();
  renderDriverBusPlan();
  renderDriverRoomingList();
  renderDriverDocs();
  renderDriverContacts();
}

// -----------------------------------------------------------------------------
// NAVIGATION PRO
// -----------------------------------------------------------------------------
function switchDriverTab(tabId) {
  document.querySelectorAll('.driver-tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.driver-nav-item').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(`driver-tab-${tabId}`);
  if (targetPane) targetPane.classList.add('active');

  const btn = Array.from(document.querySelectorAll('.driver-nav-item')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId));
  if (btn) btn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -----------------------------------------------------------------------------
// 1. ROUTE & ITINÉRAIRE TECHNIQUE
// -----------------------------------------------------------------------------
function renderDriverRouteDayPills() {
  const container = document.getElementById('driver-day-pills');
  if (!container || !driverTrip.itinerary) return;
  container.innerHTML = '';

  driverTrip.itinerary.forEach((day, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style = `padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.78rem; white-space: nowrap; border: 1px solid ${idx === currentActiveDay ? '#38bdf8' : '#334155'}; background: ${idx === currentActiveDay ? '#0284c7' : '#1e293b'}; color: ${idx === currentActiveDay ? '#ffffff' : '#94a3b8'}; cursor: pointer;`;
    btn.innerText = `J${day.day} • ${day.city || 'Étape'}`;
    btn.onclick = () => {
      currentActiveDay = idx;
      renderDriverRouteDayPills();
      renderDriverRouteDayContent(idx);
    };
    container.appendChild(btn);
  });
}

function renderDriverRouteDayContent(dayIdx) {
  const container = document.getElementById('driver-day-content');
  if (!container || !driverTrip.itinerary || !driverTrip.itinerary[dayIdx]) return;

  const day = driverTrip.itinerary[dayIdx];
  const gpsQuery = (day.lat && day.lng) ? `${day.lat},${day.lng}` : encodeURIComponent(day.city || day.title);
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gpsQuery}`;
  const wazeUrl = `https://waze.com/ul?ll=${day.lat || 0},${day.lng || 0}&navigate=yes`;

  container.innerHTML = `
    <div class="driver-card-header">
      <div>
        <span style="background:#0284c7; color:white; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:4px;">
          JOUR ${day.day}
        </span>
        <h2 style="font-size:1.15rem; font-weight:800; color:white; margin:4px 0 2px;">${day.title}</h2>
        <div style="font-size:0.8rem; color:#94a3b8;">Destination : <strong style="color:#f8fafc;">${day.city || 'Non spécifiée'}</strong></div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <a href="${googleMapsUrl}" target="_blank" class="btn-gps-direct" title="Lancer le guidage Google Maps">
          <i class="fa-solid fa-diamond-turn-right"></i> GPS Google
        </a>
        <a href="${wazeUrl}" target="_blank" class="btn-waze-direct" title="Lancer le guidage Waze (Trafic en direct)">
          <i class="fa-brands fa-waze"></i> Waze
        </a>
      </div>
    </div>

    <!-- Déroulé des horaires et étapes -->
    <div style="font-size:0.8rem; font-weight:800; color:#38bdf8; text-transform:uppercase; margin:14px 0 8px; letter-spacing:0.5px;">
      <i class="fa-solid fa-clock"></i> Déroulé chronologique du Jour ${day.day}
    </div>

    <div style="background:#0b1120; border-radius:12px; padding:12px; margin-bottom:12px;">
      ${(day.timeline && day.timeline.length > 0) ? day.timeline.map((item, vIdx) => {
        const vGps = (item.lat && item.lng) ? `${item.lat},${item.lng}` : encodeURIComponent(item.address || item.title);
        const vMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${vGps}`;
        return `
          <div style="display:flex; gap:12px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed #334155; align-items:flex-start;">
            <div style="background:#1e293b; color:#38bdf8; font-weight:800; font-size:0.82rem; padding:4px 8px; border-radius:6px; min-width:65px; text-align:center;">
              ${item.time || 'Horaire'}
            </div>
            <div style="flex:1;">
              <div style="font-size:0.9rem; font-weight:800; color:#f8fafc;">${item.title}</div>
              <div style="font-size:0.8rem; color:#94a3b8; margin:2px 0;">${item.subtitle || ''}</div>
              ${item.address ? `<div style="font-size:0.75rem; color:#64748b;"><i class="fa-solid fa-location-dot"></i> ${item.address}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <a href="${vMapsUrl}" target="_blank" class="btn-gps-direct" style="padding:4px 8px; font-size:0.72rem;" title="Guidage vers ce point">
                <i class="fa-solid fa-location-arrow"></i> Guidage
              </a>
              ${item.docId ? `
                <button type="button" onclick="openDriverDocDetails('${item.docId}')" style="background:#059669; color:white; border:none; padding:4px 8px; border-radius:14px; font-size:0.72rem; font-weight:700; cursor:pointer;">
                  <i class="fa-solid fa-qrcode"></i> Bon
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('') : '<div style="color:#64748b; font-style:italic; font-size:0.8rem;">Aucune étape détaillée.</div>'}
    </div>

    <!-- Descriptif et consignes de journée -->
    ${day.description ? `
      <div style="background:#0b1120; border-radius:12px; padding:12px; font-size:0.82rem; color:#cbd5e1; line-height:1.5;">
        <strong style="color:#f8fafc; display:block; margin-bottom:4px;"><i class="fa-solid fa-circle-info" style="color:#38bdf8;"></i> Consignes générales pour le groupe :</strong>
        ${day.description}
      </div>
    ` : ''}
  `;
}

// -----------------------------------------------------------------------------
// 2. PASSAGERS & ÉMARGEMENT
// -----------------------------------------------------------------------------
function renderDriverPassengersList(filterQuery = "") {
  const container = document.getElementById('driver-passengers-list');
  const countEl = document.getElementById('driver-boarded-count');
  if (!container) return;

  const list = (driverTrip.driverDossier && driverTrip.driverDossier.passengersList) ? driverTrip.driverDossier.passengersList : [];
  
  if (countEl) {
    countEl.innerText = `${boardedPassengers.size} / ${list.length} passagers pointés à bord`;
  }

  let filtered = list;
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    filtered = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.pickup || '').toLowerCase().includes(q) || (p.seatNumber || '').toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b; font-size:0.85rem;">Aucun passager trouvé.</div>`;
    return;
  }

  container.innerHTML = filtered.map((p, idx) => {
    const realIndex = list.indexOf(p);
    const isBoarded = boardedPassengers.has(realIndex);
    return `
      <div class="passenger-row ${isBoarded ? 'boarded' : ''}" onclick="togglePassengerBoarding(${realIndex})">
        <div style="display:flex; align-items:center;">
          <div class="passenger-check">
            <i class="fa-solid fa-check"></i>
          </div>
          <div>
            <div style="font-size:0.9rem; font-weight:800; color:${isBoarded ? '#10b981' : '#f8fafc'};">
              ${p.name || 'Nom non renseigné'}
            </div>
            <div style="font-size:0.75rem; color:#94a3b8;">
              <i class="fa-solid fa-location-dot"></i> Montée : <strong>${p.pickup || 'Départ circuit'}</strong>
            </div>
            ${p.notes ? `<div style="font-size:0.72rem; color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> ${p.notes}</div>` : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          ${p.seatNumber ? `<span class="bus-seat-pill">Place ${p.seatNumber}</span>` : ''}
          ${p.phone ? `
            <a href="tel:${p.phone}" onclick="event.stopPropagation()" style="background:#1e293b; border:1px solid #334155; color:#38bdf8; width:34px; height:34px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;">
              <i class="fa-solid fa-phone"></i>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function togglePassengerBoarding(idx) {
  if (boardedPassengers.has(idx)) {
    boardedPassengers.delete(idx);
  } else {
    boardedPassengers.add(idx);
  }
  const storageKey = `girardot_driver_boarded_${driverTrip.id || 'default'}`;
  localStorage.setItem(storageKey, JSON.stringify(Array.from(boardedPassengers)));
  renderDriverPassengersList(document.getElementById('driver-passenger-search') ? document.getElementById('driver-passenger-search').value : "");
}

function resetBoarding() {
  if (confirm("Réinitialiser le pointage de tous les passagers à zéro ?")) {
    boardedPassengers.clear();
    const storageKey = `girardot_driver_boarded_${driverTrip.id || 'default'}`;
    localStorage.removeItem(storageKey);
    renderDriverPassengersList();
  }
}

function filterDriverPassengers(query) {
  renderDriverPassengersList(query);
}

// -----------------------------------------------------------------------------
// 3. PLAN DE CAR
// -----------------------------------------------------------------------------
function renderDriverBusPlan() {
  const container = document.getElementById('driver-bus-plan-container');
  const badge = document.getElementById('driver-bus-plan-badge');
  const notesBox = document.getElementById('driver-bus-notes-box');
  if (!container) return;

  const d = driverTrip.driverDossier || {};
  if (badge) badge.innerText = d.busModel || "Autocar Tourisme";

  if (d.busNotes) {
    notesBox.style.display = 'block';
    notesBox.innerHTML = `<strong><i class="fa-solid fa-circle-exclamation"></i> Consignes de placement :</strong><br>${d.busNotes}`;
  } else {
    notesBox.style.display = 'none';
  }

  if (d.busPlanUrl) {
    if (d.busPlanUrl.includes('pdf') || d.busPlanUrl.startsWith('data:application/pdf')) {
      container.innerHTML = `
        <div style="background:#0b1120; border-radius:12px; padding:24px; border:1px dashed #334155;">
          <i class="fa-solid fa-file-pdf" style="font-size:3rem; color:#ef4444; margin-bottom:10px; display:block;"></i>
          <div style="font-weight:800; font-size:0.95rem; color:white; margin-bottom:8px;">Plan de Car (Document PDF)</div>
          <button type="button" onclick="openDriverExternalFile('${d.busPlanUrl}')" class="btn-save-main" style="background:#0284c7; font-size:0.82rem; padding:8px 16px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir le plan en grand
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <img src="${d.busPlanUrl}" alt="Plan de Car" style="max-width:100%; border-radius:12px; border:1px solid #334155; cursor:zoom-in;" onclick="this.style.maxWidth = this.style.maxWidth === '100%' ? '200%' : '100%';" title="Cliquez pour agrandir">
      `;
    }
  } else {
    // Grille schématique d'autocar de tourisme (modèle 53 places par défaut)
    const passengers = (d.passengersList || []).reduce((acc, p) => {
      if (p.seatNumber) acc[p.seatNumber.toUpperCase().trim()] = p.name;
      return acc;
    }, {});

    container.innerHTML = `
      <div style="background:#0b1120; border-radius:14px; padding:16px; border:1px solid #334155; max-width:440px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px dashed #334155; padding-bottom:8px; margin-bottom:12px;">
          <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;"><i class="fa-solid fa-steering-wheel"></i> CONDUCTEUR</span>
          <span style="font-size:0.75rem; color:#10b981; font-weight:700;">PORTE AVANT <i class="fa-solid fa-door-open"></i></span>
        </div>

        <!-- Rangées types -->
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(row => `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
            <!-- Sièges Gauche (A, B) -->
            <div style="display:flex; gap:4px; flex:1;">
              <div style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:6px; padding:6px 2px; text-align:center;">
                <div style="font-size:0.7rem; color:#38bdf8; font-weight:800;">${row}A</div>
                <div style="font-size:0.68rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px; margin:0 auto;">${passengers[`${row}A`] ? passengers[`${row}A`].split(' ')[0] : '—'}</div>
              </div>
              <div style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:6px; padding:6px 2px; text-align:center;">
                <div style="font-size:0.7rem; color:#38bdf8; font-weight:800;">${row}B</div>
                <div style="font-size:0.68rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px; margin:0 auto;">${passengers[`${row}B`] ? passengers[`${row}B`].split(' ')[0] : '—'}</div>
              </div>
            </div>

            <!-- Allée Centrale -->
            <div style="width:24px; text-align:center; color:#475569; font-size:0.65rem;">
              <i class="fa-solid fa-arrows-up-down"></i>
            </div>

            <!-- Sièges Droite (C, D) -->
            <div style="display:flex; gap:4px; flex:1;">
              <div style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:6px; padding:6px 2px; text-align:center;">
                <div style="font-size:0.7rem; color:#38bdf8; font-weight:800;">${row}C</div>
                <div style="font-size:0.68rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px; margin:0 auto;">${passengers[`${row}C`] ? passengers[`${row}C`].split(' ')[0] : '—'}</div>
              </div>
              <div style="flex:1; background:#1e293b; border:1px solid #334155; border-radius:6px; padding:6px 2px; text-align:center;">
                <div style="font-size:0.7rem; color:#38bdf8; font-weight:800;">${row}D</div>
                <div style="font-size:0.68rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px; margin:0 auto;">${passengers[`${row}D`] ? passengers[`${row}D`].split(' ')[0] : '—'}</div>
              </div>
            </div>
          </div>
        `).join('')}

        <div style="margin-top:12px; font-size:0.72rem; color:#64748b; text-align:center;">
          Schéma de principe basé sur les numéros de sièges renseignés dans la liste des passagers.
        </div>
      </div>
    `;
  }
}

// -----------------------------------------------------------------------------
// 4. ROOMING LIST HÔTELS
// -----------------------------------------------------------------------------
function renderDriverRoomingList(filterQuery = "") {
  const container = document.getElementById('driver-rooming-list');
  const totalBadge = document.getElementById('driver-rooming-total');
  const pdfBtn = document.getElementById('driver-rooming-pdf-btn');
  if (!container) return;

  const d = driverTrip.driverDossier || {};
  const list = d.roomingList || [];

  if (totalBadge) totalBadge.innerText = `${list.length} chambre(s) réservée(s)`;

  if (pdfBtn) {
    if (d.roomingFileUrl) {
      pdfBtn.innerHTML = `
        <button type="button" onclick="openDriverExternalFile('${d.roomingFileUrl}')" class="btn-gps-direct" style="background:#f59e0b; color:#451a03; font-size:0.75rem; padding:4px 10px;">
          <i class="fa-solid fa-file-pdf"></i> Ouvrir Rooming PDF
        </button>
      `;
    } else {
      pdfBtn.innerHTML = '';
    }
  }

  let filtered = list;
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    filtered = list.filter(r => (r.roomNumber || '').toLowerCase().includes(q) || (r.occupants || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b; font-size:0.85rem;">Aucune chambre trouvée.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div style="background:#0b1120; border-radius:12px; padding:12px; margin-bottom:8px; border:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span style="background:#f59e0b; color:#451a03; font-weight:800; font-size:0.75rem; padding:2px 8px; border-radius:4px;">
            Chambre ${r.roomNumber || '—'}
          </span>
          <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">${r.type}</span>
        </div>
        <div style="font-size:0.9rem; font-weight:800; color:#f8fafc;">${r.occupants || 'Occupants à définir'}</div>
        ${r.notes ? `<div style="font-size:0.75rem; color:#fcd34d; margin-top:2px;"><i class="fa-solid fa-bell"></i> ${r.notes}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function filterDriverRooming(query) {
  renderDriverRoomingList(query);
}

// -----------------------------------------------------------------------------
// 5. DOCUMENTS & BONS D'ÉCHANGE PRO
// -----------------------------------------------------------------------------
function renderDriverDocs() {
  const container = document.getElementById('driver-docs-list');
  if (!container) return;

  const docs = driverTrip.documents || [];
  if (docs.length === 0) {
    container.innerHTML = `<div style="color:#64748b; font-size:0.85rem; padding:20px; text-align:center;">Aucun bon d'échange officiel enregistré.</div>`;
    return;
  }

  container.innerHTML = docs.map(doc => `
    <div style="background:#0b1120; border-radius:12px; padding:12px; margin-bottom:10px; border:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span style="background:#0284c7; color:white; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; text-transform:uppercase;">
          ${doc.type === 'flight' ? '✈️ Avion' : (doc.type === 'voucher' ? '🏨 Voucher' : '🎟️ Billet')}
        </span>
        <div style="font-size:0.92rem; font-weight:800; color:white; margin:4px 0 2px;">${doc.title}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${doc.reference ? `Réf: ${doc.reference} • ` : ''}${doc.beneficiary || 'Tous'}</div>
      </div>
      <button type="button" onclick="openDriverDocDetails('${doc.id}')" class="btn-gps-direct" style="background:#059669; font-size:0.8rem; padding:6px 12px; cursor:pointer;">
        <i class="fa-solid fa-qrcode"></i> Afficher
      </button>
    </div>
  `).join('');
}

function openDriverDocDetails(docId) {
  const doc = (driverTrip.documents || []).find(d => d.id === docId);
  if (!doc) return;

  const modal = document.getElementById('driver-doc-modal');
  const title = document.getElementById('driver-modal-doc-title');
  const qrBox = document.getElementById('driver-modal-qr-box');
  const qrImg = document.getElementById('driver-modal-qr-img');
  const qrText = document.getElementById('driver-modal-qr-text');
  const fileBox = document.getElementById('driver-modal-file-box');
  const fileImg = document.getElementById('driver-modal-file-img');
  const notes = document.getElementById('driver-modal-notes');

  title.innerText = doc.title;
  
  if (doc.qrCode) {
    qrBox.style.display = 'block';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(doc.qrCode)}&color=2-132-199`;
    qrText.innerText = doc.qrCode;
  } else {
    qrBox.style.display = 'none';
  }

  if (doc.fileUrl && !doc.fileUrl.includes('pdf')) {
    fileBox.style.display = 'block';
    fileImg.src = doc.fileUrl;
  } else {
    fileBox.style.display = 'none';
  }

  notes.innerHTML = `
    <div><strong>Bénéficiaire :</strong> ${doc.beneficiary || 'Groupe'}</div>
    <div><strong>Date / Validité :</strong> ${doc.date || 'Toute la durée du séjour'}</div>
    ${doc.notes ? `<div style="margin-top:6px; color:#f8fafc;"><strong>Consignes :</strong> ${doc.notes}</div>` : ''}
  `;

  modal.style.display = 'flex';
}

function closeDriverDocModal() {
  const modal = document.getElementById('driver-doc-modal');
  if (modal) modal.style.display = 'none';
}

// -----------------------------------------------------------------------------
// 6. CONTACTS & ASSISTANCE
// -----------------------------------------------------------------------------
function renderDriverContacts() {
  const container = document.getElementById('driver-contacts-list');
  if (!container) return;

  let contacts = [];
  if (Array.isArray(driverTrip.contactsList) && driverTrip.contactsList.length > 0) {
    contacts = [...driverTrip.contactsList];
  } else if (driverTrip.contacts) {
    if (driverTrip.contacts.receptif) {
      contacts.push({
        category: "Correspondant Réceptif Local",
        name: driverTrip.contacts.receptif.name || "",
        phone: driverTrip.contacts.receptif.emergency || driverTrip.contacts.receptif.phone || "",
        address: driverTrip.contacts.receptif.address || "",
        isEmergency: true
      });
    }
    if (driverTrip.contacts.agence) {
      contacts.push({
        category: "Voyages Girardot",
        name: driverTrip.contacts.agence.name || "Siège Chalon",
        phone: driverTrip.contacts.agence.phone || "03 85 42 82 50",
        address: driverTrip.contacts.agence.address || "",
        isEmergency: false
      });
    }
  }

  if (contacts.length === 0) {
    contacts = [
      { category: "Permanence Urgences Girardot", name: "Assistance Exploitation 24/7", phone: "+33 3 85 42 82 50", address: "Chalon-sur-Saône", isEmergency: true }
    ];
  }

  container.innerHTML = contacts.map(c => `
    <div style="background:#0b1120; border-radius:12px; padding:12px; margin-bottom:10px; border-left:4px solid ${c.isEmergency ? '#ef4444' : '#0284c7'}; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:0.75rem; color:#94a3b8; font-weight:700; text-transform:uppercase;">${c.category || 'Contact'}</div>
        <div style="font-size:0.92rem; font-weight:800; color:white; margin:2px 0;">${c.name}</div>
        ${c.address ? `<div style="font-size:0.75rem; color:#64748b;">${c.address}</div>` : ''}
      </div>
      ${c.phone ? `
        <a href="tel:${c.phone}" class="btn-call-direct">
          <i class="fa-solid fa-phone"></i> Appeler
        </a>
      ` : ''}
    </div>
  `).join('');
}

function openDriverExternalFile(url) {
  if (!url) return;
  if (url.startsWith('data:application/pdf')) {
    try {
      const parts = url.split(',');
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
      return;
    } catch (e) {
      window.open(url, '_blank');
      return;
    }
  }
  window.open(url, '_blank');
}
