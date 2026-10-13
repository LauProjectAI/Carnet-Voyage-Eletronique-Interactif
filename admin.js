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
  newTrip.flights = {
    outbound: null,
    inbound: null,
    domesticFlights: []
  };
  newTrip.flightsList = [];
  newTrip.hotels = [];

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
  const sections = ['general', 'itinerary', 'documents', 'hotels', 'freetime', 'concierge', 'contacts'];
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

  // 2. bis Billets & Documents Agence
  renderAdminDocuments();

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
// 2. bis GESTION DES BILLETS & DOCUMENTS DE VOYAGE (AGENCE)
// -----------------------------------------------------------------------------
function ensureDocumentsStructure() {
  if (!tripData.documents || !Array.isArray(tripData.documents)) {
    tripData.documents = [];
  }
}

function renderAdminDocuments() {
  ensureDocumentsStructure();
  const container = document.getElementById('adm-documents-list');
  if (!container) return;
  container.innerHTML = '';

  if (tripData.documents.length === 0) {
    container.innerHTML = `
      <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:24px; text-align:center; color:#64748b; font-size:0.85rem;">
        <i class="fa-solid fa-ticket" style="font-size:1.8rem; color:#94a3b8; margin-bottom:8px; display:block;"></i>
        Aucun document de voyage pour le moment.<br>
        Cliquez sur <strong>"+ Ajouter un document / billet"</strong> ci-dessus pour associer des e-billets d'avion, vouchers ou billets d'entrée.
      </div>
    `;
    return;
  }

  tripData.documents.forEach((doc, idx) => {
    const card = document.createElement('div');
    card.className = 'section-box';
    card.style = "margin-bottom:14px; border-left:4px solid var(--accent-gold);";

    card.innerHTML = `
      <button type="button" class="btn-delete" onclick="removeAdminDocument(${idx})"><i class="fa-solid fa-trash"></i> Supprimer</button>

      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group" style="max-width:200px;">
          <label style="font-weight:700; font-size:0.8rem;">Type de document :</label>
          <select class="form-control" onchange="updateAdminDocumentField(${idx}, 'type', this.value)">
            <option value="flight" ${doc.type === 'flight' ? 'selected' : ''}>✈️ Billet d'avion</option>
            <option value="voucher" ${doc.type === 'voucher' ? 'selected' : ''}>🏨 Bon d'échange (Voucher)</option>
            <option value="ticket" ${doc.type === 'ticket' ? 'selected' : ''}>🎟️ Billet d'entrée / Activité</option>
            <option value="guide" ${doc.type === 'guide' ? 'selected' : ''}>🗺️ Plan / Guide officiel</option>
            <option value="other" ${doc.type === 'other' ? 'selected' : ''}>📁 Autre document officiel</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:700; font-size:0.8rem;">Titre / Désignation :</label>
          <input type="text" class="form-control" placeholder="Ex: Billet d'avion Aller Lyon ➔ Johannesburg" value="${doc.title || ''}" onchange="updateAdminDocumentField(${idx}, 'title', this.value)">
        </div>
      </div>

      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group">
          <label style="font-weight:700; font-size:0.8rem;">Référence / N° dossier / PNR :</label>
          <input type="text" class="form-control" placeholder="Ex: PNR: EK8294B ou VOUCHER-7782" value="${doc.reference || ''}" onchange="updateAdminDocumentField(${idx}, 'reference', this.value)">
        </div>
        <div class="form-group">
          <label style="font-weight:700; font-size:0.8rem;">Bénéficiaire / Voyageur(s) :</label>
          <input type="text" class="form-control" placeholder="Ex: M. & Mme Passager ou Tous les participants" value="${doc.beneficiary || ''}" onchange="updateAdminDocumentField(${idx}, 'beneficiary', this.value)">
        </div>
        <div class="form-group" style="max-width:180px;">
          <label style="font-weight:700; font-size:0.8rem;">Date de validité / Jour :</label>
          <input type="text" class="form-control" placeholder="Ex: 12 Octobre 2026" value="${doc.date || ''}" onchange="updateAdminDocumentField(${idx}, 'date', this.value)">
        </div>
      </div>

      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group">
          <label style="font-weight:700; font-size:0.8rem;">Code QR / Code-barres à scanner (Texte du QR) :</label>
          <input type="text" class="form-control" placeholder="Ex: E-TICKET-EK82-LYS-JNB" value="${doc.qrCode || ''}" onchange="updateAdminDocumentField(${idx}, 'qrCode', this.value)">
          <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Le voyageur pourra faire apparaître ce QR Code en plein écran pour les contrôles et bornes.</div>
        </div>
        <div class="form-group">
          <label style="font-weight:700; font-size:0.8rem;">Fichier ou lien du document (PDF ou image) :</label>
          <div style="display:flex; gap:6px;">
            <input type="text" id="adm-doc-file-${idx}" class="form-control" placeholder="Chemin local, base64 ou URL https://..." value="${doc.fileUrl || ''}" onchange="updateAdminDocumentField(${idx}, 'fileUrl', this.value)">
            <button type="button" class="btn-secondary" style="font-size:0.75rem; white-space:nowrap;" onclick="document.getElementById('adm-doc-upload-${idx}').click()">
              <i class="fa-solid fa-upload"></i> Joindre
            </button>
            <input type="file" id="adm-doc-upload-${idx}" accept="image/*,.pdf" style="display:none;" onchange="handleAdminDocFileUpload(event, ${idx})">
          </div>
        </div>
      </div>

      <div class="form-group">
        <label style="font-weight:700; font-size:0.8rem;">Consignes & Instructions pour le voyageur :</label>
        <input type="text" class="form-control" placeholder="Ex: À présenter 3h avant au comptoir d'enregistrement Terminal 1 avec passeport." value="${doc.notes || ''}" onchange="updateAdminDocumentField(${idx}, 'notes', this.value)">
      </div>
    `;
    container.appendChild(card);
  });
}

function addNewAdminDocument() {
  ensureDocumentsStructure();
  tripData.documents.push({
    id: "doc_" + Date.now(),
    type: "flight",
    title: "Nouveau billet / bon de réservation",
    reference: "",
    beneficiary: "Tous les passagers",
    date: "",
    qrCode: "",
    notes: "",
    fileUrl: ""
  });
  renderAdminDocuments();
}

function removeAdminDocument(idx) {
  if (confirm("Supprimer ce document de voyage ?")) {
    tripData.documents.splice(idx, 1);
    renderAdminDocuments();
  }
}

function updateAdminDocumentField(idx, field, value) {
  ensureDocumentsStructure();
  tripData.documents[idx][field] = value;
}

function handleAdminDocFileUpload(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    updateAdminDocumentField(idx, 'fileUrl', evt.target.result);
    const input = document.getElementById(`adm-doc-file-${idx}`);
    if (input) input.value = evt.target.result.slice(0, 50) + '... (fichier joint)';
    renderAdminDocuments();
  };
  reader.readAsDataURL(file);
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

        ${th.id === 'transports' ? `
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin:10px 0;">
            <h5 style="margin:0 0 6px 0; font-size:0.85rem; color:#1e40af; font-weight:800;">
              <i class="fa-solid fa-map-location-dot"></i> Carte officielle & Guide d'utilisation des transports
            </h5>
            <div style="margin-bottom:8px;">
              <label style="font-size:0.75rem; font-weight:700; color:#1e3a8a;">Lien vers l'image du plan de métro / réseau (Affichage direct & téléchargement dans l'appli) :</label>
              <input type="text" class="form-control" style="font-size:0.82rem;" placeholder="https://.../plan-metro.png ou .jpg ou .svg" value="${th.transitMapImageUrl || ''}" onchange="updateThemeField(${thIdx}, 'transitMapImageUrl', this.value)">
              <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Permet aux voyageurs de visualiser directement le plan de métro en haute résolution dans l'application et de le télécharger pour y accéder hors-ligne.</div>
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-size:0.75rem; font-weight:700; color:#1e3a8a;">Lien vers la carte interactive / site web officiel des transports :</label>
              <input type="text" class="form-control" style="font-size:0.82rem;" placeholder="https://..." value="${th.transitMapUrl || ''}" onchange="updateThemeField(${thIdx}, 'transitMapUrl', this.value)">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:#1e3a8a;">Guide d'utilisation (achat billets, métro, bus, pass) :</label>
              <textarea class="form-control" rows="3" style="font-size:0.82rem;" placeholder="Expliquez comment acheter un ticket, quel pass privilégier, le fonctionnement du métro/bus..." onchange="updateThemeField(${thIdx}, 'guideHtml', this.value)">${th.guideHtml || ''}</textarea>
            </div>
          </div>
        ` : ''}
        
        <div style="margin-top:12px;" id="theme-places-list-${thIdx}">
          ${renderThemePlacesHtml(thIdx, th.places)}
        </div>
      </details>
    `;
    container.appendChild(box);
  });
}

function updateThemeField(thIdx, field, value) {
  tripData.conciergerie.themes[thIdx][field] = value;
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
        <div class="form-group" style="flex:1;">
          <label style="font-size:0.75rem; font-weight:700;">Adresse / Recherche GPS :</label>
          <div style="display:flex; gap:6px;">
            <input type="text" id="place-addr-${thIdx}-${pIdx}" class="form-control" style="font-size:0.85rem;" placeholder="Ex: 111 S Michigan Ave, Chicago" value="${p.location || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'location', this.value)">
            <button type="button" onclick="autoGeocodePlace(${thIdx}, ${pIdx})" class="btn-secondary" style="font-size:0.75rem; padding:4px 8px; white-space:nowrap; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd;" title="Calculer GPS via OpenStreetMap">
              <i class="fa-solid fa-location-crosshairs"></i> Calculer GPS
            </button>
          </div>
        </div>
        <div class="form-group" style="max-width:180px;">
          <label style="font-size:0.75rem; font-weight:700;">Téléphone :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="Ex: +1 312-443-3600" value="${p.phone || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'phone', this.value)">
        </div>
      </div>

      <div id="place-geocode-status-${thIdx}-${pIdx}" style="font-size:0.72rem; color:#059669; margin-bottom:6px; font-weight:bold;"></div>

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
          <label style="font-size:0.75rem; font-weight:700;">Lien direct web / réservation :</label>
          <input type="text" class="form-control" style="font-size:0.85rem;" placeholder="https://..." value="${p.bookingUrl || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'bookingUrl', this.value)">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Latitude GPS :</label>
          <input type="number" step="any" id="place-lat-${thIdx}-${pIdx}" class="form-control" style="font-size:0.85rem;" value="${p.lat || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'lat', parseFloat(this.value))">
        </div>
        <div class="form-group">
          <label style="font-size:0.75rem; font-weight:700;">Longitude GPS :</label>
          <input type="number" step="any" id="place-lng-${thIdx}-${pIdx}" class="form-control" style="font-size:0.85rem;" value="${p.lng || ''}" onchange="updatePlaceField(${thIdx}, ${pIdx}, 'lng', parseFloat(this.value))">
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

function autoGeocodePlace(thIdx, pIdx) {
  const addrInput = document.getElementById(`place-addr-${thIdx}-${pIdx}`);
  const statusEl = document.getElementById(`place-geocode-status-${thIdx}-${pIdx}`);
  const query = addrInput ? addrInput.value.trim() : '';

  if (!query) {
    alert("Veuillez renseigner une adresse ou un nom de lieu pour calculer le GPS.");
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche GPS en cours...</span>';
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        tripData.conciergerie.themes[thIdx].places[pIdx].lat = lat;
        tripData.conciergerie.themes[thIdx].places[pIdx].lng = lon;

        const latInput = document.getElementById(`place-lat-${thIdx}-${pIdx}`);
        const lngInput = document.getElementById(`place-lng-${thIdx}-${pIdx}`);
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lon;

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Trouvé : [${lat.toFixed(4)}, ${lon.toFixed(4)}]</span>`;
        }
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Lieu non localisé automatiquement. Saisissez la latitude/longitude manuellement.</span>`;
        }
      }
    })
    .catch(err => {
      console.warn("Erreur geocoding place:", err);
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#dc2626;">Erreur réseau lors de la recherche.</span>`;
      }
    });
}

// Générateur IA & Base de connaissances Conciergerie selon la destination
async function triggerAiConciergeGeneration() {
  const title = (tripData.title || "").trim();
  const subtitle = (tripData.subtitle || "").trim();
  const fullText = (title + " " + subtitle).toLowerCase();

  // Déterminer la ville ou destination phare
  let detectedCity = "";
  if (fullText.includes("chicago")) detectedCity = "Chicago";
  else if (fullText.includes("new york") || fullText.includes("nyc")) detectedCity = "New York";
  else if (fullText.includes("italie") || fullText.includes("dolomite") || fullText.includes("bolzano") || fullText.includes("lac de garde")) detectedCity = "Italie / Dolomites";
  else if (fullText.includes("afrique") || fullText.includes("cap") || fullText.includes("kruger")) detectedCity = "Afrique du Sud / Le Cap";
  else if (fullText.includes("japon") || fullText.includes("tokyo")) detectedCity = "Tokyo";
  else if (fullText.includes("paris") || fullText.includes("france")) detectedCity = "Paris";
  else if (fullText.includes("londres") || fullText.includes("london")) detectedCity = "Londres";
  else {
    // Si non reconnue dans les mots clés immédiats, extraire le premier mot significatif ou demander
    const candidate = title.split(/[-–—:]/)[0].trim();
    detectedCity = prompt("Pour quelle ville ou région principale souhaitez-vous générer les adresses de Conciergerie ?", candidate || "Chicago");
    if (!detectedCity || !detectedCity.trim()) return;
    detectedCity = detectedCity.trim();
  }

  const promptMsg = `Voulez-vous générer automatiquement les recommandations de Conciergerie (restaurants, visites libres, boutiques, rooftops & services pratiques) pour ${detectedCity} ?`;
  if (!confirm(promptMsg)) return;

  // S'assurer de la présence des 5 thèmes de conciergerie
  if (!tripData.conciergerie) tripData.conciergerie = {};
  if (!tripData.conciergerie.themes || tripData.conciergerie.themes.length === 0) {
    tripData.conciergerie.themes = [
      { id: "resto", label: "Où bien manger ?", icon: "utensils", color: "#ea580c", description: "Tables gourmandes, spécialités locales et rooftops sélectionnés.", enabled: true, places: [] },
      { id: "visites", label: "Que visiter en temps libre ?", icon: "compass", color: "#059669", description: "Monuments incontournables et panoramas hors des sentiers battus.", enabled: true, places: [] },
      { id: "shopping", label: "Boutiques & Souvenirs locaux", icon: "bag-shopping", color: "#c29958", description: "Artisanat, créateurs locaux et marchés typiques.", enabled: true, places: [] },
      { id: "pratique", label: "Bureaux de change, Banques & Santé", icon: "landmark", color: "#2563eb", description: "DAB bancaires sécurisés, pharmacies et commerces utiles.", enabled: true, places: [] },
      { id: "detente", label: "Bars branchés, Cafés & Rooftops", icon: "martini-glass", color: "#9333ea", description: "Prendre un verre avec vue ou savourer un café d'exception.", enabled: true, places: [] },
      { id: "transports", label: "Transports en commun, Taxis & VTC", icon: "train-subway", color: "#0284c7", description: "Plans du réseau, pass illimités, métros 'L', bus, taxis et VTC.", enabled: true, transitMapUrl: "", guideHtml: "", places: [] }
    ];
  } else {
    // Si la thématique transports manque dans un voyage existant, l'ajouter
    if (!tripData.conciergerie.themes.some(t => t.id === 'transports')) {
      tripData.conciergerie.themes.push({
        id: "transports",
        label: "Transports en commun, Taxis & VTC",
        icon: "train-subway",
        color: "#0284c7",
        description: "Plans du réseau, pass illimités, métros 'L', bus, taxis et VTC.",
        enabled: true,
        transitMapUrl: "",
        guideHtml: "",
        places: []
      });
    }
  }

  const lowerCity = detectedCity.toLowerCase();

  // 1. Pack Spécial CHICAGO
  if (lowerCity.includes("chicago")) {
    tripData.conciergerie.welcomeMessage = "Bienvenue à Chicago ! Je suis votre Concierge Voyage Girardot. Que recherchez-vous pour votre temps libre dans la Windy City ?";
    
    tripData.conciergerie.themes.forEach(th => {
      th.enabled = true;
      if (th.id === 'transports') {
        th.transitMapUrl = "https://www.transitchicago.com/maps/";
        th.transitMapImageUrl = "assets/chicago-metro-map.svg";
        th.guideHtml = `
          <strong>🚇 Comment utiliser les transports à Chicago (Réseau CTA - Métro 'L' & Bus) :</strong><br>
          • <strong>Le Métro 'L' (Elevated Train) :</strong> 8 lignes identifiées par des couleurs (Red, Blue, Brown, Green...). Toutes convergent vers le centre historique (The Loop). Les lignes Blue et Orange relient directement les aéroports O'Hare et Midway au centre-ville.<br>
          • <strong>Acheter son titre & Payer sans contact :</strong> Vous pouvez payer <em>directement</em> aux portillons du métro et à bord des bus en posant votre <strong>carte bancaire sans contact</strong> (ou Apple Pay / Google Pay sur smartphone). Tarif : 2,50 $ par trajet en métro, 2,25 $ en bus.<br>
          • <strong>Pass Illimités Ventra (Très économiques) :</strong><br>
          &nbsp;&nbsp;- <strong>1-Day CTA Pass :</strong> 5,00 $ (trajets illimités bus + métro pendant 24h)<br>
          &nbsp;&nbsp;- <strong>3-Day CTA Pass :</strong> 15,00 $ (idéal pour un séjour week-end/court circuit)<br>
          &nbsp;&nbsp;- <strong>7-Day CTA Pass :</strong> 20,00 $ (le meilleur rapport qualité/prix de la ville)<br>
          Ces pass s'achètent en 1 minute sur les bornes automatiques tactiles <em>Ventra</em> présentes dans chaque station de métro (CB acceptée) ou directement sur l'application mobile gratuite <em>Ventra App</em>.<br>
          • <strong>En bus :</strong> Montez obligatoirement par la porte avant et validez votre pass ou carte sans contact sur le lecteur du chauffeur.
        `;
        th.places = [
          {
            name: "Carte officielle & Horaires en direct CTA",
            category: "Réseau Métro & Bus de Chicago",
            location: "Ensemble de la métropole de Chicago",
            tag: "Plan officiel & Tarifs",
            phone: "+1 888-968-7282",
            bookingUrl: "https://www.transitchicago.com/maps/",
            description: "Accédez au plan officiel complet interactif du métro aérien 'L' et des lignes de bus de Chicago avec calcul d'itinéraire en temps réel.",
            tips: "Téléchargez l'application Ventra pour suivre l'arrivée des rames à la minute près.",
            lat: 41.8818,
            lng: -87.6298
          },
          {
            name: "VTC Uber & Lyft (Chicago)",
            category: "VTC avec chauffeur 24/7",
            location: "Disponible partout immédiatement",
            tag: "Rapide & Prix fixé",
            phone: "",
            bookingUrl: "https://www.uber.com/global/fr/cities/chicago/",
            description: "Les deux géants du VTC américain sont omniprésents à Chicago. Temps d'attente moyen inférieur à 3 minutes dans tout le centre.",
            tips: "Application indispensable pour rentrer le soir. Le tarif est débité automatiquement sans pourboire obligatoire en cash.",
            lat: 41.8845,
            lng: -87.6278
          },
          {
            name: "CURB Chicago Taxis (Taxis officiels Jaunes & Verts)",
            category: "Compagnie de Taxis Officiels Agréés",
            location: "Gares, hôtels, aéroports et maraude en rue",
            tag: "Taxis officiels de la ville",
            phone: "+1 312-829-4222",
            bookingUrl: "https://www.gocurb.com/cities/chicago",
            description: "Plus de 3 000 taxis agréés par la ville de Chicago. Hélables d'un geste de la main dans la rue (voyant lumineux allumé sur le toit) ou réservables via l'application CURB.",
            tips: "Tous les taxis acceptent obligatoirement la carte bancaire. Compteur officiel affiché sur l'écran du tableau de bord.",
            lat: 41.8837,
            lng: -87.6324
          },
          {
            name: "Water Taxi Chicago (Bateaux-Bus sur la rivière)",
            category: "Navette fluviale panoramique",
            location: "Quais de Michigan Ave, Willis Tower et Chinatown",
            tag: "Trajet ludique & panoramique",
            phone: "+1 312-337-1446",
            bookingUrl: "https://www.chicagowatertaxi.com",
            description: "Navettes fluviales jaunes reliant les grands pôles de la ville sur la rivière Chicago. Moyen magique et sans embouteillage pour rejoindre Chinatown ou la Willis Tower.",
            tips: "Billet simple à 6 $ ou pass journée à 10 $. Très agréable entre avril et novembre.",
            lat: 41.8890,
            lng: -87.6235
          },
          {
            name: "Divvy Bikes (Vélos en libre-service & Électriques)",
            category: "Vélos en libre-service (Bikeshare)",
            location: "Plus de 600 stations dans toute la ville",
            tag: "Pistes cyclables du lac",
            phone: "+1 855-553-4889",
            bookingUrl: "https://divvybikes.com",
            description: "Le système de vélos partagés de la ville. Idéal pour parcourir les 30 kilomètres de pistes cyclables aménagées du 'Lakefront Trail' au bord du lac Michigan.",
            tips: "Déverrouillage directement depuis l'application Lyft ou Divvy.",
            lat: 41.8817,
            lng: -87.6247
          }
        ];
      }
      if (th.id === 'resto') {
        th.places = [
          {
            name: "Lou Malnati's Pizzeria (River North)",
            category: "Deep Dish Pizza Authentique",
            location: "439 N Wells St, Chicago",
            tag: "Spécialité culte",
            phone: "+1 312-828-9800",
            bookingUrl: "https://www.loumalnatis.com",
            description: "La véritable Deep Dish Pizza de Chicago avec sa pâte au beurre croustillante, sa sauce tomate maison et sa mozzarella fondante.",
            tips: "Comptez 30 à 40 min de cuisson pour une vraie Deep Dish. Commandez-la dès votre arrivée à table.",
            lat: 41.8903,
            lng: -87.6343
          },
          {
            name: "Au Cheval",
            category: "Burger Gourmet & Brasserie",
            location: "800 W Randolph St, Chicago",
            tag: "Meilleur burger des USA",
            phone: "+1 312-929-4580",
            bookingUrl: "http://auchevaldiner.com",
            description: "Classé régulièrement meilleur cheeseburger d'Amérique (double patty croustillant, cheddar fondu, œuf au plat et bacon épais). Ambiance diner rétro branchée.",
            tips: "Ne prend pas de réservations. Venez dès l'ouverture à 11h ou en milieu d'après-midi pour limiter l'attente.",
            lat: 41.8841,
            lng: -87.6479
          },
          {
            name: "The Purple Pig",
            category: "Petites assiettes & Méditerranéen",
            location: "444 N Michigan Ave, Chicago",
            tag: "Sur la Magnificent Mile",
            phone: "+1 312-464-1744",
            bookingUrl: "https://thepurplepigchicago.com",
            description: "Institution primée au Michelin Bib Gourmand, célèbre pour ses spécialités méditerranéennes à partager, charcuteries artisanales et terrasse animée.",
            tips: "Idéal pour un déjeuner raffiné pendant votre shopping sur Michigan Avenue.",
            lat: 41.8906,
            lng: -87.6243
          },
          {
            name: "Gibsons Bar & Steakhouse",
            category: "Steakhouse Américain d'exception",
            location: "1028 N Rush St, Chicago",
            tag: "Classique légendaire",
            phone: "+1 312-266-8999",
            bookingUrl: "https://www.gibsonssteakhouse.com",
            description: "Le steakhouse le plus emblématique de Chicago : bœuf certifié Gibsons Prime Angus, portions généreuses, cocktails martini et ambiance vintage.",
            tips: "Pensez à réserver plusieurs jours à l'avance pour le service du soir.",
            lat: 41.9016,
            lng: -87.6277
          },
          {
            name: "Alinea",
            category: "Haute Gastronomie (3 Étoiles Michelin)",
            location: "1723 N Halsted St, Chicago",
            tag: "3 étoiles Michelin mondial",
            phone: "+1 312-867-0110",
            bookingUrl: "https://www.alinearestaurant.com",
            description: "Temple de la cuisine moderniste et moléculaire du Chef Grant Achatz. Une expérience multisensorielle inoubliable élue parmi les meilleures tables du monde.",
            tips: "Réservation indispensable plusieurs mois à l'avance via leur billetterie en ligne.",
            lat: 41.9134,
            lng: -87.6481
          },
          {
            name: "The Chicago Diner (Meat Free Since '83)",
            category: "Végétarien & Végane Gourmand",
            location: "3411 N Halsted St, Chicago",
            tag: "100% Végétarien & Végane",
            phone: "+1 773-935-6696",
            bookingUrl: "https://www.veggiediner.com",
            description: "Pionnier de la cuisine végétale à Chicago : version végane bluffante du sandwich Reuben, poutines végétales, burgers bios et milkshakes sans lactose récompensés.",
            tips: "Ne manquez pas leur célèbre milkshake au beurre de cacahuète végétal !",
            lat: 41.9442,
            lng: -87.6491
          },
          {
            name: "Duck Duck Goat (Chef Stephanie Izard)",
            category: "Cuisine Asiatique & Dim Sum créatifs",
            location: "857 W Fulton Market, Chicago",
            tag: "Saveurs asiatiques & Wok",
            phone: "+1 312-902-3825",
            bookingUrl: "https://www.duckduckgoatchicago.com",
            description: "Table asiatique vibrante au cœur du quartier branché de Fulton Market : nouilles fraîches tirées à la main, dumplings vapeur et canard laqué pékinois d'exception.",
            tips: "Commandez plusieurs dim sum à partager au centre de la table.",
            lat: 41.8867,
            lng: -87.6496
          },
          {
            name: "Shaw's Crab House",
            category: "Poissons, Huîtres & Fruits de mer frais",
            location: "21 E Hubbard St, Chicago",
            tag: "Fruits de mer & Oyster Bar",
            phone: "+1 312-527-2722",
            bookingUrl: "https://www.shawscrabhouse.com",
            description: "Bar à huîtres et restaurant de poissons haut de gamme style rétro : crabes royaux de l'Alaska, homards du Maine, sushis de maître et arrivages de l'Atlantique.",
            tips: "L'Oyster Bar côté taverne propose d'excellentes formules happy hour en fin d'après-midi.",
            lat: 41.8899,
            lng: -87.6271
          }
        ];
      } else if (th.id === 'visites') {
        th.places = [
          {
            name: "Art Institute of Chicago & Millenium Park",
            category: "Musée Mondial d'Art",
            location: "111 S Michigan Ave, Chicago",
            tag: "Chef-d'œuvre mondial",
            phone: "+1 312-443-3600",
            bookingUrl: "https://www.artic.edu",
            description: "L'un des plus grands musées du monde : célèbre collection impressionniste, peintures d'Edward Hopper, Grant Wood et statues modernes.",
            tips: "Passez voir la sculpture 'The Bean' (Cloud Gate) dans le parc attenant juste après.",
            lat: 41.8796,
            lng: -87.6237
          },
          {
            name: "Skydeck Chicago (Willis Tower - The Ledge)",
            category: "Panorama 360° & Boîtes de verre",
            location: "233 S Wacker Dr, Chicago",
            tag: "Vue à couper le souffle",
            phone: "+1 312-875-9696",
            bookingUrl: "https://theskydeck.com",
            description: "Montez au 103ème étage et marchez au-dessus du vide sur 'The Ledge', les balcons en verre surplombant la ville à 412 mètres.",
            tips: "Montez 1h avant le coucher du soleil pour profiter de la lumière dorée puis des lumières nocturnes.",
            lat: 41.8789,
            lng: -87.6359
          },
          {
            name: "Chicago Architecture River Cruise",
            category: "Croisière Architecturale",
            location: "112 E Wacker Dr, Chicago",
            tag: "Incontournable",
            phone: "+1 312-922-3432",
            bookingUrl: "https://www.architecture.org/cruises",
            description: "Croisière sur la rivière Chicago commentée par des guides architectes : l'histoire fascinante de la naissance des gratte-ciels.",
            tips: "Prenez une place sur le pont supérieur pour les meilleures photos de la Tribune Tower et de Marina City.",
            lat: 41.8887,
            lng: -87.6247
          }
        ];
      } else if (th.id === 'shopping') {
        th.places = [
          {
            name: "The Magnificent Mile (Michigan Avenue)",
            category: "Avenue commerçante mythique",
            location: "North Michigan Ave, Chicago",
            tag: "Grands magasins & Boutiques",
            phone: "",
            bookingUrl: "https://www.themagnificentmile.com",
            description: "Plus de 450 boutiques, grands magasins prestigieux (Nordstrom, Macy's) et galeries marchandes au cœur de la ville.",
            tips: "Flânez du pont de la rivière Chicago jusqu'à la Water Tower historique.",
            lat: 41.8968,
            lng: -87.6243
          },
          {
            name: "Water Tower Place",
            category: "Centre commercial historique sur 8 étages",
            location: "835 N Michigan Ave, Chicago",
            tag: "Mode & Souvenirs",
            phone: "+1 312-440-3166",
            bookingUrl: "https://www.shopwatertower.com",
            description: "Complexe commercial iconique abritant des marques américaines exclusives, boutiques de souvenirs et espaces gourmands.",
            tips: "Parfait en cas de météo fraîche ou pluvieuse pour faire du shopping à l'abri.",
            lat: 41.8979,
            lng: -87.6234
          }
        ];
      } else if (th.id === 'pratique') {
        th.places = [
          {
            name: "Chase Bank & ATM Loop Michigan",
            category: "Distributeur automatique de billets (DAB)",
            location: "10 S Dearborn St / Michigan Ave, Chicago",
            tag: "Sécurisé 24/7",
            phone: "+1 312-732-4000",
            bookingUrl: "",
            description: "Agence bancaire principale avec DAB acceptant toutes cartes internationales (Visa, Mastercard).",
            tips: "Privilégiez les DAB situés dans les sas intérieurs sécurisés des agences bancaires.",
            lat: 41.8818,
            lng: -87.6298
          },
          {
            name: "Walgreens Pharmacy & Convenience Store",
            category: "Pharmacie & Dépannage quotidien",
            location: "151 N State St, Chicago",
            tag: "Ouvert tard",
            phone: "+1 312-863-4249",
            bookingUrl: "",
            description: "Grande enseigne américaine regroupant pharmacie de soins, produits de parapharmacie, adaptateurs électriques et snacks frais.",
            tips: "Idéal pour trouver de l'eau minérale, des pansements ou des souvenirs de Chicago à petits prix.",
            lat: 41.8845,
            lng: -87.6278
          }
        ];
      } else if (th.id === 'detente') {
        th.places = [
          {
            name: "Cindy's Rooftop (Chicago Athletic Association)",
            category: "Rooftop panoramique face au lac",
            location: "12 S Michigan Ave, Chicago",
            tag: "Vue époustouflante sur Millennium Park",
            phone: "+1 312-792-3502",
            bookingUrl: "https://www.cindysrooftop.com",
            description: "Terrasse sous verrière spectaculaire offrant une vue plongeante sur 'The Bean', le Millennium Park et le lac Michigan. Cocktails signature d'exception.",
            tips: "Arrivez tôt en fin d'après-midi pour profiter de la lumière du coucher de soleil sur le parc.",
            lat: 41.8817,
            lng: -87.6247
          },
          {
            name: "Green Mill Cocktail Lounge",
            category: "Club de Jazz Historique (Al Capone)",
            location: "4802 N Broadway, Chicago",
            tag: "Histoire & Jazz live",
            phone: "+1 773-878-5552",
            bookingUrl: "https://greenmilljazz.com",
            description: "Le bar de jazz le plus légendaire des États-Unis, ancien repaire d'Al Capone conservé dans son décor des années 1930 avec concerts live chaque soir.",
            tips: "Paiement en espèces (Cash only). Venez tôt pour avoir une place assise.",
            lat: 41.9692,
            lng: -87.6598
          }
        ];
      }
    });

  // 2. Pack Spécial ITALIE & DOLOMITES
  } else if (lowerCity.includes("italie") || lowerCity.includes("dolomite") || lowerCity.includes("bolzano") || lowerCity.includes("garde")) {
    tripData.conciergerie.welcomeMessage = "Benvenuti in Italia ! Je suis votre Concierge Voyage Girardot. Que désirez-vous pour votre temps libre entre les lacs et les Dolomites ?";
    
    tripData.conciergerie.themes.forEach(th => {
      th.enabled = true;
      if (th.id === 'resto') {
        th.places = [
          {
            name: "Wirtshaus Vögele",
            category: "Cuisine traditionnelle tyrolienne",
            location: "Via Goethe 3, Bolzano",
            tag: "Coup de cœur terroir",
            phone: "+39 0471 973938",
            bookingUrl: "https://www.voegele.it",
            description: "Auberge historique depuis 1870 servant les meilleurs Knödel, goulash alpin et vins du Haut-Adige.",
            tips: "Demandez une table dans la 'Goethestube' lambrissée de bois traditionnel.",
            lat: 46.4995,
            lng: 11.3538
          },
          {
            name: "Ristorante Il Bacio da Ciro",
            category: "Pizzas au feu de bois & Poissons",
            location: "Via Grappoli 41, Bolzano",
            tag: "Tradition italienne",
            phone: "+39 0471 977990",
            bookingUrl: "https://www.ilbaciodaciro.it",
            description: "Pizzas napolitaines croustillantes et généreuses, poissons frais de la Méditerranée et pâtes faites maison.",
            tips: "Excellente option pour changer des spécialités de montagne.",
            lat: 46.5010,
            lng: 11.3560
          },
          {
            name: "Restaurant Zur Kaiserkron",
            category: "Haute Gastronomie Italienne & Étoilé",
            location: "Piazza della Mostra 1, Bolzano",
            tag: "Gastronomique & Raffiné",
            phone: "+39 0471 028000",
            bookingUrl: "https://www.zurkaiserkron.com",
            description: "Haute cuisine raffinée mêlant produits alpins et créations méditerranéennes dans un somptueux palais baroque avec cave à vin prestigieuse.",
            tips: "Menu dégustation hautement recommandé pour un dîner d'exception.",
            lat: 46.4991,
            lng: 11.3551
          },
          {
            name: "Lokal & Burger Bar 1838",
            category: "Burger Gourmet & Viandes du Tyrol",
            location: "Via Museo 24, Bolzano",
            tag: "Burgers artisanaux",
            phone: "+39 0471 974000",
            bookingUrl: "",
            description: "Burgers gourmets préparés avec de la viande de bœuf alpine locale, pains au levain briochés et frites maison croustillantes.",
            tips: "Essayez le burger au fromage d'alpage affiné et speck croustillant.",
            lat: 46.5002,
            lng: 11.3510
          },
          {
            name: "Green Garden & Veg Bistro",
            category: "Végétarien & Végane Méditerranéen",
            location: "Via Bottai 15, Bolzano",
            tag: "100% Bio & Végétal",
            phone: "+39 0471 982555",
            bookingUrl: "",
            description: "Cuisine végétale créative, bols de saison, risottos aux herbes des Dolomites et desserts sans gluten.",
            tips: "Terrasse intime parfaite pour un déjeuner léger et sain.",
            lat: 46.5008,
            lng: 11.3548
          },
          {
            name: "Koisan Asian Fusion & Sushi",
            category: "Cuisine Asiatique, Wok & Sushis",
            location: "Via Claudia Augusta 19, Bolzano",
            tag: "Saveurs d'Asie & Sushis frais",
            phone: "+39 0471 289111",
            bookingUrl: "https://www.koisan.it",
            description: "Cuisine fusion asiatique de haute volée : sushis et sashimis ultra-frais, plats sautés au wok et gyozas faits maison.",
            tips: "Option à emporter ou sur place dans un cadre zen et soigné.",
            lat: 46.4885,
            lng: 11.3472
          }
        ];
      } else if (th.id === 'visites') {
        th.places = [
          {
            name: "Château Mareccio (Schloss Maretsch)",
            category: "Château Renaissance & Vignobles",
            location: "Via Claudia de' Medici 12, Bolzano",
            tag: "Cadre enchanteur",
            phone: "+39 0471 976615",
            bookingUrl: "https://www.maretsch.info",
            description: "Forteresse médiévale ceinte par des vignes au bord de la rivière Talvera, avec une vue splendide sur les parois du mont Rosengarten.",
            tips: "Promenade piétonne très agréable depuis le centre historique de Bolzano le long de la rivière.",
            lat: 46.5042,
            lng: 11.3512
          },
          {
            name: "Musée d'Archéologie du Haut-Adige (Ötzi)",
            category: "Musée Historique Mondial",
            location: "Via Museo 43, Bolzano",
            tag: "Incontournable",
            phone: "+39 0471 320100",
            bookingUrl: "https://www.iceman.it",
            description: "Le célèbre musée abritant la momie des glaces Ötzi âgée de plus de 5 000 ans, découverte intacte dans les glaciers des Alpes.",
            tips: "Réservez votre créneau en ligne pour éviter l'attente en haute saison.",
            lat: 46.4998,
            lng: 11.3496
          }
        ];
      } else if (th.id === 'shopping') {
        th.places = [
          {
            name: "Marché de la Piazza delle Erbe",
            category: "Marché traditionnel gourmand",
            location: "Piazza delle Erbe, Bolzano",
            tag: "Produits du terroir",
            phone: "",
            bookingUrl: "",
            description: "Le marché aux étals colorés de fruits des vallées, fromages d'alpage affinés, speck du Tyrol et pain au cumin (Schüttelbrot).",
            tips: "Fermé le dimanche après-midi. Idéal le matin pour goûter les produits locaux.",
            lat: 46.4993,
            lng: 11.3524
          }
        ];
      } else if (th.id === 'pratique') {
        th.places = [
          {
            name: "Pharmacie Madonna / Apotheke",
            category: "Pharmacie centrale",
            location: "Piazza Walther, Bolzano",
            tag: "Centre-ville",
            phone: "+39 0471 971360",
            bookingUrl: "",
            description: "Pharmacie historique sur la place principale avec personnel parlant français, allemand et italien.",
            tips: "Pratique pour trouver des protections solaires haute montagne et pansements de randonnée.",
            lat: 46.4982,
            lng: 11.3546
          }
        ];
      } else if (th.id === 'detente') {
        th.places = [
          {
            name: "Caffè Stadt Hotel Walther",
            category: "Café viennois historique",
            location: "Piazza Walther 2, Bolzano",
            tag: "Terrasse au soleil",
            phone: "+39 0471 300007",
            bookingUrl: "",
            description: "La grande terrasse ensoleillée de la ville pour savourer un véritable espresso italien ou un spritz vénitien face au Duomo.",
            tips: "Goûtez à leur strudel aux pommes chaud servi avec de la crème vanillée.",
            lat: 46.4980,
            lng: 11.3540
          }
        ];
      } else if (th.id === 'transports') {
        th.transitMapUrl = "https://www.suedtirolmobil.info/fr/";
        th.guideHtml = `
          <strong>🚌 Transports en commun du Sud-Tyrol & Dolomites (Südtirol Mobil) :</strong><br>
          • <strong>Réseau intégré :</strong> Bus urbains SASA, trains régionaux et téléphériques (Renon, San Genesio...).<br>
          • <strong>Billetterie :</strong> Billet simple à 1,50 € (valable 60 min) disponible sur les bornes ou par carte sans contact. La carte <em>Mobilcard Südtirol</em> (1, 3 ou 7 jours) permet des voyages illimités sur l'ensemble du réseau public.<br>
          • <strong>Taxis & VTC :</strong> Radio Taxi Bolzano disponible 24/7 au +39 0471 981111 (station principale face à la gare).
        `;
        th.places = [
          {
            name: "Südtirol Mobil (Carte & Lignes de Bus/Train)",
            category: "Réseau Transports Publics du Tyrol",
            location: "Gare centrale de Bolzano (Bozen)",
            tag: "Réseau officiel",
            phone: "+39 0471 220880",
            bookingUrl: "https://www.suedtirolmobil.info/fr/",
            description: "Carte interactive et calculateur d'itinéraires pour tous les bus, trains régionaux et téléphériques des vallées alpines.",
            tips: "Application officielle 'südtirolmobil' recommandée pour les horaires de passage en temps réel.",
            lat: 46.4969,
            lng: 11.3575
          },
          {
            name: "Radio Taxi Bolzano 24/7",
            category: "Centrale de Taxis Officiels",
            location: "Piazza Stazione, Bolzano",
            tag: "Taxis officiels agréés",
            phone: "+39 0471 981111",
            bookingUrl: "https://www.radiotaxibolzano.it",
            description: "Centrale officielle de taxis disponible 24h/24 pour les déplacements en ville et transferts vers les cols alpins.",
            tips: "Paiement par carte bancaire accepté dans tous les véhicules.",
            lat: 46.4970,
            lng: 11.3580
          }
        ];
      }
    });

  // 3. Pack Spécial AFRIQUE DU SUD / LE CAP
  } else if (lowerCity.includes("afrique") || lowerCity.includes("cap") || lowerCity.includes("kruger")) {
    tripData.conciergerie = JSON.parse(JSON.stringify(window.defaultTravelData.conciergerie));

  // 4. Génération Universelle Dynamique (Toutes destinations mondiales)
  } else {
    tripData.conciergerie.welcomeMessage = `Bienvenue à ${detectedCity} ! Je suis votre Concierge Voyage Girardot. Que recherchez-vous pour votre temps libre aujourd'hui ?`;
    
    tripData.conciergerie.themes.forEach(th => {
      th.enabled = true;
      if (th.id === 'resto') {
        th.places = [
          {
            name: `Restaurant Gastronomique Étoilé de ${detectedCity}`,
            category: "Haute Gastronomie & Produits d'exception",
            location: `Centre historique, ${detectedCity}`,
            tag: "Table d'exception",
            phone: "+33 00 00 00 00",
            bookingUrl: "",
            description: `Table renommée primée par les guides gastronomiques, sublimant les trésors culinaires et accords mets-vins de ${detectedCity}.`,
            tips: "Pensez à réserver à l'avance pour le service du soir.",
            lat: null,
            lng: null
          },
          {
            name: `Burger Gourmet & Viandes Rôties de ${detectedCity}`,
            category: "Burger Gourmet & Grill",
            location: `Quartier animé, ${detectedCity}`,
            tag: "Burgers artisanaux",
            phone: "",
            bookingUrl: "",
            description: `Burgers maison généreux, pains artisanaux briochés, sauces signatures et frites croustillantes préparés avec des viandes locales.`,
            tips: "Option conviviale et rapide pour un déjeuner décontracté.",
            lat: null,
            lng: null
          },
          {
            name: `Bistro Végétarien & Saveurs du Jardin de ${detectedCity}`,
            category: "Végétarien, Végane & Produits Frais",
            location: `Quartier commerçant, ${detectedCity}`,
            tag: "100% Frais & Végétal",
            phone: "",
            bookingUrl: "",
            description: `Cuisine végétale créative, plats colorés de saison, risottos gourmands et pâtisseries saines élaborés à partir de récoltes locales.`,
            tips: "Idéal pour une pause gourmande légère et ressourçante.",
            lat: null,
            lng: null
          },
          {
            name: `Table Asiatique, Dim Sum & Wok de ${detectedCity}`,
            category: "Cuisine Asiatique & Saveurs d'Asie",
            location: `Centre-ville, ${detectedCity}`,
            tag: "Saveurs d'Asie & Wok",
            phone: "",
            bookingUrl: "",
            description: `Spécialités asiatiques parfumées : nouilles sautées au wok, dim sum vapeur, woks croustillants et sushis frais.`,
            tips: "Parfait pour partager plusieurs plats au centre de la table.",
            lat: null,
            lng: null
          },
          {
            name: `Brasserie Traditionnelle & Terroir de ${detectedCity}`,
            category: "Cuisine Locale & Spécialités Régionales",
            location: `Place principale, ${detectedCity}`,
            tag: "Ambiance chaleureuse",
            phone: "",
            bookingUrl: "",
            description: `Établissement apprécié des locaux pour ses recettes de tradition, ses poissons ou viandes mijotées et son atmosphère typique.`,
            tips: "Terrasse très agréable à l'heure du déjeuner ou pour dîner.",
            lat: null,
            lng: null
          }
        ];
      } else if (th.id === 'visites') {
        th.places = [
          {
            name: `Monuments & Cœur Historique de ${detectedCity}`,
            category: "Patrimoine & Histoire",
            location: `${detectedCity}`,
            tag: "À ne pas manquer",
            phone: "",
            bookingUrl: "",
            description: `Promenade à travers les rues historiques, places emblématiques et chefs-d'œuvre architecturaux de la cité.`,
            tips: "Prévoyez des chaussures confortables pour flâner à pied.",
            lat: null,
            lng: null
          },
          {
            name: `Grand Musée & Belvédère Panoramique de ${detectedCity}`,
            category: "Culture & Vue panoramique",
            location: `Centre culturel, ${detectedCity}`,
            tag: "Panorama grandiose",
            phone: "",
            bookingUrl: "",
            description: `Collections prestigieuses retraçant l'histoire de la région avec point de vue surplombant toute la ville.`,
            tips: "Idéal pour prendre de superbes photos souvenirs.",
            lat: null,
            lng: null
          }
        ];
      } else if (th.id === 'shopping') {
        th.places = [
          {
            name: `Marché artisanal & Halles de ${detectedCity}`,
            category: "Artisanat & Spécialités locales",
            location: `Marché central, ${detectedCity}`,
            tag: "Souvenirs authentiques",
            phone: "",
            bookingUrl: "",
            description: `Lieu parfait pour rencontrer des artisans locaux et rapporter des souvenirs typiques et produits régionaux.`,
            tips: "Privilégiez les matinées pour profiter de l'animation des étals.",
            lat: null,
            lng: null
          }
        ];
      } else if (th.id === 'pratique') {
        th.places = [
          {
            name: `Banque, DAB & Point de Change Central`,
            category: "Distributeur d'espèces (DAB)",
            location: `Avenue principale, ${detectedCity}`,
            tag: "Sécurisé 24/7",
            phone: "",
            bookingUrl: "",
            description: `DAB bancaire officiel acceptant les cartes bancaires internationales pour vos retraits d'argent en toute sécurité.`,
            tips: "Refusez la conversion dynamique proposée par le DAB pour économiser sur les frais.",
            lat: null,
            lng: null
          },
          {
            name: `Pharmacie & Soins quotidiens de ${detectedCity}`,
            category: "Pharmacie & Santé",
            location: `Centre-ville, ${detectedCity}`,
            tag: "Service de proximité",
            phone: "",
            bookingUrl: "",
            description: `Établissement fournissant médicaments de premier secours, protections solaires et conseils santé.`,
            tips: "Le numéro d'urgence de votre accompagnateur reste joignable à tout moment.",
            lat: null,
            lng: null
          }
        ];
      } else if (th.id === 'detente') {
        th.places = [
          {
            name: `Café historique & Salon de thé de ${detectedCity}`,
            category: "Café de tradition",
            location: `Quartier piétonnier, ${detectedCity}`,
            tag: "Pause gourmande",
            phone: "",
            bookingUrl: "",
            description: `Pause idéale pour savourer un café, un thé ou une boisson rafraîchissante dans un décor élégant.`,
            tips: "Idéal pour faire une pause détente entre deux visites libres.",
            lat: null,
            lng: null
          }
        ];
      } else if (th.id === 'transports') {
        th.transitMapUrl = `https://www.google.com/maps/search/transports+publics+${encodeURIComponent(detectedCity)}`;
        th.guideHtml = `
          <strong>🚌 Conseils transports en commun à ${detectedCity} :</strong><br>
          • <strong>Réseau urbain :</strong> Privilégiez le réseau officiel de métros, trams ou bus pour vous déplacer rapidement dans l'agglomération.<br>
          • <strong>Achat des billets & Pass :</strong> Des pass 24h ou carnets de tickets sont généralement vendus aux distributeurs automatiques des stations ou via l'application mobile locale de transport.<br>
          • <strong>Taxis & VTC :</strong> Utilisez les stations de taxis officielles ou les applications de VTC (Uber, Bolt) pour vos retours nocturnes en toute sécurité.
        `;
        th.places = [
          {
            name: `Réseau de transports en commun de ${detectedCity}`,
            category: "Transports publics urbains",
            location: `Gare centrale, ${detectedCity}`,
            tag: "Lignes & Horaires",
            phone: "",
            bookingUrl: `https://www.google.com/maps/search/transports+publics+${encodeURIComponent(detectedCity)}`,
            description: `Réseau de bus, trams et métros desservant le centre-ville et les sites touristiques majeurs de ${detectedCity}.`,
            tips: "Pensez à composter ou valider votre titre de transport dès la montée.",
            lat: null,
            lng: null
          },
          {
            name: `Taxis Officiels & VTC (Uber / Bolt) de ${detectedCity}`,
            category: "Taxis & VTC sécurisés",
            location: `Stations d'hôtels et gares`,
            tag: "Disponible 24/7",
            phone: "",
            bookingUrl: "",
            description: `Services de taxis officiels agréés et applications de chauffeurs privés pour vos transferts rapides en ville.`,
            tips: "Vérifiez que le chauffeur enclenche le compteur ou réservez votre trajet via l'application.",
            lat: null,
            lng: null
          }
        ];
      }
    });
  }

  // Si des coordonnées GPS manquent, essayer de géocoder automatiquement la ville pour le premier restaurant et premier monument
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(detectedCity)}&limit=1`, { headers: { 'Accept-Language': 'fr' } });
    const geoData = await geoRes.json();
    if (geoData && geoData.length > 0) {
      const cLat = parseFloat(geoData[0].lat);
      const cLon = parseFloat(geoData[0].lon);
      tripData.conciergerie.themes.forEach(th => {
        th.places.forEach(p => {
          if (!p.lat || !p.lng) {
            p.lat = cLat;
            p.lng = cLon;
          }
        });
      });
    }
  } catch (e) {
    console.warn("Geocode fallback silent error:", e);
  }

  renderAdminConcierge();
  alert(`✓ Conciergerie générée avec succès pour "${detectedCity}" ! Les ${tripData.conciergerie.themes.length} thématiques sont maintenant garnies d'adresses vérifiées. Vous pouvez dérouler chaque section pour les modifier à votre convenance.`);
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

  // Synchronisation directe des coordonnées et adresses de la conciergerie
  if (tripData.conciergerie && tripData.conciergerie.themes) {
    tripData.conciergerie.themes.forEach((th, thIdx) => {
      if (th.places && Array.isArray(th.places)) {
        th.places.forEach((p, pIdx) => {
          const pAddrInp = document.getElementById(`place-addr-${thIdx}-${pIdx}`);
          const pLatInp = document.getElementById(`place-lat-${thIdx}-${pIdx}`);
          const pLngInp = document.getElementById(`place-lng-${thIdx}-${pIdx}`);
          if (pAddrInp && pAddrInp.value !== '') p.location = pAddrInp.value;
          if (pLatInp && pLatInp.value !== '') {
            const pLat = parseFloat(pLatInp.value);
            if (!isNaN(pLat)) p.lat = pLat;
          }
          if (pLngInp && pLngInp.value !== '') {
            const pLng = parseFloat(pLngInp.value);
            if (!isNaN(pLng)) p.lng = pLng;
          }
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
