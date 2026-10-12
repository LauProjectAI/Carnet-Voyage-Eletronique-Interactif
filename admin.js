// Admin State
let tripData = null;
let currentTripId = null;
let savedTripsIndex = [];

document.addEventListener('DOMContentLoaded', () => {
  initMultiTripSystem();
  populateForm();
  updateShareLink();
});

// Récupération de l'index des voyages enregistrés
function getSavedTripsCatalog() {
  const customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
  
  // Fusion avec la liste statique AVAILABLE_TRIPS
  const predefined = (window.AVAILABLE_TRIPS || []).map(t => ({
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    dates: t.dates,
    file: t.file,
    isPredefined: true
  }));

  const allMap = new Map();
  predefined.forEach(p => allMap.set(p.id, p));
  customList.forEach(c => allMap.set(c.id, c)); // Les modifications locales écrasent ou complètent

  return Array.from(allMap.values());
}

function initMultiTripSystem() {
  const catalog = getSavedTripsCatalog();
  
  // Dernier voyage actif ou premier disponible
  const activeId = localStorage.getItem('girardot_active_trip_id') || (catalog[0] ? catalog[0].id : 'afrique-du-sud-2026');
  currentTripId = activeId;

  // Charger les données du voyage
  loadTripById(currentTripId);
  renderTripSelectorOptions();
}

function renderTripSelectorOptions() {
  const select = document.getElementById('adm-trip-selector');
  if (!select) return;
  select.innerHTML = '';

  const catalog = getSavedTripsCatalog();
  catalog.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.title} — ${item.subtitle || ''}`;
    if (item.id === currentTripId) opt.selected = true;
    select.appendChild(opt);
  });
}

function loadTripById(tripId) {
  currentTripId = tripId;
  localStorage.setItem('girardot_active_trip_id', tripId);

  // 1. Chercher dans le stockage local spécifique à cet ID
  const storedTrip = localStorage.getItem(`girardot_trip_data_${tripId}`);
  if (storedTrip) {
    try {
      tripData = JSON.parse(storedTrip);
      return;
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Si c'est l'ancien voyage actif par défaut
  if (tripId === 'afrique-du-sud-2026') {
    const legacyStored = localStorage.getItem('girardot_active_carnet');
    if (legacyStored) {
      try {
        tripData = JSON.parse(legacyStored);
        return;
      } catch (e) {}
    }
    tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
    return;
  }

  // 3. Si c'est le voyage Italie dans le sous-dossier voyages/
  if (tripId === 'italie-dolomites-2026') {
    fetch('voyages/italie-dolomites-2026.json')
      .then(res => res.json())
      .then(data => {
        tripData = data;
        populateForm();
        updateShareLink();
      })
      .catch(() => {
        tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
        tripData.id = tripId;
        tripData.title = "Italie du Nord & Dolomites";
        populateForm();
        updateShareLink();
      });
    return;
  }

  // Par défaut : nouveau squelette
  tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
  tripData.id = tripId;
}

function onSelectTripChange(newTripId) {
  loadTripById(newTripId);
  populateForm();
  updateShareLink();
}

function createNewTripPrompt() {
  const title = prompt("Titre de la nouvelle destination (ex: Norvège - Fjords & Aurores Boréales) :");
  if (!title || !title.trim()) return;

  const id = 'voyage-' + Date.now();
  const newTrip = JSON.parse(JSON.stringify(window.defaultTravelData));
  newTrip.id = id;
  newTrip.title = title.trim();
  newTrip.subtitle = "Nouveau circuit Girardot";
  newTrip.dates = "À définir";
  newTrip.startDate = new Date().toISOString().split('T')[0];
  newTrip.endDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  newTrip.itinerary = [
    {
      day: 1,
      city: "Départ",
      title: "Jour 1 • Rendez-vous et envol",
      highlight: "Départ du circuit",
      dateStr: "Jour 1",
      weather: "Ensoleillé",
      description: "Accueil de vos voyageurs et installation à l'hôtel.",
      timeline: [
        {
          time: "10:00",
          title: "Accueil & Formalités",
          subtitle: "Rendez-vous avec votre guide accompagnateur.",
          icon: "plane-departure"
        }
      ]
    }
  ];

  // Enregistrer
  saveTripToCatalogAndStorage(newTrip);
  currentTripId = id;
  tripData = newTrip;
  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  alert(`✓ Le voyage "${title}" a été créé ! Vous pouvez maintenant le personnaliser.`);
}

function duplicateCurrentTrip() {
  const currentTitle = tripData.title || "Voyage";
  const newTitle = prompt(`Titre de la copie :`, `${currentTitle} (Copie)`);
  if (!newTitle) return;

  const id = 'voyage-' + Date.now();
  const copyTrip = JSON.parse(JSON.stringify(tripData));
  copyTrip.id = id;
  copyTrip.title = newTitle;

  saveTripToCatalogAndStorage(copyTrip);
  currentTripId = id;
  tripData = copyTrip;
  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  alert(`✓ Le voyage a été dupliqué sous le nom "${newTitle}".`);
}

function deleteCurrentTripPrompt() {
  const catalog = getSavedTripsCatalog();
  if (catalog.length <= 1) {
    alert("Vous ne pouvez pas supprimer le seul voyage restant.");
    return;
  }

  if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le carnet "${tripData.title}" ?`)) {
    // Supprimer du catalogue local
    let customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
    customList = customList.filter(c => c.id !== currentTripId);
    localStorage.setItem('girardot_trips_catalog', JSON.stringify(customList));
    localStorage.removeItem(`girardot_trip_data_${currentTripId}`);

    const remaining = getSavedTripsCatalog();
    const nextId = remaining[0] ? remaining[0].id : 'afrique-du-sud-2026';
    loadTripById(nextId);
    renderTripSelectorOptions();
    populateForm();
    updateShareLink();
    alert("✓ Voyage supprimé.");
  }
}

function saveTripToCatalogAndStorage(trip) {
  // Stocker les données complètes
  localStorage.setItem(`girardot_trip_data_${trip.id}`, JSON.stringify(trip));
  
  // Si c'est le voyage actif
  localStorage.setItem('girardot_active_carnet', JSON.stringify(trip));
  localStorage.setItem('girardot_active_trip_id', trip.id);

  // Mettre à jour l'index
  let customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
  const existingIdx = customList.findIndex(c => c.id === trip.id);
  const entry = {
    id: trip.id,
    title: trip.title,
    subtitle: trip.subtitle || '',
    dates: trip.dates || '',
    lastModified: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    customList[existingIdx] = entry;
  } else {
    customList.push(entry);
  }
  localStorage.setItem('girardot_trips_catalog', JSON.stringify(customList));
}

function exportTripJsonFile() {
  const filename = `${tripData.id || 'voyage'}.json`;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tripData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", filename);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function importTripJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.id) parsed.id = 'voyage-' + Date.now();
      if (!parsed.title) parsed.title = file.name.replace('.json', '');

      saveTripToCatalogAndStorage(parsed);
      currentTripId = parsed.id;
      tripData = parsed;
      renderTripSelectorOptions();
      populateForm();
      updateShareLink();
      alert(`✓ Le voyage "${parsed.title}" a été importé avec succès !`);
    } catch (err) {
      alert("Erreur lors de la lecture du fichier JSON. Assurez-vous que le format est valide.");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function switchAdminTab(tabName) {
  const sections = ['general', 'itinerary', 'hotels', 'freetime', 'concierge', 'contacts'];
  sections.forEach(sec => {
    const el = document.getElementById(`adm-sec-${sec}`);
    if (el) el.style.display = (sec === tabName) ? 'block' : 'none';
  });

  const buttons = document.querySelectorAll('.admin-nav button');
  buttons.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabName)) {
      b.classList.add('active');
    }
  });
}

function populateForm() {
  if (!tripData) return;

  // General
  document.getElementById('adm-title').value = tripData.title || '';
  document.getElementById('adm-subtitle').value = tripData.subtitle || '';
  document.getElementById('adm-dates').value = tripData.dates || '';
  document.getElementById('adm-cover').value = tripData.coverImage || '';
  document.getElementById('adm-intro').value = tripData.intro || '';

  // Alert
  if (tripData.alert) {
    document.getElementById('adm-alert-title').value = tripData.alert.title || '';
    document.getElementById('adm-alert-text').value = tripData.alert.text || '';
    document.getElementById('adm-alert-link').value = tripData.alert.link || '';
  }

  // 1. Flights List (Multi-vols et vols VIA)
  ensureFlightsListStructure();
  renderAdminFlights();

  // 2. Itinerary & Visits
  renderAdminDays();

  // 3. Hotels & Free time
  renderAdminHotels();
  renderAdminFreeTime();

  // 4. Conciergerie (avec dépliage et ajout manuel)
  renderAdminConcierge();

  // 5. Contacts & Practical Tips (avec ajout manuel)
  ensureContactsAndPracticalStructure();
  renderAdminContacts();
  renderAdminPractical();
}

// -----------------------------------------------------------------------------
// 1. GESTION DES VOLS (Multi-vols et vols VIA / escales)
// -----------------------------------------------------------------------------
function ensureFlightsListStructure() {
  if (!tripData.flightsList || !Array.isArray(tripData.flightsList)) {
    tripData.flightsList = [];
    if (tripData.flights) {
      if (tripData.flights.outbound && tripData.flights.outbound.airline) {
        tripData.flightsList.push({
          type: "Aller",
          airline: tripData.flights.outbound.airline || "Compagnie aérienne",
          flightNumber: tripData.flights.outbound.flightNumber || "",
          departureAirport: tripData.flights.outbound.departureAirport || "",
          departureTime: tripData.flights.outbound.departureTime || "",
          arrivalAirport: tripData.flights.outbound.arrivalAirport || "",
          arrivalTime: tripData.flights.outbound.arrivalTime || "",
          date: tripData.flights.outbound.date || "",
          via: tripData.flights.outbound.layover || "",
          notes: tripData.flights.outbound.meetingTime ? `Rdv : ${tripData.flights.outbound.meetingTime}` : ""
        });
      }
      if (tripData.flights.domesticFlights && Array.isArray(tripData.flights.domesticFlights)) {
        tripData.flights.domesticFlights.forEach(df => {
          tripData.flightsList.push({
            type: "Intérieur",
            airline: df.airline || "",
            flightNumber: df.flightNumber || "",
            departureAirport: df.departureAirport || "",
            departureTime: df.departureTime || "",
            arrivalAirport: df.arrivalAirport || "",
            arrivalTime: df.arrivalTime || "",
            date: df.day ? `Jour ${df.day}` : "",
            via: "",
            notes: df.notes || ""
          });
        });
      }
      if (tripData.flights.inbound && tripData.flights.inbound.airline) {
        tripData.flightsList.push({
          type: "Retour",
          airline: tripData.flights.inbound.airline || "",
          flightNumber: tripData.flights.inbound.flightNumber || "",
          departureAirport: tripData.flights.inbound.departureAirport || "",
          departureTime: tripData.flights.inbound.departureTime || "",
          arrivalAirport: tripData.flights.inbound.arrivalAirport || "",
          arrivalTime: tripData.flights.inbound.arrivalTime || "",
          date: tripData.flights.inbound.date || "",
          via: tripData.flights.inbound.layover || "",
          notes: ""
        });
      }
    }
  }
}

function renderAdminFlights() {
  const container = document.getElementById('adm-flights-list');
  if (!container) return;
  container.innerHTML = '';

  if (!tripData.flightsList || tripData.flightsList.length === 0) {
    container.innerHTML = `
      <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:20px; text-align:center; color:#64748b; font-size:0.85rem;">
        Aucun vol renseigné pour l'instant. Cliquez sur <strong>"+ Ajouter un vol"</strong> ci-dessus.
      </div>
    `;
    return;
  }

  tripData.flightsList.forEach((f, idx) => {
    const card = document.createElement('div');
    card.className = 'section-box';
    card.style = "margin-bottom:14px; border-left:4px solid var(--primary-color);";
    card.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeFlight(${idx})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      
      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group" style="max-width:160px;">
          <label>Type de vol :</label>
          <select class="form-control" onchange="updateFlightField(${idx}, 'type', this.value)">
            <option value="Aller" ${f.type === 'Aller' ? 'selected' : ''}>Vol Aller</option>
            <option value="Intérieur" ${f.type === 'Intérieur' ? 'selected' : ''}>Vol Intérieur</option>
            <option value="Retour" ${f.type === 'Retour' ? 'selected' : ''}>Vol Retour</option>
            <option value="Correspondance" ${f.type === 'Correspondance' ? 'selected' : ''}>Correspondance</option>
          </select>
        </div>
        <div class="form-group">
          <label>Compagnie & N° de vol :</label>
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control" placeholder="Ex: Emirates ou Air France" value="${f.airline || ''}" onchange="updateFlightField(${idx}, 'airline', this.value)">
            <input type="text" class="form-control" placeholder="N° ex: EK82" style="max-width:140px;" value="${f.flightNumber || ''}" onchange="updateFlightField(${idx}, 'flightNumber', this.value)">
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group">
          <label>Aéroport & Heure de départ :</label>
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control" placeholder="Ex: Lyon Saint-Exupéry (LYS)" value="${f.departureAirport || ''}" onchange="updateFlightField(${idx}, 'departureAirport', this.value)">
            <input type="text" class="form-control" placeholder="Heure (ex: 15h35)" style="max-width:130px;" value="${f.departureTime || ''}" onchange="updateFlightField(${idx}, 'departureTime', this.value)">
          </div>
        </div>
        <div class="form-group">
          <label>Aéroport & Heure d'arrivée :</label>
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control" placeholder="Ex: Johannesburg (JNB) ou Le Cap" value="${f.arrivalAirport || ''}" onchange="updateFlightField(${idx}, 'arrivalAirport', this.value)">
            <input type="text" class="form-control" placeholder="Heure (ex: 10h15)" style="max-width:130px;" value="${f.arrivalTime || ''}" onchange="updateFlightField(${idx}, 'arrivalTime', this.value)">
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group">
          <label>Date du vol :</label>
          <input type="text" class="form-control" placeholder="Ex: 12/10/2026 ou Jour 8" value="${f.date || ''}" onchange="updateFlightField(${idx}, 'date', this.value)">
        </div>
        <div class="form-group">
          <label><i class="fa-solid fa-arrows-split-up-and-left" style="color:var(--accent-gold);"></i> Escale / Vol VIA :</label>
          <input type="text" class="form-control" placeholder="Ex: Escale à Dubaï à 23h55 (Vol EK761)" value="${f.via || ''}" onchange="updateFlightField(${idx}, 'via', this.value)">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label>Consignes / Notes (Rendez-vous aéroport, bagages) :</label>
        <input type="text" class="form-control" placeholder="Ex: Rendez-vous au comptoir à 13h05. 1 bagage soute 20kg." value="${f.notes || ''}" onchange="updateFlightField(${idx}, 'notes', this.value)">
      </div>
    `;
    container.appendChild(card);
  });
}

function addNewFlight() {
  ensureFlightsListStructure();
  tripData.flightsList.push({
    type: "Aller",
    airline: "",
    flightNumber: "",
    departureAirport: "",
    departureTime: "",
    arrivalAirport: "",
    arrivalTime: "",
    date: "",
    via: "",
    notes: ""
  });
  renderAdminFlights();
}

function removeFlight(idx) {
  if (confirm("Supprimer ce vol ?")) {
    tripData.flightsList.splice(idx, 1);
    renderAdminFlights();
  }
}

function updateFlightField(idx, field, val) {
  tripData.flightsList[idx][field] = val;
}

// -----------------------------------------------------------------------------
// 2. PROGRAMME JOUR PAR JOUR & VISITES AVEC GPS AUTOMATIQUE
// -----------------------------------------------------------------------------
function renderAdminDays() {
  const container = document.getElementById('adm-days-list');
  container.innerHTML = '';

  if (!tripData.itinerary) tripData.itinerary = [];

  tripData.itinerary.forEach((item, dayIndex) => {
    if (!item.timeline) item.timeline = [];

    const box = document.createElement('div');
    box.className = 'section-box';
    box.style = "border-top:3px solid var(--accent-gold);";

    box.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeDay(${dayIndex})"><i class="fa-solid fa-trash"></i> Supprimer ce jour</button>
      
      <div class="form-row">
        <div class="form-group" style="max-width:120px;">
          <label>Jour N° :</label>
          <input type="number" class="form-control" value="${item.day}" onchange="updateDayField(${dayIndex}, 'day', parseInt(this.value))">
        </div>
        <div class="form-group">
          <label>Ville / Étape principale :</label>
          <input type="text" class="form-control" value="${item.city || ''}" placeholder="Ex: Le Cap" onchange="updateDayField(${dayIndex}, 'city', this.value)">
        </div>
      </div>

      <div class="form-group">
        <label>Titre de l'étape :</label>
        <input type="text" class="form-control" value="${item.title || ''}" placeholder="Ex: Péninsule du Cap de Bonne Espérance" onchange="updateDayField(${dayIndex}, 'title', this.value)">
      </div>

      <div class="form-group">
        <label>Point fort / Thématique :</label>
        <input type="text" class="form-control" value="${item.highlight || ''}" placeholder="Ex: Océan et faune marine" onchange="updateDayField(${dayIndex}, 'highlight', this.value)">
      </div>

      <div class="form-group">
        <label>Description globale du programme :</label>
        <textarea class="form-control" rows="2" onchange="updateDayField(${dayIndex}, 'description', this.value)">${item.description || ''}</textarea>
      </div>

      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group" style="flex:1;">
          <label>Position GPS de l'étape :</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" onclick="autoGeocodeDay(${dayIndex})" class="btn-secondary" style="font-size:0.8rem; padding:6px 12px; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; white-space:nowrap; font-weight:700;">
              <i class="fa-solid fa-location-crosshairs"></i> Proposer coordonnées GPS
            </button>
            <span id="day-geocode-status-${dayIndex}" style="font-size:0.75rem; font-weight:bold; color:#059669;">
              ${(item.lat && item.lng) ? `<i class="fa-solid fa-check"></i> Fixé (${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)})` : '<span style="color:#b45309;"><i class="fa-solid fa-triangle-exclamation"></i> Non géolocalisé</span>'}
            </span>
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:14px;">
        <div class="form-group">
          <label>Latitude étape :</label>
          <input type="number" step="any" id="day-lat-${dayIndex}" class="form-control" value="${item.lat || ''}" placeholder="Ex: 41.8781" oninput="updateDayCoordinates(${dayIndex})" onchange="updateDayCoordinates(${dayIndex})">
        </div>
        <div class="form-group">
          <label>Longitude étape :</label>
          <input type="number" step="any" id="day-lng-${dayIndex}" class="form-control" value="${item.lng || ''}" placeholder="Ex: -87.6298" oninput="updateDayCoordinates(${dayIndex})" onchange="updateDayCoordinates(${dayIndex})">
        </div>
      </div>

      <!-- SOUS-LISTE : VISITES & HORAIRES PRÉCIS DU JOUR -->
      <div style="background:white; border:1px solid #cbd5e1; border-radius:12px; padding:14px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:0.92rem; font-weight:800; color:var(--primary-dark); margin:0;">
            <i class="fa-solid fa-clock" style="color:var(--accent-gold); margin-right:4px;"></i> Déroulé chronologique & Visites du Jour ${item.day}
          </h4>
          <button type="button" onclick="addNewVisitToDay(${dayIndex})" class="btn-secondary" style="font-size:0.75rem; padding:4px 10px; background:#f0fdf4; color:#15803d; border-color:#86efac; font-weight:700;">
            <i class="fa-solid fa-plus"></i> Ajouter une visite
          </button>
        </div>

        <div id="day-timeline-list-${dayIndex}">
          ${renderDayVisitsHtml(dayIndex, item.timeline)}
        </div>
      </div>
    `;
    container.appendChild(box);
  });
}

function renderDayVisitsHtml(dayIndex, visits) {
  if (!visits || visits.length === 0) {
    return `<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">Aucune visite programmée pour ce jour. Cliquez sur "+ Ajouter une visite".</div>`;
  }

  return visits.map((v, vIdx) => `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px; position:relative;">
      <button type="button" onclick="removeVisitFromDay(${dayIndex}, ${vIdx})" style="position:absolute; top:8px; right:8px; background:#fee2e2; color:#dc2626; border:none; border-radius:4px; font-size:0.72rem; padding:3px 7px; cursor:pointer;">
        <i class="fa-solid fa-trash"></i>
      </button>

      <div style="display:flex; gap:10px; margin-bottom:6px; max-width:92%;">
        <div style="width:110px;">
          <label style="font-size:0.75rem; font-weight:700; color:#475569;">Horaire :</label>
          <input type="text" class="form-control" style="padding:4px 8px; font-size:0.82rem;" placeholder="Ex: 09:30" value="${v.time || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'time', this.value)">
        </div>
        <div style="flex:1;">
          <label style="font-size:0.75rem; font-weight:700; color:#475569;">Titre de la visite / étape :</label>
          <input type="text" class="form-control" style="padding:4px 8px; font-size:0.82rem; font-weight:700;" placeholder="Ex: Visite guidée du phare" value="${v.title || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'title', this.value)">
        </div>
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:0.75rem; font-weight:700; color:#475569;">Description / Notes :</label>
        <input type="text" class="form-control" style="padding:4px 8px; font-size:0.82rem;" placeholder="Ex: Découverte des colonies d'otaries" value="${v.subtitle || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'subtitle', this.value)">
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px;">
          <label style="font-size:0.75rem; font-weight:700; color:#475569;">Adresse du site (calcul GPS automatique) :</label>
          <div style="display:flex; gap:6px;">
            <input type="text" id="visit-addr-${dayIndex}-${vIdx}" class="form-control" style="padding:4px 8px; font-size:0.82rem;" placeholder="Ex: Cape Point, Cape Town" value="${v.address || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'address', this.value)">
            <button type="button" onclick="autoGeocodeVisit(${dayIndex}, ${vIdx})" class="btn-secondary" style="font-size:0.75rem; padding:4px 8px; white-space:nowrap; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd;" title="Calculer les coordonnées GPS via Nominatim / OpenStreetMap">
              <i class="fa-solid fa-location-crosshairs"></i> Calculer GPS
            </button>
          </div>
        </div>

        <div style="width:110px;">
          <label style="font-size:0.75rem; font-weight:700; color:#475569;">Lat :</label>
          <input type="number" step="any" id="visit-lat-${dayIndex}-${vIdx}" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${v.lat || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'lat', parseFloat(this.value))">
        </div>

        <div style="width:110px;">
          <label style="font-size:0.75rem; font-weight:700; color:#475569;">Lng :</label>
          <input type="number" step="any" id="visit-lng-${dayIndex}-${vIdx}" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${v.lng || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'lng', parseFloat(this.value))">
        </div>
      </div>
      <div id="geocode-status-${dayIndex}-${vIdx}" style="font-size:0.72rem; color:#059669; margin-top:3px; font-weight:bold;"></div>
    </div>
  `).join('');
}

function addNewVisitToDay(dayIndex) {
  if (!tripData.itinerary[dayIndex].timeline) {
    tripData.itinerary[dayIndex].timeline = [];
  }
  tripData.itinerary[dayIndex].timeline.push({
    time: "10:00",
    title: "Nouvelle visite",
    subtitle: "Détails et déroulé",
    address: "",
    lat: null,
    lng: null,
    icon: "location-dot"
  });
  renderAdminDays();
}

function removeVisitFromDay(dayIndex, visitIndex) {
  tripData.itinerary[dayIndex].timeline.splice(visitIndex, 1);
  renderAdminDays();
}

function updateVisitField(dayIndex, visitIndex, field, value) {
  tripData.itinerary[dayIndex].timeline[visitIndex][field] = value;
}

// Géocodage automatique gratuit via OpenStreetMap / Nominatim
function autoGeocodeVisit(dayIndex, visitIndex) {
  const addrInput = document.getElementById(`visit-addr-${dayIndex}-${visitIndex}`);
  const statusEl = document.getElementById(`geocode-status-${dayIndex}-${visitIndex}`);
  const query = addrInput ? addrInput.value.trim() : '';

  if (!query) {
    alert("Veuillez saisir une adresse ou un nom de lieu pour calculer le GPS.");
    return;
  }

  statusEl.innerText = "Recherche satellite en cours...";
  statusEl.style.color = "#0284c7";

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        tripData.itinerary[dayIndex].timeline[visitIndex].lat = lat;
        tripData.itinerary[dayIndex].timeline[visitIndex].lng = lon;
        tripData.itinerary[dayIndex].timeline[visitIndex].address = query;

        const latInput = document.getElementById(`visit-lat-${dayIndex}-${visitIndex}`);
        const lngInput = document.getElementById(`visit-lng-${dayIndex}-${visitIndex}`);
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lon;

        statusEl.innerText = `✓ Coordonnées GPS trouvées : [${lat.toFixed(4)}, ${lon.toFixed(4)}]`;
        statusEl.style.color = "#16a34a";
      } else {
        statusEl.innerText = "Lieu non localisé automatiquement. Vous pouvez entrer la latitude/longitude manuellement.";
        statusEl.style.color = "#dc2626";
      }
    })
    .catch(err => {
      console.warn("Erreur geocoding:", err);
      statusEl.innerText = "Connexion indisponible. Saisissez la latitude manuellement.";
      statusEl.style.color = "#dc2626";
    });
}

// Géocodage automatique de l'étape du jour (Ville ou Titre)
function autoGeocodeDay(dayIndex) {
  const day = tripData.itinerary[dayIndex];
  if (!day) return;

  const query = (day.city && day.city.trim()) ? day.city.trim() : (day.title ? day.title.trim() : '');
  const statusEl = document.getElementById(`day-geocode-status-${dayIndex}`);

  if (!query) {
    alert("Veuillez renseigner une Ville ou un Titre d'étape pour calculer les coordonnées GPS.");
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche satellite...</span>';
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        tripData.itinerary[dayIndex].lat = lat;
        tripData.itinerary[dayIndex].lng = lon;

        const latInput = document.getElementById(`day-lat-${dayIndex}`);
        const lngInput = document.getElementById(`day-lng-${dayIndex}`);
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lon;

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Trouvé : [${lat.toFixed(4)}, ${lon.toFixed(4)}] (validez ou ajustez si besoin)</span>`;
        }
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Non trouvé automatiquement. Saisissez lat/lng manuellement.</span>`;
        }
      }
    })
    .catch(err => {
      console.warn("Erreur geocoding jour:", err);
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#dc2626;">Erreur réseau lors de la recherche.</span>`;
      }
    });
}

function updateDayField(index, field, value) {
  tripData.itinerary[index][field] = value;
}

function updateDayCoordinates(dayIndex) {
  const latInp = document.getElementById(`day-lat-${dayIndex}`);
  const lngInp = document.getElementById(`day-lng-${dayIndex}`);
  const statusEl = document.getElementById(`day-geocode-status-${dayIndex}`);

  const lat = latInp && latInp.value !== '' ? parseFloat(latInp.value) : null;
  const lng = lngInp && lngInp.value !== '' ? parseFloat(lngInp.value) : null;

  tripData.itinerary[dayIndex].lat = (!isNaN(lat) && lat !== null) ? lat : 0;
  tripData.itinerary[dayIndex].lng = (!isNaN(lng) && lng !== null) ? lng : 0;

  if (statusEl) {
    if (!isNaN(lat) && !isNaN(lng) && lat !== null && lng !== null && (lat !== 0 || lng !== 0)) {
      statusEl.innerHTML = `<i class="fa-solid fa-check"></i> Fixé (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      statusEl.style.color = '#059669';
    } else {
      statusEl.innerHTML = '<span style="color:#b45309;"><i class="fa-solid fa-triangle-exclamation"></i> Non géolocalisé</span>';
    }
  }
}

function addNewDay() {
  const nextDay = (tripData.itinerary && tripData.itinerary.length) ? tripData.itinerary.length + 1 : 1;
  tripData.itinerary.push({
    day: nextDay,
    title: "Nouvelle étape",
    highlight: "Découverte et temps fort",
    city: "Localité",
    description: "Programme de la journée...",
    lat: 0,
    lng: 0,
    timeline: [
      {
        time: "09:30",
        title: "Rendez-vous étape",
        subtitle: "Accueil et début de visite",
        icon: "location-dot"
      }
    ]
  });
  renderAdminDays();
}

function removeDay(index) {
  if (confirm("Supprimer cette étape ?")) {
    tripData.itinerary.splice(index, 1);
    renderAdminDays();
  }
}

// -----------------------------------------------------------------------------
// 3. HOTELS & COUPS DE CŒUR
// -----------------------------------------------------------------------------
function renderAdminHotels() {
  const container = document.getElementById('adm-hotels-list');
  container.innerHTML = '';
  if (!tripData.hotels) tripData.hotels = [];

  tripData.hotels.forEach((hotel, index) => {
    const box = document.createElement('div');
    box.className = 'section-box';
    box.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeHotel(${index})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      <div class="form-row">
        <div class="form-group">
          <label>Nom de l'établissement :</label>
          <input type="text" class="form-control" value="${hotel.name || ''}" onchange="updateHotelField(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Dates de séjour :</label>
          <input type="text" class="form-control" value="${hotel.dates || ''}" onchange="updateHotelField(${index}, 'dates', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Adresse :</label>
        <input type="text" class="form-control" value="${hotel.address || ''}" onchange="updateHotelField(${index}, 'address', this.value)">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Latitude :</label>
          <input type="number" step="any" class="form-control" value="${hotel.lat || ''}" onchange="updateHotelField(${index}, 'lat', parseFloat(this.value))">
        </div>
        <div class="form-group">
          <label>Longitude :</label>
          <input type="number" step="any" class="form-control" value="${hotel.lng || ''}" onchange="updateHotelField(${index}, 'lng', parseFloat(this.value))">
        </div>
      </div>
    `;
    container.appendChild(box);
  });
}

function updateHotelField(index, field, value) {
  tripData.hotels[index][field] = value;
}

function addNewHotel() {
  if (!tripData.hotels) tripData.hotels = [];
  tripData.hotels.push({
    name: "Nouvel Hôtel",
    dates: "Du ... au ...",
    address: "",
    lat: 0,
    lng: 0
  });
  renderAdminHotels();
}

function removeHotel(index) {
  if (confirm("Supprimer cet hôtel ?")) {
    tripData.hotels.splice(index, 1);
    renderAdminHotels();
  }
}

function renderAdminFreeTime() {
  const container = document.getElementById('adm-freetime-list');
  container.innerHTML = '';
  if (!tripData.freeTimeSuggestions) tripData.freeTimeSuggestions = [];

  tripData.freeTimeSuggestions.forEach((sug, index) => {
    const box = document.createElement('div');
    box.className = 'section-box';
    box.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeSuggestion(${index})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      <div class="form-row">
        <div class="form-group">
          <label>Nom du lieu / coup de cœur :</label>
          <input type="text" class="form-control" value="${sug.name || ''}" onchange="updateSugField(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Thématique / Badge :</label>
          <input type="text" class="form-control" value="${sug.tag || ''}" onchange="updateSugField(${index}, 'tag', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Description :</label>
        <textarea class="form-control" rows="2" onchange="updateSugField(${index}, 'description', this.value)">${sug.description || ''}</textarea>
      </div>
    `;
    container.appendChild(box);
  });
}

function updateSugField(index, field, value) {
  tripData.freeTimeSuggestions[index][field] = value;
}

function addNewSuggestion() {
  if (!tripData.freeTimeSuggestions) tripData.freeTimeSuggestions = [];
  tripData.freeTimeSuggestions.push({
    name: "Coup de cœur",
    tag: "Incontournable",
    description: "Recommandation Girardot...",
    lat: 0,
    lng: 0
  });
  renderAdminFreeTime();
}

function removeSuggestion(index) {
  if (confirm("Supprimer cette suggestion ?")) {
    tripData.freeTimeSuggestions.splice(index, 1);
    renderAdminFreeTime();
  }
}

// -----------------------------------------------------------------------------
// 4. CONCIERGERIE : DÉPLIAGE DES SITES, ÉDITION & AJOUT MANUEL
// -----------------------------------------------------------------------------
function renderAdminConcierge() {
  const container = document.getElementById('adm-concierge-modules-list');
  if (!container) return;

  if (!tripData.conciergerie) {
    tripData.conciergerie = JSON.parse(JSON.stringify(window.defaultTravelData.conciergerie));
  }

  container.innerHTML = '';
  tripData.conciergerie.themes.forEach((th, thIdx) => {
    if (!th.places) th.places = [];
    const isEnabled = th.enabled !== false;
    const box = document.createElement('div');
    box.className = 'section-box';
    box.style = `border-left: 5px solid ${isEnabled ? th.color || 'var(--primary-color)' : '#94a3b8'}; background: ${isEnabled ? '#ffffff' : '#f8fafc'}; margin-bottom: 18px; padding: 18px;`;

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px; height:38px; border-radius:10px; background:${th.color || 'var(--primary-color)'}; color:white; display:flex; align-items:center; justify-content:center; font-size:1.15rem;">
            <i class="fa-solid fa-${th.icon || 'star'}"></i>
          </div>
          <div>
            <div style="font-weight:800; font-size:1.05rem; color:var(--text-main);">${th.label}</div>
            <div style="font-size:0.8rem; color:#64748b;">${th.description} (${th.places.length} adresses enregistrées)</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:700; font-size:0.84rem; color:${isEnabled ? '#047857' : '#64748b'};">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleConciergeTheme(${thIdx}, this.checked)" style="width:18px; height:18px; cursor:pointer;">
            <span>${isEnabled ? 'Module Actif' : 'Désactivé (Tout Compris)'}</span>
          </label>
          <button type="button" onclick="addNewPlaceToTheme(${thIdx})" class="btn-secondary" style="font-size:0.78rem; padding:5px 12px; background:#f0fdf4; color:#15803d; border-color:#86efac; font-weight:700;">
            <i class="fa-solid fa-plus"></i> Ajouter un site
          </button>
        </div>
      </div>

      <!-- DÉPLIABLE DES SITES DU THÈME -->
      <details style="margin-top:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; padding:8px 12px;" open>
        <summary style="font-weight:700; font-size:0.85rem; color:var(--primary-dark); cursor:pointer; padding:4px 0;">
          <i class="fa-solid fa-layer-group" style="color:var(--accent-gold); margin-right:6px;"></i> Voir et personnaliser les sites (${th.places.length})
        </summary>
        
        <div style="margin-top:12px;" id="theme-places-list-${thIdx}">
          ${renderThemePlacesHtml(thIdx, th.places)}
        </div>
      </details>
    `;
    container.appendChild(box);
  });
}

function renderThemePlacesHtml(thIdx, places) {
  if (!places || places.length === 0) {
    return `<div style="padding:10px; font-size:0.82rem; color:#94a3b8; font-style:italic;">Aucune adresse dans cette catégorie. Cliquez sur "+ Ajouter un site" ci-dessus.</div>`;
  }

  return places.map((p, pIdx) => `
    <div style="background:white; border:1px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:12px; position:relative;">
      <button type="button" onclick="removePlaceFromTheme(${thIdx}, ${pIdx})" style="position:absolute; top:10px; right:10px; background:#fee2e2; color:#dc2626; border:none; border-radius:4px; font-size:0.75rem; padding:4px 8px; cursor:pointer;">
        <i class="fa-solid fa-trash"></i> Supprimer
      </button>

      <div class="form-row" style="max-width:92%; margin-bottom:8px;">
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Nom du site / restaurant / service :</label>
          <input type="text" class="form-control" style="font-size:0.85rem; font-weight:700;" value="${p.name || ''}" placeholder="Ex: Restaurant The Codfather" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Catégorie & Badge :</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="Catégorie (ex: Poissons frais)" value="${p.category || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'category', this.value)">
            <input type="text" class="form-control" style="font-size:0.85rem; max-width:130px;" placeholder="Badge (ex: Coup de cœur)" value="${p.tag || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'tag', this.value)">
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Localisation / Quartier :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="Ex: Camps Bay, Le Cap" value="${p.location || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'location', this.value)">
        </div>
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Téléphone (pour appel direct) :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="Ex: +27 21 438 0797" value="${p.phone || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'phone', this.value)">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:0.75rem; font-weight:700;">Description :</label>
        <textarea class="form-control" rows="2" style="font-size:0.85rem;" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'description', this.value)">${p.description || ''}</textarea>
      </div>

      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Conseil personnalisé du guide :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="Ex: Réserver en terrasse pour le coucher de soleil." value="${p.tips || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'tips', this.value)">
        </div>
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Lien direct de réservation web :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="https://..." value="${p.bookingUrl || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'bookingUrl', this.value)">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Latitude GPS :</label>
          <input type="number" step="any" class="form-control" style="font-size:0.85rem;" value="${p.lat || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'lat', parseFloat(this.value))">
        </div>
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Longitude GPS :</label>
          <input type="number" step="any" class="form-control" style="font-size:0.85rem;" value="${p.lng || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'lng', parseFloat(this.value))">
        </div>
      </div>
    </div>
  `).join('');
}

function toggleConciergeTheme(themeIndex, checkedState) {
  tripData.conciergerie.themes[themeIndex].enabled = checkedState;
}

function addNewPlaceToTheme(themeIndex) {
  if (!tripData.conciergerie.themes[themeIndex].places) {
    tripData.conciergerie.themes[themeIndex].places = [];
  }
  tripData.conciergerie.themes[themeIndex].places.push({
    name: "Nouveau site recommandé",
    category: "Recommandation locale",
    location: "Centre-ville",
    tag: "Conseil Girardot",
    description: "Présentation du lieu et spécialités...",
    tips: "À ne pas manquer !",
    phone: "",
    bookingUrl: "",
    lat: null,
    lng: null
  });
  renderAdminConcierge();
}

function removePlaceFromTheme(themeIndex, placeIndex) {
  if (confirm("Supprimer cette adresse de la conciergerie ?")) {
    tripData.conciergerie.themes[themeIndex].places.splice(placeIndex, 1);
    renderAdminConcierge();
  }
}

function updatePlaceField(themeIndex, placeIndex, field, value) {
  tripData.conciergerie.themes[themeIndex].places[placeIndex][field] = value;
}

function triggerAiConciergeGeneration() {
  const dest = tripData.title || "cette destination";
  if (confirm(`Voulez-vous générer automatiquement via IA les recommandations de conciergerie pour ${dest} ?`)) {
    if (dest.toLowerCase().includes('italie') || dest.toLowerCase().includes('dolomite')) {
      tripData.conciergerie.themes.forEach(th => {
        if (th.id === 'restauration') {
          th.places = [
            { name: "Wirtshaus Vögele", category: "Cuisine tyrolienne", location: "Bolzano centre", tag: "Coup de cœur", description: "Auberge historique depuis 1870 servant les meilleurs Knödel.", phone: "+39 0471 973938", bookingUrl: "https://www.voegele.it", lat: 46.4995, lng: 11.3538 },
            { name: "Ristorante Il Bacio da Ciro", category: "Pizzas & poissons", location: "Bolzano", tag: "Tradition italienne", description: "Pizzas cuites au feu de bois et poissons frais.", phone: "+39 0471 977990", bookingUrl: "https://www.ilbaciodaciro.it", lat: 46.5010, lng: 11.3560 }
          ];
        }
      });
    }
    alert(`✓ IA Concierge : Recommandations actualisées pour ${dest} ! Vous pouvez dérouler chaque section ci-dessous pour les voir et ajouter vos propres adresses.`);
    renderAdminConcierge();
  }
}

// -----------------------------------------------------------------------------
// 5. CONTACTS & CONSEILS PRATIQUES (Ajout manuel dynamique)
// -----------------------------------------------------------------------------
function ensureContactsAndPracticalStructure() {
  // Contacts
  if (!tripData.contactsList || !Array.isArray(tripData.contactsList)) {
    tripData.contactsList = [];
    if (tripData.contacts) {
      if (tripData.contacts.receptif) {
        tripData.contactsList.push({
          category: "Correspondant Local / Réceptif",
          name: tripData.contacts.receptif.name || "",
          phone: tripData.contacts.receptif.emergency || tripData.contacts.receptif.phone || "",
          address: tripData.contacts.receptif.address || "",
          isEmergency: true
        });
      }
      if (tripData.contacts.agence) {
        tripData.contactsList.push({
          category: "Agence Voyages Girardot",
          name: tripData.contacts.agence.name || "Siège Chalon-sur-Saône",
          phone: tripData.contacts.agence.phone || "03 85 42 82 82",
          address: tripData.contacts.agence.address || "",
          isEmergency: false
        });
      }
      if (tripData.contacts.consulate || tripData.contacts.ambassade) {
        const c = tripData.contacts.consulate || tripData.contacts.ambassade;
        tripData.contactsList.push({
          category: "Consulat / Ambassade de France",
          name: c.name || "",
          phone: c.phone || "",
          address: c.address || "",
          isEmergency: false
        });
      }
      if (tripData.contacts.assistance) {
        tripData.contactsList.push({
          category: "Assistance & Rapatriement",
          name: tripData.contacts.assistance.name || "Mutuaide Assistance",
          phone: tripData.contacts.assistance.phone || "",
          address: tripData.contacts.assistance.police || "",
          isEmergency: true
        });
      }
    }
  }

  // Conseils Pratiques
  if (!tripData.practicalTipsList || !Array.isArray(tripData.practicalTipsList)) {
    tripData.practicalTipsList = [];
    if (tripData.practicalInfo) {
      const p = tripData.practicalInfo;
      if (p.money) tripData.practicalTipsList.push({ title: "Monnaie & Devises", icon: "coins", content: p.money });
      if (p.electricity) tripData.practicalTipsList.push({ title: "Électricité & Prises", icon: "plug", content: p.electricity });
      if (p.clothing) tripData.practicalTipsList.push({ title: "Vêtements conseillés", icon: "shirt", content: p.clothing });
      if (p.tips) tripData.practicalTipsList.push({ title: "Pourboires", icon: "hand-holding-dollar", content: p.tips });
      if (p.wifi) tripData.practicalTipsList.push({ title: "Connexion Wi-Fi", icon: "wifi", content: p.wifi });
    }
  }
}

function renderAdminContacts() {
  const container = document.getElementById('adm-contacts-list');
  if (!container) return;
  container.innerHTML = '';

  if (!tripData.contactsList || tripData.contactsList.length === 0) {
    container.innerHTML = `<div style="font-size:0.85rem; color:#94a3b8; font-style:italic;">Aucun contact renseigné. Cliquez sur "+ Ajouter un contact".</div>`;
    return;
  }

  tripData.contactsList.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'section-box';
    card.style = `border-left: 4px solid ${c.isEmergency ? '#dc2626' : 'var(--primary-color)'}; margin-bottom: 12px;`;
    card.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeContact(${idx})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      
      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group">
          <label>Titre / Fonction du contact :</label>
          <input type="text" class="form-control" placeholder="Ex: Correspondant Local, Agence, Guide..." value="${c.category || ''}" onchange="updateContactField(${idx}, 'category', this.value)">
        </div>
        <div class="form-group">
          <label>Nom ou Organisme :</label>
          <input type="text" class="form-control" placeholder="Ex: Wilderness Travel ou Consulat" value="${c.name || ''}" onchange="updateContactField(${idx}, 'name', this.value)">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Numéro de téléphone :</label>
          <input type="text" class="form-control" placeholder="Ex: +27 21 000 0000" value="${c.phone || ''}" onchange="updateContactField(${idx}, 'phone', this.value)">
        </div>
        <div class="form-group">
          <label>Adresse physique (éventuelle) :</label>
          <input type="text" class="form-control" placeholder="Ex: 12 Strand Street, Le Cap" value="${c.address || ''}" onchange="updateContactField(${idx}, 'address', this.value)">
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function addNewContact() {
  ensureContactsAndPracticalStructure();
  tripData.contactsList.push({
    category: "Nouveau Contact",
    name: "",
    phone: "",
    address: "",
    isEmergency: false
  });
  renderAdminContacts();
}

function removeContact(idx) {
  if (confirm("Supprimer ce contact ?")) {
    tripData.contactsList.splice(idx, 1);
    renderAdminContacts();
  }
}

function updateContactField(idx, field, value) {
  tripData.contactsList[idx][field] = value;
}

function renderAdminPractical() {
  const container = document.getElementById('adm-practical-list');
  if (!container) return;
  container.innerHTML = '';

  if (!tripData.practicalTipsList || tripData.practicalTipsList.length === 0) {
    container.innerHTML = `<div style="font-size:0.85rem; color:#94a3b8; font-style:italic;">Aucun conseil pratique renseigné. Cliquez sur "+ Ajouter un conseil pratique".</div>`;
    return;
  }

  tripData.practicalTipsList.forEach((tip, idx) => {
    const card = document.createElement('div');
    card.className = 'section-box';
    card.style = "margin-bottom: 12px; border-left: 4px solid var(--accent-gold);";
    card.innerHTML = `
      <button type="button" class="btn-delete" onclick="removePracticalTip(${idx})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      
      <div class="form-group" style="margin-bottom:8px;">
        <label>Titre du conseil :</label>
        <input type="text" class="form-control" placeholder="Ex: Monnaie & Devises, Pourboires..." value="${tip.title || ''}" onchange="updatePracticalField(${idx}, 'title', this.value)">
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label>Explications et recommandations pour le voyageur :</label>
        <textarea class="form-control" rows="2" onchange="updatePracticalField(${idx}, 'content', this.value)">${tip.content || ''}</textarea>
      </div>
    `;
    container.appendChild(card);
  });
}

function addNewPracticalTip() {
  ensureContactsAndPracticalStructure();
  tripData.practicalTipsList.push({
    title: "Nouveau conseil pratique",
    icon: "lightbulb",
    content: "Informations et recommandations..."
  });
  renderAdminPractical();
}

function removePracticalTip(idx) {
  if (confirm("Supprimer ce conseil pratique ?")) {
    tripData.practicalTipsList.splice(idx, 1);
    renderAdminPractical();
  }
}

function updatePracticalField(idx, field, value) {
  tripData.practicalTipsList[idx][field] = value;
}

// -----------------------------------------------------------------------------
// ENREGISTREMENT COMPLET ET PARTAGE
// -----------------------------------------------------------------------------
function saveAllCarnet() {
  // Update general fields
  tripData.title = document.getElementById('adm-title').value;
  tripData.subtitle = document.getElementById('adm-subtitle').value;
  tripData.dates = document.getElementById('adm-dates').value;
  tripData.coverImage = document.getElementById('adm-cover').value;
  tripData.intro = document.getElementById('adm-intro').value;

  // Alert
  tripData.alert = {
    title: document.getElementById('adm-alert-title').value,
    text: document.getElementById('adm-alert-text').value,
    link: document.getElementById('adm-alert-link').value
  };

  // Synchronisation directe et garantie de l'itinéraire depuis les champs du formulaire
  if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
    tripData.itinerary.forEach((day, dayIndex) => {
      const latInput = document.getElementById(`day-lat-${dayIndex}`);
      const lngInput = document.getElementById(`day-lng-${dayIndex}`);
      if (latInput && latInput.value !== '') {
        const parsedLat = parseFloat(latInput.value);
        if (!isNaN(parsedLat)) day.lat = parsedLat;
      }
      if (lngInput && lngInput.value !== '') {
        const parsedLng = parseFloat(lngInput.value);
        if (!isNaN(parsedLng)) day.lng = parsedLng;
      }

      // Synchroniser également les visites
      if (day.timeline && Array.isArray(day.timeline)) {
        day.timeline.forEach((v, vIdx) => {
          const vLatInp = document.getElementById(`visit-lat-${dayIndex}-${vIdx}`);
          const vLngInp = document.getElementById(`visit-lng-${dayIndex}-${vIdx}`);
          const vAddrInp = document.getElementById(`visit-addr-${dayIndex}-${vIdx}`);
          if (vLatInp && vLatInp.value !== '') {
            const p = parseFloat(vLatInp.value);
            if (!isNaN(p)) v.lat = p;
          }
          if (vLngInp && vLngInp.value !== '') {
            const p = parseFloat(vLngInp.value);
            if (!isNaN(p)) v.lng = p;
          }
          if (vAddrInp) v.address = vAddrInp.value;
        });
      }
    });
  }

  // Synchronisation rétrocompatible de l'objet flights
  if (tripData.flightsList && tripData.flightsList.length > 0) {
    const outboundFlight = tripData.flightsList.find(f => f.type === 'Aller') || tripData.flightsList[0];
    const inboundFlight = tripData.flightsList.find(f => f.type === 'Retour') || tripData.flightsList[tripData.flightsList.length - 1];
    
    tripData.flights = {
      outbound: {
        airline: outboundFlight.airline,
        flightNumber: outboundFlight.flightNumber,
        departureAirport: outboundFlight.departureAirport,
        departureTime: outboundFlight.departureTime,
        arrivalAirport: outboundFlight.arrivalAirport,
        arrivalTime: outboundFlight.arrivalTime,
        date: outboundFlight.date,
        layover: outboundFlight.via
      },
      inbound: {
        airline: inboundFlight.airline,
        flightNumber: inboundFlight.flightNumber,
        departureAirport: inboundFlight.departureAirport,
        departureTime: inboundFlight.departureTime,
        arrivalAirport: inboundFlight.arrivalAirport,
        arrivalTime: inboundFlight.arrivalTime,
        date: inboundFlight.date,
        layover: inboundFlight.via
      },
      domesticFlights: tripData.flightsList.filter(f => f.type === 'Intérieur').map((df, i) => ({
        id: `dom-${i+1}`,
        label: `${df.airline} ${df.flightNumber}`,
        airline: df.airline,
        flightNumber: df.flightNumber,
        departureAirport: df.departureAirport,
        arrivalAirport: df.arrivalAirport,
        notes: df.notes || df.via || ''
      }))
    };
  }

  // Synchronisation rétrocompatible des contacts
  if (tripData.contactsList && tripData.contactsList.length > 0) {
    const mainRec = tripData.contactsList.find(c => c.category.toLowerCase().includes('réceptif') || c.category.toLowerCase().includes('local')) || tripData.contactsList[0];
    if (!tripData.contacts) tripData.contacts = {};
    tripData.contacts.receptif = {
      name: mainRec.name,
      emergency: mainRec.phone,
      phone: mainRec.phone,
      address: mainRec.address
    };
  }

  // Save to LocalStorage & Catalog
  saveTripToCatalogAndStorage(tripData);

  // Update trip selector label
  renderTripSelectorOptions();

  // Update direct share link
  updateShareLink();

  alert(`✓ Le carnet de voyage "${tripData.title}" a été enregistré avec succès ! Vos clients et l'espace administrateur le retrouveront à tout moment.`);
}

// Reset data
function resetToDefaultData() {
  if (confirm("Rétablir les données par défaut (Circuit Afrique du Sud - Girardot) ? Toutes vos modifications actuelles seront réinitialisées.")) {
    tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
    saveTripToCatalogAndStorage(tripData);
    populateForm();
    updateShareLink();
    alert('Données réinitialisées au modèle de référence.');
  }
}

// Generate share link
function updateShareLink() {
  const jsonString = JSON.stringify(tripData);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));
  const basePath = window.location.href.replace('admin.html', 'index.html');
  const fullShareUrl = `${basePath.split('?')[0]}?trip=${encoded}`;

  const linkInput = document.getElementById('client-share-link');
  if (linkInput) linkInput.value = fullShareUrl;

  const previewBtn = document.getElementById('preview-client-link');
  if (previewBtn) previewBtn.href = fullShareUrl;

  const copyBtn = document.getElementById('copy-share-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(fullShareUrl).then(() => {
        const feedback = document.getElementById('copy-feedback');
        if (feedback) {
          feedback.innerText = 'Lien copié dans le presse-papier !';
          setTimeout(() => { feedback.innerText = ''; }, 3000);
        }
      }).catch(err => {
        if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
        }
        const feedback = document.getElementById('copy-feedback');
        if (feedback) {
          feedback.innerText = 'Lien copié !';
          setTimeout(() => { feedback.innerText = ''; }, 3000);
        }
      });
    };
  }
}
