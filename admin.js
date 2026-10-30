// Admin State
let tripData = null;
let currentTripId = null;
let savedTripsIndex = [];

// Helper: génère un slug propre à partir du nom du carnet (ex: "Norvège - Fjords 2026" -> "norvege-fjords-2026")
function slugifyTitle(text) {
  if (!text || !text.trim()) return 'nouveau-carnet';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nouveau-carnet';
}

// Squelette vierge pour démarrer un nouveau carnet sans pollution d'un autre circuit
function createBlankTripTemplate(title = '') {
  const cleanTitle = title.trim();
  const id = cleanTitle ? slugifyTitle(cleanTitle) : '';
  const baseConciergerie = (window.defaultTravelData && window.defaultTravelData.conciergerie)
    ? JSON.parse(JSON.stringify(window.defaultTravelData.conciergerie))
    : { welcomeMessage: "Posez votre question ou explorez nos sélections :", themes: [] };

  if (baseConciergerie.themes) {
    baseConciergerie.themes.forEach(t => { t.places = []; t.enabled = true; });
  }

  return {
    id: id,
    title: cleanTitle,
    subtitle: "",
    dates: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    coverImage: "",
    intro: "",
    alert: { title: "", text: "", link: "" },
    flights: { outbound: null, inbound: null, domesticFlights: [] },
    flightsList: [],
    itinerary: [
      {
        day: 1,
        city: "",
        title: "Jour 1",
        highlight: "",
        dateStr: "Jour 1",
        weather: "",
        description: "",
        lat: null,
        lng: null,
        timeline: []
      }
    ],
    hotels: [],
    documents: [],
    freeTimeSuggestions: [],
    conciergerie: baseConciergerie,
    driverDossier: {
      busModel: "",
      busCapacity: 50,
      busPlanUrl: "",
      busNotes: "",
      roomingList: [],
      roomingFileUrl: "",
      passengersList: []
    },
    contactsList: [
      {
        category: "Agence Voyages Girardot",
        name: "Siège Chalon-sur-Saône",
        phone: "03 85 42 82 82",
        address: "",
        isEmergency: false
      }
    ],
    practicalTipsList: []
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initMultiTripSystem();
  populateForm();
  updateShareLink();
  updateGitHubStatusIndicator();
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
  // Par défaut à l'ouverture : page vierge prête pour un nouveau carnet
  currentTripId = '__blank__';
  tripData = createBlankTripTemplate('');
  renderTripSelectorOptions();
}

function renderTripSelectorOptions() {
  const select = document.getElementById('adm-trip-selector');
  if (!select) return;
  select.innerHTML = '';

  const blankOpt = document.createElement('option');
  blankOpt.value = '__blank__';
  blankOpt.textContent = '✨ Nouveau carnet vierge (Non enregistré)';
  if (currentTripId === '__blank__' || !currentTripId) blankOpt.selected = true;
  select.appendChild(blankOpt);

  const catalog = getSavedTripsCatalog();
  catalog.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.title}${item.subtitle ? ' — ' + item.subtitle : ''}`;
    if (item.id === currentTripId) opt.selected = true;
    select.appendChild(opt);
  });
}

function normalizeAdminTripDocuments(trip) {
  if (!trip) return;
  const isSouthAfrica = (trip.id === 'afrique-du-sud-2026') || 
    ((trip.title || '') + ' ' + (trip.destination || '')).toLowerCase().includes('afrique du sud');
  
  if (!isSouthAfrica) {
    const defaultSaDocIds = ['doc-flight-out', 'doc-voucher-safari', 'doc-ticket-tablemt'];
    if (Array.isArray(trip.documents)) {
      trip.documents = trip.documents.filter(d => !defaultSaDocIds.includes(d.id));
    }
    // Nettoyer les visites et nextEvent qui feraient référence à des codes QR ou documents d'Afrique du Sud résiduels
    const saQrCodes = ['VOUCHER-SOWETO-01', 'VOUCHER-KRUGER-BIGFIVE-GIRARDOT', 'TICKET-TABLE-MOUNTAIN-GIRARDOT-2026', 'E-TICKET-EK82-LYS-JNB-GIRARDOT', 'VOUCHER-BLYDE-CANYON-04', 'VOUCHER-NDEBELE-VILLAGE-02'];
    if (Array.isArray(trip.itinerary)) {
      trip.itinerary.forEach(day => {
        if (day.nextEvent) {
          if (defaultSaDocIds.includes(day.nextEvent.docId) || saQrCodes.includes(day.nextEvent.qrCodeText)) {
            day.nextEvent.docId = '';
            day.nextEvent.qrCodeText = '';
          }
        }
        if (Array.isArray(day.timeline)) {
          day.timeline.forEach(v => {
            if (defaultSaDocIds.includes(v.docId)) v.docId = '';
            if (saQrCodes.includes(v.qrCodeText)) v.qrCodeText = '';
          });
        }
      });
    }
  }
}

function loadTripById(tripId) {
  if (!tripId || tripId === '__blank__') {
    currentTripId = '__blank__';
    tripData = createBlankTripTemplate('');
    return;
  }

  currentTripId = tripId;
  localStorage.setItem('girardot_active_trip_id', tripId);

  // 1. Chercher dans le stockage local spécifique à cet ID
  const storedTrip = localStorage.getItem(`girardot_trip_data_${tripId}`);
  if (storedTrip) {
    try {
      tripData = JSON.parse(storedTrip);
      normalizeAdminTripDocuments(tripData);
      return;
    } catch (e) {
      console.error(e);
    }
  }

  // Si pas dans localStorage (ex: voyage volumineux avec gros PDFs), charger depuis GirardotStorage (IndexedDB)
  if (window.GirardotStorage) {
    window.GirardotStorage.get(`girardot_trip_data_${tripId}`).then(idbTrip => {
      if (idbTrip && idbTrip.title) {
        tripData = idbTrip;
        normalizeAdminTripDocuments(tripData);
        populateForm();
        updateShareLink();
      }
    }).catch(() => {});
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

  // 3. Si c'est un voyage prédéfini dans le sous-dossier voyages/ (Italie, San Francisco, Chicago, Mexique...)
  const predefined = (window.AVAILABLE_TRIPS || []).find(t => t.id === tripId || t.alias === tripId || (t.aliases && t.aliases.includes(tripId)));
  if (predefined && predefined.file) {
    fetch(encodeURI(predefined.file))
      .then(res => res.json())
      .then(data => {
        tripData = data;
        normalizeAdminTripDocuments(tripData);
        populateForm();
        updateShareLink();
      })
      .catch(() => {
        tripData = createBlankTripTemplate(predefined.title || tripId);
        tripData.id = tripId;
        populateForm();
        updateShareLink();
      });
    return;
  }

  // Par défaut : nouveau squelette vierge
  tripData = createBlankTripTemplate(tripId);
  tripData.id = tripId;
}

function onSelectTripChange(newTripId) {
  loadTripById(newTripId);
  populateForm();
  updateShareLink();
}

function createNewTripPrompt() {
  const title = prompt("Nom du nouveau carnet (ex: Norvège - Fjords & Aurores Boréales) :");
  if (title === null) return;

  const newTrip = createBlankTripTemplate(title.trim());
  if (title.trim()) {
    currentTripId = newTrip.id;
    saveTripToCatalogAndStorage(newTrip);
  } else {
    currentTripId = '__blank__';
  }
  tripData = newTrip;
  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  document.getElementById('adm-title').focus();
}

function duplicateCurrentTrip() {
  const currentTitle = tripData.title || "Voyage";
  const newTitle = prompt(`Nom du carnet dupliqué :`, `${currentTitle} - Copie`);
  if (!newTitle || !newTitle.trim()) return;

  const id = slugifyTitle(newTitle.trim());
  const copyTrip = JSON.parse(JSON.stringify(tripData));
  copyTrip.id = id;
  copyTrip.title = newTitle.trim();

  saveTripToCatalogAndStorage(copyTrip);
  currentTripId = id;
  tripData = copyTrip;
  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  alert(`✓ Le carnet a été dupliqué sous le nom "${newTitle}" (fichier : ${id}.json).`);
}

function deleteCurrentTripPrompt() {
  if (currentTripId === '__blank__') {
    tripData = createBlankTripTemplate('');
    populateForm();
    updateShareLink();
    return;
  }

  if (confirm(`Êtes-vous sûr de vouloir supprimer le carnet "${tripData.title || currentTripId}" de ce navigateur ?`)) {
    let customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
    customList = customList.filter(c => c.id !== currentTripId);
    localStorage.setItem('girardot_trips_catalog', JSON.stringify(customList));
    localStorage.removeItem(`girardot_trip_data_${currentTripId}`);

    currentTripId = '__blank__';
    tripData = createBlankTripTemplate('');
    renderTripSelectorOptions();
    populateForm();
    updateShareLink();
    alert("✓ Carnet supprimé. Vous êtes sur une page vierge.");
  }
}

function saveTripToCatalogAndStorage(trip) {
  const cleanSlug = slugifyTitle(trip.title);
  const oldId = trip.id;
  trip.id = cleanSlug;
  currentTripId = cleanSlug;

  if (oldId && oldId !== cleanSlug && oldId !== '__blank__') {
    if (window.GirardotStorage) window.GirardotStorage.remove(`girardot_trip_data_${oldId}`);
    localStorage.removeItem(`girardot_trip_data_${oldId}`);
    let list = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
    list = list.filter(c => c.id !== oldId);
    localStorage.setItem('girardot_trips_catalog', JSON.stringify(list));
  }

  // 1. Stocker dans GirardotStorage (IndexedDB - Capacité illimitée pour plans, roomings et gros JSON)
  if (window.GirardotStorage) {
    window.GirardotStorage.set(`girardot_trip_data_${trip.id}`, trip);
    window.GirardotStorage.set('girardot_active_carnet', trip);
  }

  // 2. Mémoriser aussi dans localStorage si la taille le permet (sans blocage si quota atteint)
  try {
    const serialized = JSON.stringify(trip);
    if (serialized.length < 400000) {
      localStorage.setItem(`girardot_trip_data_${trip.id}`, serialized);
      localStorage.setItem('girardot_active_carnet', serialized);
    } else {
      localStorage.removeItem(`girardot_trip_data_${trip.id}`);
    }
    localStorage.setItem('girardot_active_trip_id', trip.id);
  } catch (quotaErr) {
    console.warn("Quota localStorage atteint, sauvegarde sécurisée dans IndexedDB:", quotaErr);
  }

  // Mettre à jour l'index
  let customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
  const existingIdx = customList.findIndex(c => c.id === trip.id);
  const entry = {
    id: trip.id,
    title: trip.title,
    subtitle: trip.subtitle || '',
    dates: trip.dates || '',
    file: `voyages/${trip.id}.json`,
    lastModified: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    customList[existingIdx] = entry;
  } else {
    customList.push(entry);
  }
  localStorage.setItem('girardot_trips_catalog', JSON.stringify(customList));
}

function downloadTripTemplateJson() {
  const template = {
    id: "nouveau-voyage-" + Date.now(),
    title: "Titre de votre destination (ex: Canada - Les Grands Espaces)",
    subtitle: "Sous-titre ou thème (ex: De Montréal aux Chutes du Niagara)",
    dates: "Ex: Du lundi 10 mai au vendredi 21 mai 2027",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    coverImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    intro: "Texte d'introduction présentant les temps forts de votre circuit, la promesse du voyage et les paysages à découvrir.",
    alert: {
      title: "Formalités indispensables (Passeport / Visas)",
      text: "Passeport biométrique valide 6 mois après la date de retour. Formulaire électronique obligatoire avant départ.",
      link: ""
    },
    flightsList: [
      {
        type: "Aller",
        airline: "Air France",
        flightNumber: "AF084",
        departureAirport: "Paris Charles de Gaulle (CDG)",
        departureTime: "10:30",
        arrivalAirport: "Montréal (YUL)",
        arrivalTime: "12:45",
        date: "Jour 1",
        via: "",
        notes: "Rendez-vous 3h avant au comptoir Terminal 2E."
      },
      {
        type: "Retour",
        airline: "Air France",
        flightNumber: "AF085",
        departureAirport: "Montréal (YUL)",
        departureTime: "19:00",
        arrivalAirport: "Paris Charles de Gaulle (CDG)",
        arrivalTime: "08:15 (+1 jour)",
        date: "Dernier jour",
        via: "",
        notes: "Enregistrement bagages soute 23 kg inclus."
      }
    ],
    itinerary: [
      {
        day: 1,
        title: "Jour 1 • Rendez-vous, envol et arrivée",
        highlight: "Départ et premier contact avec la destination",
        city: "Ville d'arrivée",
        dateStr: "Jour 1",
        description: "Accueil de vos voyageurs à l'aéroport par votre guide local francophone. Transfert vers votre hôtel et installation.",
        lat: 45.5017,
        lng: -73.5673,
        timeline: [
          {
            time: "10:30",
            title: "Envol pour votre destination",
            subtitle: "Vol direct avec prestations à bord.",
            address: "Aéroport de départ",
            lat: 49.0097,
            lng: 2.5479,
            icon: "plane-departure"
          },
          {
            time: "14:30",
            title: "Accueil & Installation à l'hôtel",
            subtitle: "Remise des clés et dîner de bienvenue.",
            address: "Hôtel d'étape",
            lat: 45.5017,
            lng: -73.5673,
            icon: "hotel"
          }
        ]
      },
      {
        day: 2,
        title: "Jour 2 • Découverte du centre historique",
        highlight: "Visite guidée et panoramas",
        city: "Centre historique",
        dateStr: "Jour 2",
        description: "Matinée consacrée à la découverte pédestre des monuments emblématiques et des quartiers historiques avec votre guide.",
        lat: 45.5088,
        lng: -73.5542,
        timeline: [
          {
            time: "09:30",
            title: "Visite guidée des monuments clés",
            subtitle: "Architecture, anecdotes et histoire locale.",
            address: "Place centrale",
            lat: 45.5088,
            lng: -73.5542,
            icon: "monument"
          },
          {
            time: "12:30",
            title: "Déjeuner traditionnel inclus",
            subtitle: "Spécialités culinaires régionales.",
            address: "Restaurant partenaire",
            lat: 45.5075,
            lng: -73.5550,
            icon: "utensils"
          },
          {
            time: "15:00",
            title: "Temps libre ou visite de musée",
            subtitle: "Flânerie et découvertes personnelles.",
            address: "Quartier piétonnier",
            lat: 45.5090,
            lng: -73.5560,
            icon: "camera"
          }
        ]
      }
    ],
    hotels: [
      {
        name: "Hôtel Partenaire Girardot",
        city: "Ville étape",
        rating: "4 étoiles",
        checkIn: "Du Jour 1 au Jour 3 (2 nuits)",
        phone: "+1 514-000-0000",
        address: "100 Rue Principale, Ville",
        lat: 45.5017,
        lng: -73.5673,
        description: "Établissement tout confort avec petit-déjeuner buffet inclus, Wi-Fi gratuit et réception 24h/24.",
        tips: "Espace bien-être accessible gratuitement aux clients Girardot.",
        photos: []
      }
    ],
    documents: [
      {
        id: "doc-billet-1",
        type: "flight",
        title: "Billet électronique Paris ➔ Destination",
        reference: "PNR: GIR982",
        beneficiary: "Tous les passagers",
        date: "Jour 1",
        qrCode: "E-TICKET-GIRARDOT-01",
        notes: "Présentation au comptoir avec pièce d'identité.",
        fileUrl: ""
      }
    ],
    freeTimeSuggestions: [
      {
        name: "Belvédère panoramique",
        category: "Panorama & Photo",
        city: "Ville d'étape",
        tag: "Incontournable",
        address: "Belvédère de la ville",
        lat: 45.5048,
        lng: -73.5872,
        description: "Superbe point de vue sur la ville et la baie. Parfait au coucher du soleil."
      }
    ],
    practicalInfo: {
      money: "Monnaie locale : Cartes bancaires acceptées partout. Prévoir un petit montant d'espèces pour les pourboires.",
      electricity: "Courant 110V/220V. Prévoir un adaptateur de prise universel.",
      clothing: "Tenue confortable et chaussures de marche pour les visites. Prévoir une veste chaude pour les soirées.",
      tips: "Pourboires indicatifs : 2 à 3 € / jour / personne pour le guide et 1 à 2 € pour le chauffeur.",
      wifi: "Wi-Fi gratuit disponible dans tous les hôtels et les autocars."
    },
    contactsList: [
      {
        category: "Assistance Girardot 24h/7j",
        name: "Permanence Urgences Girardot",
        phone: "+33 3 85 00 00 00",
        address: "Chalon-sur-Saône, France",
        isEmergency: true
      },
      {
        category: "Guide accompagnateur",
        name: "Votre Guide Girardot",
        phone: "+33 6 00 00 00 00",
        address: "Sur place avec le groupe",
        isEmergency: false
      }
    ]
  };

  const filename = "modele-programme-voyage-girardot.json";
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", filename);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function downloadReferenceSouthAfricaJson() {
  const filename = "programme-afrique-du-sud-reference.json";
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.defaultTravelData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", filename);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function exportTripJsonFile() {
  const titleInput = document.getElementById('adm-title');
  if (titleInput && titleInput.value.trim()) {
    tripData.title = titleInput.value.trim();
  }
  if (!tripData.title || !tripData.title.trim()) {
    const asked = prompt("Veuillez indiquer le nom du carnet avant d'exporter le fichier JSON :");
    if (!asked || !asked.trim()) return;
    tripData.title = asked.trim();
    if (titleInput) titleInput.value = tripData.title;
  }

  const fileSlug = slugifyTitle(tripData.title);
  tripData.id = fileSlug;
  const filename = `${fileSlug}.json`;

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
      if (!parsed.title) parsed.title = file.name.replace(/\.json$/i, '');
      parsed.id = slugifyTitle(parsed.title);

      saveTripToCatalogAndStorage(parsed);
      currentTripId = parsed.id;
      tripData = parsed;
      renderTripSelectorOptions();
      populateForm();
      updateShareLink();
      alert(`✓ Le carnet "${parsed.title}" (${parsed.id}.json) a été importé avec succès !`);
    } catch (err) {
      alert("Erreur lors de la lecture du fichier JSON. Assurez-vous que le format est valide.");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function switchAdminTab(tabName) {
  const sections = ['general', 'itinerary', 'driver', 'documents', 'hotels', 'freetime', 'concierge', 'contacts'];
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
  updateCoverPreview(tripData.coverImage || '');

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

  // 2. ter Dossier Conducteur & Accompagnateur
  ensureDriverStructure();
  renderAdminDriver();

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

  // 6. Profil Conciergerie & IA Gemini
  populateConciergeMode();
  populateGeminiDaySelector();
  if (typeof updateGeminiStatusIndicator === 'function') {
    updateGeminiStatusIndicator();
  }
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

// Recherche et récupération automatique du logo de compagnie aérienne
function getAirlineLogoUrl(airlineName = "", flightNumber = "") {
  if (!airlineName && !flightNumber) return null;

  const cleanName = (airlineName || "").trim().toLowerCase();
  const cleanFlight = (flightNumber || "").trim().toUpperCase();

  const airlineCodes = {
    // France & Europe
    'air france': 'AF',
    'airfrance': 'AF',
    'transavia': 'TO',
    'easyjet': 'U2',
    'lufthansa': 'LH',
    'swiss': 'LX',
    'austrian': 'OS',
    'british airways': 'BA',
    'klm': 'KL',
    'iberia': 'IB',
    'tap': 'TP',
    'tap air portugal': 'TP',
    'ita airways': 'AZ',
    'alitalia': 'AZ',
    'brussels airlines': 'SN',
    'volotea': 'V7',
    'vueling': 'VY',
    'ryanair': 'FR',
    'wizz': 'W6',
    'wizz air': 'W6',
    'aer lingus': 'EI',
    'sas': 'SK',
    'scandinavian airlines': 'SK',
    'finnair': 'AY',
    'icelandair': 'FI',
    'norwegian': 'DY',
    'corsair': 'SS',
    'air caraibes': 'TX',
    'air caraïbes': 'TX',
    'french bee': 'BF',
    
    // Moyen-Orient & Golfe
    'emirates': 'EK',
    'qatar airways': 'QR',
    'qatar': 'QR',
    'etihad': 'EY',
    'etihad airways': 'EY',
    'saudia': 'SV',
    'gulf air': 'GF',
    'oman air': 'WY',
    'el al': 'LY',
    'turkish airlines': 'TK',
    'turkish': 'TK',
    'pegasus': 'PC',

    // Afrique
    'flysafair': 'FA',
    'safair': 'FA',
    'cemair': '5Z',
    'south african airways': 'SA',
    'airlink': '4Z',
    'ethiopian airlines': 'ET',
    'ethiopian': 'ET',
    'royal air maroc': 'AT',
    'tunisair': 'TU',
    'air algerie': 'AH',
    'air algérie': 'AH',
    'egyptair': 'MS',
    'kenya airways': 'KQ',
    'air mauritius': 'MK',
    'air madagascar': 'MD',
    'air seychelles': 'HM',

    // Amérique du Nord
    'delta': 'DL',
    'delta air lines': 'DL',
    'american airlines': 'AA',
    'united': 'UA',
    'united airlines': 'UA',
    'air canada': 'AC',
    'air transat': 'TS',

    // Asie & Pacifique
    'singapore airlines': 'SQ',
    'cathay pacific': 'CX',
    'thai airways': 'TG',
    'vietnam airlines': 'VN',
    'japan airlines': 'JL',
    'jal': 'JL',
    'ana': 'NH',
    'all nippon airways': 'NH',
    'korean air': 'KE',
    'air china': 'CA',
    'china eastern': 'MU',
    'china southern': 'CZ',
    'qantas': 'QF',
    'air new zealand': 'NZ'
  };

  let code = null;

  // 1. Recherche par nom exact ou partiel
  for (const [key, c] of Object.entries(airlineCodes)) {
    if (cleanName.includes(key)) {
      code = c;
      break;
    }
  }

  // 2. Si non trouvé, tentative d'extraction par préfixe du n° de vol
  if (!code && cleanFlight) {
    const match = cleanFlight.match(/^([A-Z0-9]{2})\s*\d+/);
    if (match && match[1]) {
      code = match[1];
    }
  }

  if (code) {
    return {
      code: code,
      svg: `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code}.svg`,
      png: `https://images.kiwi.com/airlines/64/${code}.png`
    };
  }

  return null;
}

function updateFlightLogoPreview(idx) {
  const f = tripData.flightsList[idx];
  const previewEl = document.getElementById(`adm-flight-logo-${idx}`);
  if (!f || !previewEl) return;

  const logoInfo = getAirlineLogoUrl(f.airline, f.flightNumber);
  if (logoInfo) {
    previewEl.innerHTML = `
      <img src="${logoInfo.svg}" alt="${logoInfo.code}" onerror="this.onerror=null; this.src='${logoInfo.png}';" style="max-height:22px; max-width:60px; object-fit:contain;">
      <span style="font-size:0.7rem; font-weight:700; color:#0284c7; background:#e0f2fe; padding:2px 6px; border-radius:4px;">${logoInfo.code}</span>
    `;
    previewEl.style.display = 'inline-flex';
  } else {
    previewEl.innerHTML = `<span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-solid fa-plane"></i> Aucun logo détecté</span>`;
    previewEl.style.display = 'inline-flex';
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
    const logoInfo = getAirlineLogoUrl(f.airline, f.flightNumber);
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label style="margin:0;">Compagnie & N° de vol :</label>
            <div id="adm-flight-logo-${idx}" style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:2px 8px; min-height:26px;">
              ${logoInfo ? `
                <img src="${logoInfo.svg}" alt="${logoInfo.code}" onerror="this.onerror=null; this.src='${logoInfo.png}';" style="max-height:22px; max-width:60px; object-fit:contain;">
                <span style="font-size:0.7rem; font-weight:700; color:#0284c7; background:#e0f2fe; padding:2px 6px; border-radius:4px;">${logoInfo.code}</span>
              ` : `
                <span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-solid fa-plane"></i> Auto-détection</span>
              `}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control" placeholder="Ex: Emirates ou Air France" value="${f.airline || ''}" oninput="updateFlightField(${idx}, 'airline', this.value); updateFlightLogoPreview(${idx});" onchange="updateFlightField(${idx}, 'airline', this.value); updateFlightLogoPreview(${idx});">
            <input type="text" class="form-control" placeholder="N° ex: EK82" style="max-width:140px;" value="${f.flightNumber || ''}" oninput="updateFlightField(${idx}, 'flightNumber', this.value); updateFlightLogoPreview(${idx});" onchange="updateFlightField(${idx}, 'flightNumber', this.value); updateFlightLogoPreview(${idx});">
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

      <div class="form-group" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="margin:0; font-weight:700; color:var(--primary-dark); font-size:0.85rem;">
            <i class="fa-solid fa-camera" style="color:var(--accent-gold); margin-right:4px;"></i> Photo d'illustration de cette étape (Jour ${item.day}) :
          </label>
          <button type="button" onclick="openPhotoPickerModal('day', ${dayIndex})" class="btn-secondary" style="font-size:0.75rem; padding:3px 10px; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-weight:700;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Proposer une photo
          </button>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="day-image-${dayIndex}" class="form-control" placeholder="Chemin local ou URL de la photo..." value="${item.image || ''}" oninput="updateDayField(${dayIndex}, 'image', this.value); updateDayImagePreview(${dayIndex}, this.value);" onchange="updateDayField(${dayIndex}, 'image', this.value); updateDayImagePreview(${dayIndex}, this.value);">
          <div id="day-image-preview-${dayIndex}" style="width:64px; height:42px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
            ${item.image ? `<img src="${item.image}" alt="Aperçu" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-triangle-exclamation\\' style=\\'color:#f59e0b; font-size:0.8rem;\\'></i>';">` : `<i class="fa-solid fa-image" style="color:#94a3b8; font-size:0.9rem;"></i>`}
          </div>
          ${item.image ? `
            <button type="button" onclick="clearDayImage(${dayIndex})" class="btn-delete" style="position:static; padding:6px 8px;" title="Retirer l'image">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>
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

      <!-- LIAISON BON D'ÉCHANGE & QR CODE -->
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; background:#ffffff; border-radius:6px; padding:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <div style="flex:1; min-width:240px;">
          <label style="font-size:0.75rem; font-weight:800; color:#065f46; display:flex; align-items:center; gap:5px; margin-bottom:3px;">
            <i class="fa-solid fa-qrcode" style="color:var(--accent-gold);"></i> Relier un Bon d'échange / Billet QR Code :
          </label>
          <select class="form-control" style="font-size:0.8rem; padding:4px 8px; border-color:#86efac; background:#f0fdf4;" onchange="updateVisitDocumentLink(${dayIndex}, ${vIdx}, this.value)">
            <option value="">-- Aucun bon d'échange lié --</option>
            ${(tripData.documents || []).map(doc => `
              <option value="${doc.id}" ${(v.docId === doc.id || (doc.qrCode && v.qrCodeText === doc.qrCode)) ? 'selected' : ''}>
                ${doc.type === 'flight' ? '✈️' : (doc.type === 'voucher' ? '🏨' : '🎟️')} ${doc.title} ${doc.reference ? `(${doc.reference})` : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div style="flex:1; min-width:180px;">
          <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:3px;">Texte ou Code QR personnalisé :</label>
          <input type="text" class="form-control" style="font-size:0.78rem; padding:4px 8px;" placeholder="Ex: VOUCHER-SOWETO-01" value="${v.qrCodeText || ''}" onchange="updateVisitField(${dayIndex}, ${vIdx}, 'qrCodeText', this.value)">
        </div>

        <div style="display:flex; align-items:center; gap:6px; margin-top:16px;">
          <label style="font-size:0.75rem; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:5px; cursor:pointer;" title="Ce bon d'échange s'affichera également dans la carte prioritaire 'NEXT / À VENIR' en haut de journée">
            <input type="radio" name="day-nextevent-${dayIndex}" ${((tripData.itinerary[dayIndex].nextEvent && tripData.itinerary[dayIndex].nextEvent.visitIndex === vIdx) || (!tripData.itinerary[dayIndex].nextEvent && vIdx === 0)) ? 'checked' : ''} onchange="setDayPrimaryNextEvent(${dayIndex}, ${vIdx})">
            <span style="font-size:0.75rem; color:#0369a1;"><i class="fa-solid fa-star" style="color:var(--accent-gold);"></i> Clé du jour ("NEXT")</span>
          </label>
        </div>
      </div>
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

function updateVisitDocumentLink(dayIndex, visitIndex, docId) {
  const day = tripData.itinerary[dayIndex];
  if (!day || !day.timeline) return;
  const visit = day.timeline[visitIndex];
  if (!visit) return;

  visit.docId = docId || '';
  if (docId) {
    const doc = (tripData.documents || []).find(d => d.id === docId);
    if (doc) {
      visit.qrCodeText = doc.qrCode || doc.reference || doc.title;
    }
  } else {
    visit.qrCodeText = '';
  }

  // Si cette visite est l'événement clé 'NEXT' du jour, synchroniser également
  if (day.nextEvent && day.nextEvent.visitIndex === visitIndex) {
    day.nextEvent.docId = visit.docId;
    day.nextEvent.qrCodeText = visit.qrCodeText || (docId ? '' : `GIRARDOT-JOUR-${day.day}`);
  }

  renderAdminDays();
}

function setDayPrimaryNextEvent(dayIndex, visitIndex) {
  const day = tripData.itinerary[dayIndex];
  if (!day || !day.timeline || !day.timeline[visitIndex]) return;

  const visit = day.timeline[visitIndex];
  day.nextEvent = {
    visitIndex: visitIndex,
    title: visit.title,
    time: visit.time,
    badge: visit.subtitle || "Programme clé Girardot",
    docId: visit.docId || '',
    qrCodeText: visit.qrCodeText || (visit.docId ? '' : `GIRARDOT-JOUR-${day.day}`)
  };
  renderAdminDays();
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
// 2. ter DOSSIER CONDUCTEUR & ACCOMPAGNATEUR (PRO)
// -----------------------------------------------------------------------------
function ensureDriverStructure() {
  if (!tripData.driverDossier || typeof tripData.driverDossier !== 'object') {
    tripData.driverDossier = {
      busModel: "Mercedes Tourismo 16 RHD • 53 Places",
      busCapacity: 53,
      busPlanUrl: "",
      busNotes: "1er rang réservé aux personnes sensibles au mal des transports.",
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
  if (!Array.isArray(tripData.driverDossier.roomingList)) tripData.driverDossier.roomingList = [];
  if (!Array.isArray(tripData.driverDossier.passengersList)) tripData.driverDossier.passengersList = [];
}

function renderAdminDriver() {
  ensureDriverStructure();
  const d = tripData.driverDossier;

  // Plan de car
  const busModelInp = document.getElementById('adm-driver-bus-model');
  const busCapInp = document.getElementById('adm-driver-bus-capacity');
  const busFileInp = document.getElementById('adm-driver-bus-file');
  const busNotesInp = document.getElementById('adm-driver-bus-notes');
  const busStatus = document.getElementById('adm-driver-bus-status');

  if (busModelInp) busModelInp.value = d.busModel || '';
  if (busCapInp) busCapInp.value = d.busCapacity || '';
  if (busFileInp) busFileInp.value = (d.busPlanUrl && d.busPlanUrl.startsWith('data:')) ? '(Schéma ou plan joint enregistré)' : (d.busPlanUrl || '');
  if (busNotesInp) busNotesInp.value = d.busNotes || '';
  if (busStatus) {
    busStatus.innerHTML = d.busPlanUrl ? `<i class="fa-solid fa-check"></i> Plan de car disponible (${d.busPlanUrl.includes('pdf') ? 'Format PDF' : 'Image'}) <button type="button" onclick="updateDriverField('busPlanUrl', ''); renderAdminDriver();" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.75rem; text-decoration:underline;">Supprimer</button>` : '';
  }

  // Rooming list
  const roomingStatus = document.getElementById('adm-driver-rooming-file-status');
  if (roomingStatus) {
    roomingStatus.innerHTML = d.roomingFileUrl ? `<i class="fa-solid fa-file-pdf"></i> Document PDF Rooming List joint <button type="button" onclick="updateDriverField('roomingFileUrl', ''); renderAdminDriver();" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.75rem; text-decoration:underline; font-weight:normal;">Retirer le fichier PDF</button>` : '';
  }

  const roomingTbody = document.getElementById('adm-driver-rooming-tbody');
  if (roomingTbody) {
    roomingTbody.innerHTML = '';
    d.roomingList.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = "1px solid #f1f5f9";
      tr.innerHTML = `
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${r.roomNumber || ''}" placeholder="101" onchange="updateRoomingField(${idx}, 'roomNumber', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <select class="form-control" style="padding:4px 6px; font-size:0.78rem;" onchange="updateRoomingField(${idx}, 'type', this.value)">
            <option value="Double (Grand Lit)" ${r.type.includes('Double') ? 'selected' : ''}>Double (1 lit)</option>
            <option value="Twin (2 lits séparés)" ${r.type.includes('Twin') ? 'selected' : ''}>Twin (2 lits)</option>
            <option value="Individuelle (Single)" ${r.type.includes('Single') || r.type.includes('Individuelle') ? 'selected' : ''}>Single</option>
            <option value="Triple" ${r.type.includes('Triple') ? 'selected' : ''}>Triple</option>
            <option value="Autre" ${r.type.includes('Autre') ? 'selected' : ''}>Autre</option>
          </select>
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 8px; font-size:0.8rem; font-weight:600;" value="${r.occupants || ''}" placeholder="Ex: M. & Mme Dupont" onchange="updateRoomingField(${idx}, 'occupants', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${r.notes || ''}" placeholder="Ex: RDC, sans gluten..." onchange="updateRoomingField(${idx}, 'notes', this.value)">
        </td>
        <td style="padding:6px 8px; text-align:center;">
          <button type="button" onclick="removeRoomingEntry(${idx})" style="background:#fee2e2; color:#dc2626; border:none; border-radius:4px; padding:3px 6px; cursor:pointer;" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      roomingTbody.appendChild(tr);
    });
  }

  // Liste des passagers
  const passTbody = document.getElementById('adm-driver-passengers-tbody');
  if (passTbody) {
    passTbody.innerHTML = '';
    d.passengersList.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = "1px solid #f1f5f9";
      tr.innerHTML = `
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 8px; font-size:0.8rem; font-weight:700;" value="${p.name || ''}" placeholder="NOM Prénom" onchange="updatePassengerField(${idx}, 'name', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${p.pickup || ''}" placeholder="Ex: Gare Chalon" onchange="updatePassengerField(${idx}, 'pickup', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${p.phone || ''}" placeholder="06..." onchange="updatePassengerField(${idx}, 'phone', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem; text-align:center;" value="${p.seatNumber || ''}" placeholder="3A" onchange="updatePassengerField(${idx}, 'seatNumber', this.value)">
        </td>
        <td style="padding:6px 8px;">
          <input type="text" class="form-control" style="padding:4px 6px; font-size:0.78rem;" value="${p.notes || ''}" placeholder="Régime, PMR..." onchange="updatePassengerField(${idx}, 'notes', this.value)">
        </td>
        <td style="padding:6px 8px; text-align:center;">
          <button type="button" onclick="removePassengerEntry(${idx})" style="background:#fee2e2; color:#dc2626; border:none; border-radius:4px; padding:3px 6px; cursor:pointer;" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      passTbody.appendChild(tr);
    });
  }
}

function updateDriverField(field, val) {
  ensureDriverStructure();
  tripData.driverDossier[field] = val;
}

function handleDriverBusUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    updateDriverField('busPlanUrl', evt.target.result);
    renderAdminDriver();
  };
  reader.readAsDataURL(file);
}

function handleDriverRoomingUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    updateDriverField('roomingFileUrl', evt.target.result);
    renderAdminDriver();
  };
  reader.readAsDataURL(file);
}

// -----------------------------------------------------------------------------
// IMPORTATION DES DONNÉES DE ROOMING LIST (PDF / CSV / TXT)
// -----------------------------------------------------------------------------
function handleImportRoomingData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  const statusEl = document.getElementById('adm-driver-rooming-file-status');

  if (isPdf) {
    if (!window.pdfjsLib) {
      alert("La bibliothèque PDF.js n'est pas encore prête. Veuillez réessayer.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      // Joindre également comme document de référence consultable
      updateDriverField('roomingFileUrl', evt.target.result);

      window.pdfjsLib.getDocument({ data: new Uint8Array(evt.target.result) }).promise.then(async function(pdf) {
        let extractedText = "";
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          
          const items = textContent.items;
          if (!items || items.length === 0) continue;
          items.sort((a, b) => {
            const yA = a.transform[5];
            const yB = b.transform[5];
            if (Math.abs(yA - yB) > 5) return yB - yA;
            return a.transform[4] - b.transform[4];
          });

          let pageLines = [];
          let curY = null;
          let curLine = "";
          for (const item of items) {
            const str = item.str;
            if (!str) continue;
            if (curY === null) {
              curY = item.transform[5];
              curLine = str;
            } else if (Math.abs(item.transform[5] - curY) > 5) {
              pageLines.push(curLine.trim());
              curY = item.transform[5];
              curLine = str;
            } else {
              curLine += (curLine.endsWith(" ") || str.startsWith(" ") ? "" : " ") + str;
            }
          }
          if (curLine.trim()) pageLines.push(curLine.trim());
          extractedText += pageLines.join("\n") + "\n\n";
        }
        parseRoomingTextAndPopulate(extractedText, file.name);
      }).catch(err => {
        console.error("Erreur lecture PDF rooming:", err);
        alert("Erreur lors de la lecture du fichier PDF : " + err.message);
      });
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Fichier texte, CSV ou tableur exporté
    const reader = new FileReader();
    reader.onload = function(evt) {
      parseRoomingTextAndPopulate(evt.target.result, file.name);
    };
    reader.readAsText(file);
  }
}

function parseRoomingTextAndPopulate(rawText, sourceFileName) {
  ensureDriverStructure();
  const statusEl = document.getElementById('adm-driver-rooming-file-status');
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const newEntries = [];
  let currentRoomType = "Double (Grand Lit)";
  let inTableSection = false;

  // Lignes d'en-tête ou de pied de page hors tableau à ignorer
  const headerOrFooterIgnore = [
    "repartition des chambres", "répartition des chambres", "voyages girardot", "organisation",
    "caracteres d ameriques", "caractères d'amériques", "rashida rouabah", "info@caracteres",
    "voyage n°", "voyage no", "rooming n°", "rooming no", "cdg paris charles de gaulle",
    "laurent bidet", "total chambre", "soit un total", "chambre individuelle =", "chambre double =",
    "20 rue louis jacques", "71100 chalon", "44201 nantes", "10 rue gaetan"
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Vérifier les en-têtes de type de chambre
    if (/^chambre\s+individuelle/i.test(line)) {
      currentRoomType = "Individuelle (Single)";
      inTableSection = true;
      continue;
    }
    if (/^chambre\s+double/i.test(line)) {
      currentRoomType = "Double (Grand Lit)";
      inTableSection = true;
      continue;
    }
    if (/^chambre\s+twin/i.test(line)) {
      currentRoomType = "Twin (2 lits séparés)";
      inTableSection = true;
      continue;
    }
    if (/^chambre\s+triple/i.test(line)) {
      currentRoomType = "Triple";
      inTableSection = true;
      continue;
    }

    // Ignorer les lignes d'en-tête de colonnes du tableau
    if (lower.includes("rgpt") && (lower.includes("nom") || lower.includes("dossier") || lower.includes("prenom"))) {
      inTableSection = true;
      continue;
    }

    // Ignorer si la ligne correspond à une métadonnée ou pied de page
    if (headerOrFooterIgnore.some(h => lower.includes(h))) {
      continue;
    }

    // Si on est dans le tableau ou format délimité CSV
    if (line.includes(';') || line.includes('\t')) {
      const parts = line.split(/[;\t]/).map(p => p.trim());
      if (parts.length >= 2 && !parts[0].toLowerCase().includes('rgpt')) {
        let rOcc = parts.find(p => /^(?:MR|MRS|M\.|MME)\b/i.test(p) || /^[A-ZÀ-Ý\s-]{3,}$/.test(p)) || parts[2] || parts[0];
        let rNum = parts.find(p => /^\d{1,4}$/.test(p)) || String(101 + newEntries.length);
        newEntries.push({
          roomNumber: rNum,
          type: currentRoomType,
          occupants: rOcc,
          notes: ""
        });
        continue;
      }
    }

    // Détection d'une ligne passager du tableau officiel Girardot
    // Motif A: "004 MRS MORIN MIREILLE 28/04/1959..." ou "001 MR TRIOUX JOSE 19/12/1954..."
    const dossierMatch = line.match(/^(?:\d{3}\s+)?(?:00\d|\d{2,3})\s+(MR|MRS|MME|MLLE|M\.)\s+([A-ZÀ-Ý\s-]+?)\s+([A-ZÀ-Ýa-zà-ÿ-]+)(?:\s+\d{2}\/\d{2}\/\d{4})?(.*)/i);
    if (dossierMatch) {
      const civ = dossierMatch[1].toUpperCase();
      const nom = dossierMatch[2].trim();
      const prenom = dossierMatch[3].trim();
      const rest = dossierMatch[4] ? dossierMatch[4].trim() : "";
      
      const occupantStr = `${civ} ${nom} ${prenom}`;
      
      // Extraire un éventuel contact d'urgence ou remarque
      let noteStr = "";
      if (rest) {
        const phoneMatch = rest.match(/(?:0\d|\+33)\s*[\d\s]{8,14}/);
        if (phoneMatch) {
          noteStr = "Urgence : " + rest.replace(/\d{2}\/\d{2}\/\d{4}/, '').trim();
        }
      }

      // Si c'est une chambre double et que la dernière entrée n'a qu'un occupant, regrouper dans la même chambre
      if (currentRoomType.includes("Double") && newEntries.length > 0 && newEntries[newEntries.length - 1].type.includes("Double") && !newEntries[newEntries.length - 1].occupants.includes(" / ")) {
        const last = newEntries[newEntries.length - 1];
        last.occupants += ` / ${occupantStr}`;
        if (noteStr && !last.notes) last.notes = noteStr;
      } else {
        newEntries.push({
          roomNumber: String(101 + newEntries.length),
          type: currentRoomType,
          occupants: occupantStr,
          notes: noteStr
        });
      }
      continue;
    }

    // Motif B: Cas particulier (Accompagnateur) : "Declerque Hélène" ou "(Accompagnateur) Hélène"
    if (/declerque/i.test(line) || /accompagnateur/i.test(line) && inTableSection) {
      const occ = line.replace(/[(]accompagnateur[)]/i, '').replace(/[()]/g, '').trim() || "Declerque Hélène";
      newEntries.push({
        roomNumber: String(101 + newEntries.length),
        type: "Individuelle (Single)",
        occupants: occ.includes("Hélène") ? "Mme DECLERQUE Hélène (Accompagnatrice)" : occ,
        notes: "Chambre Accompagnateur"
      });
      continue;
    }
  }

  if (newEntries.length > 0) {
    tripData.driverDossier.roomingList = newEntries;
    renderAdminDriver();
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> <strong>${newEntries.length} chambre(s)</strong> extraite(s) exclusivement depuis les zones du tableau de <em>${sourceFileName}</em>.</span>`;
    }
  } else {
    alert("Aucune ligne de chambre n'a pu être identifiée dans les zones du tableau.");
  }
}

function normalizeRoomType(str = "") {
  const s = str.toLowerCase();
  if (s.includes('sgl') || s.includes('single') || s.includes('indiv')) return 'Individuelle (Single)';
  if (s.includes('twin') || s.includes('jumeau') || s.includes('séparé') || s.includes('separe')) return 'Twin (2 lits séparés)';
  if (s.includes('triple')) return 'Triple';
  return 'Double (Grand Lit)';
}

// -----------------------------------------------------------------------------
// IMPORTATION DE LA LISTE DES PASSAGERS (PDF / CSV / TXT)
// -----------------------------------------------------------------------------
function handleImportPassengersData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  const statusEl = document.getElementById('adm-driver-passengers-file-status');

  if (isPdf) {
    if (!window.pdfjsLib) {
      alert("La bibliothèque PDF.js n'est pas encore prête. Veuillez réessayer.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      window.pdfjsLib.getDocument({ data: new Uint8Array(evt.target.result) }).promise.then(async function(pdf) {
        let extractedText = "";
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          
          const items = textContent.items;
          if (!items || items.length === 0) continue;
          items.sort((a, b) => {
            const yA = a.transform[5];
            const yB = b.transform[5];
            if (Math.abs(yA - yB) > 5) return yB - yA;
            return a.transform[4] - b.transform[4];
          });

          let pageLines = [];
          let curY = null;
          let curLine = "";
          for (const item of items) {
            const str = item.str;
            if (!str) continue;
            if (curY === null) {
              curY = item.transform[5];
              curLine = str;
            } else if (Math.abs(item.transform[5] - curY) > 5) {
              pageLines.push(curLine.trim());
              curY = item.transform[5];
              curLine = str;
            } else {
              curLine += (curLine.endsWith(" ") || str.startsWith(" ") ? "" : " ") + str;
            }
          }
          if (curLine.trim()) pageLines.push(curLine.trim());
          extractedText += pageLines.join("\n") + "\n\n";
        }
        parsePassengersTextAndPopulate(extractedText, file.name);
      }).catch(err => {
        console.error("Erreur lecture PDF passagers:", err);
        alert("Erreur lors de la lecture du PDF : " + err.message);
      });
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = function(evt) {
      parsePassengersTextAndPopulate(evt.target.result, file.name);
    };
    reader.readAsText(file);
  }
}

function parsePassengersTextAndPopulate(rawText, sourceFileName) {
  ensureDriverStructure();
  const statusEl = document.getElementById('adm-driver-passengers-file-status');
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const newPassengers = [];
  const headerOrFooterIgnore = [
    "voyages girardot organisation", "liste des passagers", "voyage n°", "voyage no",
    "mexique paris charles de gaulle", "edition du", "trié par inscription", "civ nom prénom téléphone",
    "laurent bidet", "total chambre", "page 1", "page 2"
  ];

  lines.forEach((line) => {
    const lower = line.toLowerCase();

    // Ignorer les métadonnées hors tableau et l'en-tête de colonnes
    if (headerOrFooterIgnore.some(h => lower.includes(h))) return;
    if (lower.startsWith("civ") && lower.includes("nom")) return;

    // Format délimité (CSV ou tabulation)
    if (line.includes(';') || line.includes('\t')) {
      const parts = line.split(/[;\t]/).map(p => p.trim());
      if (parts.length >= 3 && !parts[0].toLowerCase().includes("civ")) {
        let civ = /^(MR|MRS|M\.|MME|MLLE)$/i.test(parts[0]) ? parts[0] + " " : "";
        let nom = parts[1] || "";
        let prenom = parts[2] || "";
        let tel = parts.find(p => /(?:0\d|\+33)\s*[\d\s]{8,14}/.test(p)) || parts[3] || "";
        newPassengers.push({
          name: `${civ}${nom} ${prenom}`.trim(),
          pickup: "Départ circuit",
          phone: tel,
          seatNumber: "",
          notes: ""
        });
        return;
      }
    }

    // Détection stricte de ligne de tableau : commence par une Civilité (MR, MRS, M., MME...)
    // Exemple : "MR TRIOUX JOSE 07 78 10 96 99 1"
    const rowMatch = line.match(/^(MR|MRS|MME|MLLE|M\.)\s+([A-ZÀ-Ý\s-]+?)\s+([A-ZÀ-Ýa-zà-ÿ\s,-]+?)\s+((?:0\d|\+33|\+52|\+1)[\s\d.-]{8,16})(?:\s+\d+)?$/i);
    if (rowMatch) {
      const civ = rowMatch[1].toUpperCase();
      const nom = rowMatch[2].trim();
      const prenom = rowMatch[3].trim();
      const tel = rowMatch[4].trim();

      newPassengers.push({
        name: `${civ} ${nom} ${prenom}`,
        pickup: "Départ circuit",
        phone: tel,
        seatNumber: "",
        notes: ""
      });
      return;
    }

    // Variantes sans téléphone ou format alternatif
    const rowAltMatch = line.match(/^(MR|MRS|MME|MLLE|M\.)\s+([A-ZÀ-Ý\s-]+?)\s+([A-ZÀ-Ýa-zà-ÿ\s,-]+?)(?:\s+((?:0\d|\+33|\+52)[\s\d.-]{8,16}))?(?:\s+\d+)?$/i);
    if (rowAltMatch && rowAltMatch[2].length >= 2 && !rowAltMatch[2].includes("GIRARDOT") && !rowAltMatch[2].includes("VOYAGE")) {
      const civ = rowAltMatch[1].toUpperCase();
      const nom = rowAltMatch[2].trim();
      const prenom = rowAltMatch[3].trim();
      const tel = rowAltMatch[4] ? rowAltMatch[4].trim() : "";

      newPassengers.push({
        name: `${civ} ${nom} ${prenom}`,
        pickup: "Départ circuit",
        phone: tel,
        seatNumber: "",
        notes: ""
      });
      return;
    }
  });

  if (newPassengers.length > 0) {
    tripData.driverDossier.passengersList = newPassengers;
    renderAdminDriver();
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> <strong>${newPassengers.length} passager(s)</strong> importé(s) avec succès exclusivement depuis le tableau de <em>${sourceFileName}</em>.</span>`;
    }
  } else {
    alert("Aucune ligne de passager n'a pu être identifiée dans le tableau du document.");
  }
}


function addNewRoomingEntry() {
  ensureDriverStructure();
  const nextNum = 100 + (tripData.driverDossier.roomingList.length + 1);
  tripData.driverDossier.roomingList.push({
    roomNumber: String(nextNum),
    type: "Double (Grand Lit)",
    occupants: "",
    notes: ""
  });
  renderAdminDriver();
}

function removeRoomingEntry(idx) {
  ensureDriverStructure();
  tripData.driverDossier.roomingList.splice(idx, 1);
  renderAdminDriver();
}

function updateRoomingField(idx, field, val) {
  ensureDriverStructure();
  tripData.driverDossier.roomingList[idx][field] = val;
}

function addNewPassengerEntry() {
  ensureDriverStructure();
  tripData.driverDossier.passengersList.push({
    name: "",
    pickup: "Départ circuit",
    phone: "",
    seatNumber: "",
    notes: ""
  });
  renderAdminDriver();
}

function removePassengerEntry(idx) {
  ensureDriverStructure();
  tripData.driverDossier.passengersList.splice(idx, 1);
  renderAdminDriver();
}

function updatePassengerField(idx, field, val) {
  ensureDriverStructure();
  tripData.driverDossier.passengersList[idx][field] = val;
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
            <input type="text" id="adm-doc-file-${idx}" class="form-control" placeholder="Chemin local, base64 ou URL https://..." value="${(doc.fileUrl && doc.fileUrl.startsWith('data:')) ? '(Fichier joint enregistré)' : (doc.fileUrl || '')}" onchange="if(!this.value.includes('(Fichier joint')) updateAdminDocumentField(${idx}, 'fileUrl', this.value)">
            <button type="button" class="btn-secondary" style="font-size:0.75rem; white-space:nowrap;" onclick="document.getElementById('adm-doc-upload-${idx}').click()">
              <i class="fa-solid fa-upload"></i> Joindre
            </button>
            <input type="file" id="adm-doc-upload-${idx}" accept="image/*,.pdf,application/pdf" style="display:none;" onchange="handleAdminDocFileUpload(event, ${idx})">
          </div>
          ${doc.fileUrl ? `
            <div style="font-size:0.75rem; color:#16a34a; margin-top:4px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid ${doc.fileUrl.includes('pdf') ? 'fa-file-pdf' : 'fa-image'}"></i>
              <span>Fichier bien joint (${doc.fileUrl.includes('pdf') ? 'Format PDF' : 'Image'})</span>
              <button type="button" onclick="updateAdminDocumentField(${idx}, 'fileUrl', ''); renderAdminDocuments();" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.72rem; text-decoration:underline; padding:0 4px;">Retirer</button>
            </div>
          ` : ''}
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
          <label>Nom de l'hébergement (Hôtel ou Navire) :</label>
          <input type="text" id="hotel-name-${index}" class="form-control" value="${hotel.name || ''}" placeholder="Ex: RH Hotel & Apartments Pretoria" onchange="updateHotelField(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Dates de séjour :</label>
          <input type="text" class="form-control" value="${hotel.dates || ''}" placeholder="Ex: Du 13 au 14 octobre" onchange="updateHotelField(${index}, 'dates', this.value)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Téléphone de l'hébergement :</label>
          <input type="text" class="form-control" value="${hotel.phone || ''}" placeholder="Ex: +52 222 232 2430" onchange="updateHotelField(${index}, 'phone', this.value)">
        </div>
        <div class="form-group">
          <label>Ville / Étape :</label>
          <input type="text" class="form-control" value="${hotel.city || ''}" placeholder="Ex: Puebla" onchange="updateHotelField(${index}, 'city', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Adresse ou Port d'embarquement (calcul GPS) :</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="hotel-addr-${index}" class="form-control" placeholder="Ex: 14 Trevenna St, Sunnyside, Pretoria, 0002" value="${hotel.address || ''}" onchange="updateHotelField(${index}, 'address', this.value)">
          <button type="button" onclick="autoGeocodeHotel(${index})" class="btn-secondary" style="font-size:0.75rem; padding:6px 12px; white-space:nowrap; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-weight:700;" title="Calculer les coordonnées GPS via OpenStreetMap / Nominatim">
            <i class="fa-solid fa-location-crosshairs"></i> Calculer GPS
          </button>
        </div>
        <div id="hotel-geocode-status-${index}" style="font-size:0.75rem; color:#059669; margin-top:4px; font-weight:bold;">
          ${(hotel.lat && hotel.lng) ? `<i class="fa-solid fa-check"></i> Coordonnées GPS : [${Number(hotel.lat).toFixed(4)}, ${Number(hotel.lng).toFixed(4)}]` : ''}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Latitude :</label>
          <input type="number" step="any" id="hotel-lat-${index}" class="form-control" value="${hotel.lat || ''}" placeholder="Ex: -25.7533" oninput="updateHotelField(${index}, 'lat', parseFloat(this.value))" onchange="updateHotelField(${index}, 'lat', parseFloat(this.value))">
        </div>
        <div class="form-group">
          <label>Longitude :</label>
          <input type="number" step="any" id="hotel-lng-${index}" class="form-control" value="${hotel.lng || ''}" placeholder="Ex: 28.2045" oninput="updateHotelField(${index}, 'lng', parseFloat(this.value))" onchange="updateHotelField(${index}, 'lng', parseFloat(this.value))">
        </div>
      </div>
    `;
    container.appendChild(box);
  });
}

function autoGeocodeHotel(index) {
  const hotel = tripData.hotels[index];
  if (!hotel) return;

  const addrInput = document.getElementById(`hotel-addr-${index}`);
  const nameInput = document.getElementById(`hotel-name-${index}`);
  const statusEl = document.getElementById(`hotel-geocode-status-${index}`);

  const addrQuery = addrInput ? addrInput.value.trim() : '';
  const nameQuery = nameInput ? nameInput.value.trim() : '';
  const query = addrQuery || nameQuery;

  if (!query) {
    alert("Veuillez saisir au moins l'adresse ou le nom de l'hôtel pour calculer le GPS.");
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche des coordonnées GPS...</span>';
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        tripData.hotels[index].lat = lat;
        tripData.hotels[index].lng = lon;

        const latInput = document.getElementById(`hotel-lat-${index}`);
        const lngInput = document.getElementById(`hotel-lng-${index}`);
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lon;

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Coordonnées GPS trouvées : [${lat.toFixed(4)}, ${lon.toFixed(4)}]</span>`;
        }
      } else {
        // Tentative secondaire avec le nom uniquement si l'adresse exacte a échoué
        if (addrQuery && nameQuery && query !== nameQuery) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Nouvelle tentative avec le nom de l\'hôtel...</span>';
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nameQuery)}&limit=1`, { headers: { 'Accept-Language': 'fr' } })
            .then(r => r.json())
            .then(data2 => {
              if (data2 && data2.length > 0) {
                const lat = parseFloat(data2[0].lat);
                const lon = parseFloat(data2[0].lon);
                tripData.hotels[index].lat = lat;
                tripData.hotels[index].lng = lon;
                const latInput = document.getElementById(`hotel-lat-${index}`);
                const lngInput = document.getElementById(`hotel-lng-${index}`);
                if (latInput) latInput.value = lat;
                if (lngInput) lngInput.value = lon;
                if (statusEl) {
                  statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Coordonnées GPS trouvées via le nom : [${lat.toFixed(4)}, ${lon.toFixed(4)}]</span>`;
                }
              } else {
                if (statusEl) {
                  statusEl.innerHTML = '<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Lieu non localisé automatiquement. Vous pouvez saisir les coordonnées GPS manuellement.</span>';
                }
              }
            })
            .catch(() => {
              if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;">Erreur réseau lors de la recherche GPS.</span>';
            });
        } else {
          if (statusEl) {
            statusEl.innerHTML = '<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Lieu non localisé automatiquement. Vous pouvez saisir les coordonnées GPS manuellement.</span>';
          }
        }
      }
    })
    .catch(err => {
      console.warn("Erreur geocoding hôtel:", err);
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#dc2626;">Connexion indisponible. Saisissez les coordonnées GPS manuellement.</span>';
      }
    });
}

function updateHotelField(index, field, value) {
  tripData.hotels[index][field] = value;
}

function addNewHotel() {
  if (!tripData.hotels) tripData.hotels = [];
  tripData.hotels.push({
    name: "Nouvel Hébergement",
    dates: "Du ... au ...",
    address: "",
    lat: 0,
    lng: 0
  });
  renderAdminHotels();
}

function removeHotel(index) {
  if (confirm("Supprimer cet hébergement ?")) {
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
          <input type="text" id="sug-name-${index}" class="form-control" value="${sug.name || ''}" onchange="updateSugField(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Thématique / Badge :</label>
          <input type="text" class="form-control" value="${sug.tag || sug.category || ''}" onchange="updateSugField(${index}, 'tag', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Adresse ou localisation :</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="sug-addr-${index}" class="form-control" value="${sug.address || sug.location || ''}" placeholder="Ex: 501 Stanyan St, San Francisco, CA" onchange="updateSugField(${index}, 'address', this.value); updateSugField(${index}, 'location', this.value);">
          <button type="button" onclick="autoGeocodeSuggestion(${index})" class="btn-secondary" style="font-size:0.75rem; padding:6px 12px; white-space:nowrap; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-weight:700;" title="Calculer les coordonnées GPS via OpenStreetMap">
            <i class="fa-solid fa-location-crosshairs"></i> Calculer GPS
          </button>
        </div>
        <div id="sug-geocode-status-${index}" style="font-size:0.75rem; color:#059669; margin-top:4px; font-weight:bold;">
          ${(sug.lat && sug.lng) ? `<i class="fa-solid fa-check"></i> Coordonnées GPS : [${Number(sug.lat).toFixed(4)}, ${Number(sug.lng).toFixed(4)}]` : ''}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Latitude :</label>
          <input type="number" step="any" id="sug-lat-${index}" class="form-control" value="${sug.lat || ''}" placeholder="Ex: 37.7712" oninput="updateSugField(${index}, 'lat', parseFloat(this.value))" onchange="updateSugField(${index}, 'lat', parseFloat(this.value))">
        </div>
        <div class="form-group">
          <label>Longitude :</label>
          <input type="number" step="any" id="sug-lng-${index}" class="form-control" value="${sug.lng || ''}" placeholder="Ex: -122.4542" oninput="updateSugField(${index}, 'lng', parseFloat(this.value))" onchange="updateSugField(${index}, 'lng', parseFloat(this.value))">
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

function autoGeocodeSuggestion(index) {
  const sug = tripData.freeTimeSuggestions[index];
  if (!sug) return;

  const addrInput = document.getElementById(`sug-addr-${index}`);
  const nameInput = document.getElementById(`sug-name-${index}`);
  const statusEl = document.getElementById(`sug-geocode-status-${index}`);

  const addrQuery = addrInput ? addrInput.value.trim() : '';
  const nameQuery = nameInput ? nameInput.value.trim() : '';
  const query = addrQuery || nameQuery;

  if (!query) {
    alert("Veuillez saisir au moins l'adresse ou le nom du lieu pour calculer le GPS.");
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche des coordonnées GPS...</span>';
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        tripData.freeTimeSuggestions[index].lat = lat;
        tripData.freeTimeSuggestions[index].lng = lon;

        const latInput = document.getElementById(`sug-lat-${index}`);
        const lngInput = document.getElementById(`sug-lng-${index}`);
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lon;

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Coordonnées GPS trouvées : [${lat.toFixed(4)}, ${lon.toFixed(4)}]</span>`;
        }
      } else {
        if (addrQuery && nameQuery && query !== nameQuery) {
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nameQuery)}&limit=1`, { headers: { 'Accept-Language': 'fr' } })
            .then(r => r.json())
            .then(data2 => {
              if (data2 && data2.length > 0) {
                const lat = parseFloat(data2[0].lat);
                const lon = parseFloat(data2[0].lon);
                tripData.freeTimeSuggestions[index].lat = lat;
                tripData.freeTimeSuggestions[index].lng = lon;
                const latInput = document.getElementById(`sug-lat-${index}`);
                const lngInput = document.getElementById(`sug-lng-${index}`);
                if (latInput) latInput.value = lat;
                if (lngInput) lngInput.value = lon;
                if (statusEl) {
                  statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> Coordonnées GPS trouvées via le nom : [${lat.toFixed(4)}, ${lon.toFixed(4)}]</span>`;
                }
              } else {
                if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Lieu non localisé automatiquement. Saisissez la latitude/longitude manuellement.</span>';
              }
            })
            .catch(() => {
              if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;">Erreur réseau lors de la recherche GPS.</span>';
            });
        } else {
          if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Lieu non localisé automatiquement. Saisissez la latitude/longitude manuellement.</span>';
        }
      }
    })
    .catch(err => {
      console.warn("Erreur geocoding coup de cœur:", err);
      if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;">Erreur réseau lors de la recherche GPS.</span>';
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
    address: "",
    location: "",
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

  // Détection si c'est une croisière maritime ou fluviale
  const isCruiseCheck = tripData.isCruise || /croisi[eè]re|smeralda|costa|msc|bateau|navire|paquebot/i.test(fullText);
  if (isCruiseCheck) {
    let shipName = tripData.shipName || "";
    if (!shipName) {
      if (fullText.includes("smeralda")) shipName = "Costa Smeralda";
      else if (fullText.includes("costa")) shipName = "Costa Croisières";
      else if (fullText.includes("msc")) shipName = "MSC Croisières";
      else shipName = "Navire de Croisière";
    }
    const promptMsg = `Voulez-vous générer automatiquement la Conciergerie de bord (restaurants du navire, excursions d'escales, boutiques du bord, infirmerie/santé Pont 4 et plan des ponts) pour ${shipName} ?`;
    if (!confirm(promptMsg)) return;

    tripData.conciergerie = buildCruiseConciergerie(shipName, tripData.itinerary, "");
    tripData.isCruise = true;
    tripData.shipName = shipName;
    renderAdminConcierge();
    alert(`⚓ Conciergerie de croisière générée avec succès pour "${shipName}" ! Les 6 thématiques ont été adaptées à la vie à bord (restaurants, bars, infirmerie pont 4, excursions, boutiques et plan des ponts).`);
    return;
  }

  // Déterminer la ville ou destination phare
  let detectedCity = "";
  if (fullText.includes("san francisco") || fullText.includes("francisco") || fullText.includes("sfo")) detectedCity = "San Francisco";
  else if (fullText.includes("chicago")) detectedCity = "Chicago";
  else if (fullText.includes("new york") || fullText.includes("nyc")) detectedCity = "New York";
  else if (fullText.includes("italie") || fullText.includes("dolomite") || fullText.includes("bolzano") || fullText.includes("lac de garde")) detectedCity = "Italie / Dolomites";
  else if (fullText.includes("afrique") || fullText.includes("cap") || fullText.includes("kruger")) detectedCity = "Afrique du Sud / Le Cap";
  else if (fullText.includes("japon") || fullText.includes("tokyo")) detectedCity = "Tokyo";
  else if (fullText.includes("paris") || fullText.includes("france")) detectedCity = "Paris";
  else if (fullText.includes("londres") || fullText.includes("london")) detectedCity = "Londres";
  else {
    // Si non reconnue dans les mots clés immédiats, extraire le premier mot significatif ou demander
    const candidate = title.split(/[-–—:]/)[0].trim();
    detectedCity = prompt("Pour quelle ville ou région principale souhaitez-vous générer les adresses de Conciergerie ?", candidate || "San Francisco");
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

  // 0. Pack Spécial SAN FRANCISCO (Calcul par rayons stricts : <1km immédiat, puis 1 à 4km, et visites <5km sans doublons)
  if (lowerCity.includes("san francisco") || lowerCity.includes("francisco")) {
    // Identifier l'hôtel sur la destination San Francisco (en excluant formellement l'hôtel de pré-acheminement en France)
    const sfHotels = (tripData.hotels || []).filter(h => {
      const text = ((h.name || '') + ' ' + (h.address || '') + ' ' + (h.notes || '')).toLowerCase();
      // Exclure France, Lyon, Roissy, Paris, escale ou pré-acheminement
      if (text.includes('france') || text.includes('lyon') || text.includes('paris') || text.includes('roissy') || text.includes('cdg') || text.includes('saint-exupéry') || text.includes('avant voyage') || text.includes('départ')) {
        return false;
      }
      // Si des coordonnées GPS existent, vérifier qu'elles sont dans la zone américaine / californienne
      if (h.lat && h.lng) {
        if (h.lat > 40 && h.lng > 0) return false; // En Europe / France
      }
      return true;
    });

    // L'hôtel de référence à San Francisco
    const targetHotel = sfHotels[0] || (tripData.hotels || [])[0] || null;
    const hotelRefName = targetHotel ? targetHotel.name : "votre hôtel à San Francisco";
    const hotelLat = (targetHotel && targetHotel.lat) ? Number(targetHotel.lat) : 37.7879; // Défaut Union Sq
    const hotelLng = (targetHotel && targetHotel.lng) ? Number(targetHotel.lng) : -122.4075;

    // Fonction de calcul de distance précise (Haversine)
    const computeDistanceKm = (lat1, lon1, lat2, lon2) => {
      if (!lat1 || !lon1 || !lat2 || !lon2) return null;
      const R = 6371; // Rayon de la Terre en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const getDistanceLabel = (pLat, pLng) => {
      const d = computeDistanceKm(hotelLat, hotelLng, pLat, pLng);
      if (d === null) return "";
      if (d < 1) {
        const m = Math.round(d * 1000);
        return `À ${m}m de ${targetHotel ? targetHotel.name.split(' ')[0] : 'l\'hôtel'}`;
      }
      return `À ${d.toFixed(1)} km de l'hôtel`;
    };

    tripData.conciergerie.welcomeMessage = `Bienvenue à San Francisco ! Je suis votre Concierge Voyage Girardot. Retrouvez vos adresses sélectionnées à proximité immédiate de ${hotelRefName} et pour votre temps libre dans la City by the Bay.`;
    
    // Extraction des titres de visites programmées pour exclure les doublons
    const plannedTitles = (tripData.itinerary || [])
      .flatMap(d => (d.timeline || []).map(v => (v.title || '').toLowerCase()))
      .concat((tripData.itinerary || []).map(d => (d.title || '').toLowerCase()));

    const isAlreadyPlanned = (name) => {
      const lower = name.toLowerCase();
      return plannedTitles.some(p => p.includes(lower) || lower.includes(p.replace(/visite|découverte|matin|après-midi/g, '').trim()));
    };

    tripData.conciergerie.themes.forEach(th => {
      th.enabled = true;

      if (th.id === 'resto') {
        const allRestaurants = [
          // PROXIMITÉ IMMÉDIATE DU COEUR HÔTELIER (< 1 km)
          {
            name: "John's Grill (Steakhouse historique)",
            category: "Steakhouse & Fruits de mer",
            location: "63 Ellis St, San Francisco, CA 94102",
            tag: "Légendaire depuis 1908",
            phone: "+1 415-986-0069",
            bookingUrl: "https://www.johnsgrill.com",
            description: "Table mythique de San Francisco fondée en 1908, immortalisée par Dashiell Hammett dans Le Faucon Maltais. Filets de bœuf grillés, côtes d'agneau et fruits de mer servis dans un somptueux décor boisé d'époque.",
            tips: "Idéal pour dîner le premier soir sans marcher longtemps. Réservez à l'avance pour le premier étage.",
            lat: 37.7858,
            lng: -122.4082
          },
          {
            name: "Sears Fine Food (Brasserie & Pancakes)",
            category: "Brasserie américaine & Petit-déjeuner",
            location: "439 Powell St, San Francisco, CA 94102",
            tag: "Institution depuis 1938",
            phone: "+1 415-986-0700",
            bookingUrl: "https://www.searsfinefood.com",
            description: "Célèbre institution face au passage des mythiques Cable Cars. Connue dans le monde entier pour ses 18 mini-pancakes suédois au beurre fondu, ses omelettes fermières et ses burgers traditionnels.",
            tips: "Parfait pour un petit-déjeuner copieux ou un déjeuner rapide au saut du lit.",
            lat: 37.7891,
            lng: -122.4087
          },
          {
            name: "Super Duper Burgers",
            category: "Burger Gourmet Local 100% Bio",
            location: "721 Market St, San Francisco, CA 94103",
            tag: "Meilleurs Burgers Bio de SF",
            phone: "+1 415-538-3437",
            bookingUrl: "https://www.superduperburgers.com",
            description: "La référence californienne du burger artisanal écoresponsable : viande de bœuf bio issue d'élevages locaux sans hormones, buns moelleux cuits le matin même, frites maison au sel de mer et pickles à volonté.",
            tips: "Service au comptoir ultra-rapide. Ne manquez pas les milkshakes au caramel au beurre salé bio.",
            lat: 37.7869,
            lng: -122.4042
          },
          {
            name: "Enjoy Vegetarian Restaurant",
            category: "Végétarien & Vegan Asiatique",
            location: "839 Kearny St, San Francisco, CA 94108",
            tag: "100% Végétal & Sans OGM",
            phone: "+1 415-956-7868",
            bookingUrl: "https://enjoyveggie.com",
            description: "Table réputée et certifiée bouddhiste proposant une cuisine chinoise entièrement végétarienne et végane sans glutamate : raviolis aux légumes frais, woks de champignons sauvages et tofu braisé savoureux.",
            tips: "Rapport qualité/prix imbattable à quelques minutes de marche de votre hôtel.",
            lat: 37.7958,
            lng: -122.4051
          },
          {
            name: "Mister Jiu's (Étoilé Michelin)",
            category: "Haute Gastronomie Asiatique",
            location: "28 Waverly Pl, Chinatown, San Francisco, CA 94108",
            tag: "Étoile Michelin",
            phone: "+1 415-857-9688",
            bookingUrl: "https://misterjius.com",
            description: "Le chef Brandon Jew réinvente la gastronomie cantonaise dans un ancien banquet historique de Waverly Place. Canard laqué rôti au feu de bois réputé dans tous les États-Unis et dim sums de haute voltige.",
            tips: "Réservation indispensable plusieurs semaines à l'avance en ligne. Bar à cocktails d'exception à l'étage (Moongate Lounge).",
            lat: 37.7938,
            lng: -122.4069
          },
          {
            name: "Tadich Grill (Fruits de mer & Grillades)",
            category: "Fruits de mer & Cioppino traditionnel",
            location: "240 California St, San Francisco, CA 94111",
            tag: "Plus vieux restaurant de Californie (1849)",
            phone: "+1 415-391-1849",
            bookingUrl: "https://tadichgrillsf.com",
            description: "Le plus ancien restaurant de Californie en activité continue depuis 1849. Spécialiste absolu du célèbre Cioppino (ragoût de fruits de mer et crabe Dungeness typique de San Francisco) et poisson frais grillé au feu de mesquite.",
            tips: "Prenez place au grand comptoir en bois pour regarder les cuisiniers officier. Service élégant en veste blanche.",
            lat: 37.7934,
            lng: -122.3996
          },

          // RAYON 1 À 4 KM (Adresses emblématiques accessibles en court trajet)
          {
            name: "Original Joe's (North Beach)",
            category: "Tradition Italo-Américaine",
            location: "601 Union St, North Beach, San Francisco, CA 94133",
            tag: "Institution chaleureuse",
            phone: "+1 415-775-4877",
            bookingUrl: "https://originaljoes.com",
            description: "Temple chaleureux de la cuisine italo-américaine depuis 1937 face au parc Washington Square. Célèbres raviolis maison, escalopes de veau parmigiana, steaks charbon et banquettes en cuir rouge.",
            tips: "Atmosphère vibrante au cœur du quartier italien. Très rapide d'accès en bus 30 ou 8.",
            lat: 37.8005,
            lng: -122.4103
          },
          {
            name: "Shizen Vegan Sushi Bar & Izakaya",
            category: "Sushis Végans Gastronomiques",
            location: "370 14th St, Mission District, San Francisco, CA 94103",
            tag: "Bib Gourmand Michelin",
            phone: "+1 415-678-5767",
            bookingUrl: "https://www.shizensf.com",
            description: "Izakaya japonais gastronomique 100% végétalien récompensé par le Guide Michelin (Bib Gourmand). Créations spectaculaires combinant igname de montagne, konjac et champignons pour reproduire des textures marines sans aucune pêche.",
            tips: "Arrivez dès l'ouverture à 17h ou inscrivez-vous sur leur liste d'attente en ligne.",
            lat: 37.7683,
            lng: -122.4217
          },
          {
            name: "Greens Restaurant (Waterfront)",
            category: "Haute Gastronomie Végétarienne",
            location: "2 Marina Blvd, Fort Mason Center, San Francisco, CA 94123",
            tag: "Vue panoramique Golden Gate",
            phone: "+1 415-771-6222",
            bookingUrl: "https://greensrestaurant.com",
            description: "Pionnier mondial de la gastronomie végétale fondé en 1979 par le Centre Zen de San Francisco. Situé dans un ancien hangar maritime rénové avec d'immenses baies vitrées offrant une vue féerique sur le Golden Gate Bridge.",
            tips: "Idéal pour un déjeuner panoramique ou un dîner au coucher du soleil face au pont.",
            lat: 37.8066,
            lng: -122.4318
          }
        ];

        // Calcul dynamique et intégration de la distance réelle par rapport à l'hôtel de destination
        th.places = allRestaurants.map(r => {
          const dist = computeDistanceKm(hotelLat, hotelLng, r.lat, r.lng);
          const distLabel = dist !== null 
            ? (dist < 1 ? ` (${Math.round(dist * 1000)}m de l'hôtel)` : ` (${dist.toFixed(1)} km de l'hôtel)`)
            : "";
          return {
            ...r,
            category: r.category + distLabel
          };
        }).filter(r => {
          const d = computeDistanceKm(hotelLat, hotelLng, r.lat, r.lng);
          // Filtrer strictement les restaurants dans un rayon maximal de 4.5 km de l'hôtel
          return d === null || d <= 4.5;
        });
      } else if (th.id === 'visites') {
        const potentialVisits = [
          {
            name: "Dragon's Gate & Ruelles de Chinatown",
            category: "Balade historique & Architecture (Rayon 700m)",
            location: "Grant Ave & Bush St, San Francisco, CA 94108",
            tag: "Patrimoine emblématique",
            phone: "+1 415-982-6306",
            bookingUrl: "https://www.sanfranciscochinatown.com",
            description: "Porte monumentale gardée par des lions de pierre sculptés marquant l'entrée de la plus ancienne Chinatown d'Amérique du Nord. Parcourez Grant Avenue et Waverly Place aux façades ornées et balcons multicolores.",
            tips: "À moins de 10 min à pied d'Union Square. Arrêtez-vous à la Golden Gate Fortune Cookie Factory pour voir fabriquer les biscuits artisanaux.",
            lat: 37.7907,
            lng: -122.4058
          },
          {
            name: "Ferry Building Marketplace & Embarcadero",
            category: "Marché gourmand & Baie panoramique (Rayon 1.5 km)",
            location: "1 Ferry Building, The Embarcadero, San Francisco, CA 94111",
            tag: "Halles gourmandes du front de mer",
            phone: "+1 415-983-8030",
            bookingUrl: "https://www.ferrybuildingmarketplace.com",
            description: "Bâtiment historique de 1898 dominé par sa tour de l'horloge. Abrite sous ses verrières les meilleurs artisans culinaires de Californie (fromages artisanaux Cowgirl Creamery, pains au levain Acme Bread, glaces bio et cafés Blue Bottle).",
            tips: "Grand marché des fermiers en plein air les mardis, jeudis et samedis matins face au Bay Bridge.",
            lat: 37.7955,
            lng: -122.3937
          },
          {
            name: "Librairie City Lights & Alley Jack Kerouac",
            category: "Littérature Beat & Culture (Rayon 1.4 km)",
            location: "261 Columbus Ave, North Beach, San Francisco, CA 94133",
            tag: "Monstre sacré de la Beat Generation",
            phone: "+1 415-362-8193",
            bookingUrl: "https://citylights.com",
            description: "Fondée en 1953 par le poète Lawrence Ferlinghetti, cette librairie mythique a publié 'Howl' d'Allen Ginsberg et incarné le cœur de la liberté d'expression et de la Beat Generation.",
            tips: "Montez au dernier étage dans la 'Poetry Room' pour feuilleter un recueil dans les fauteuils en bois au calme.",
            lat: 37.7976,
            lng: -122.4066
          },
          {
            name: "Coit Tower & Télégraphe Hill",
            category: "Belvédère & Fresques historiques (Rayon 2.1 km)",
            location: "1 Telegraph Hill Blvd, San Francisco, CA 94133",
            tag: "Vue 360° sur toute la baie",
            phone: "+1 415-249-0995",
            bookingUrl: "https://sfrecpark.org/destination/coit-tower/",
            description: "Tour art-déco en béton blanc de 64 mètres de haut érigée au sommet de Telegraph Hill. L'intérieur abrite d'exceptionnelles fresques murales des années 1930 peintes par des artistes du New Deal.",
            tips: "Montez-y à pied via les célèbres escaliers fleuris de Filbert Street pour apercevoir les colonies de perroquets sauvages.",
            lat: 37.8024,
            lng: -122.4058
          },
          {
            name: "Palace of Fine Arts",
            category: "Architecture néo-classique & Parc (Rayon 4.2 km)",
            location: "3301 Lyon St, Marina District, San Francisco, CA 94123",
            tag: "Dôme gréco-romain majestueux",
            phone: "+1 415-563-6504",
            bookingUrl: "https://palaceoffinearts.org",
            description: "Monument féerique hérité de l'Exposition Universelle de 1915. Sa monumentale rotonde classique et ses colonnades se reflètent dans une lagune paisible habitée par des cygnes.",
            tips: "Entrée libre et gratuite. Lieu particulièrement magique et paisible pour une balade au soleil couchant.",
            lat: 37.8020,
            lng: -122.4485
          }
        ];

        // Filtrer automatiquement les visites qui feraient doublon avec une étape déjà prévue au programme
        th.places = potentialVisits.filter(v => !isAlreadyPlanned(v.name));
      } else if (th.id === 'shopping') {
        th.places = [
          {
            name: "Westfield San Francisco Centre",
            category: "Grandes enseignes & Dôme historique",
            location: "865 Market St, Union Square, San Francisco, CA 94103",
            tag: "Accès direct métro Powell St",
            phone: "+1 415-512-6776",
            bookingUrl: "https://www.westfield.com",
            description: "Centre commercial historique abritant des dizaines de boutiques sous une magnifique verrière restaurée de 1908.",
            tips: "Sous-sol gourmand très pratique avec accès direct aux lignes de métro BART et Muni.",
            lat: 37.7842,
            lng: -122.4065
          },
          {
            name: "Union Square Boutiques & Galeries",
            category: "Mode internationale & Horlogerie",
            location: "Post St, Geary St & Maiden Lane, San Francisco, CA 94108",
            tag: "Cœur commerçant piétonnier",
            phone: "",
            bookingUrl: "https://visitunionsquaresf.com",
            description: "Les rues entourant Union Square concentrent les plus grandes maisons de mode, grands magasins (Macy's, Saks) et les jolies boutiques fleuries de Maiden Lane.",
            tips: "Maiden Lane devient entièrement piétonne l'après-midi, idéale pour flâner en terrasse.",
            lat: 37.7880,
            lng: -122.4060
          }
        ];
      } else if (th.id === 'pratique') {
        th.places = [
          {
            name: "Chase Bank & Distributeurs DAB 24/7",
            category: "Banque & Retraits sécurisés",
            location: "211 Sutter St, Union Square, San Francisco, CA 94108",
            tag: "DAB sécurisé multi-cartes",
            phone: "+1 415-951-1997",
            bookingUrl: "https://www.chase.com",
            description: "Agence bancaire officielle disposant d'un hall DAB sécurisé 24h/24 acceptant toutes les cartes internationales (Visa, Mastercard, Amex).",
            tips: "Refusez le taux de change proposé par le distributeur (Dynamic Currency Conversion) pour laisser votre banque appliquer le taux officiel sans surcoût.",
            lat: 37.7895,
            lng: -122.4038
          },
          {
            name: "Walgreens Pharmacy (Powell & Geary)",
            category: "Pharmacie, Santé & Dépannage quotidien",
            location: "135 Powell St, San Francisco, CA 94102",
            tag: "Ouvert 7j/7 en plein centre",
            phone: "+1 415-391-7222",
            bookingUrl: "https://www.walgreens.com",
            description: "Grande pharmacie et supérette de dépannage : produits de premiers soins, paracétamol, pansements, adaptateurs électriques US, bouteilles d'eau et snacks.",
            tips: "À 200 mètres d'Union Square. Personnel serviable pour vous orienter sur les médicaments en vente libre aux USA.",
            lat: 37.7865,
            lng: -122.4080
          },
          {
            name: "CVS Pharmacy (Geary St)",
            category: "Pharmacie & Parapharmacie",
            location: "399 Geary St, Union Square, San Francisco, CA 94102",
            tag: "Face aux théâtres d'Union Square",
            phone: "+1 415-268-9949",
            bookingUrl: "https://www.cvs.com",
            description: "Pharmacie complète proposant soins d'hygiène, cosmétiques, chargeurs de téléphone et en-cas légers.",
            tips: "Pratique pour trouver des protections solaires et des produits de voyage format cabine.",
            lat: 37.7871,
            lng: -122.4101
          }
        ];
      } else if (th.id === 'detente') {
        th.places = [
          {
            name: "Cityscape Sky Bar (Hilton 46e étage)",
            category: "Rooftop panoramique 360° (Rayon 250m)",
            location: "333 O'Farrell St, 46th Floor, San Francisco, CA 94102",
            tag: "Plus haut lounge panoramique de SF",
            phone: "+1 415-923-5002",
            bookingUrl: "https://www.cityscapeskybar.com",
            description: "Perché au 46e étage de la tour Hilton, ce sky bar offre d'immenses baies vitrées avec une vue à couper le souffle à 360° sur toute la skyline de San Francisco, le Golden Gate et le pont d'Oakland.",
            tips: "Venez 45 minutes avant le coucher du soleil pour voir la ville s'illuminer dans la brume. Tenue correcte exigée.",
            lat: 37.7861,
            lng: -122.4111
          },
          {
            name: "The View Lounge (Marriott Marquis 39e étage)",
            category: "Cocktails & Verrière historique (Rayon 500m)",
            location: "780 Mission St, 39th Floor, San Francisco, CA 94103",
            tag: "Célèbre fenêtre en arche",
            phone: "+1 415-896-1600",
            bookingUrl: "https://www.marriott.com/en-us/hotels/sfodt-san-francisco-marriott-marquis/dining/",
            description: "Lounge élégant réputé pour sa spectaculaire baie vitrée en éventail surplombant le sud de San Francisco et Market Street. Cocktails signature artisanaux et planches à partager.",
            tips: "Entrée libre sans réservation obligatoire. Très prisé en début de soirée, accès par les ascenseurs rapides de l'hôtel.",
            lat: 37.7854,
            lng: -122.4045
          }
        ];
      } else if (th.id === 'transports') {
        th.transitMapUrl = "https://www.sfmta.com/maps";
        th.transitMapImageUrl = "assets/sf-metro-map.jpg";
        th.guideHtml = `
          <strong>🚊 Guide pratique des transports à San Francisco (Réseau Muni, Cable Cars & BART) :</strong><br>
          • <strong>Le Réseau Muni (Métro léger & Bus) :</strong> Muni dessert l'intégralité de la ville. Les lignes de métro souterrain/aérien (lignes J, K, L, M, N, T) circulent le long de Market Street et relient tous les quartiers majeurs.<br>
          • <strong>Les Mythiques Cable Cars :</strong> 3 lignes historiques (Powell-Hyde, Powell-Mason et California St). Le terminus de Powell Street se situe à 200m d'Union Square. Tarif : 8 $ le trajet simple, mais <em>inclus en illimité</em> dans les Visitor Passports !<br>
          • <strong>Ligne historique F-Market :</strong> De magnifiques tramways anciens venus de Milan, Porto ou Philadelphie qui parcourent toute la rue Market jusqu'au Fisherman's Wharf le long des quais de l'Embarcadero.<br>
          • <strong>Pass Visiteur Muni (Très avantageux) :</strong><br>
          &nbsp;&nbsp;- <strong>1-Day Visitor Passport :</strong> 13 $ (trajets illimités bus, métro ET Cable Cars pendant 24h sur smartphone via l'application <em>MuniMobile</em>)<br>
          &nbsp;&nbsp;- <strong>3-Day Visitor Passport :</strong> 31 $ (idéal pour 3 jours de découverte complète)<br>
          &nbsp;&nbsp;- <strong>7-Day Visitor Passport :</strong> 41 $<br>
          • <strong>Payer avec son smartphone (Clipper / Contactless) :</strong> Vous pouvez également poser votre carte bancaire sans contact ou votre Apple Pay sur les bornes d'entrée (tarif 2,50 $ par trajet en bus/métro). Attention, le réseau régional <strong>BART</strong> reliant l'aéroport SFO au centre-ville fonctionne avec une tarification kilométrique séparée.
        `;
        th.places = [
          {
            name: "Terminus Cable Car de Powell Street (Union Square)",
            category: "Lignes historiques de Cable Car",
            location: "Powell St & Market St, San Francisco, CA 94102",
            tag: "Départ des lignes Powell-Hyde & Powell-Mason",
            phone: "+1 415-701-2311",
            bookingUrl: "https://www.sfmta.com/getting-around/muni/cable-cars",
            description: "Terminus mythique où les wattmen font pivoter manuellement les rames historiques en bois de 1873 sur une plaque tournante. Départ direct pour traverser Nob Hill et rejoindre Fisherman's Wharf.",
            tips: "Arrivez avant 9h30 le matin pour éviter l'attente aux heures de pointe touristique.",
            lat: 37.7845,
            lng: -122.4080
          },
          {
            name: "Application Officielle MuniMobile & Cartes SFMTA",
            category: "Application mobile & Horaires en direct",
            location: "Disponible sur smartphone (iOS & Android)",
            tag: "Pass 1, 3 et 7 jours en ligne",
            phone: "+1 415-701-2311",
            bookingUrl: "https://www.sfmta.com/getting-around/muni/fares-passes/munimobile",
            description: "L'application mobile officielle de la ville de San Francisco pour acheter vos Passports illimités dématérialisés en 1 minute sans faire la queue aux guichets.",
            tips: "Activez votre pass juste avant de monter à bord pour la première fois.",
            lat: 37.7879,
            lng: -122.4075
          },
          {
            name: "VTC Uber, Lyft & Taxis officiels de San Francisco",
            category: "Taxis & Voitures avec chauffeur 24/7",
            location: "Disponible immédiatement partout dans la métropole",
            tag: "Berceau mondial du VTC",
            phone: "+1 415-333-3333",
            bookingUrl: "https://www.uber.com/fr/cities/san-francisco/",
            description: "San Francisco est la ville natale d'Uber et Lyft. Les chauffeurs arrivent en 2 à 4 minutes partout dans la ville. Idéal pour remonter les célèbres collines escarpées sans fatigue le soir.",
            tips: "Application indispensable pour regagner votre hôtel rapidement après le dîner.",
            lat: 37.7833,
            lng: -122.4167
          }
        ];
      }
    });

  // 1. Pack Spécial CHICAGO
  } else if (lowerCity.includes("chicago")) {
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
  if (!syncFormDataIntoTrip()) return;

  // Save to LocalStorage & Catalog
  saveTripToCatalogAndStorage(tripData);

  // Update trip selector label
  renderTripSelectorOptions();

  // Update direct share link
  updateShareLink();

  alert(`✓ Le carnet de voyage "${tripData.title}" a été enregistré localement avec succès ! Pour le rendre accessible en ligne à vos voyageurs sans passer par un terminal, cliquez sur "Publier sur GitHub".`);
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

// Generate share links (Client & Conducteur)
function updateShareLink() {
  const jsonString = JSON.stringify(tripData);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));
  
  // 1. Lien Voyageur (Client)
  const clientBasePath = window.location.href.replace('admin.html', 'index.html');
  const fullShareUrl = `${clientBasePath.split('?')[0]}?trip=${encoded}`;

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
          feedback.innerText = 'Lien client copié !';
          setTimeout(() => { feedback.innerText = ''; }, 3000);
        }
      }).catch(err => {
        if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
        }
      });
    };
  }

  // 2. Lien Dossier Conducteur & Accompagnateur
  const driverBasePath = window.location.href.replace('admin.html', 'conducteur.html');
  const fullDriverUrl = `${driverBasePath.split('?')[0]}?trip=${encoded}`;

  const driverInput = document.getElementById('driver-share-link');
  if (driverInput) driverInput.value = fullDriverUrl;

  const driverPreviewBtn = document.getElementById('preview-driver-link');
  if (driverPreviewBtn) driverPreviewBtn.href = fullDriverUrl;

  const copyDriverBtn = document.getElementById('copy-driver-share-btn');
  if (copyDriverBtn) {
    copyDriverBtn.onclick = () => {
      navigator.clipboard.writeText(fullDriverUrl).then(() => {
        const feedback = document.getElementById('copy-driver-feedback');
        if (feedback) {
          feedback.innerText = 'Lien conducteur copié !';
          setTimeout(() => { feedback.innerText = ''; }, 3000);
        }
      }).catch(err => {
        if (driverInput) {
          driverInput.select();
          document.execCommand('copy');
        }
      });
    };
  }
}

// -----------------------------------------------------------------------------
// MODULE DE RECHERCHE & PROPOSITION DE PHOTOS LIBRES (Wikimedia Commons)
// -----------------------------------------------------------------------------
let currentPhotoTarget = { type: null, dayIndex: null };

function updateCoverPreview(url) {
  const preview = document.getElementById('adm-cover-preview');
  if (!preview) return;
  if (url && url.trim()) {
    preview.innerHTML = `<img src="${url.trim()}" alt="Couverture" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-triangle-exclamation\\' style=\\'color:#f59e0b; font-size:0.8rem;\\'></i>';">`;
  } else {
    preview.innerHTML = `<i class="fa-solid fa-image" style="color:#94a3b8; font-size:0.9rem;"></i>`;
  }
}

function updateDayImagePreview(dayIndex, url) {
  const preview = document.getElementById(`day-image-preview-${dayIndex}`);
  if (!preview) return;
  if (url && url.trim()) {
    preview.innerHTML = `<img src="${url.trim()}" alt="Aperçu" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-triangle-exclamation\\' style=\\'color:#f59e0b; font-size:0.8rem;\\'></i>';">`;
  } else {
    preview.innerHTML = `<i class="fa-solid fa-image" style="color:#94a3b8; font-size:0.9rem;"></i>`;
  }
}

function clearDayImage(dayIndex) {
  updateDayField(dayIndex, 'image', '');
  const input = document.getElementById(`day-image-${dayIndex}`);
  if (input) input.value = '';
  updateDayImagePreview(dayIndex, '');
  renderAdminDays();
}

function openPhotoPickerModal(targetType, dayIndex = null) {
  currentPhotoTarget = { type: targetType, dayIndex: dayIndex };
  const modal = document.getElementById('photo-picker-modal');
  const titleEl = document.getElementById('photo-modal-title');
  const subtitleEl = document.getElementById('photo-modal-subtitle');
  const searchInput = document.getElementById('photo-search-input');
  const grid = document.getElementById('photo-results-grid');

  if (!modal) return;

  // Déterminer le terme de recherche par défaut
  let defaultQuery = '';
  if (targetType === 'general') {
    titleEl.innerHTML = `<i class="fa-solid fa-earth-americas" style="color:var(--accent-gold);"></i> Proposer une photo de destination générale`;
    subtitleEl.innerText = `Cette photo apparaîtra en couverture et en en-tête principal du carnet.`;
    defaultQuery = (tripData && tripData.title) ? tripData.title : 'Voyage paysage';
  } else if (targetType === 'day' && dayIndex !== null) {
    const day = tripData.itinerary[dayIndex];
    titleEl.innerHTML = `<i class="fa-solid fa-camera-retro" style="color:var(--accent-gold);"></i> Proposer une photo pour le Jour ${day ? day.day : ''}`;
    subtitleEl.innerText = `Cette photo illustrera la carte de cette étape dans le carnet et le circuit.`;
    defaultQuery = (day && day.city) ? day.city : (day && day.title ? day.title : (tripData ? tripData.title : ''));
  }

  // Nettoyage de la requête pour retirer les puces ou tirets superflus
  defaultQuery = defaultQuery.split('•')[0].split('—')[0].trim();
  if (searchInput) searchInput.value = defaultQuery;

  modal.style.display = 'flex';

  // Lancer la recherche automatiquement
  if (defaultQuery) {
    searchWikimediaPhotos(defaultQuery);
  } else if (grid) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:#64748b;">Saisissez un mot-clé ci-dessus pour lancer la recherche.</div>`;
  }
}

function closePhotoPickerModal() {
  const modal = document.getElementById('photo-picker-modal');
  if (modal) modal.style.display = 'none';
}

function triggerPhotoSearch() {
  const input = document.getElementById('photo-search-input');
  const q = input ? input.value.trim() : '';
  if (q) {
    searchWikimediaPhotos(q);
  }
}

function searchWikimediaPhotos(query) {
  const grid = document.getElementById('photo-results-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:40px; color:#0284c7;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:12px;"></i>
      <div style="font-size:0.9rem; font-weight:700;">Recherche de photos panoramiques en cours...</div>
      <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">Interrogation de la médiathèque Wikimedia Commons</div>
    </div>
  `;

  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|dimensions&iiurlwidth=800`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.query || !data.query.pages) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">
            <i class="fa-regular fa-image" style="font-size:2rem; color:#cbd5e1; margin-bottom:8px;"></i>
            <div style="font-weight:700;">Aucune photo trouvée pour "${query}".</div>
            <div style="font-size:0.8rem; margin-top:4px;">Essayez avec le nom en anglais ou un mot-clé plus général (ex: "Cape Town", "Kruger", "Safari").</div>
          </div>
        `;
        return;
      }

      const pages = Object.values(data.query.pages);
      // Filtrer pour ne garder que les vraies images (jpg, jpeg, png, webp)
      const validImages = pages.filter(p => {
        const title = (p.title || '').toLowerCase();
        return (title.endsWith('.jpg') || title.endsWith('.jpeg') || title.endsWith('.png') || title.endsWith('.webp')) && !title.includes('icon') && !title.includes('flag');
      });

      if (validImages.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:#64748b;">Aucune photo exploitable trouvée pour "${query}".</div>`;
        return;
      }

      grid.innerHTML = '';
      validImages.forEach(page => {
        const info = (page.imageinfo && page.imageinfo[0]) ? page.imageinfo[0] : null;
        if (!info) return;

        const thumbUrl = info.thumburl || info.url;
        const cleanTitle = page.title.replace('File:', '').replace(/_/g, ' ');

        const card = document.createElement('div');
        card.style = `border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:white; display:flex; flex-direction:column; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.15s, box-shadow 0.15s;`;
        card.onmouseover = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)'; };
        card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; };

        card.innerHTML = `
          <div style="height:120px; width:100%; background:#f1f5f9; overflow:hidden; position:relative;">
            <img src="${thumbUrl}" alt="${cleanTitle}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="padding:10px; display:flex; flex-direction:column; justify-content:space-between; flex:1;">
            <div style="font-size:0.75rem; color:#334155; font-weight:600; line-height:1.3; margin-bottom:8px; max-height:2.6em; overflow:hidden; text-overflow:ellipsis;">
              ${cleanTitle}
            </div>
            <button type="button" class="btn-save-main" style="width:100%; padding:6px 10px; font-size:0.75rem; justify-content:center; border-radius:6px; box-shadow:none;">
              <i class="fa-solid fa-check"></i> Valider cette photo
            </button>
          </div>
        `;

        card.querySelector('button').onclick = () => {
          applySelectedPhoto(thumbUrl);
        };

        grid.appendChild(card);
      });
    })
    .catch(err => {
      console.warn("Erreur recherche Wikimedia:", err);
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:30px; color:#dc2626;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:1.8rem; margin-bottom:6px;"></i>
          <div>Connexion impossible à la médiathèque. Vous pouvez saisir l'adresse URL manuellement.</div>
        </div>
      `;
    });
}

function applySelectedPhoto(photoUrl) {
  if (currentPhotoTarget.type === 'general') {
    const input = document.getElementById('adm-cover');
    if (input) input.value = photoUrl;
    tripData.coverImage = photoUrl;
    updateCoverPreview(photoUrl);
    closePhotoPickerModal();
    alert("✓ Photo de destination générale validée avec succès ! Pensez à enregistrer vos modifications.");
  } else if (currentPhotoTarget.type === 'day' && currentPhotoTarget.dayIndex !== null) {
    const idx = currentPhotoTarget.dayIndex;
    updateDayField(idx, 'image', photoUrl);
    const input = document.getElementById(`day-image-${idx}`);
    if (input) input.value = photoUrl;
    updateDayImagePreview(idx, photoUrl);
    closePhotoPickerModal();
    renderAdminDays();
    alert(`✓ Photo du Jour ${tripData.itinerary[idx].day} validée avec succès ! Pensez à enregistrer vos modifications.`);
  }
}

// -----------------------------------------------------------------------------
// 6. CONVERTISSEUR INTELLIGENT DE PROGRAMME PDF / TEXTE EN VOYAGE (.JSON)
// -----------------------------------------------------------------------------
let currentParsedTrip = null;

function openPdfImportModal() {
  const modal = document.getElementById('pdf-import-modal');
  if (modal) modal.style.display = 'flex';
  resetPdfModalState();
}

function closePdfImportModal() {
  const modal = document.getElementById('pdf-import-modal');
  if (modal) modal.style.display = 'none';
}

function resetPdfModalState() {
  currentParsedTrip = null;
  const status = document.getElementById('pdf-import-status');
  const preview = document.getElementById('pdf-preview-container');
  const btnDownload = document.getElementById('btn-download-parsed-json');
  const btnApply = document.getElementById('btn-apply-parsed-trip');
  const rawInput = document.getElementById('pdf-raw-text-input');
  const fileInput = document.getElementById('pdf-file-input');

  if (status) status.style.display = 'none';
  if (preview) preview.style.display = 'none';
  if (btnDownload) btnDownload.style.display = 'none';
  if (btnApply) btnApply.style.display = 'none';
  if (rawInput) rawInput.value = '';
  if (fileInput) fileInput.value = '';
}

function handlePdfFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('pdf-import-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.borderColor = '#93c5fd';
    statusEl.style.background = '#eff6ff';
    statusEl.style.color = '#1d4ed8';
    statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Lecture et extraction du texte du fichier "${file.name}" en cours...`;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const typedarray = new Uint8Array(e.target.result);
    extractTextFromPdfArray(typedarray, file.name);
  };
  reader.readAsArrayBuffer(file);
}

function extractTextFromPdfArray(typedarray, originalFileName) {
  const statusEl = document.getElementById('pdf-import-status');
  
  if (!window.pdfjsLib) {
    if (statusEl) {
      statusEl.style.borderColor = '#fca5a5';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#b91c1c';
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> La bibliothèque PDF.js n'a pas pu être chargée. Vous pouvez copier/coller directement le texte de votre PDF dans l'encadré ci-dessous.`;
    }
    return;
  }

  window.pdfjsLib.getDocument({ data: typedarray }).promise.then(async function(pdf) {
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Regrouper les éléments textuels par ligne en utilisant leur coordonnée Y
      const items = textContent.items;
      if (!items || items.length === 0) continue;

      // Trier verticalement (du haut vers le bas, y décroissant) puis horizontalement (x croissant)
      items.sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        if (Math.abs(yA - yB) > 5) {
          return yB - yA; // Ligne supérieure d'abord
        }
        return a.transform[4] - b.transform[4]; // De gauche à droite
      });

      let pageLines = [];
      let currentLineY = null;
      let currentLineText = "";

      for (const item of items) {
        const str = item.str;
        if (!str) continue;
        const itemY = item.transform[5];

        if (currentLineY === null) {
          currentLineY = itemY;
          currentLineText = str;
        } else if (Math.abs(itemY - currentLineY) > 5) {
          pageLines.push(currentLineText.trim());
          currentLineY = itemY;
          currentLineText = str;
        } else {
          // Même ligne : ajouter un espace si besoin
          currentLineText += (currentLineText.endsWith(" ") || str.startsWith(" ") ? "" : " ") + str;
        }
      }
      if (currentLineText.trim()) {
        pageLines.push(currentLineText.trim());
      }

      fullText += pageLines.join("\n") + "\n\n";
    }

    if (!fullText.trim()) {
      if (statusEl) {
        statusEl.style.borderColor = '#fca5a5';
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#b91c1c';
        statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Le PDF semble être un scan sans couche texte sélectionnable. Copiez-collez le texte ou écrivez les étapes manuellement.`;
      }
      return;
    }

    // Afficher dans la zone de texte pour vérification et analyse
    const rawInput = document.getElementById('pdf-raw-text-input');
    if (rawInput) rawInput.value = fullText;

    processExtractedTextToTrip(fullText, originalFileName);
  }).catch(err => {
    console.error("Erreur PDF.js:", err);
    if (statusEl) {
      statusEl.style.borderColor = '#fca5a5';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#b91c1c';
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erreur lors de la lecture du PDF : ${err.message}. Vous pouvez coller le texte directement ci-dessous.`;
    }
  });
}

function parsePastedTextToTrip() {
  const rawInput = document.getElementById('pdf-raw-text-input');
  const text = rawInput ? rawInput.value.trim() : '';
  if (!text) {
    alert("Veuillez d'abord coller le texte de votre programme de voyage.");
    return;
  }
  processExtractedTextToTrip(text, "Programme importé");
}


// -----------------------------------------------------------------------------
// PROFILS DE PONTS DES NAVIRES DE CROISIÈRE
// -----------------------------------------------------------------------------
const COSTA_SMERALDA_DECKS = [
  {
    deck: 4,
    name: "Palermo",
    category: "Services & Cabines",
    description: "Centre Médical & Infirmerie (Avant), Cabines passagers, Passerelle d'embarquement / débarquement en escale.",
    highlights: [
      { name: "Centre Médical & Infirmerie", zone: "Proue (Avant)", side: "Bâbord", icon: "shield-heart", color: "#2563eb", desc: "Soins médicaux, urgences, consultations et médicaments 24h/24." },
      { name: "Passerelle de débarquement", zone: "Centre / Poupe", side: "Bâbord & Tribord", icon: "door-open", color: "#0891b2", desc: "Accès piéton pour les sorties d'escale et excursions." }
    ]
  },
  {
    deck: 5,
    name: "Taormina",
    category: "Restauration & Cabines",
    description: "Restaurant Principal La Colombina (Arrière), Cabines passagers.",
    highlights: [
      { name: "Restaurant Principal La Colombina", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Dîner inclus servi à table avec carte régionale italienne renouvelée chaque soir." }
    ]
  },
  {
    deck: 6,
    name: "Matera",
    category: "Spectacles & Grands Salons",
    description: "Grand Théâtre Sanremo (Avant), Grand Bar Mastroianni (Centre), Atrium Colosseo (Centre), Illy Bar & Café, Restaurants Il Meneghino & Arlecchino (Arrière).",
    highlights: [
      { name: "Grand Théâtre Sanremo (Niveau 1)", zone: "Proue (Avant)", side: "Centre", icon: "masks-theater", color: "#7c3aed", desc: "Spectacles musicaux, acrobates, danseurs et artistes internationaux." },
      { name: "Grand Bar Mastroianni", zone: "Centre", side: "Centre", icon: "music", color: "#9333ea", desc: "Grand salon central avec piste de danse et orchestre live." },
      { name: "Atrium Colosseo (Niveau 1)", zone: "Centre", side: "Centre", icon: "landmark", color: "#c29958", desc: "Cœur battant du navire avec parois vitrées et écrans géants LED." },
      { name: "Illy Bar & Café Italien", zone: "Centre", side: "Bâbord", icon: "mug-saucer", color: "#b45309", desc: "Véritable expresso italien, cappuccino et pâtisseries." },
      { name: "Restaurants Il Meneghino & Arlecchino", zone: "Poupe (Arrière)", side: "Bâbord / Tribord", icon: "utensils", color: "#e11d48", desc: "Grands espaces de restauration panoramiques avec vue sur la mer." }
    ]
  },
  {
    deck: 7,
    name: "Positano",
    category: "Accueil & Vie Centrale",
    description: "Théâtre Sanremo (Avant), Réception & Bureau d'Information 24h, Bornes Carte Cabine, Campari Bar, Piazza di Spagna (Arrière), Tutti a Tavola.",
    highlights: [
      { name: "Réception & Bureau d'Information 24h/24", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Accueil permanent en français, questions pratiques et gestion de compte." },
      { name: "Bornes Enregistrement Carte Cabine", zone: "Centre", side: "Tribord", icon: "credit-card", color: "#2563eb", desc: "Association obligatoire de votre carte bancaire dès le premier jour." },
      { name: "Campari Bar (Atrium Colosseo)", zone: "Centre", side: "Bâbord", icon: "martini-glass-citrus", color: "#dc2626", desc: "Apéritif italien rouge vif surplombant les shows de l'Atrium." },
      { name: "Piazza di Spagna & Grand Escalier", zone: "Poupe (Arrière)", side: "Poupe", icon: "sun", color: "#ea580c", desc: "Gradins extérieurs monumentaux ouverts sur l'horizon marin." }
    ]
  },
  {
    deck: 8,
    name: "Capri",
    category: "Gastronomie & Boutiques Tax-Free",
    description: "Galleria Sanremo (Duty Free), Pizzeria Pummid'Oro, Buffet La Sagra dei Sapori, Teppanyaki, Spazio Bollicine Ferrari.",
    highlights: [
      { name: "Buffet La Sagra dei Sapori", zone: "Poupe (Arrière)", side: "Centre", icon: "bowl-food", color: "#e11d48", desc: "Buffet libre-service géant : entrées, pâtes fraîches, viandes, desserts." },
      { name: "Galleria Sanremo & Boutiques Tax-Free", zone: "Centre", side: "Bâbord & Tribord", icon: "bag-shopping", color: "#d97706", desc: "Parfums, cosmétiques, bijoux, maroquinerie italienne et tabacs détaxés." },
      { name: "Pizzeria Pummid'Oro", zone: "Centre", side: "Bâbord", icon: "pizza-slice", color: "#ea580c", desc: "Pizzas artisanales à fermentation lente et mozzarella 100% faite à bord." },
      { name: "Restaurant Japonais Teppanyaki", zone: "Poupe (Arrière)", side: "Tribord", icon: "fire-burner", color: "#b91c1c", desc: "Show cooking japonais spectaculaire sous vos yeux." }
    ]
  },
  {
    deck: 9,
    name: "Napoli",
    category: "Pont Cabines",
    description: "Cabines passagers intérieures, extérieures avec vue mer et avec balcon privé.",
    highlights: [
      { name: "Cabines Pont 9 (9001 à 9390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès immédiat par les ascenseurs Avant, Centraux ou Arrière." }
    ]
  },
  {
    deck: 10,
    name: "Roma",
    category: "Pont Cabines",
    description: "Cabines passagers avec balcon et suites élégantes.",
    highlights: [
      { name: "Cabines Pont 10 (10001 à 10390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès par les ascenseurs Avant, Centraux ou Arrière." }
    ]
  },
  {
    deck: 11,
    name: "Firenze",
    category: "Pont Cabines",
    description: "Cabines passagers et suites avec vue panoramique.",
    highlights: [
      { name: "Cabines Pont 11 (11001 à 11390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès direct par les 3 cages d'ascenseurs principales." }
    ]
  },
  {
    deck: 12,
    name: "Genova",
    category: "Pont Cabines",
    description: "Cabines passagers avec balcon.",
    highlights: [
      { name: "Cabines Pont 12 (12001 à 12390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès rapide aux ascenseurs Avant, Centraux et Arrière." }
    ]
  },
  {
    deck: 14,
    name: "Venezia",
    category: "Pont Cabines",
    description: "Cabines et Suites vénitiennes (pas de pont 13).",
    highlights: [
      { name: "Cabines Pont 14 (14001 à 14390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Ascenseurs Avant, Centraux et Arrière." }
    ]
  },
  {
    deck: 15,
    name: "Milano",
    category: "Pont Cabines",
    description: "Cabines avec balcon supérieur et suites.",
    highlights: [
      { name: "Cabines Pont 15 (15001 à 15390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "À un seul escalier du Spa et des piscines supérieures." }
    ]
  },
  {
    deck: 16,
    name: "Como",
    category: "Bien-être, Spa & Fitness",
    description: "Spa Solemio, Espace Beauté, Sauna, Hammam, Salle de Fitness panoramique.",
    highlights: [
      { name: "Spa Solemio & Massages", zone: "Proue (Avant)", side: "Centre", icon: "spa", color: "#0d9488", desc: "Parcours thermal luxueux, cabine de neige, sauna vue mer." },
      { name: "Salle de Gym & Fitness", zone: "Proue (Avant)", side: "Tribord", icon: "dumbbell", color: "#0284c7", desc: "Équipements Technogym avec vue panoramique mer." }
    ]
  },
  {
    deck: 17,
    name: "Bellagio",
    category: "Piscines & Ponts Extérieurs",
    description: "Piscine centrale La Spiaggia avec verrière amovible, Solarium, Aperol Spritz Bar.",
    highlights: [
      { name: "Piscine La Spiaggia", zone: "Centre", side: "Centre", icon: "water-ladder", color: "#0284c7", desc: "Bassin principal tempéré sous verrière avec transats." },
      { name: "Aperol Spritz Bar", zone: "Centre", side: "Bâbord", icon: "wine-glass", color: "#f97316", desc: "Cocktails face à la mer au coucher du soleil." }
    ]
  },
  {
    deck: 18,
    name: "Torino",
    category: "Sports & Club Enfants",
    description: "Terrain multisports, parcours de marche, Club Squok enfants.",
    highlights: [
      { name: "Terrain Multisports", zone: "Poupe (Arrière)", side: "Centre", icon: "basketball", color: "#ea580c", desc: "Terrains de basket, football et tennis en plein air." }
    ]
  },
  {
    deck: 19,
    name: "Cortina",
    category: "Passerelle Panoramique Volare",
    description: "Passerelle panoramique Volare suspendue à 65 mètres avec sol en verre.",
    highlights: [
      { name: "Passerelle Volare", zone: "Poupe (Arrière)", side: "Centre", icon: "eye", color: "#0891b2", desc: "Promenade spectaculaire au-dessus du vide face à l'immensité de la mer." }
    ]
  }
];

const COSTA_DIADEMA_DECKS = [
  {
    deck: 1,
    name: "Timone",
    category: "Services Médicaux & Cabines",
    description: "Centre Médical & Infirmerie (Avant), Cabines passagers intérieures et vue mer.",
    highlights: [
      { name: "Centre Médical & Infirmerie", zone: "Proue (Avant)", side: "Centre", icon: "shield-heart", color: "#2563eb", desc: "Consultations, soins d'urgence, mal de mer et délivrance de médicaments 24h/24." },
      { name: "Cabines Pont 1", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Cabines passagers calmes proches des ascenseurs." }
    ]
  },
  {
    deck: 2,
    name: "Sara",
    category: "Pont Cabines & Passerelle",
    description: "Cabines passagers et passerelle d'accès pour les débarquements en escale.",
    highlights: [
      { name: "Passerelle de débarquement", zone: "Centre / Poupe", side: "Bâbord & Tribord", icon: "door-open", color: "#0891b2", desc: "Accès piéton pour les sorties d'escale et excursions." },
      { name: "Cabines Pont 2", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Cabines avec hublot vue mer et cabines intérieures." }
    ]
  },
  {
    deck: 3,
    name: "Centenario",
    category: "Accueil, Dîner & Théâtre",
    description: "Théâtre Emerald (Avant), Réception & Guest Service 24h, Atrium Eliodoro, Restaurant Fiorentino (Arrière), Restaurant Adularia (Centre).",
    highlights: [
      { name: "Réception & Guest Service (24h/24)", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Accueil francophone permanent, gestion de compte et cartes cabine." },
      { name: "Restaurant Adularia (1er Service)", zone: "Centre", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Votre restaurant principal sélectionné pour le dîner. Cuisine italienne et régionale servie à table." },
      { name: "Restaurant Fiorentino (Niveau 1)", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#be123c", desc: "Grand restaurant élégant avec vue splendide sur le sillage du navire." },
      { name: "Théâtre Emerald (Niveau 1)", zone: "Proue (Avant)", side: "Centre", icon: "masks-theater", color: "#7c3aed", desc: "Grandes comédies musicales, danseurs et artistes internationaux." },
      { name: "Atrium Eliodoro (Niveau 1)", zone: "Centre", side: "Centre", icon: "landmark", color: "#c29958", desc: "Atrium central spectaculaire avec ascenseurs panoramiques en verre." }
    ]
  },
  {
    deck: 4,
    name: "Perla di Venere",
    category: "Grands Salons & Fêtes",
    description: "Théâtre Emerald (Niveau 2), Grand Bar Orlov (Centre), Bar Bollicine, Atrium Eliodoro (Niveau 2), Restaurant Fiorentino (Niveau supérieur).",
    highlights: [
      { name: "Grand Bar Orlov", zone: "Centre", side: "Centre", icon: "music", color: "#9333ea", desc: "Le grand salon de danse du navire avec orchestre live tous les soirs." },
      { name: "Bar Bollicine", zone: "Centre", side: "Tribord", icon: "champagne-glasses", color: "#c29958", desc: "Bar à bulles et cocktails de prestige avant le dîner." },
      { name: "Théâtre Emerald (Niveau 2)", zone: "Proue (Avant)", side: "Centre", icon: "masks-theater", color: "#7c3aed", desc: "Balcon mezzanine du théâtre avec vue plongeante sur la scène." },
      { name: "Restaurant Fiorentino (Niveau 2)", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#be123c", desc: "Niveau supérieur du restaurant panoramique." }
    ]
  },
  {
    deck: 5,
    name: "Eldorador",
    category: "Promenade, Restaurants & Boutiques",
    description: "Promenade La Passeggiata (500m), Pizzeria La Tavernetta, Teppanyaki, Birreria Dresden Green, Vinoteca Gran Duca di Toscana, Country Rock Club, Casino Golden Mirage, Boutiques Tax-Free.",
    highlights: [
      { name: "Promenade extérieure 'La Passeggiata'", zone: "Tout le tour", side: "Bâbord & Tribord", icon: "person-walking", color: "#0284c7", desc: "500 mètres de promenade en plein air faisant tout le tour du navire, avec bains à remous suspendus." },
      { name: "Pizzeria La Tavernetta", zone: "Centre", side: "Bâbord", icon: "pizza-slice", color: "#ea580c", desc: "Véritable pizza italienne artisanale avec pâte levée et mozzarella fraîche du bord." },
      { name: "Restaurant Japonais Teppanyaki", zone: "Centre", side: "Tribord", icon: "fire-burner", color: "#b91c1c", desc: "Spectacle culinaire japonais sur plaques chauffantes par des maîtres teppanyaki." },
      { name: "Birreria Dresden Green", zone: "Centre", side: "Bâbord", icon: "beer-mug-empty", color: "#b45309", desc: "Brasserie artisanale avec bières à la pression et ambiance chaleureuse." },
      { name: "Vinoteca Gran Duca di Toscana", zone: "Centre", side: "Tribord", icon: "wine-glass", color: "#9333ea", desc: "Bar à vins italiens de renom, dégustations avec sommeliers." },
      { name: "Country Rock Club", zone: "Centre", side: "Bâbord", icon: "guitar", color: "#dc2626", desc: "Concerts rock live, guitares et musique américaine." },
      { name: "Galerie Marchande & Duty Free", zone: "Centre", side: "Centre", icon: "bag-shopping", color: "#d97706", desc: "Boutiques détaxées : parfums, mode italienne, montres, souvenirs Costa." },
      { name: "Casino Golden Mirage", zone: "Centre", side: "Tribord", icon: "clover", color: "#059669", desc: "Roulettes, tables de blackjack, poker et machines à sous." },
      { name: "Bar Teodora (Salon Arrière)", zone: "Poupe (Arrière)", side: "Centre", icon: "martini-glass-citrus", color: "#0891b2", desc: "Grand salon de détente arrière avec vue panoramique sur l'océan." }
    ]
  },
  {
    deck: 6,
    name: "Brindisi",
    category: "Pont Cabines",
    description: "Cabines passagers avec balcon privé, vue mer et intérieures.",
    highlights: [
      { name: "Cabines Pont 6 (6001 à 6390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès immédiat par les 3 cages d'ascenseurs (Avant, Centraux, Arrière)." }
    ]
  },
  {
    deck: 7,
    name: "Agata",
    category: "Pont Cabines",
    description: "Cabines avec balcon et suites confortables.",
    highlights: [
      { name: "Cabines Pont 7 (7001 à 7390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès ascenseurs Théâtre Emerald, Atrium Eliodoro ou Arrière." }
    ]
  },
  {
    deck: 8,
    name: "Topazio",
    category: "Pont Cabines",
    description: "Cabines passagers avec balcon privé et mini-suites.",
    highlights: [
      { name: "Cabines Pont 8 (8001 à 8390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Coursives bâbord (pairs) et tribord (impairs)." }
    ]
  },
  {
    deck: 9,
    name: "Acquamarina",
    category: "Pont Cabines",
    description: "Cabines supérieures avec balcon et vue panoramique dégagée.",
    highlights: [
      { name: "Cabines Pont 9 (9001 à 9390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "À un seul pont du buffet et des piscines du Pont 10." }
    ]
  },
  {
    deck: 10,
    name: "Hortensia",
    category: "Buffet, Piscines & Glaces",
    description: "Buffet Corona Blu (Arrière), Lido Diana (Piscine couverte avec verrière rétractable et écran géant), Lido Stella del Sud (Piscine extérieure), Glacier Amarillo.",
    highlights: [
      { name: "Restaurant Buffet Corona Blu", zone: "Poupe (Arrière)", side: "Centre", icon: "bowl-food", color: "#e11d48", desc: "Buffet libre-service très complet pour petit-déjeuner, déjeuner et dîner décontracté." },
      { name: "Lido Diana (Piscine couverte & Écran géant)", zone: "Centre", side: "Centre", icon: "water-ladder", color: "#0284c7", desc: "Grande piscine centrale tempérée sous verrière amovible et écran géant de cinéma." },
      { name: "Lido Stella del Sud (Piscine Extérieure)", zone: "Poupe (Arrière)", side: "Poupe", icon: "sun", color: "#ea580c", desc: "Piscine plein air et solarium face au sillage du navire." },
      { name: "Glacier Italien Amarillo", zone: "Centre", side: "Bâbord", icon: "ice-cream", color: "#d97706", desc: "Glaces italiennes artisanales bio fabriquées chaque jour à bord." }
    ]
  },
  {
    deck: 11,
    name: "Samsara",
    category: "Samsara Spa, Fitness & Bien-être",
    description: "Samsara Spa (6 200 m² sur 4 étages), Salle de Fitness Technogym vue mer, Balnéothérapie, Hammam, Sauna, Restaurant Samsara.",
    highlights: [
      { name: "Samsara Spa & Wellness (6 200 m²)", zone: "Proue (Avant)", side: "Centre", icon: "spa", color: "#0d9488", desc: "Parcours thermal de luxe, piscine balnéo, sauna finlandais et cabines de soins." },
      { name: "Salle de Sport & Gym Panoramique", zone: "Proue (Avant)", side: "Tribord", icon: "dumbbell", color: "#0284c7", desc: "Appareils Technogym dernier cri avec baie vitrée plongeant sur l'avant du paquebot." },
      { name: "Restaurant Samsara", zone: "Proue (Avant)", side: "Bâbord", icon: "utensils", color: "#059669", desc: "Cuisine saine, légère et raffinée dans un décor zen et apaisant." },
      { name: "Lido Balbi & Bains à remous", zone: "Centre", side: "Centre", icon: "hot-tub-person", color: "#0891b2", desc: "Bains à remous bouillonnants et transats de relaxation." }
    ]
  },
  {
    deck: 12,
    name: "Diamante",
    category: "Spa Supérieur & Cabines Samsara",
    description: "Niveau supérieur du Samsara Spa, solarium UVA et cabines bien-être.",
    highlights: [
      { name: "Samsara Spa (Niveau supérieur)", zone: "Proue (Avant)", side: "Centre", icon: "spa", color: "#0d9488", desc: "Salons de relaxation intimes, lits chauffants en céramique et thérapie." },
      { name: "Cabines & Suites Samsara", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#059669", desc: "Cabines privilégiées avec accès direct illimité à l'espace thermal." }
    ]
  },
  {
    deck: 14,
    name: "Rubino",
    category: "Sports, Footing & Enfants",
    description: "Piste de jogging / footing en plein air, Terrain multisports, Club enfants Squok Club, Piscine enfants Peppa Pig, Cinéma 4D.",
    highlights: [
      { name: "Piste de Jogging / Footing en mer", zone: "Tout le tour", side: "Bâbord & Tribord", icon: "person-running", color: "#0284c7", desc: "Circuit de course à pied en plein air avec vue panoramique sur l'océan." },
      { name: "Terrain Multisports Polyvalent", zone: "Centre", side: "Centre", icon: "basketball", color: "#ea580c", desc: "Tournois amicaux de basket-ball, football et volley-ball." },
      { name: "Squok Club & Piscine Peppa Pig", zone: "Centre", side: "Tribord", icon: "children", color: "#ec4899", desc: "Espace d'animation réservé aux enfants avec pataugeoire thématique." },
      { name: "Cinéma 4D & Simulateur de tir Star Lazer", zone: "Centre", side: "Bâbord", icon: "film", color: "#7c3aed", desc: "Sensations fortes avec effets sensoriels et jeux vidéo arcade." }
    ]
  },
  {
    deck: 15,
    name: "Smeraldo",
    category: "Grand Solarium Panoramique",
    description: "Le sommet du paquebot : transats de bronzage, vue panoramique à 360° et observation du grand large.",
    highlights: [
      { name: "Grand Solarium Supérieur 360°", zone: "Tout le pont", side: "Proue & Centre", icon: "sun", color: "#f59e0b", desc: "Point culminant du navire pour admirer les arrivées au port et les couchers de soleil." }
    ]
  }
];

function getCruiseShipDecks(shipName) {
  if (typeof window.CRUISE_FLEET !== 'undefined' && typeof window.CRUISE_FLEET.getCruiseShipDecks === 'function') {
    return window.CRUISE_FLEET.getCruiseShipDecks(shipName);
  }
  const s = (shipName || "").toLowerCase();
  if (s.includes('diadema')) {
    return COSTA_DIADEMA_DECKS;
  }
  return COSTA_SMERALDA_DECKS;
}

// -----------------------------------------------------------------------------
// CONCIERGERIE SPÉCIALE CROISIÈRE : RESTAURANTS, BARS, BOUTIQUES, INFIRMERIE & PONTS
// -----------------------------------------------------------------------------
function buildCruiseConciergerie(shipName, itinerary, rawText) {
  if (typeof window.CRUISE_FLEET !== 'undefined' && typeof window.CRUISE_FLEET.buildCruiseConciergerie === 'function') {
    return window.CRUISE_FLEET.buildCruiseConciergerie(shipName, itinerary, rawText);
  }
  const ship = shipName || "Navire de Croisière";
  const isDiadema = (ship.toLowerCase().includes('diadema') || (rawText && rawText.toLowerCase().includes('diadema')));

  // Génération dynamique des escales à partir de l'itinéraire du PDF
  const excursionsPlaces = [];
  if (itinerary && Array.isArray(itinerary) && itinerary.length > 0) {
    itinerary.forEach(d => {
      const city = d.city || "";
      const isSeaDay = city.toLowerCase().includes('plaisirs en mer') || d.title.toLowerCase().includes('en mer');

      let cat = "Escale Portuaire";
      let tag = city || "Escale";
      let tips = "Excursion organisée vendue à bord ou temps libre à terre. Respectez impérativement l'heure limite de retour à bord.";

      if (isSeaDay) {
        cat = "Journée en Navigation";
        tag = "Détente & Loisirs à bord";
        tips = "Profitez des piscines, du spa, des boutiques détaxées et du programme d'animations Oggi a bordo.";
      } else if (d.day === 1) {
        cat = "Embarquement";
        tag = "Marseille Terminal Croisière";
        tips = "Présentez votre billet de croisière imprimé et votre pièce d'identité à la gare maritime.";
      } else if (d.day === itinerary.length) {
        cat = "Débarquement";
        tag = "Fin de croisière";
        tips = "Récupération des valises sous le hangar portuaire et retour dans votre région.";
      }

      let desc = d.description ? d.description.slice(0, 260) : (d.highlight || "Découverte de l'escale.");
      if (d.timeline && d.timeline.length > 0) {
        const excList = d.timeline.filter(t => t.time === "Excursion" || t.title.toLowerCase().includes('visite') || t.title.toLowerCase().includes('découverte')).map(t => t.title);
        if (excList.length > 0) {
          desc += " Excursions disponibles : " + excList.join(', ') + ".";
        }
      }

      excursionsPlaces.push({
        name: `${d.title}`,
        category: cat,
        location: `${city || 'En mer'} • ${d.dateStr || `Jour ${d.day}`}`,
        tag: tag,
        description: desc,
        tips: tips,
        lat: d.lat || 43.2965,
        lng: d.lng || 5.3698
      });
    });
  }

  // Fallback si pas d'étapes dans l'itinéraire
  if (excursionsPlaces.length === 0) {
    if (isDiadema) {
      excursionsPlaces.push(
        { name: "Escale Savone (Italie)", category: "Escale historique", location: "Port de Savone", tag: "Forteresse & Portofino", description: "Vieille ville, forteresse du Priamar et excursions vers Gênes ou Portofino.", tips: "Centre-ville accessible à pied.", lat: 44.3079, lng: 8.4811 },
        { name: "Escale Barcelone (Espagne)", category: "Escale culturelle", location: "Port de Barcelone", tag: "Gaudi & Ramblas", description: "Sagrada Familia, Parc Güell, balade sur les Ramblas et tapas.", tips: "Navette portuaire vers le centre.", lat: 41.3851, lng: 2.1734 },
        { name: "Escale Tanger (Maroc)", category: "Escale d'Orient", location: "Port de Tanger", tag: "Médina & Grand Souk", description: "Médina blanchie à la chaux, kasbah sur le détroit de Gibraltar.", tips: "Marchandage de rigueur dans les souks.", lat: 35.7878, lng: -5.8118 },
        { name: "Escale Casablanca (Maroc)", category: "Escale d'Orient", location: "Port de Casablanca", tag: "Mosquée Hassan II", description: "L'impressionnante mosquée Hassan II sur l'eau et quartier des Habous.", tips: "Respect des coutumes vestimentaires pour la mosquée.", lat: 33.6062, lng: -7.6186 },
        { name: "Escale Cadix (Espagne)", category: "Escale andalouse", location: "Port de Cadix", tag: "Cathédrale & Séville", description: "Ruelles pavées, cathédrale à coupole dorée ou excursion vers Séville.", tips: "Escale très facile à pied.", lat: 36.5271, lng: -6.2886 },
        { name: "Escale Gibraltar (Royaume-Uni)", category: "Escale insolite", location: "Port de Gibraltar", tag: "Le Rocher & Macaques", description: "Le célèbre rocher de Gibraltar, réserve naturelle et macaques en liberté.", tips: "Paiement en Livres ou Euros.", lat: 36.1408, lng: -5.3536 },
        { name: "Escale Malaga (Espagne)", category: "Costa del Sol", location: "Port de Malaga", tag: "Picasso & Alcazaba", description: "Ville natale de Picasso, forteresse de l'Alcazaba et plages andalouses.", tips: "Musée Picasso au cœur historique.", lat: 36.7213, lng: -4.4214 }
      );
    } else {
      excursionsPlaces.push(
        { name: "Escale Barcelone (Espagne)", category: "Escale culturelle", location: "Port de Barcelone", tag: "Gaudi & Ramblas", description: "Sagrada Familia, Parc Güell et tapas.", tips: "Navette disponible.", lat: 41.3851, lng: 2.1734 },
        { name: "Escale Palerme (Sicile)", category: "Trésors arabo-normands", location: "Port de Palerme", tag: "Cathédrale & Monreale", description: "Explorez la capitale sicilienne.", tips: "Dégustez les cannoli.", lat: 38.1157, lng: 13.3615 },
        { name: "Escale Civitavecchia / Rome", category: "Cité Éternelle", location: "Port de Civitavecchia", tag: "Colisée & Vatican", description: "Excursion exceptionnelle vers Rome.", tips: "Trajet 1h15.", lat: 42.0924, lng: 11.7955 },
        { name: "Escale Savone (Italie)", category: "Riviera Ligure", location: "Port de Savone", tag: "Forteresse du Priamar", description: "Forteresse du Priamar face à la mer.", tips: "Accessible à pied.", lat: 44.3079, lng: 8.4811 }
      );
    }
  }

  // Thème Restaurants
  const restoPlaces = isDiadema ? [
    {
      name: "Restaurant Adularia (Pont 3)",
      category: "Restaurant Principal Inclus",
      location: "Pont 3 Centenario (Centre)",
      tag: "1er Service réservé",
      description: "Votre restaurant principal sélectionné pour le dîner. Cuisine italienne et méditerranéenne soignée servie à table avec rotation quotidienne des menus régionaux.",
      tips: "Tenue soignée exigée en soirée. Boissons du forfait My Drinks incluses servies au verre.",
      phone: "Service de bord",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Restaurant Fiorentino (Ponts 3 & 4)",
      category: "Grand Restaurant Panoramique",
      location: "Ponts 3 et 4 (Poupe / Arrière)",
      tag: "Vue sur le sillage",
      description: "Spectaculaire restaurant sur deux étages offrant une vue grandiose sur l'océan et le sillage du navire.",
      tips: "Retrouvez chaque soir la carte et le menu du jour sur l'application MyCosta.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Buffet Corona Blu (Pont 10)",
      category: "Buffet Libre-service & Saveurs",
      location: "Pont 10 Hortensia (Arrière)",
      tag: "Petit-déj, Déjeuner & Dîner",
      description: "Buffet géant avec stations de pâtes fraîches, salades composées, poissons, viandes grillées et desserts gourmands. Idéal dès l'embarquement à Marseille !",
      tips: "Parfait pour un déjeuner rapide et sans contrainte d'horaire au retour d'une escale.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Pizzeria La Tavernetta (Pont 5)",
      category: "Véritable Pizzeria Italienne",
      location: "Pont 5 Eldorador (Bâbord)",
      tag: "Spécialité italienne",
      description: "Pizzas artisanales préparées avec une pâte à fermentation lente et 100% de mozzarella fraîche produite directement à bord.",
      tips: "Ambiance trattoria italienne chaleureuse. Restaurant de spécialité avec supplément.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Restaurant Japonais Teppanyaki (Pont 5)",
      category: "Show Cooking & Cuisine Japonaise",
      location: "Pont 5 Eldorador (Tribord)",
      tag: "Spectacle culinaire",
      description: "Les chefs cuisinent viandes, poissons et légumes avec virtuosité sur des plaques chauffantes sous vos yeux avec spectacle et acrobaties.",
      tips: "Réservation indispensable à l'avance sur l'application MyCosta.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Restaurant Samsara (Pont 11)",
      category: "Gastronomie Légère & Bien-être",
      location: "Pont 11 Samsara (Avant)",
      tag: "Ambiance feutrée & Zen",
      description: "Restaurant exclusif dédié à une cuisine équilibrée, innovante et raffinée dans un cadre intime.",
      tips: "Sur réservation via l'application MyCosta ou le maître d'hôtel.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    }
  ] : [
    {
      name: "Restaurant La Colombina (Pont 5)",
      category: "Restaurant Principal Inclus",
      location: "Pont 5 Taormina",
      tag: "1er Service réservé",
      description: "Votre restaurant principal sélectionné pour le dîner. Cuisine italienne et méditerranéenne soignée servie à table.",
      tips: "Tenue soignée exigée en soirée. Eau minérale et forfait boissons My Drinks inclus selon formule.",
      phone: "Service de bord",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Il Meneghino & Arlecchino (Pont 6)",
      category: "Grands Restaurants Inclus",
      location: "Pont 6 Matera",
      tag: "Service à table",
      description: "Deux superbes espaces de restauration proposant des menus inspirés de chaque région visitée par le navire avec vue sur la mer.",
      tips: "Retrouvez chaque soir la carte et le menu du jour sur l'application MyCosta.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Buffet La Sagra dei Sapori (Pont 8)",
      category: "Buffet & Saveurs du monde",
      location: "Pont 8 Capri",
      tag: "Petit-déj, Déjeuner & Dîner",
      description: "Buffet libre-service très complet avec stations de pâtes fraîches, salades composées, grillades et desserts gourmands.",
      tips: "Parfait pour un déjeuner rapide et sans contrainte d'horaire au retour d'une escale.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Pizzeria Pummid'Oro (Pont 8)",
      category: "Véritable Pizzeria Italienne",
      location: "Pont 8 Capri",
      tag: "Spécialité italienne",
      description: "Pizzas artisanales préparées avec une pâte à fermentation lente et 100% de mozzarella fraîche produite directement à bord.",
      tips: "Ambiance trattoria italienne chaleureuse. Restaurant de spécialité avec supplément à la carte.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Restaurant Japonais Teppanyaki (Pont 8)",
      category: "Show Cooking & Cuisine Japonaise",
      location: "Pont 8 Capri",
      tag: "Show culinaire",
      description: "Les chefs cuisinent viandes, poissons et légumes avec virtuosité sur des plaques chauffantes sous vos yeux.",
      tips: "Réservation indispensable à l'avance sur MyCosta.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    }
  ];

  // Thème Shopping
  const shoppingPlaces = isDiadema ? [
    {
      name: "Galerie Marchande & Duty Free (Pont 5)",
      category: "Boutiques Tax Free en mer",
      location: "Pont 5 Eldorador (Centre)",
      tag: "Prix détaxés en navigation",
      description: "Boutiques détaxées ouvertes en navigation : parfums de grandes marques, cosmétiques, maroquinerie, spiritueux et tabacs.",
      tips: "Paiement direct avec votre carte de cabine Costa. Exonération de taxes en mer.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Boutique Officielle Costa Diadema (Pont 5)",
      category: "Souvenirs de Croisière",
      location: "Pont 5 Eldorador",
      tag: "Objets collector",
      description: "Maquettes officielles du Costa Diadema, polos, casquettes, serviettes de plage griffées et magnets souvenirs.",
      tips: "Idéal pour rapporter des souvenirs du navire à vos proches.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Espace Photo & Photographes Costa (Pont 5)",
      category: "Photos & Albums souvenirs",
      location: "Pont 5 Eldorador",
      tag: "Tirages personnalisés",
      description: "Retrouvez et commandez toutes vos photos prises lors de l'embarquement, des soirées de gala et des escales.",
      tips: "Visualisez également vos clichés directement sur l'application MyCosta.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Boutique Bijouterie & Mode Italienne (Pont 5)",
      category: "Haute Horlogerie & Créateurs",
      location: "Pont 5 Eldorador",
      tag: "Grandes marques",
      description: "Sélection de montres suisses, bijoux en or et argent, lunettes de créateurs et prêt-à-porter italien pour vos soirées de gala.",
      tips: "Ventes promotionnelles flash annoncées quotidiennement dans Oggi a bordo.",
      lat: 43.3444,
      lng: 5.3488
    }
  ] : [
    {
      name: "Galleria Sanremo & Duty Free (Pont 7 & 8)",
      category: "Galerie Marchande & Tax Free",
      location: "Ponts 7 et 8 (Atrium Colosseo)",
      tag: "Prix détaxés en mer",
      description: "Boutiques détaxées ouvertes en navigation : parfums de grandes marques, maquillage, alcools, confiseries et tabacs.",
      tips: "Paiement direct avec votre carte de cabine.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Boutique Officielle Costa & Souvenirs",
      category: "Souvenirs de Croisière",
      location: "Pont 7 Positano",
      tag: "Objets collector",
      description: "Maquettes officielles, casquettes, polos, serviettes de plage griffées et magnets souvenirs.",
      tips: "Idéal pour rapporter des cadeaux de vacances.",
      lat: 43.3444,
      lng: 5.3488
    }
  ];

  // Thème Pratique & Santé
  const pratiquePlaces = [
    {
      name: isDiadema ? "Centre Médical & Infirmerie (Pont 1)" : "Centre Médical & Infirmerie (Pont 4)",
      category: "Service Sanitaire & Soins d'Urgence",
      location: isDiadema ? "Pont 1 Timone (Accès direct ascenseurs)" : "Pont 4 Palermo",
      tag: "Médecin et infirmières 24h/24",
      description: "Équipe médicale complète pour soins d'urgence, consultations, mal de mer et délivrance de médicaments d'urgence.",
      tips: "En cas d'urgence vitale, composez le numéro d'urgence directement depuis le combiné de votre cabine ou contactez la Réception. Les consultations sont à la charge du passager (couvertes par votre assurance multirisque).",
      phone: "Urgence Cabine ou Réception",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: isDiadema ? "Réception & Guest Service (Pont 3)" : "Réception & Bureau d'Information (Pont 7)",
      category: "Accueil & Assistance Voyageurs 24h",
      location: isDiadema ? "Pont 3 Centenario (Atrium Eliodoro)" : "Pont 7 Positano",
      tag: "Ouvert 24h/24 & Francophone",
      description: "Personnel francophone disponible jour et nuit pour répondre à toutes vos questions, gérer vos clés de cabine et vous assister.",
      tips: "Réunion d'information francophone le jour de l'embarquement et réunion de débarquement l'avant-dernier jour.",
      phone: "Poste Réception à bord",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: isDiadema ? "Bornes Carte Cabine (Ponts 3 & 5)" : "Bornes d'Enregistrement Carte Cabine (Pont 7)",
      category: "Paiement & Monétique de bord",
      location: isDiadema ? "Pont 3 (Réception) et Pont 5 (Casino)" : "Pont 7 à côté de la Réception",
      tag: "Aucun argent liquide à bord",
      description: "Votre carte cabine sert de moyen de paiement unique à bord. Enregistrez votre carte bancaire dès les premiers jours aux bornes automatiques.",
      tips: "Dépôt d'espèces possible (150 € minimum par personne) aux bornes. Les chèques ne sont pas acceptés à bord.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Consignes de Sécurité & Muster Station",
      category: "Sécurité Maritime Obligatoire",
      location: "Point de rassemblement indiqué au dos de votre carte Costa",
      tag: "Exercice obligatoire Jour 1",
      description: "Visionnez le récapitulatif des consignes de sécurité sur l'application MyCosta puis présentez-vous à votre Muster Station pour valider votre présence.",
      tips: "Obligatoire dès le premier jour avant l'appareillage du navire.",
      phone: "",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Permanence Accompagnatrice Voyages Girardot",
      category: "Accompagnement Privatif Girardot",
      location: isDiadema ? "Restaurant Adularia (Pont 3) & Salons de bord" : "Salons de bord",
      tag: "Permanence quotidienne",
      description: "Votre accompagnatrice Voyages Girardot est présente chaque jour pour vous informer, coordonner les rendez-vous et faciliter votre séjour.",
      tips: "Rendez-vous fixé chaque soir au dîner du 1er service.",
      phone: "03 85 42 82 50",
      lat: 43.3444,
      lng: 5.3488
    }
  ];

  // Thème Détente & Bars
  const detentePlaces = isDiadema ? [
    {
      name: "Grand Bar Orlov (Pont 4)",
      category: "Grand Salon & Musique Live",
      location: "Pont 4 Perla di Venere (Centre)",
      tag: "Orchestre & Danse tous les soirs",
      description: "Le cœur musical du paquebot : vaste salon avec piste de danse, musiciens live et ambiance festive. Inclus dans votre forfait boissons My Drinks !",
      tips: "Idéal pour prendre l'apéritif et danser après le spectacle du soir.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Country Rock Club (Pont 5)",
      category: "Bar Concert & Ambiance Rock",
      location: "Pont 5 Eldorador (Bâbord)",
      tag: "Concerts guitare & Rock",
      description: "Le repaire des amateurs de bonne musique live, guitares électriques et cocktails dans une ambiance chaleureuse.",
      tips: "Concerts acoustiques et reprises de classiques du rock en soirée.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Brasserie Dresden Green (Pont 5)",
      category: "Bières Artisanales du Bord",
      location: "Pont 5 Eldorador (Bâbord)",
      tag: "Atmosphère bavaroise",
      description: "Véritable brasserie à bord proposant bières artisanales à la pression, bretzels et snacks salés.",
      tips: "Parfait pour se retrouver entre amis après une longue escale.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Vinoteca Gran Duca di Toscana (Pont 5)",
      category: "Bar à Vins & Dégustations",
      location: "Pont 5 Eldorador (Tribord)",
      tag: "Grands Crus d'Italie",
      description: "Bar à vins réputé servant au verre les meilleurs cépages de Toscane, du Piémont et de Vénétie, accompagnés de tapas italiennes.",
      tips: "Dégustations guidées organisées par le sommelier du bord.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Bar Lido Diana (Pont 10)",
      category: "Bar Piscine & Verrière",
      location: "Pont 10 Hortensia (Centre)",
      tag: "Piscine couverte",
      description: "Boissons rafraîchissantes, cocktails et glaces au bord de la piscine couverte sous la verrière amovible.",
      tips: "Ouvert toute la journée pour se désaltérer au retour des baignades.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Glacier Artisanal Amarillo (Pont 10)",
      category: "Glaces & Desserts italiens",
      location: "Pont 10 Hortensia",
      tag: "Glaces faites à bord",
      description: "Délicieuses glaces italiennes produites chaque jour à bord avec des ingrédients bio de qualité, gaufres et crêpes gourmandes.",
      tips: "Le plaisir incontournable de l'après-midi pour petits et grands !",
      lat: 43.3444,
      lng: 5.3488
    }
  ] : [
    {
      name: "Campari Bar (Pont 7)",
      category: "Bar Cocktail Design",
      location: "Pont 7 Positano (Colosseo)",
      tag: "Aperitivo à l'italienne",
      description: "Bar emblématique au design rouge passion offrant une vue plongeante sur les spectacles de l'atrium Colosseo.",
      tips: "Idéal pour déguster un Negroni ou un Campari Spritz.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Aperol Spritz Bar (Pont 17)",
      category: "Bar Piscine & Vue Mer",
      location: "Pont 17 Bellagio",
      tag: "Coucher de soleil",
      description: "Bar en plein air les yeux dans le bleu méditerranéen. Dégustez votre Spritz face au sillage du navire.",
      tips: "Inclus dans votre forfait My Drinks !",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Grand Bar Mastroianni (Pont 6)",
      category: "Musique Live & Soirées dansantes",
      location: "Pont 6 Matera",
      tag: "Orchestre & Danse",
      description: "Immense salon central avec grande scène, orchestre live tous les soirs, piste de danse et ambiance très chaleureuse.",
      tips: "Rendez-vous incontournable pour prendre un verre.",
      lat: 43.3444,
      lng: 5.3488
    }
  ];

  // Thème Transports & Ponts
  const transportPlaces = isDiadema ? [
    {
      name: "Organisation des 20 Ponts (15 ponts passagers)",
      category: "Plan d'ensemble du Navire",
      location: "Du Pont 1 Timone au Pont 15 Smeraldo",
      tag: "Architecture Joseph Farcus",
      description: "Pont 1 (Timone/Médical), Pont 2 (Sara), Pont 3 (Centenario/Adularia/Réception), Pont 4 (Perla di Venere/Grand Bar), Pont 5 (Eldorador/Promenade 500m/Boutiques), Ponts 6-9 (Cabines), Pont 10 (Hortensia/Corona Blu/Lido Diana), Pont 11 (Samsara Spa), Pont 14 (Rubino/Sports), Pont 15 (Smeraldo/Solarium).",
      tips: "Utilisez le plan interactif et le calculateur d'itinéraires intégrés dans votre carnet pour vous déplacer aisément hors-connexion.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Promenade Extérieure 'La Passeggiata' (Pont 5)",
      category: "Promenade Panoramique Maritime",
      location: "Pont 5 Eldorador",
      tag: "500m faisant le tour complet",
      description: "Véritable terrasse de promenade faisant tout le tour du Costa Diadema, bordée de bains à remous suspendus au-dessus des flots.",
      tips: "Magique à l'heure du coucher du soleil ou lors des manœuvres portuaires.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Samsara Spa & Balnéothérapie (Pont 11)",
      category: "Espace Thermal de 6 200 m²",
      location: "Ponts 11 et 12 Samsara",
      tag: "4 niveaux de bien-être",
      description: "Piscine thermale de balnéothérapie, hammam, sauna panoramique finlandais, cabines de soins et salle de fitness Technogym.",
      tips: "Accès inclus pour les cabines et suites Samsara, forfaits journée disponibles pour tous les passagers.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Application Mobile 'MyCosta' (Wi-Fi gratuit du bord)",
      category: "Guide de Poche & Déplacements",
      location: "Sur votre smartphone (AppStore / Google Play)",
      tag: "Indispensable & Gratuit à bord",
      description: "Permet de consulter le journal 'Oggi a bordo', le plan interactif des ponts, réserver vos excursions et suivre vos dépenses.",
      tips: "Connectez-vous au réseau Wi-Fi gratuit du navire dès votre arrivée sans consommer votre forfait data terrestre.",
      phone: "Gratuit en Wi-Fi bord",
      lat: 43.3444,
      lng: 5.3488
    }
  ] : [
    {
      name: "Organisation des 20 Ponts (16 ponts passagers)",
      category: "Plan d'ensemble du Navire",
      location: "Du Pont 4 au Pont 20",
      tag: "Nommés d'après les villes italiennes",
      description: "Pont 4 (Palermo), Pont 5 (Taormina), Pont 6 (Matera), Pont 7 (Positano), Pont 8 (Capri), Ponts 9-15 (Cabines), Pont 16 (Como/Spa), Pont 17 (Bellagio), Pont 18 (Torino), Pont 19 (Cortina/Volare).",
      tips: "Des plans interactifs tactiles sont disposés devant chaque cage d'ascenseur.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Passerelle Panoramique 'Volare' (Pont 19)",
      category: "Promenade Panoramique",
      location: "Pont 19 Cortina",
      tag: "Point culminant à 65m",
      description: "Promenade extérieure suspendue offrant une vue spectaculaire à 360 degrés sur la mer et le ciel, avec sol de verre au-dessus du vide.",
      tips: "Inoubliable au coucher de soleil.",
      lat: 43.3444,
      lng: 5.3488
    },
    {
      name: "Application Mobile 'MyCosta' (Wi-Fi gratuit du bord)",
      category: "Guide de Poche & Déplacements",
      location: "Sur votre smartphone",
      tag: "Gratuit à bord",
      description: "Journal Oggi a bordo, menus, réservations et solde.",
      tips: "Wi-Fi gratuit du bord.",
      lat: 43.3444,
      lng: 5.3488
    }
  ];

  return {
    welcomeMessage: `Bienvenue à bord du ${ship} ! Je suis votre Concierge de bord Voyages Girardot. Retrouvez ici les restaurants, bars, boutiques, infirmerie et le plan des ponts pour profiter pleinement de votre croisière.`,
    themes: [
      {
        id: "resto",
        label: "Restaurants du navire",
        icon: "utensils",
        color: "#e11d48",
        enabled: true,
        description: `Espaces de restauration à bord du ${ship} : tables incluses, buffets et restaurants de spécialités.`,
        places: restoPlaces
      },
      {
        id: "visites",
        label: "Synthèse des Excursions & Escales",
        icon: "compass",
        color: "#059669",
        enabled: true,
        description: "Temps forts et excursions proposées à chaque escale portuaire de votre itinéraire.",
        places: excursionsPlaces
      },
      {
        id: "shopping",
        label: "Boutiques & Shopping du navire",
        icon: "bag-shopping",
        color: "#d97706",
        enabled: true,
        description: `Galeries marchandes détaxées et souvenirs officiels à bord du ${ship}.`,
        places: shoppingPlaces
      },
      {
        id: "pratique",
        label: "Infirmerie & Services de bord",
        icon: "shield-heart",
        color: "#2563eb",
        enabled: true,
        description: "Centre médical, infirmerie du bord, formalités sanitaires et paiement par carte cabine.",
        places: pratiquePlaces
      },
      {
        id: "detente",
        label: "Bars & Salons du navire",
        icon: "martini-glass",
        color: "#9333ea",
        enabled: true,
        description: `Les bars et salons thématiques du ${ship} inclus dans votre forfait boissons.`,
        places: detentePlaces
      },
      {
        id: "transports",
        label: "Plan du navire & Ponts",
        icon: "ship",
        color: "#0891b2",
        enabled: true,
        description: `Plan d'ensemble des ponts du ${ship}, passerelles et orientation à bord.`,
        places: transportPlaces
      }
    ]
  };
}

// Moteur heuristique d'analyse et de structuration du programme Girardot
// -----------------------------------------------------------------------------
// EXTRACTION DES INFOS PRATIQUES DE DESTINATION (CIRCUITS TERRESTRES)
// -----------------------------------------------------------------------------
function extractDestinationPracticalInfoFromText(text) {
  const sections = [
    { title: "Monnaie & Devises", icon: "coins", field: "money", patterns: [/(?:^|\n)\s*Monnaie(?:\s*nationale|\s*locale)?\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i, /(?:^|\n)\s*Devises?\s*\n+([^\n]+(?:\n[^\n]+){0,3})/i] },
    { title: "Électricité & Prises", icon: "plug", field: "electricity", patterns: [/(?:^|\n)\s*[EÉ]lectricit[ée]\s*\n+([^\n]+(?:\n[^\n]+){0,3})/i, /(?:^|\n)\s*Prises?\s*[\n:]+([^\n]+(?:\n[^\n]+){0,2})/i] },
    { title: "Décalage horaire", icon: "clock", field: "timezone", patterns: [/(?:^|\n)\s*D[ée]calage horaire\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i] },
    { title: "Climat & Météo", icon: "cloud-sun", field: "climate", patterns: [/(?:^|\n)\s*Climat\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i] },
    { title: "Vêtements & Valise", icon: "suitcase-rolling", field: "clothing", patterns: [/(?:^|\n)\s*Valise\s*\n+([^\n]+(?:\n[^\n]+){0,5})/i, /(?:^|\n)\s*V[êe]tements?(?:\s*conseill[ée]s)?\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i] },
    { title: "Pourboires", icon: "hand-holding-dollar", field: "tips", patterns: [/(?:^|\n)\s*Pourboires?\s*\n+(?:Suggestions pour les pourboires\s*:\s*)?([^\n]+(?:\n[^\n]+){0,4})/i, /Les pourboires sont laiss[ée]s [àa] discr[ée]tion[\s\S]*?(?=\n\n|\.\s+[A-Z]|$)/i] },
    { title: "Santé & Alimentation", icon: "shield-heart", field: "health", patterns: [/(?:^|\n)\s*Sant[ée]\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i, /(?:^|\n)\s*Cuisine\s*\n+([^\n]+(?:\n[^\n]+){0,4})/i] },
    { title: "Téléphone & Réseau", icon: "phone", field: "phone", patterns: [/(?:^|\n)\s*T[ée]l[ée]phone\s*\n+([^\n]+(?:\n[^\n]+){0,3})/i] },
    { title: "Formalités d'entrée", icon: "passport", field: "formalities", patterns: [/(?:^|\n)\s*Formalit[ée]s(?:\s*indispensables)?\s*\n+([^\n]+(?:\n[^\n]+){0,3})/i] }
  ];

  const tipsList = [];
  const practicalInfo = {};

  sections.forEach(sec => {
    let matchedText = "";
    for (const pat of sec.patterns) {
      const m = text.match(pat);
      if (m) {
        matchedText = (m[1] || m[0]).trim().replace(/\r?\n+/g, ' ');
        break;
      }
    }
    if (matchedText) {
      practicalInfo[sec.field] = matchedText;
      tipsList.push({
        title: sec.title,
        icon: sec.icon,
        content: matchedText
      });
    }
  });

  return { tipsList, practicalInfo };
}

const DESTINATION_CITY_COORDINATES = {
  "san cristobal de las casas": { lat: 16.7370, lng: -92.6376, city: "San Cristóbal de las Casas" },
  "san cristobal": { lat: 16.7370, lng: -92.6376, city: "San Cristóbal de las Casas" },
  "oaxaca de juarez": { lat: 17.0732, lng: -96.7266, city: "Oaxaca de Juárez" },
  "oaxaca": { lat: 17.0732, lng: -96.7266, city: "Oaxaca" },
  "puebla": { lat: 19.0414, lng: -98.2063, city: "Puebla" },
  "ixtepec": { lat: 16.5593, lng: -95.0975, city: "Ixtepec" },
  "palenque": { lat: 17.5095, lng: -91.9825, city: "Palenque" },
  "campeche": { lat: 19.8301, lng: -90.5349, city: "Campeche" },
  "merida": { lat: 20.9674, lng: -89.5926, city: "Mérida" },
  "valladolid": { lat: 20.6896, lng: -88.2024, city: "Valladolid" },
  "cancun": { lat: 21.1619, lng: -86.8515, city: "Cancún" },
  "tulum": { lat: 20.2114, lng: -87.4654, city: "Tulum" },
  "celestun": { lat: 20.8600, lng: -90.3980, city: "Celestún" },
  "chichen itza": { lat: 20.6843, lng: -88.5678, city: "Chichén Itzá" },
  "teotihuacan": { lat: 19.6925, lng: -98.8437, city: "Teotihuacán" },
  "mexico cdmx": { lat: 19.4326, lng: -99.1332, city: "Mexico (CDMX)" },
  "cdmx": { lat: 19.4326, lng: -99.1332, city: "Mexico (CDMX)" },
  "mexico": { lat: 19.4326, lng: -99.1332, city: "Mexico (CDMX)" },
  "chicago": { lat: 41.8781, lng: -87.6298, city: "Chicago" },
  "san francisco": { lat: 37.7749, lng: -122.4194, city: "San Francisco" },
  "paris": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "marseille": { lat: 43.2965, lng: 5.3698, city: "Marseille" },
  "barcelone": { lat: 41.3851, lng: 2.1734, city: "Barcelone" },
  "tanger": { lat: 35.7878, lng: -5.8118, city: "Tanger" },
  "casablanca": { lat: 33.6062, lng: -7.6186, city: "Casablanca" },
  "cadix": { lat: 36.5271, lng: -6.2886, city: "Cadix" },
  "gibraltar": { lat: 36.1408, lng: -5.3536, city: "Gibraltar" },
  "malaga": { lat: 36.7213, lng: -4.4214, city: "Malaga" },
  "seville": { lat: 37.3891, lng: -5.9845, city: "Séville" },
  "savone": { lat: 44.3079, lng: 8.4811, city: "Savone" },
  "palerme": { lat: 38.1157, lng: 13.3615, city: "Palerme" },
  "cagliari": { lat: 39.2238, lng: 9.1217, city: "Cagliari" },
  "civitavecchia": { lat: 42.0924, lng: 11.7954, city: "Civitavecchia / Rome" },
  "genes": { lat: 44.4056, lng: 8.9463, city: "Gênes" },
  "naples": { lat: 40.8518, lng: 14.2681, city: "Naples" },
  "le cap": { lat: -33.9249, lng: 18.4241, city: "Le Cap" },
  "pretoria": { lat: -25.7479, lng: 28.2293, city: "Pretoria" },
  "johannesburg": { lat: -26.2041, lng: 28.0473, city: "Johannesburg" },
  "new delhi": { lat: 28.6139, lng: 77.2090, city: "New Delhi" },
  "delhi": { lat: 28.6139, lng: 77.2090, city: "Delhi" },
  "mandawa": { lat: 28.0551, lng: 75.1485, city: "Mandawa" },
  "bikaner": { lat: 28.0229, lng: 73.3119, city: "Bikaner" },
  "jaisalmer": { lat: 26.9157, lng: 70.9083, city: "Jaisalmer" },
  "sam": { lat: 26.8322, lng: 70.5050, city: "Dunes de Sam" },
  "jodhpur": { lat: 26.2389, lng: 73.0243, city: "Jodhpur" },
  "luni": { lat: 26.1022, lng: 73.0189, city: "Luni" },
  "jaipur": { lat: 26.9124, lng: 75.7873, city: "Jaipur" },
  "abhaneri": { lat: 27.0094, lng: 76.6025, city: "Abhaneri" },
  "agra": { lat: 27.1767, lng: 78.0081, city: "Agra (Taj Mahal)" },
  "jhansi": { lat: 25.4484, lng: 78.5685, city: "Jhansi" },
  "orchha": { lat: 25.3516, lng: 78.6433, city: "Orchha" },
  "orccha": { lat: 25.3516, lng: 78.6433, city: "Orchha" },
  "khajuraho": { lat: 24.8318, lng: 79.9199, city: "Khajuraho" },
  "varanasi": { lat: 25.3176, lng: 82.9739, city: "Varanasi (Bénarès)" },
  "benares": { lat: 25.3176, lng: 82.9739, city: "Varanasi (Bénarès)" },
  "sarnath": { lat: 25.3716, lng: 83.0252, city: "Sarnath" },
  "geneve": { lat: 46.2044, lng: 6.1432, city: "Genève" }
};

function separateDayTitleAndText(rawText) {
  let cleaned = (rawText || "").replace(/^[•\-\*·\s]+/, '').trim();
  cleaned = cleaned.replace(/^[•\-\*·\s]+/, '').trim();

  const reg = /(?:^|\s+)(Jour\s+consacr[eé]|Visite|Route|D[ée]part|D[ée]couverte|Matin[ée]e|Apr[èe]s-midi|Accueil|Transfert|Embarquement|Envol|Arriv[ée]e)(?![a-zA-Zà-ÿÀ-Ý])/i;
  const m = cleaned.match(reg);
  if (m && m.index > 2) {
    const candidateTitle = cleaned.slice(0, m.index).replace(/[•:\-–—."'«»\s]+$/, '').trim();
    const candidateDesc = cleaned.slice(m.index).trim();
    if (candidateTitle.length >= 2 && candidateTitle.length <= 70) {
      return { title: candidateTitle, extraDesc: candidateDesc };
    }
  }

  const doubleSpaceMatch = cleaned.match(/^([A-ZÀ-Ý0-9][\w\s'’/&,.-]{1,60}?)\s{2,}(.*)$/s);
  if (doubleSpaceMatch) {
    const candidateTitle = doubleSpaceMatch[1].trim();
    const rest = doubleSpaceMatch[2].trim();
    if (candidateTitle.includes('-') || candidateTitle.includes('–') || candidateTitle.split(/\s+/).length <= 6) {
      return { title: candidateTitle, extraDesc: rest };
    }
  }

  if (cleaned.length <= 65) return { title: cleaned, extraDesc: '' };
  return { title: cleaned.slice(0, 50).trim(), extraDesc: cleaned.slice(50).trim() };
}

function extractVisitsFromDay(description, dayTitle) {
  const visits = [];
  if (!description) {
    return [{
      time: "",
      title: dayTitle || "Étape du jour",
      subtitle: "Déroulé de la journée.",
      icon: "route"
    }];
  }

  const rawItems = description
    .split(/(?:\r?\n|(?<=[.!?])\s+)/)
    .map(s => s.replace(/^[•\-\*·\s]+/, '').trim())
    .filter(s => s.length > 8);

  const filterOutIntro = rawItems.filter(s => {
    const l = (s || "").normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return !l.startsWith('pays fabuleux') &&
           !l.startsWith('trois mille ans') &&
           !l.startsWith('le voyage n’etant pas une science exacte') &&
           !l.startsWith('le voyage n\'etant pas une science exacte') &&
           !l.startsWith('nous attirons votre attention') &&
           !l.startsWith('sous reserve de modification');
  });

  const candidates = filterOutIntro.length > 0 ? filterOutIntro : rawItems;

  candidates.slice(0, 5).forEach(item => {
    let detectedTime = "";
    const timeMatch = item.match(/\b([01]?\d|2[0-3])[hH:]([0-5]\d)\b/) || item.match(/\b([01]?\d|2[0-3])\s*[hH]\b/);
    if (timeMatch) {
      const h = timeMatch[1].padStart(2, '0');
      const m = timeMatch[2] ? timeMatch[2] : "00";
      detectedTime = `${h}:${m}`;
    }

    let cleanTitle = item.replace(/^(?:[àa]\s*)?(?:[01]?\d|2[0-3])[hH:][0-5]\d\s*[:–-]?\s*/i, '').trim();
    if (cleanTitle.length > 60) {
      const commaIdx = cleanTitle.indexOf(',');
      if (commaIdx > 15 && commaIdx < 60) {
        cleanTitle = cleanTitle.slice(0, commaIdx).trim();
      } else {
        cleanTitle = cleanTitle.slice(0, 58).replace(/[.,;:!?\s]+$/, '') + '...';
      }
    }

    visits.push({
      time: detectedTime,
      title: cleanTitle,
      subtitle: item,
      icon: (typeof detectIconForText === 'function') ? detectIconForText(item) : 'location-dot'
    });
  });

  return visits.length > 0 ? visits : [{
    time: "",
    title: dayTitle,
    subtitle: description,
    icon: "route"
  }];
}

function processExtractedTextToTrip(text, sourceName) {
  const statusEl = document.getElementById('pdf-import-status');
  const previewBox = document.getElementById('pdf-preview-container');
  const previewSummary = document.getElementById('pdf-preview-summary');
  const btnDownload = document.getElementById('btn-download-parsed-json');
  const btnApply = document.getElementById('btn-apply-parsed-trip');

  // Choix explicite du profil avant import
  const profileSelect = document.getElementById('pdf-import-profile-select');
  const chosenProfile = profileSelect ? profileSelect.value : 'guided';

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Détection du Titre et Dates globales
  let detectedTitle = "";
  let detectedSubtitle = "Circuit exclusif Voyages Girardot";
  let detectedDates = "";
  let detectedStartDate = "";
  let detectedEndDate = "";

  // Analyse multi-lignes pour les dates globales de voyage
  const headerBlock = rawLines.slice(0, 12).join(" ");
  const datesMatch = headerBlock.match(/((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4})\s*[-–—]\s*((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4})/i);
  if (datesMatch) {
    detectedDates = `${datesMatch[1]} au ${datesMatch[2]}`;
  }

  // Recherche de motif de carnet "Votre carnet de voyage X"
  for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
    const l = rawLines[i];
    const carnetMatch = l.match(/Votre carnet de voyage\s+(.*)/i);
    if (carnetMatch) {
      detectedTitle = carnetMatch[1].trim();
    }
    const subMatch = l.match(/De\s+([A-Za-zÀ-Ý\s-]+)\s+au\s+([A-Za-zÀ-Ý\s-]+(?:\s+en passant par\s+[A-Za-zÀ-Ý\s-]+)?)/i);
    if (subMatch) {
      detectedSubtitle = subMatch[0].trim();
    } else if (l.includes('|') && (l.toLowerCase().includes('croisière') || l.toLowerCase().includes('bord du') || l.toLowerCase().includes('espagne') || l.toLowerCase().includes('italie') || l.toLowerCase().includes('sicile'))) {
      detectedSubtitle = l.trim();
    }
  }

  // Nettoyage du titre si la date est accolée
  if (detectedTitle) {
    detectedTitle = detectedTitle.replace(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b.*$/i, '').trim();
    detectedTitle = detectedTitle.replace(/\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}.*$/i, '').trim();
  }

  if (!detectedTitle && sourceName && !sourceName.toLowerCase().includes("programme importé")) {
    detectedTitle = sourceName.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim();
  }
  if (!detectedTitle && rawLines.length > 0) {
    detectedTitle = rawLines[0].slice(0, 60);
  }

  // 2. Détection précise des étapes "Jour X"
  const itinerary = [];
  let currentDay = null;
  const dayHeaderRegex = /^(?:Jour|J)\s*(\d{1,2})\b(?:\s*[•:\-–—."'«»]\s*(.*))?$/i;
  const altDayRegex = /^(?:1er|\d{1,2}(?:er|[eè]me)?)\s+jour\b(?:\s*[•:\-–—."'«»]\s*(.*))?$/i;

  // Mots qui marquent la FIN définitive du déroulé des étapes (SEULEMENT APRÈS AVOIR COMMENCÉ À TROUVER DES JOURS)
  const endOfItineraryKeywords = [
    "coordonnées de vos hôtels", "coordonnees de vos hotels", "vos hôtels", "vos hotels",
    "le voyage n’étant pas une science exacte", "le voyage n'etant pas une science exacte",
    "votre accompagnatrice", "votre guide", "vos contacts",
    "formalités indispensables", "formalites indispensables", "bon à savoir", "bon a savoir",
    "assurance multirisque"
  ];

  const knownPortCoordinates = {
    "marseille": { city: "Marseille", lat: 43.2965, lng: 5.3698 },
    "barcelone": { city: "Barcelone", lat: 41.3851, lng: 2.1734 },
    "tanger": { city: "Tanger (Maroc)", lat: 35.7878, lng: -5.8118 },
    "casablanca": { city: "Casablanca (Maroc)", lat: 33.6062, lng: -7.6186 },
    "cadix": { city: "Cadix (Espagne)", lat: 36.5271, lng: -6.2886 },
    "cadiz": { city: "Cadix (Espagne)", lat: 36.5271, lng: -6.2886 },
    "gibraltar": { city: "Gibraltar (Royaume-Uni)", lat: 36.1408, lng: -5.3536 },
    "malaga": { city: "Malaga (Espagne)", lat: 36.7213, lng: -4.4214 },
    "seville": { city: "Séville (Espagne)", lat: 37.3891, lng: -5.9845 },
    "savone": { city: "Savone (Italie)", lat: 44.3079, lng: 8.4811 },
    "palerme": { city: "Palerme (Italie)", lat: 38.1157, lng: 13.3615 },
    "cagliari": { city: "Cagliari (Italie)", lat: 39.2238, lng: 9.1217 },
    "civitavecchia": { city: "Civitavecchia / Rome (Italie)", lat: 42.0924, lng: 11.7954 },
    "genes": { city: "Gênes (Italie)", lat: 44.4056, lng: 8.9463 },
    "naples": { city: "Naples (Italie)", lat: 40.8518, lng: 14.2681 }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lowerLine = line.toLowerCase();

    // Arrêt uniquement si nous avons déjà trouvé au moins un jour ET que nous atteignons la section finale
    if (currentDay !== null || itinerary.length > 0) {
      if (endOfItineraryKeywords.some(kw => lowerLine.startsWith(kw))) {
        break;
      }
    }

    let matchDay = line.match(dayHeaderRegex);
    let dayNum = 0;
    let dayTitle = "";

    if (matchDay) {
      dayNum = parseInt(matchDay[1], 10);
      dayTitle = (matchDay[2] || "").trim();
    } else {
      const matchAlt = line.match(altDayRegex);
      if (matchAlt) {
        dayNum = parseInt(matchAlt[0].match(/\d+/)?.[0] || "1", 10);
        dayTitle = (matchAlt[1] || "").trim();
        matchDay = matchAlt;
      }
    }

    if (matchDay) {
      if (currentDay) {
        itinerary.push(currentDay);
      }

      if (!dayTitle && i + 1 < rawLines.length && !dayHeaderRegex.test(rawLines[i + 1]) && !altDayRegex.test(rawLines[i + 1])) {
        dayTitle = rawLines[i + 1];
        i++;
      }

      const separated = (typeof separateDayTitleAndText === 'function') 
        ? separateDayTitleAndText(dayTitle) 
        : { title: dayTitle, extraDesc: "" };

      currentDay = {
        day: dayNum,
        title: separated.title || `Étape Jour ${dayNum}`,
        city: "",
        lat: 0,
        lng: 0,
        highlight: "", // Thématique / Point fort : reste vide et sera rempli à la main par l'administrateur
        description: separated.extraDesc || "",
        weather: "",
        dateStr: `Jour ${dayNum}`,
        timeline: []
      };
    } else if (currentDay) {
      if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
        const visitTitle = line.replace(/^[•\-\*]\s*/, '').trim();
        if (visitTitle.length > 2) {
          let itemTime = "";
          const tm = visitTitle.match(/\b([01]?\d|2[0-3])[hH:]([0-5]\d)\b/) || visitTitle.match(/\b([01]?\d|2[0-3])\s*[hH]\b/);
          if (tm) {
            itemTime = `${tm[1].padStart(2, '0')}:${tm[2] ? tm[2] : '00'}`;
          }
          currentDay.timeline.push({
            time: itemTime, // Pas d'horaires inventés si non spécifiés dans le document
            title: visitTitle,
            subtitle: "Visite ou temps fort au programme.",
            icon: detectIconForText(visitTitle)
          });
        }
        currentDay.description += (currentDay.description ? " " : "") + visitTitle;
      } else {
        currentDay.description += (currentDay.description ? " " : "") + line;
      }
    }
  }

  if (currentDay) {
    itinerary.push(currentDay);
  }

  // Clés de coordonnées triées par spécificité (les noms les plus longs d'abord)
  const sortedCoordsKeys = (typeof DESTINATION_CITY_COORDINATES !== 'undefined') 
    ? Object.keys(DESTINATION_CITY_COORDINATES).sort((a, b) => b.length - a.length)
    : [];

  itinerary.forEach(d => {
    // Si aucune visite extraite par puces, extraire les étapes depuis les phrases du descriptif (SANS inventer d'horaires)
    if (!d.timeline || d.timeline.length === 0) {
      if (typeof extractVisitsFromDay === 'function') {
        d.timeline = extractVisitsFromDay(d.description, d.title);
      } else {
        d.timeline = [{
          time: "",
          title: d.title,
          subtitle: d.description || "Déroulé de la journée.",
          icon: "route"
        }];
      }
    }

    // Résolution précise de la Ville et des coordonnées GPS de l'étape
    const normSearch = (d.title + " " + d.description).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const k of sortedCoordsKeys) {
      if (normSearch.includes(k)) {
        const c = DESTINATION_CITY_COORDINATES[k];
        d.city = c.city;
        d.lat = c.lat;
        d.lng = c.lng;
        break;
      }
    }

    // Vérification des ports connus pour croisières
    if (!d.lat && !d.lng) {
      for (const [portKey, portData] of Object.entries(knownPortCoordinates)) {
        if (normSearch.includes(portKey)) {
          d.city = portData.city;
          d.lat = portData.lat;
          d.lng = portData.lng;
          break;
        }
      }
    }

    if (!d.city) d.city = extractProbableCity(d.title);
  });

  // 3. Détection des Hôtels avec Dates, Adresses complètes et coordonnées GPS
  const hotels = [];
  const hotelSectionRegex = /(?:Coordonn[ée]es de (?:vos|votre) h[ôo]tels?|(?:^|\n)\s*Vos h[ôo]tels?)\s*(?:sous r[ée]serve[^\n]*)?\n*([\s\S]*?)(?=(?:Votre accompagnat|Votre guide|Votre contact|Vos contacts|Formalit[ée]s|Bon [àa] savoir|Assurance|$))/i;
  const hotelSectionMatch = text.match(hotelSectionRegex);
  const hotelTextToAnalyze = hotelSectionMatch ? hotelSectionMatch[1] : text;

  const hotelBlockRegex = /du\s+(\d{1,2}(?:\s+[a-zà-ÿ]+)?\s+au\s+\d{1,2}\s+[a-zà-ÿ]+)([\s\S]*?)(?=(?:du\s+\d{1,2}\s+au|$))/gi;
  let hbMatch;

  while ((hbMatch = hotelBlockRegex.exec(hotelTextToAnalyze)) !== null) {
    const datesStay = "Du " + hbMatch[1].trim();
    const blockContent = hbMatch[2].trim();
    const bLines = blockContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !/^sous réserve/i.test(l));

    if (bLines.length > 0) {
      const hotelName = bLines[0];
      let addressParts = [];
      let phone = "";

      for (let j = 1; j < bLines.length; j++) {
        const l = bLines[j];
        if (/^t[ée]l\.?\s*:/i.test(l)) {
          phone = l.replace(/^t[ée]l\.?\s*:\s*/i, '').trim();
        } else {
          addressParts.push(l);
        }
      }

      const fullAddress = addressParts.join(", ") || hotelName;
      const lastAddrLine = addressParts[addressParts.length - 1] || "";
      let detectedCity = lastAddrLine.replace(/^\d{4,5}\s+/, '').replace(/,\s*[A-Z]{2,4}$/, '').trim();
      let lat = 0;
      let lng = 0;

      const normAddr = fullAddress.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normDetectedCity = (detectedCity || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normSearch = (hotelName + " " + fullAddress + " " + detectedCity).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      // 1. Tester d'abord la ville détectée dans la dernière ligne d'adresse
      let matchedCoord = null;
      for (const k of sortedCoordsKeys) {
        if (normDetectedCity && (normDetectedCity.includes(k) || k.includes(normDetectedCity))) {
          matchedCoord = DESTINATION_CITY_COORDINATES[k];
          break;
        }
      }

      // 2. Sinon chercher dans l'adresse complète (en évitant le piège du nom de rue ex: "Paris No. 9" à Mexico)
      if (!matchedCoord) {
        for (const k of sortedCoordsKeys) {
          if (k === 'paris' && (normAddr.includes('mexico') || normAddr.includes('cdmx'))) continue;
          if (normSearch.includes(k)) {
            matchedCoord = DESTINATION_CITY_COORDINATES[k];
            break;
          }
        }
      }

      if (matchedCoord) {
        lat = matchedCoord.lat;
        lng = matchedCoord.lng;
        detectedCity = matchedCoord.city;
      }

      hotels.push({
        name: hotelName,
        dates: datesStay,
        city: detectedCity || "Étape du circuit",
        address: fullAddress,
        phone: phone,
        lat: lat,
        lng: lng,
        notes: "Hôtel sélectionné par Voyages Girardot"
      });
    }
  }

  // Fallback si aucun bloc avec date "Du ... au ..." n'a été trouvé mais qu'un hôtel est présent dans la section
  if (hotels.length === 0 && hotelSectionMatch && hotelSectionMatch[1].trim()) {
    const rawLines = hotelSectionMatch[1].split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^sous r[ée]serve/i.test(l) && !/^coordonn[ée]es/i.test(l));

    if (rawLines.length > 0) {
      const hotelName = rawLines[0];
      let addressParts = [];
      let phone = "";
      for (let j = 1; j < rawLines.length; j++) {
        const l = rawLines[j];
        if (/^t[ée]l\.?\s*:/i.test(l)) {
          phone = l.replace(/^t[ée]l\.?\s*:\s*/i, '').trim();
        } else {
          addressParts.push(l);
        }
      }
      const fullAddress = addressParts.join(", ") || hotelName;
      const lastAddrLine = addressParts[addressParts.length - 1] || "";
      let detectedCity = lastAddrLine.replace(/^\d{4,6}\s+/, '').replace(/-\d{4,6}$/, '').replace(/,\s*[A-Z]{2,4}$/, '').trim();
      let lat = 0;
      let lng = 0;

      const normAddr = fullAddress.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normDetectedCity = (detectedCity || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normSearch = (hotelName + " " + fullAddress + " " + detectedCity).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      let matchedCoord = null;
      for (const k of sortedCoordsKeys) {
        if (normDetectedCity && (normDetectedCity.includes(k) || k.includes(normDetectedCity))) {
          matchedCoord = DESTINATION_CITY_COORDINATES[k];
          break;
        }
      }
      if (!matchedCoord) {
        for (const k of sortedCoordsKeys) {
          if (k === 'paris' && (normAddr.includes('mexico') || normAddr.includes('cdmx'))) continue;
          if (normSearch.includes(k)) {
            matchedCoord = DESTINATION_CITY_COORDINATES[k];
            break;
          }
        }
      }
      if (matchedCoord) {
        lat = matchedCoord.lat;
        lng = matchedCoord.lng;
        detectedCity = matchedCoord.city;
      }

      hotels.push({
        name: hotelName,
        dates: detectedDates || "Pendant le séjour",
        city: detectedCity || "Étape du circuit",
        address: fullAddress,
        phone: phone,
        lat: lat,
        lng: lng,
        notes: "Hôtel sélectionné par Voyages Girardot"
      });
    }
  }

  // 4. Détermination Intelligente du Profil & Croisière vs Circuit Terrestre
  let isCruise = false;
  let conciergeMode = 'guided';

  const shipMatch = text.match(/(?:à bord du|a bord du|navire amiral de|navire|bateau)\s+([A-ZÀ-Ý][\w\s'-]{2,25})(?=[!\r\n,•|]|$)/i)
                 || text.match(/(?:Votre bateau[\s\r\n]+(?:sous réserve de modification[\s\r\n]+)?(?:Données non contractuelles[\s\r\n]+)?)([A-ZÀ-Ý][\w\s'-]{2,25})/i)
                 || text.match(/\b(Costa\s+[A-ZÀ-Ý][a-zà-ÿ]+|MSC\s+[A-ZÀ-Ý][a-zà-ÿ]+|CroisiEurope\s+[A-ZÀ-Ý][a-zà-ÿ]+|MS\s+[A-ZÀ-Ý][a-zà-ÿ]+|Le\s+Boréal|L'Austral|Le\s+Soléal|Le\s+Lyrial|Le\s+Commandant\s+Charcot|Le\s+Polarfront|Polarfront|Le\s+Nanook|Ocean\s+Nova)\b/i);
  let detectedShip = "";
  if (shipMatch) {
    detectedShip = shipMatch[1].split(/\r?\n|!|[•|]/)[0].trim();
  }
  if (!detectedShip && detectedSubtitle && /à bord du\s+([^|]+)/i.test(detectedSubtitle)) {
    detectedShip = detectedSubtitle.match(/à bord du\s+([^|]+)/i)[1].trim();
  }

  if (chosenProfile === 'cruise') {
    isCruise = true;
    conciergeMode = 'cruise';
  } else if (chosenProfile === 'guided' || chosenProfile === 'full' || chosenProfile === 'disabled') {
    isCruise = false;
    conciergeMode = chosenProfile;
  } else {
    // Mode 'auto' : détection contextuelle rigoureuse
    const titleHasCruise = /croisi[eè]re/i.test(detectedTitle || "") || /croisi[eè]re/i.test(detectedSubtitle || "");
    const explicitShipPattern = /(?:à bord du|a bord du)\s+(?:Costa|MSC|CroisiEurope|Ponant|Hurtigruten|MS\s+|Le\s+Boréal|L'Austral|Le\s+Soléal|Le\s+Lyrial|Le\s+Commandant|Polarfront|Ocean\s+Nova)/i;
    const shipSpecsPattern = /(?:Votre bateau[\s\S]{0,120}?(?:Dimensions|Capacité|Ponts|Tonnage|Tirant d'eau))/i;
    const hasManyTerrestrialHotels = (hotels && hotels.length >= 2);

    if (titleHasCruise || (!hasManyTerrestrialHotels && (explicitShipPattern.test(text) || shipSpecsPattern.test(text)))) {
      isCruise = true;
      conciergeMode = 'cruise';
    } else {
      isCruise = false;
      conciergeMode = 'guided';
    }
  }

  // Fallback hébergement croisière si aucun hôtel terrestre
  if (isCruise && hotels.length === 0) {
    hotels.push({
      name: `${detectedShip || "Costa Diadema"} (Cabine de bord)`,
      dates: detectedDates || "Pendant toute la croisière",
      city: "À bord du navire (Croisière)",
      address: `Paquebot ${detectedShip || "Costa Diadema"} - Compagnie Costa Croisières`,
      phone: "Réception 24h/24 à bord",
      lat: 43.2965,
      lng: 5.3698,
      notes: "Cabine tout confort selon catégorie réservée (Service de bord 24h/24)"
    });
  }

  // 5. Contacts (Accompagnatrice, Guide local, Réceptif & Assistance)
  const contactsList = [];
  const accompMatch = text.match(/Votre accompagnatrice(?:\s*(?:Voyages\s+)?Girardot)?[\s\r\n]+([A-ZÀ-Ý][a-zà-ÿ]+)/i);
  let accompName = "";
  if (accompMatch) {
    accompName = accompMatch[1].trim();
  }
  if (!accompName && isCruise) {
    const m = text.match(/(?:accompagnatrice|accompagnateur)\s+(?:Voyages Girardot\s+)?([A-ZÀ-Ý][a-zà-ÿ]+)/i);
    if (m) accompName = m[1].trim();
  }

  if (accompName) {
    contactsList.push({
      category: "Accompagnatrice Voyages Girardot",
      name: accompName,
      phone: "",
      address: isCruise ? `À bord du ${detectedShip || "navire"} (Permanence quotidienne Voyages Girardot)` : "Avec le groupe sur le circuit",
      isEmergency: false
    });
  }

  // Guide local terrestre
  const guideMatch = text.match(/Votre guide(?:\s+local)?[\s\r\n]+([A-ZÀ-Ýa-zà-ÿ\s-]+)(?:\n+T[ée]l\.?\s*:\s*([+\d\s().-]+))?/i);
  if (guideMatch && !isCruise) {
    const candidateName = guideMatch[1].trim().split('\n')[0].trim();
    if (candidateName && !/^(?:Votre contact|Formalit|Bon [àa] savoir)/i.test(candidateName)) {
      contactsList.push({
        category: "Guide Local",
        name: candidateName,
        phone: guideMatch[2] ? guideMatch[2].trim() : "",
        address: "Guide local francophone",
        isEmergency: false
      });
    }
  }

  // Réceptif terrestre / Contact sur place
  const receptifMatch = text.match(/(?:Votre contact sur place|Correspondant local|R[ée]ceptif local|En France|Au Mexique|À l[’']étranger|A l[’']etranger|Vos contacts)\s*[:–-]?[\s\r\n]+([\s\S]*?)(?=(?:Formalit[ée]s|Bon [àa] savoir|Assurance|$))/i);
  if (receptifMatch && !isCruise) {
    const rawContactBlock = receptifMatch[1].slice(0, 450);
    const cLines = rawContactBlock.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (cLines.length > 0) {
      let contactName = cLines[0].replace(/^[:–-]\s*/, '').trim();
      let addressParts = [];
      let phone = "";
      for (let j = 1; j < cLines.length; j++) {
        const l = cLines[j];
        if (/^t[ée]l\.?\s*:/i.test(l)) {
          phone = l.replace(/^t[ée]l\.?\s*:\s*/i, '').trim();
        } else {
          addressParts.push(l);
        }
      }
      if (!phone) {
        const phones = rawContactBlock.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g) || [];
        phone = phones[0] || "";
      }
      contactsList.push({
        category: "Correspondant Réceptif & Urgence",
        name: contactName,
        phone: phone,
        address: addressParts.join(", ") || "Assistance locale 24h/24",
        isEmergency: true
      });
    }
  }

  contactsList.push({
    category: "Assistance Girardot 24h/7j",
    name: "Permanence Urgences Girardot",
    phone: "03 85 42 82 50",
    address: "Chalon-sur-Saône, France",
    isEmergency: true
  });

  const landContactsCopy = JSON.parse(JSON.stringify(contactsList));

  // 6. Détection des Vols (Aller / Retour)
  const flightsList = [];
  const outboundMatch = text.match(/(?:Vol\s+)?Aller\s*[:–-]?\s*([0-9a-zA-Zà-ÿ\s/.-]*?)(?:\r?\n)([\s\S]*?)(?=(?:Vol\s+)?Retour|Nous attirons|Bagages|Jour 1|$)/i);
  if (outboundMatch) {
    const outHeader = outboundMatch[1].trim();
    const outBlock = outboundMatch[2];
    const outDateMatch = outHeader.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || outBlock.match(/Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) || outHeader.match(/\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}/i);
    const outDate = outDateMatch ? outDateMatch[0] : (outHeader || detectedStartDate || "Jour 1");

    const depAero = (outBlock.match(/(?:D[ée]collage de l[’']a[ée]roport de|D[ée]part de|A[ée]roport de d[ée]part)\s*:\s*(.*)/i) || [])[1] || "";
    const arrAero = (outBlock.match(/(?:A l[’']a[ée]roport de|Arriv[ée]e [àa]|A[ée]roport d'arriv[ée]e)\s*:\s*(.*)/i) || [])[1] || "";
    const flightNum = (outBlock.match(/(?:N°\s*(?:de\s*)?vol|Vol)\s*:\s*(.*)/i) || [])[1] || "";
    const depTime = (outBlock.match(/(?:D[ée]collage pr[ée]vu [àa]|D[ée]part pr[ée]vu [àa]|D[ée]collage|D[ée]part)\s*:\s*(.*)/i) || [])[1] || "";
    const arrTime = (outBlock.match(/(?:Arriv[ée]e pr[ée]vue [àa]|Arriv[ée]e)\s*:\s*(.*)/i) || [])[1] || "";
    const comp = (outBlock.match(/Compagnie\s*:\s*(.*)/i) || [])[1] || "Air France";
    const meeting = (outBlock.match(/(?:Heure de pr[ée]sentation|Convocation)\s*(?:[àa]\s*l[’']a[ée]roport)?\s*:\s*(.*)/i) || [])[1] || "";

    if (flightNum || (depAero && arrAero)) {
      flightsList.push({
        type: "Aller",
        airline: comp.trim(),
        flightNumber: flightNum.trim(),
        departureAirport: depAero.trim(),
        departureTime: depTime.trim(),
        arrivalAirport: arrAero.trim(),
        arrivalTime: arrTime.trim(),
        date: outDate.trim(),
        via: "",
        notes: meeting ? `Convocation à ${meeting.trim()}` : ""
      });
    }
  }

  const inboundMatch = text.match(/(?:Vol\s+)?Retour\s*[:–-]?\s*([0-9a-zA-Zà-ÿ\s/.-]*?)(?:\r?\n)([\s\S]*?)(?=Nous attirons|Bagages|Jour 1|Coordonnées|Vos hôtels|$)/i);
  if (inboundMatch) {
    const inHeader = inboundMatch[1].trim();
    const inBlock = inboundMatch[2];
    const inDateMatch = inHeader.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || inBlock.match(/Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) || inHeader.match(/\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}/i);
    const inDate = inDateMatch ? inDateMatch[0] : (inHeader || detectedEndDate || "Dernier jour");

    const depAero = (inBlock.match(/(?:D[ée]collage de l[’']a[ée]roport de|D[ée]part de|A[ée]roport de d[ée]part)\s*:\s*(.*)/i) || [])[1] || "";
    const arrAero = (inBlock.match(/(?:A l[’']a[ée]roport de|Arriv[ée]e [àa]|A[ée]roport d'arriv[ée]e)\s*:\s*(.*)/i) || [])[1] || "";
    const flightNum = (inBlock.match(/(?:N°\s*(?:de\s*)?vol|Vol)\s*:\s*(.*)/i) || [])[1] || "";
    const depTime = (inBlock.match(/(?:D[ée]collage pr[ée]vu [àa]|D[ée]part pr[ée]vu [àa]|D[ée]collage|D[ée]part)\s*:\s*(.*)/i) || [])[1] || "";
    const arrTime = (inBlock.match(/(?:Arriv[ée]e pr[ée]vue [àa]|Arriv[ée]e)\s*:\s*(.*)/i) || [])[1] || "";
    const comp = (inBlock.match(/Compagnie\s*:\s*(.*)/i) || [])[1] || "Air France";

    if (flightNum || (depAero && arrAero)) {
      flightsList.push({
        type: "Retour",
        airline: comp.trim(),
        flightNumber: flightNum.trim(),
        departureAirport: depAero.trim(),
        departureTime: depTime.trim(),
        arrivalAirport: arrAero.trim(),
        arrivalTime: arrTime.trim(),
        date: inDate.trim(),
        via: "",
        notes: ""
      });
    }
  }

  // Backup scan automatique des numéros de vols réels (ex: AF 178, AF 651) si le format différé n'a pas répondu
  if (flightsList.length === 0) {
    const flightRegex = /\b(AF|IB|LH|UX|BA|EK|QR|SN|KL|AT)\s*(\d{2,4})\b/g;
    let fm;
    const foundNumbers = [];
    while ((fm = flightRegex.exec(text)) !== null) {
      const fullNum = `${fm[1]} ${fm[2]}`;
      if (!foundNumbers.includes(fullNum)) {
        foundNumbers.push(fullNum);
        flightsList.push({
          type: foundNumbers.length === 1 ? "Aller" : "Retour",
          airline: fm[1] === 'AF' ? "Air France" : (fm[1] === 'IB' ? "Iberia" : (fm[1] === 'LH' ? "Lufthansa" : "Compagnie aérienne")),
          flightNumber: fullNum,
          departureAirport: foundNumbers.length === 1 ? "Paris Charles de Gaulle" : "Aéroport international de destination",
          departureTime: "",
          arrivalAirport: foundNumbers.length === 1 ? (detectedTitle || "Destination") : "Paris Charles de Gaulle",
          arrivalTime: "",
          date: detectedDates || "",
          via: "",
          notes: ""
        });
      }
    }
  }

  const landFlightsCopy = JSON.parse(JSON.stringify(flightsList));

  // 7. Objet Voyage Final
  const newTripId = 'voyage-' + Date.now();
  currentParsedTrip = {
    id: newTripId,
    title: detectedTitle || "Circuit Découverte",
    subtitle: detectedSubtitle || "Circuit exclusif Voyages Girardot",
    dates: detectedDates || "Dates selon programme",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + (itinerary.length || 14) * 86400000).toISOString().split('T')[0],
    coverImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    intro: text.slice(0, 320) + "...",
    alert: {
      title: "Formalités indispensables",
      text: "Passeport ou pièce d'identité en cours de validité. Vérifiez vos dates de validité.",
      link: ""
    },
    flightsList: flightsList,
    flights: flightsList,
    itinerary: itinerary,
    hotels: hotels,
    hotelsList: hotels,
    documents: [],
    freeTimeSuggestions: [],
    contactsList: contactsList,
    practicalTipsList: [],
    practicalInfo: {
      money: "Euros ou devise locale selon le pays. Cartes bancaires internationales acceptées. Prévoir des espèces pour les petits commerces.",
      electricity: "Voltage 220-230 volts. Vérifiez si un adaptateur de prise est nécessaire selon la destination.",
      clothing: "Tenue confortable de saison et chaussures adaptées pour les visites à pied.",
      tips: "Pourboires indicatifs : selon les usages locaux et laissés à votre discrétion.",
      wifi: "Wi-Fi disponible dans la plupart des hébergements."
    },
    driverDossier: {
      busModel: "Autocar Grand Tourisme",
      busCapacity: 50,
      busPlanUrl: "",
      busNotes: "Placement libre ou selon consignes de l'accompagnatrice.",
      roomingList: [],
      roomingFileUrl: "",
      passengersList: []
    },
    _rawImportedText: text,
    _landContactsList: landContactsCopy,
    _landFlightsList: landFlightsCopy,
    _detectedShip: detectedShip,
    _accompName: accompName,
    conciergeMode: conciergeMode
  };

  // Traitement Croisière vs Circuit Terrestre
  if (isCruise) {
    currentParsedTrip.isCruise = true;
    const cruiseInfo = (typeof detectCruiseLineAndShip === 'function')
      ? detectCruiseLineAndShip(detectedShip || detectedTitle, text)
      : { line: 'costa', companyName: 'Croisière', shipName: detectedShip || "Costa Diadema", isRiver: false, isPolar: false };

    currentParsedTrip.shipName = detectedShip || cruiseInfo.shipName || "Costa Diadema";
    currentParsedTrip.cruiseCompany = cruiseInfo.companyName;
    currentParsedTrip.cruiseCategory = cruiseInfo.category;
    currentParsedTrip.decks = (typeof getCruiseShipDecks === 'function') ? getCruiseShipDecks(currentParsedTrip.shipName, text) : [];
    currentParsedTrip.conciergerie = (typeof buildCruiseConciergerie === 'function') ? buildCruiseConciergerie(currentParsedTrip.shipName, itinerary, text) : null;

    if (typeof getCruisePracticalInfo === 'function') currentParsedTrip.practicalInfo = getCruisePracticalInfo(currentParsedTrip.shipName, text);
    if (typeof getCruisePracticalTips === 'function') currentParsedTrip.practicalTipsList = getCruisePracticalTips(currentParsedTrip.shipName, text);
    if (typeof getCruiseContacts === 'function') currentParsedTrip.contactsList = getCruiseContacts(currentParsedTrip.shipName, accompName || "Mireille");

    // Supprimer les vols fictifs pour croisière maritime si non explicites
    const realCruiseFlights = flightsList.filter(f => f.flightNumber || (f.departureAirport && f.arrivalAirport && f.departureAirport !== 'Paris' && f.arrivalAirport !== detectedTitle));
    currentParsedTrip.flightsList = realCruiseFlights;

  } else {
    // CIRCUIT TERRESTRE
    currentParsedTrip.isCruise = false;
    currentParsedTrip.shipName = "";
    currentParsedTrip.decks = [];

    // Extraction des vraies informations pratiques de destination du PDF
    const destPractical = extractDestinationPracticalInfoFromText(text);
    if (destPractical.tipsList && destPractical.tipsList.length > 0) {
      currentParsedTrip.practicalTipsList = destPractical.tipsList;
      currentParsedTrip.practicalInfo = Object.assign(currentParsedTrip.practicalInfo, destPractical.practicalInfo);
    } else {
      currentParsedTrip.practicalTipsList = [
        { title: "Monnaie & Devises", icon: "coins", content: "Euros ou devise locale selon votre destination. Cartes bancaires internationales acceptées. Prévoyez des espèces pour les petits commerces et marchés locaux." },
        { title: "Électricité & Prises", icon: "plug", content: "Voltage 220-230 volts. Vérifiez si un adaptateur de prise est nécessaire selon les normes du pays visité." },
        { title: "Vêtements conseillés", icon: "shirt", content: "Vêtements confortables de saison, chaussures de marche adaptées aux visites et une petite laine pour les soirées ou la climatisation du car." },
        { title: "Pourboires indicatifs", icon: "hand-holding-dollar", content: "Les pourboires restent à votre entière appréciation pour les guides locaux et conducteurs d'autocar." },
        { title: "Connexion Wi-Fi", icon: "wifi", content: "Accès Wi-Fi disponible gratuitement dans la plupart des hébergements du circuit." }
      ];
    }

    // Formalités passeport et sanitaires (Visa, Air Suvidha, etc.)
    const formalitesMatch = text.match(/Formalit[ée]s indispensables\s*[:–-]?\s*\n*([\s\S]*?)(?=(?:03\/07|\d{2}\/\d{2}\/\d{4}|Bon [àa] savoir|Inclus|$))/i);
    let formalitiesText = formalitesMatch ? formalitesMatch[1].trim().replace(/\r?\n+/g, ' ') : '';
    formalitiesText = formalitiesText.replace(/---\s*PAGE\s*\d+\s*---/gi, '').trim();
    if (!formalitiesText) {
      const passMatch = text.match(/Passeport\s+valide[^\n.]+/i);
      if (passMatch) formalitiesText = passMatch[0].trim();
    }

    const airSuvidhaMatch = text.match(/(?:Air Suvidha|d[ée]claration de sant[ée])[\s\S]*?airsuvidha\.civilaviation\.gov\.in[\s\S]*?(?=(?:Bon [àa] savoir|Inclus|$))/i);
    if (airSuvidhaMatch) {
      currentParsedTrip.alert = {
        title: "Formalités indispensables (Visa & Déclaration Air Suvidha)",
        text: (formalitiesText ? formalitiesText + " — " : "") + "Déclaration de santé 'Air Suvidha' obligatoire à remplir en ligne sur airsuvidha.civilaviation.gov.in dans les 24h avant l'arrivée en Inde.",
        link: "https://airsuvidha.civilaviation.gov.in"
      };

      if (currentParsedTrip.practicalTipsList) {
        currentParsedTrip.practicalTipsList.unshift({
          title: "Déclaration de santé Air Suvidha (Obligatoire)",
          icon: "file-shield",
          content: "Obligatoire pour l'Inde. Le formulaire officiel doit être impérativement complété en ligne sur airsuvidha.civilaviation.gov.in dans les 24h avant l'atterrissage (le portail bloque si rempli plus tôt). Présenter le document avec QR Code généré à l'embarquement."
        });
      }
    } else if (formalitiesText) {
      currentParsedTrip.alert = {
        title: "Formalités indispensables",
        text: formalitiesText,
        link: ""
      };
    }

    // Conciergerie par défaut standard
    currentParsedTrip.conciergerie = (window.defaultTravelData && window.defaultTravelData.conciergerie)
      ? JSON.parse(JSON.stringify(window.defaultTravelData.conciergerie))
      : { welcomeMessage: "Bienvenue sur votre carnet de voyage Girardot !", themes: [] };
  }

  // Synchronisation rétrocompatible des objets flights et contacts
  if (currentParsedTrip.flightsList && currentParsedTrip.flightsList.length > 0) {
    const outF = currentParsedTrip.flightsList.find(f => f.type === 'Aller') || currentParsedTrip.flightsList[0];
    const inF = currentParsedTrip.flightsList.find(f => f.type === 'Retour') || currentParsedTrip.flightsList[currentParsedTrip.flightsList.length - 1];
    currentParsedTrip.flights = {
      outbound: {
        airline: outF.airline,
        flightNumber: outF.flightNumber,
        departureAirport: outF.departureAirport,
        departureTime: outF.departureTime,
        arrivalAirport: outF.arrivalAirport,
        arrivalTime: outF.arrivalTime,
        date: outF.date,
        layover: outF.via,
        meetingTime: outF.notes
      },
      inbound: {
        airline: inF.airline,
        flightNumber: inF.flightNumber,
        departureAirport: inF.departureAirport,
        departureTime: inF.departureTime,
        arrivalAirport: inF.arrivalAirport,
        arrivalTime: inF.arrivalTime,
        date: inF.date,
        layover: inF.via
      },
      domesticFlights: []
    };
  } else {
    currentParsedTrip.flights = null;
  }

  if (currentParsedTrip.contactsList && currentParsedTrip.contactsList.length > 0) {
    const mainRec = currentParsedTrip.contactsList.find(c => c.category.toLowerCase().includes('réceptif') || c.category.toLowerCase().includes('urgence')) || currentParsedTrip.contactsList[0];
    currentParsedTrip.contacts = {
      receptif: {
        name: mainRec.name,
        emergency: mainRec.phone,
        phone: mainRec.phone,
        address: mainRec.address
      },
      guide: {
        name: accompName || "",
        role: "Accompagnateur Girardot",
        phone: ""
      },
      agence: {
        name: "Voyages Girardot",
        phone: "03 85 42 82 50",
        email: "contact@voyages-girardot.com"
      }
    };
  }

  // Affichage du résultat dans le modal via le helper dédié
  if (previewBox) previewBox.style.display = 'block';
  renderParsedTripSummaryInModal();

  if (btnDownload) btnDownload.style.display = 'inline-block';
  if (btnApply) btnApply.style.display = 'inline-block';
}

function extractProbableCity(text) {
  if (!text) return "";
  const words = text.split(/[\s,•–—\/-]+/);
  for (const w of words) {
    if (w.length > 3 && /^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(w) && !['Jour', 'Visite', 'Arrivee', 'Depart', 'Matin', 'Apres', 'Etape', 'Circuit', 'Envol'].includes(w)) {
      return w;
    }
  }
  return words[0] || "";
}

function detectIconForText(str) {
  const s = str.toLowerCase();
  if (s.includes('vol') || s.includes('envol') || s.includes('aeroport') || s.includes('avion')) return 'plane-departure';
  if (s.includes('hotel') || s.includes('installation') || s.includes('chambre')) return 'hotel';
  if (s.includes('dejeuner') || s.includes('diner') || s.includes('repas') || s.includes('restaurant')) return 'utensils';
  if (s.includes('musee') || s.includes('monument') || s.includes('eglise') || s.includes('temple')) return 'monument';
  if (s.includes('croisiere') || s.includes('bateau') || s.includes('lac') || s.includes('mer')) return 'ship';
  if (s.includes('safari') || s.includes('faune') || s.includes('animaux')) return 'paw';
  return 'location-dot';
}

function downloadParsedTripJson() {
  if (!currentParsedTrip) return;
  const slug = slugifyTitle(currentParsedTrip.title);
  currentParsedTrip.id = slug;
  const filename = `${slug}.json`;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentParsedTrip, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", filename);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function applyParsedTripToAdmin() {
  if (!currentParsedTrip) return;
  currentParsedTrip.id = slugifyTitle(currentParsedTrip.title);

  saveTripToCatalogAndStorage(currentParsedTrip);
  currentTripId = currentParsedTrip.id;
  tripData = currentParsedTrip;

  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  closePdfImportModal();

  alert(`✓ Le voyage "${currentParsedTrip.title}" (${currentParsedTrip.id}.json) extrait du PDF a été chargé dans l'administration avec succès !`);
}


// ==========================================
// SYNCHRONISATION DU FORMULAIRE DANS TRIPDATA
// ==========================================
function syncFormDataIntoTrip() {
  let rawTitle = document.getElementById('adm-title') ? document.getElementById('adm-title').value.trim() : '';
  if (!rawTitle) {
    const asked = prompt("Veuillez donner un nom à votre carnet de voyage (il servira aussi à nommer le fichier .json) :");
    if (!asked || !asked.trim()) return false;
    rawTitle = asked.trim();
    if (document.getElementById('adm-title')) document.getElementById('adm-title').value = rawTitle;
  }

  if (!tripData) tripData = createBlankTripTemplate(rawTitle);

  tripData.title = rawTitle;
  tripData.id = slugifyTitle(rawTitle);
  tripData.subtitle = document.getElementById('adm-subtitle') ? document.getElementById('adm-subtitle').value : '';
  tripData.dates = document.getElementById('adm-dates') ? document.getElementById('adm-dates').value : '';
  tripData.coverImage = document.getElementById('adm-cover') ? document.getElementById('adm-cover').value : '';
  tripData.intro = document.getElementById('adm-intro') ? document.getElementById('adm-intro').value : '';

  // Alert
  tripData.alert = {
    title: document.getElementById('adm-alert-title') ? document.getElementById('adm-alert-title').value : '',
    text: document.getElementById('adm-alert-text') ? document.getElementById('adm-alert-text').value : '',
    link: document.getElementById('adm-alert-link') ? document.getElementById('adm-alert-link').value : ''
  };

  // Synchronisation directe de l'itinéraire
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

  // Synchronisation conciergerie
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

  // Synchronisation rétrocompatible des vols
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
  } else {
    tripData.flights = null;
  }

  // Synchronisation du profil conciergerie & mode
  const modeSel = document.getElementById('adm-concierge-mode');
  if (modeSel) {
    tripData.conciergeMode = modeSel.value;
    if (tripData.conciergeMode === 'cruise') {
      tripData.isCruise = true;
    } else if (tripData.conciergeMode === 'guided' || tripData.conciergeMode === 'full' || tripData.conciergeMode === 'disabled') {
      tripData.isCruise = false;
    }
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

  return true;
}

// ==========================================
// GESTION DE LA SYNCHRONISATION GITHUB (API)
// ==========================================

const GITHUB_CONFIG_KEY = 'girardot_github_config';
const DEFAULT_GH_REPO = 'LauProjectAI/Carnet-Voyage-Eletronique-Interactif';
const DEFAULT_GH_BRANCH = 'main';

function getGitHubConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      return {
        repo: (cfg.repo || DEFAULT_GH_REPO).trim(),
        branch: (cfg.branch || DEFAULT_GH_BRANCH).trim(),
        token: (cfg.token || '').trim()
      };
    }
  } catch (e) {
    console.warn("Erreur lecture config GitHub:", e);
  }
  return {
    repo: DEFAULT_GH_REPO,
    branch: DEFAULT_GH_BRANCH,
    token: ''
  };
}

function updateGitHubStatusIndicator() {
  const indicator = document.getElementById('github-status-indicator');
  if (!indicator) return;
  const cfg = getGitHubConfig();
  if (cfg.token) {
    const shortRepo = cfg.repo.split('/')[1] || cfg.repo;
    indicator.innerHTML = `<span style="color:#22c55e;">●</span> GitHub connecté (${shortRepo})`;
    if (indicator.parentElement) {
      indicator.parentElement.style.borderColor = '#86efac';
      indicator.parentElement.style.background = '#f0fdf4';
      indicator.parentElement.style.color = '#15803d';
    }
  } else {
    indicator.innerHTML = `Synchro GitHub`;
    if (indicator.parentElement) {
      indicator.parentElement.style.borderColor = '';
      indicator.parentElement.style.background = '';
      indicator.parentElement.style.color = '';
    }
  }
}

function openGitHubConfigModal() {
  const cfg = getGitHubConfig();
  const repoInp = document.getElementById('gh-repo');
  const branchInp = document.getElementById('gh-branch');
  const tokenInp = document.getElementById('gh-token');
  const feedback = document.getElementById('gh-test-feedback');

  if (repoInp) repoInp.value = cfg.repo;
  if (branchInp) branchInp.value = cfg.branch;
  if (tokenInp) tokenInp.value = cfg.token;
  if (feedback) feedback.innerHTML = '';

  const modal = document.getElementById('github-config-modal');
  if (modal) modal.style.display = 'flex';
}

function closeGitHubConfigModal() {
  const modal = document.getElementById('github-config-modal');
  if (modal) modal.style.display = 'none';
}

function saveGitHubConfig() {
  const repoInp = document.getElementById('gh-repo');
  const branchInp = document.getElementById('gh-branch');
  const tokenInp = document.getElementById('gh-token');

  const repo = repoInp ? repoInp.value.trim() : DEFAULT_GH_REPO;
  const branch = branchInp ? branchInp.value.trim() : DEFAULT_GH_BRANCH;
  const token = tokenInp ? tokenInp.value.trim() : '';

  const cfg = { repo: repo || DEFAULT_GH_REPO, branch: branch || DEFAULT_GH_BRANCH, token: token };
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(cfg));
  updateGitHubStatusIndicator();

  alert("✓ Paramètres GitHub enregistrés avec succès !");
  closeGitHubConfigModal();
}

function disconnectGitHub() {
  if (confirm("Voulez-vous vraiment effacer le jeton GitHub enregistré sur ce navigateur ?")) {
    const cfg = getGitHubConfig();
    cfg.token = '';
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(cfg));
    const tokenInp = document.getElementById('gh-token');
    if (tokenInp) tokenInp.value = '';
    const feedback = document.getElementById('gh-test-feedback');
    if (feedback) feedback.innerHTML = '<span style="color:#64748b;">Clé supprimée.</span>';
    updateGitHubStatusIndicator();
  }
}

async function testGitHubConnection() {
  const repoInp = document.getElementById('gh-repo');
  const tokenInp = document.getElementById('gh-token');
  const feedback = document.getElementById('gh-test-feedback');

  const repo = repoInp ? repoInp.value.trim() : DEFAULT_GH_REPO;
  const token = tokenInp ? tokenInp.value.trim() : '';

  if (!token) {
    if (feedback) feedback.innerHTML = '<span style="color:#ef4444;">⚠️ Veuillez entrer un jeton GitHub (PAT) pour tester la connexion.</span>';
    return;
  }

  if (feedback) feedback.innerHTML = '<span style="color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Test de connexion en cours...</span>';

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const canPush = data.permissions ? data.permissions.push : true;
      if (feedback) {
        feedback.innerHTML = `<span style="color:#16a34a;">✓ Connexion réussie à <strong>${data.full_name}</strong> ! ${canPush ? '(Droit d\'écriture validé)' : '(Attention: droit d\'écriture non confirmé)'}</span>`;
      }
    } else {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      if (feedback) {
        feedback.innerHTML = `<span style="color:#ef4444;">❌ Erreur (${res.status}) : ${errData.message || 'Dépôt inaccessible ou jeton invalide'}.</span>`;
      }
    }
  } catch (err) {
    if (feedback) feedback.innerHTML = `<span style="color:#ef4444;">❌ Erreur réseau : ${err.message}</span>`;
  }
}

function encodeUtf8Base64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function decodeUtf8Base64(b64) {
  return decodeURIComponent(escape(window.atob(b64.replace(/\s/g, ''))));
}
async function getGitHubFileSha(repo, filePath, branch, token) {
  const cleanPath = filePath.split('/').map(encodeURIComponent).join('/');
  const cacheBuster = Date.now();

  // 1. Essai principal direct via Contents API avec no-store et timestamp
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}&_=${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.sha) return data.sha;
    }
  } catch (e) {
    console.warn("Contents API SHA check failed:", e);
  }

  // 2. Fallback via Commits API si la Contents API est en retard ou indisponible
  try {
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits?path=${cleanPath}&sha=${encodeURIComponent(branch)}&per_page=1&_=${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (commitRes.ok) {
      const commits = await commitRes.json();
      if (Array.isArray(commits) && commits.length > 0 && commits[0].sha) {
        const detailRes = await fetch(`https://api.github.com/repos/${repo}/commits/${commits[0].sha}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const targetFile = (detail.files || []).find(f => f.filename === filePath);
          if (targetFile && targetFile.sha) return targetFile.sha;
        }
      }
    }
  } catch (e) {
    console.warn("Commits API SHA check failed:", e);
  }

  return null;
}


async function saveTripDirectToGitHub() {
  if (!syncFormDataIntoTrip()) return;

  const cfg = getGitHubConfig();
  if (!cfg.token) {
    alert("⚠️ Aucun jeton GitHub (Personal Access Token) n'a été renseigné.\n\nVeuillez renseigner votre clé GitHub pour enregistrer directement vos voyages sur le dépôt en ligne.");
    openGitHubConfigModal();
    return;
  }

  const slug = tripData.id;
  const fileName = `${slug}.json`;
  const filePath = `voyages/${fileName}`;
  const repo = cfg.repo;
  const branch = cfg.branch;

  const confirmSave = confirm(
    `Voulez-vous publier le voyage "${tripData.title}" directement sur GitHub ?\n\n` +
    `• Fichier : ${filePath}\n` +
    `• Dépôt : ${repo} (${branch})\n\n` +
    `Le voyage sera immédiatement accessible publiquement sur GitHub Pages pour vos voyageurs.`
  );
  if (!confirmSave) return;

  const originalSaveBtn = document.querySelector('button[onclick="saveTripDirectToGitHub()"]');
  const originalBtnHtml = originalSaveBtn ? originalSaveBtn.innerHTML : null;
  if (originalSaveBtn) {
    originalSaveBtn.disabled = true;
    originalSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publication GitHub...';
  }

  try {
    saveTripToCatalogAndStorage(tripData);
    renderTripSelectorOptions();
    updateShareLink();

    const cleanFilePath = filePath.split('/').map(encodeURIComponent).join('/');
    let existingSha = await getGitHubFileSha(repo, filePath, branch, cfg.token);

    const tripJsonString = JSON.stringify(tripData, null, 2);
    const putBody = {
      message: existingSha ? `feat(voyages): mise à jour du carnet ${tripData.title}` : `feat(voyages): ajout du carnet ${tripData.title}`,
      content: encodeUtf8Base64(tripJsonString),
      branch: branch
    };
    if (existingSha) putBody.sha = existingSha;

    let putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanFilePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(putBody)
    });

    // Si GitHub répond 422 ("sha wasn't supplied" ou conflit), récupération forcée immédiate et nouvelle tentative
    if (!putRes.ok && putRes.status === 422) {
      console.warn("GitHub 422 reçu, nouvelle tentative avec récupération forcée du SHA...");
      const freshSha = await getGitHubFileSha(repo, filePath, branch, cfg.token);
      if (freshSha && freshSha !== existingSha) {
        putBody.sha = freshSha;
        putBody.message = `feat(voyages): mise à jour du carnet ${tripData.title}`;
        putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanFilePath}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${cfg.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(putBody)
        });
      }
    }

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({ message: putRes.statusText }));
      throw new Error(`Erreur lors de la publication du JSON (${putRes.status}) : ${err.message}`);
    }

    // Mise à jour de index_voyages.js
    try {
      const indexPath = 'voyages/index_voyages.js';
      const cleanIndexPath = indexPath.split('/').map(encodeURIComponent).join('/');
      const indexSha = await getGitHubFileSha(repo, indexPath, branch, cfg.token);
      const getIndexRes = await fetch(`https://api.github.com/repos/${repo}/contents/${cleanIndexPath}?ref=${encodeURIComponent(branch)}&_=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getIndexRes.ok) {
        const indexData = await getIndexRes.json();
        const indexContent = decodeUtf8Base64(indexData.content);

        const alreadyIndexed = indexContent.includes(`id: "${slug}"`) || indexContent.includes(`id: '${slug}'`);
        if (!alreadyIndexed) {
          const newEntry = `  {\n    id: "${slug}",\n    alias: "${slug}",\n    aliases: ["${slug}"],\n    title: ${JSON.stringify(tripData.title)},\n    subtitle: ${JSON.stringify(tripData.subtitle || '')},\n    dates: ${JSON.stringify(tripData.dates || '')},\n    file: "${filePath}"\n  },\n`;
          
          let updatedIndexContent;
          if (indexContent.includes('window.AVAILABLE_TRIPS = [')) {
            updatedIndexContent = indexContent.replace('window.AVAILABLE_TRIPS = [', `window.AVAILABLE_TRIPS = [\n${newEntry}`);
          } else if (indexContent.lastIndexOf('];') !== -1) {
            const lastBracket = indexContent.lastIndexOf('];');
            updatedIndexContent = indexContent.slice(0, lastBracket) + newEntry + indexContent.slice(lastBracket);
          } else {
            updatedIndexContent = indexContent + `\nwindow.AVAILABLE_TRIPS.push(${JSON.stringify({ id: slug, title: tripData.title, file: filePath })});\n`;
          }

          await fetch(`https://api.github.com/repos/${repo}/contents/${indexPath}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${cfg.token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
              message: `feat(index): référencer le carnet ${tripData.title} dans index_voyages.js`,
              content: encodeUtf8Base64(updatedIndexContent),
              branch: branch,
              sha: indexData.sha
            })
          });
        }
      }
    } catch (indexErr) {
      console.warn("Index voyages non mis à jour automatiquement (non bloquant):", indexErr);
    }

    const [owner, repoName] = repo.split('/');
    const cleanRepoName = repoName || 'Carnet-Voyage-Eletronique-Interactif';
    const clientPublicUrl = `https://${(owner || 'lauprojectai').toLowerCase()}.github.io/${cleanRepoName}/index.html?id=${slug}`;
    const driverPublicUrl = `https://${(owner || 'lauprojectai').toLowerCase()}.github.io/${cleanRepoName}/conducteur.html?id=${slug}`;

    try {
      navigator.clipboard.writeText(clientPublicUrl);
    } catch (e) {}

    alert(
      `🎉 SUCCÈS ! Le carnet a été publié directement sur GitHub !\n\n` +
      `📁 Fichier : ${filePath}\n\n` +
      `🔗 Lien Voyageur (copié dans votre presse-papier) :\n${clientPublicUrl}\n\n` +
      `🔗 Lien Dossier Conducteur :\n${driverPublicUrl}\n\n` +
      `(Note : GitHub Pages prend 30 à 60 secondes pour propager les nouveaux fichiers en ligne).`
    );

    const clientShareInput = document.getElementById('client-share-link');
    if (clientShareInput) clientShareInput.value = clientPublicUrl;
    const previewClientLink = document.getElementById('preview-client-link');
    if (previewClientLink) previewClientLink.href = clientPublicUrl;
    const driverShareInput = document.getElementById('driver-share-link');
    if (driverShareInput) driverShareInput.value = driverPublicUrl;
    const previewDriverLink = document.getElementById('preview-driver-link');
    if (previewDriverLink) previewDriverLink.href = driverPublicUrl;

  } catch (err) {
    console.error("Erreur enregistrement GitHub API:", err);
    alert(`❌ Erreur lors de la publication sur GitHub :\n\n${err.message}\n\nVérifiez votre connexion internet et la validité de votre token GitHub dans les réglages.`);
  } finally {
    if (originalSaveBtn && originalBtnHtml) {
      originalSaveBtn.disabled = false;
      originalSaveBtn.innerHTML = originalBtnHtml;
    }
  }
}



// =============================================================================
// GESTION DU PROFIL DU VOYAGE & MODE CONCIERGERIE (CIRCUIT / CROISIÈRE / SÉJOUR)
// =============================================================================
function populateConciergeMode() {
  const sel = document.getElementById('adm-concierge-mode');
  if (!sel || !tripData) return;

  let mode = tripData.conciergeMode;
  if (!mode) {
    mode = tripData.isCruise ? 'cruise' : (tripData.freeTimeSuggestions && tripData.freeTimeSuggestions.length > 0 ? 'guided' : 'full');
    tripData.conciergeMode = mode;
  }
  sel.value = mode;
  onConciergeModeChange(mode, false);
}

function onConciergeModeChange(mode, userInitiated = true) {
  if (tripData) {
    tripData.conciergeMode = mode;
    if (mode === 'cruise') {
      tripData.isCruise = true;
      if (!tripData.shipName && tripData._detectedShip) {
        tripData.shipName = tripData._detectedShip;
      }
    } else {
      tripData.isCruise = false;
      tripData.shipName = "";
      tripData.decks = [];

      // Si les infos pratiques actuelles étaient pour une croisière, basculer sur des infos terrestres
      if (tripData.practicalTipsList && tripData.practicalTipsList.some(t => /croisière|paquebot|cabine|ponts|muster/i.test(t.title + ' ' + t.content))) {
        if (tripData._rawImportedText) {
          const destPractical = extractDestinationPracticalInfoFromText(tripData._rawImportedText);
          if (destPractical.tipsList && destPractical.tipsList.length > 0) {
            tripData.practicalTipsList = destPractical.tipsList;
            tripData.practicalInfo = Object.assign(tripData.practicalInfo || {}, destPractical.practicalInfo);
          }
        }
        if (!tripData.practicalTipsList || tripData.practicalTipsList.some(t => /croisière|paquebot/i.test(t.title))) {
          tripData.practicalTipsList = [
            { title: "Monnaie & Devises", icon: "coins", content: "Euros ou devise locale selon votre destination. Cartes bancaires internationales acceptées. Prévoyez des espèces pour les petits commerces et marchés locaux." },
            { title: "Électricité & Prises", icon: "plug", content: "Voltage 220-230 volts. Vérifiez si un adaptateur de prise est nécessaire selon les normes du pays visité." },
            { title: "Vêtements conseillés", icon: "shirt", content: "Vêtements confortables de saison, chaussures de marche adaptées aux visites et une petite laine pour les soirées ou la climatisation du car." },
            { title: "Pourboires indicatifs", icon: "hand-holding-dollar", content: "Les pourboires restent à votre entière appréciation pour les guides locaux et conducteurs d'autocar." },
            { title: "Connexion Wi-Fi", icon: "wifi", content: "Accès Wi-Fi disponible gratuitement dans la plupart des hébergements du circuit." }
          ];
        }
        if (typeof renderAdminPractical === 'function') renderAdminPractical();
      }

      // Si les contacts étaient des contacts de bord de croisière
      if (tripData.contactsList && tripData.contactsList.some(c => /réception\s+costa|guest\s+service|infirmerie/i.test(c.category + ' ' + c.name))) {
        if (tripData._landContactsList && tripData._landContactsList.length > 0) {
          tripData.contactsList = JSON.parse(JSON.stringify(tripData._landContactsList));
        } else {
          tripData.contactsList = [
            { category: "Accompagnateur Voyages Girardot", name: "Accompagnateur du circuit", phone: "", address: "Avec le groupe", isEmergency: false },
            { category: "Assistance Girardot 24h/7j", name: "Permanence Urgences Girardot", phone: "03 85 42 82 50", address: "Chalon-sur-Saône, France", isEmergency: true }
          ];
        }
        if (typeof renderAdminContacts === 'function') renderAdminContacts();
      }
    }
  }

  const desc = document.getElementById('adm-concierge-mode-desc');
  if (!desc) return;

  if (mode === 'guided') {
    desc.innerHTML = "💡 <strong>Circuit Accompagné / Guidé :</strong> La conciergerie générale est masquée. Seuls les temps libres prévus (ci-dessous ou générés par Gemini) seront mis en avant pour vos clients.";
  } else if (mode === 'cruise') {
    desc.innerHTML = "🚢 <strong>Croisière :</strong> Plan d'ensemble du navire, sélection des ponts, décodeur de cabine, boussole marine et vie à bord actifs.";
  } else if (mode === 'full') {
    desc.innerHTML = "🏙️ <strong>Séjour Libre / City-break :</strong> Conciergerie complète de la ville activée (restaurants, bars, cafés, transports, visites libres).";
  } else if (mode === 'disabled') {
    desc.innerHTML = "🚫 <strong>100% Guidé sans aucun temps libre :</strong> L'onglet Conciergerie est totalement masqué dans le carnet du voyageur pour une clarté maximale.";
  }
}

function populateGeminiDaySelector() {
  const daySelect = document.getElementById('gemini-day-select');
  if (!daySelect || !tripData) return;
  daySelect.innerHTML = '<option value="">Sélectionner une étape du circuit...</option>';

  if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
    tripData.itinerary.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.day;
      let displayCity = d.city || "";
      if (!displayCity || displayCity.toLowerCase().includes('votre') || displayCity.length <= 4) {
        let clean = d.title.replace(/votre\s+r[ée]gion\s*[-–—•]\s*/i, '').trim();
        displayCity = clean || d.title;
      }
      opt.innerText = `Jour ${d.day} : ${displayCity}`;
      daySelect.appendChild(opt);
    });
  }
}


function onParsedProfilePreviewChange(newMode) {
  if (!currentParsedTrip) return;
  currentParsedTrip.conciergeMode = newMode;
  const rawText = currentParsedTrip._rawImportedText || '';

  if (newMode === 'cruise') {
    currentParsedTrip.isCruise = true;
    const detectedShip = currentParsedTrip._detectedShip || "Costa Diadema";
    currentParsedTrip.shipName = detectedShip;
    currentParsedTrip.decks = (typeof getCruiseShipDecks === 'function') ? getCruiseShipDecks(detectedShip, rawText) : [];
    currentParsedTrip.conciergerie = (typeof buildCruiseConciergerie === 'function') ? buildCruiseConciergerie(detectedShip, currentParsedTrip.itinerary, rawText) : null;
    if (typeof getCruisePracticalInfo === 'function') currentParsedTrip.practicalInfo = getCruisePracticalInfo(detectedShip, rawText);
    if (typeof getCruisePracticalTips === 'function') currentParsedTrip.practicalTipsList = getCruisePracticalTips(detectedShip, rawText);
    if (typeof getCruiseContacts === 'function') currentParsedTrip.contactsList = getCruiseContacts(detectedShip, currentParsedTrip._accompName || "Mireille");
  } else {
    currentParsedTrip.isCruise = false;
    currentParsedTrip.shipName = "";
    currentParsedTrip.decks = [];

    // Restaurer les infos pratiques de la destination terrestre
    const destPractical = extractDestinationPracticalInfoFromText(rawText);
    if (destPractical.tipsList && destPractical.tipsList.length > 0) {
      currentParsedTrip.practicalTipsList = destPractical.tipsList;
      currentParsedTrip.practicalInfo = Object.assign(currentParsedTrip.practicalInfo || {}, destPractical.practicalInfo);
    } else {
      currentParsedTrip.practicalTipsList = [
        { title: "Monnaie & Devises", icon: "coins", content: "Euros ou devise locale selon votre destination. Cartes bancaires internationales acceptées. Prévoyez des espèces pour les petits commerces et marchés locaux." },
        { title: "Électricité & Prises", icon: "plug", content: "Voltage 220-230 volts. Vérifiez si un adaptateur de prise est nécessaire selon les normes du pays visité." },
        { title: "Vêtements conseillés", icon: "shirt", content: "Vêtements confortables de saison, chaussures de marche adaptées aux visites et une petite laine pour les soirées ou la climatisation du car." },
        { title: "Pourboires indicatifs", icon: "hand-holding-dollar", content: "Les pourboires restent à votre entière appréciation pour les guides locaux et conducteurs d'autocar." },
        { title: "Connexion Wi-Fi", icon: "wifi", content: "Accès Wi-Fi disponible gratuitement dans la plupart des hébergements du circuit." }
      ];
    }

    if (currentParsedTrip._landContactsList && currentParsedTrip._landContactsList.length > 0) {
      currentParsedTrip.contactsList = JSON.parse(JSON.stringify(currentParsedTrip._landContactsList));
    }
    if (currentParsedTrip._landFlightsList && currentParsedTrip._landFlightsList.length > 0) {
      currentParsedTrip.flightsList = JSON.parse(JSON.stringify(currentParsedTrip._landFlightsList));
    }
  }

  // Mettre à jour le résumé du modal
  renderParsedTripSummaryInModal();
}

function renderParsedTripSummaryInModal() {
  const statusEl = document.getElementById('pdf-import-status');
  const previewSummary = document.getElementById('pdf-preview-summary');
  const sel = document.getElementById('pdf-preview-profile-select');
  if (sel && currentParsedTrip) sel.value = currentParsedTrip.conciergeMode || 'guided';

  if (!currentParsedTrip) return;
  const isC = currentParsedTrip.isCruise;
  const mode = currentParsedTrip.conciergeMode;

  let modeBadge = '';
  if (mode === 'cruise' || isC) modeBadge = '<span style="background:#0284c7; color:white; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-ship"></i> Profil Croisière (' + (currentParsedTrip.shipName || 'Navire') + ')</span>';
  else if (mode === 'guided') modeBadge = '<span style="background:#059669; color:white; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-compass"></i> Profil Circuit Accompagné (Temps libre ciblé)</span>';
  else if (mode === 'full') modeBadge = '<span style="background:#4f46e5; color:white; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-city"></i> Profil Séjour Libre / City-Break</span>';
  else modeBadge = '<span style="background:#64748b; color:white; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;">100% Guidé</span>';

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.borderColor = '#86efac';
    statusEl.style.background = '#f0fdf4';
    statusEl.style.color = '#15803d';
    statusEl.innerHTML = `<i class="fa-solid fa-check"></i> <strong>Conversion prête :</strong> ${currentParsedTrip.itinerary.length} étape(s), ${currentParsedTrip.hotels.length} hébergement(s), ${(currentParsedTrip.flightsList || []).length} vol(s) et ${(currentParsedTrip.contactsList || []).length} contact(s).`;
  }

  if (previewSummary) {
    const flights = currentParsedTrip.flightsList || [];
    const hotels = currentParsedTrip.hotels || [];
    const contacts = currentParsedTrip.contactsList || [];
    const practicals = currentParsedTrip.practicalTipsList || [];

    previewSummary.innerHTML = `
      <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <strong>Destination :</strong> <span style="font-size:0.95rem; font-weight:800; color:#0f172a;">${currentParsedTrip.title}</span>
        ${modeBadge}
      </div>
      <div style="margin-bottom:6px;"><strong>Sous-titre / Itinéraire :</strong> ${currentParsedTrip.subtitle || 'Voyages Girardot'}</div>
      <div style="margin-bottom:6px;"><strong>Dates :</strong> ${currentParsedTrip.dates || 'À définir'} • <strong>${currentParsedTrip.itinerary.length} jours au programme</strong></div>
      <div style="margin-bottom:6px;"><strong>Vols reconnus :</strong> ${flights.length > 0 ? flights.map(f => `${f.type}: ${f.airline} ${f.flightNumber} (${f.departureAirport} ➔ ${f.arrivalAirport})`).join(' | ') : '<em>Aucun vol (trajet autocar ou croisière)</em>'}</div>
      <div style="margin-bottom:6px;"><strong>Hébergements (${hotels.length}) :</strong> ${hotels.map(h => `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; border-radius:4px; padding:2px 6px; margin:2px; font-size:0.75rem;">${h.name} (${h.dates})</span>`).join('')}</div>
      <div style="margin-bottom:6px;"><strong>Contacts identifiés :</strong> ${contacts.map(c => `${c.category}: ${c.name} ${c.phone ? `(${c.phone})` : ''}`).join(' | ')}</div>
      <div style="margin-bottom:6px;"><strong>Infos pratiques extraites (${practicals.length}) :</strong> ${practicals.map(p => `<span style="display:inline-block; background:#fef3c7; color:#92400e; border-radius:4px; padding:2px 6px; margin:2px; font-size:0.75rem;">${p.title}</span>`).join('')}</div>
      <div><strong>Étapes :</strong> ${currentParsedTrip.itinerary.map(d => `<span style="display:inline-block; background:#e2e8f0; border-radius:4px; padding:2px 6px; margin:2px; font-size:0.75rem;">J${d.day}: ${d.highlight || d.title.slice(0, 20)}</span>`).join('')}</div>
    `;
  }
}

// ============================================================
// ENRICHISSEMENT DU PROGRAMME VIA UN PDF PARTENAIRE (RÉCEPTIF)
// ============================================================
let currentPartnerParsedDays = [];

function openPartnerEnrichModal() {
  if (!tripData || !tripData.title) {
    alert("⚠️ Aucun voyage actif n'est chargé dans l'administration.\nVeuillez d'abord sélectionner ou importer un voyage Girardot avant d'enrichir ses étapes.");
    return;
  }

  const titleEl = document.getElementById('partner-target-title');
  const metaEl = document.getElementById('partner-target-meta');
  if (titleEl) titleEl.textContent = tripData.title + (tripData.subtitle ? ` — ${tripData.subtitle}` : '');
  if (metaEl) {
    const daysCount = tripData.itinerary ? tripData.itinerary.length : 0;
    const hotelsCount = tripData.hotels ? tripData.hotels.length : 0;
    const flightsCount = tripData.flightsList ? tripData.flightsList.length : 0;
    metaEl.textContent = `${daysCount} jour(s) • ${hotelsCount} hôtel(s) • ${flightsCount} vol(s)`;
  }

  resetPartnerEnrichModalState();
  const modal = document.getElementById('partner-enrich-modal');
  if (modal) modal.style.display = 'flex';
}

function closePartnerEnrichModal() {
  const modal = document.getElementById('partner-enrich-modal');
  if (modal) modal.style.display = 'none';
}

function resetPartnerEnrichModalState() {
  currentPartnerParsedDays = [];
  const statusEl = document.getElementById('partner-enrich-status');
  const previewEl = document.getElementById('partner-preview-container');
  const btnApply = document.getElementById('btn-apply-partner-enrich');
  const rawInput = document.getElementById('partner-raw-text-input');
  const fileInput = document.getElementById('partner-pdf-file-input');

  if (statusEl) statusEl.style.display = 'none';
  if (previewEl) previewEl.style.display = 'none';
  if (btnApply) btnApply.style.display = 'none';
  if (rawInput) rawInput.value = '';
  if (fileInput) fileInput.value = '';
}

function handlePartnerPdfFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('partner-enrich-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.borderColor = '#93c5fd';
    statusEl.style.background = '#eff6ff';
    statusEl.style.color = '#1d4ed8';
    statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Lecture et analyse du PDF partenaire "${file.name}" en cours...`;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const typedarray = new Uint8Array(e.target.result);
    extractTextFromPartnerPdfArray(typedarray, file.name);
  };
  reader.readAsArrayBuffer(file);
}

function extractTextFromPartnerPdfArray(typedarray, originalFileName) {
  const statusEl = document.getElementById('partner-enrich-status');
  if (!window.pdfjsLib) {
    if (statusEl) {
      statusEl.style.borderColor = '#fca5a5';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#b91c1c';
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> La bibliothèque PDF.js n'a pas pu être chargée. Vous pouvez copier/coller directement le texte du PDF dans l'encadré ci-dessous.`;
    }
    return;
  }

  window.pdfjsLib.getDocument({ data: typedarray }).promise.then(async function(pdf) {
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      if (!items || items.length === 0) continue;

      items.sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        if (Math.abs(yA - yB) > 5) return yB - yA;
        return a.transform[4] - b.transform[4];
      });

      let pageLines = [];
      let currentLineY = null;
      let currentLineText = "";

      for (const item of items) {
        const str = item.str;
        if (!str) continue;
        const itemY = item.transform[5];

        if (currentLineY === null) {
          currentLineY = itemY;
          currentLineText = str;
        } else if (Math.abs(itemY - currentLineY) > 5) {
          pageLines.push(currentLineText.trim());
          currentLineY = itemY;
          currentLineText = str;
        } else {
          currentLineText += (currentLineText.endsWith(" ") || str.startsWith(" ") ? "" : " ") + str;
        }
      }
      if (currentLineText.trim()) pageLines.push(currentLineText.trim());
      fullText += pageLines.join("\n") + "\n\n";
    }

    processPartnerPdfText(fullText, originalFileName);
  }).catch(function(err) {
    if (statusEl) {
      statusEl.style.borderColor = '#fca5a5';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#b91c1c';
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erreur lors de la lecture du PDF : ${err.message}`;
    }
  });
}

function parsePastedPartnerText() {
  const rawInput = document.getElementById('partner-raw-text-input');
  if (!rawInput || !rawInput.value.trim()) {
    alert("Veuillez d'abord coller le texte du programme partenaire.");
    return;
  }
  processPartnerPdfText(rawInput.value.trim(), "Texte collé");
}

function parsePartnerItinerary(fullText) {
  const progIdx = fullText.search(/(?:^|\n)\s*LE\s+PROGRAMME\b/i);
  const textToScan = progIdx !== -1 ? fullText.slice(progIdx) : fullText;

  const endIdx = textToScan.search(/(?:HOTELS\s+NORMES|HOTELS\s+SELECTIONNES|DEVIS\s+N|TARIFS\s+EN\s+EUROS|NOS\s+PRIX\s+COMPRENNENT)/i);
  const cleanProgText = endIdx !== -1 ? textToScan.slice(0, endIdx) : textToScan;

  const dayHeaderRegex = /(?:^|\n)\s*(?:JOUR|J)\s*(\d{1,2})\s*[:–-]\s*([^\n\r]+)/gi;
  const days = [];
  let match;
  const indices = [];

  while ((match = dayHeaderRegex.exec(cleanProgText)) !== null) {
    indices.push({
      dayNum: parseInt(match[1], 10),
      rawHeader: match[2].trim(),
      startIndex: match.index,
      headerLength: match[0].length
    });
  }

  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i];
    const nextStart = (i + 1 < indices.length) ? indices[i + 1].startIndex : cleanProgText.length;
    const bodyRaw = cleanProgText.slice(cur.startIndex + cur.headerLength, nextStart).trim();

    const cleanLines = bodyRaw.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => {
        if (!l) return false;
        if (/^---\s*PAGE\s*\d+\s*---/i.test(l)) return false;
        if (/25\s+Boulevard\s+des\s+Martyrs\s+Nantais/i.test(l)) return false;
        if (/ZEN\s+ASIE\s+SAS\s+TOTRAVEL/i.test(l)) return false;
        if (/SIRET\s+\d+|GARANTIE\s+APST/i.test(l)) return false;
        return true;
      });

    let rawTitle = cur.rawHeader;
    let remainingLines = [...cleanLines];

    if (remainingLines.length > 0) {
      const firstLine = remainingLines[0];
      const isDate = /^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}/i.test(firstLine);
      const isContinuation = /^([A-Z0-9\s()\/–-]+(?:KM|H|\)))/i.test(firstLine) || /^[)]/.test(firstLine);
      if (!isDate && isContinuation) {
        rawTitle += ' ' + firstLine;
        remainingLines.shift();
      }
    }

    let dateStr = '';
    if (remainingLines.length > 0) {
      const isDate = /^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}/i.test(remainingLines[0]);
      if (isDate) {
        dateStr = remainingLines[0];
        remainingLines.shift();
      }
    }

    let cleanTitle = rawTitle
      .replace(/[\u2708\uFE0F\uD83D\uDEEB✈️]+/g, ' - ')
      .replace(/\s*\/\s*/g, ' - ')
      .replace(/\s*-\s*-\s*/g, ' - ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const description = remainingLines.join('\n\n');

    let detectedCity = "";
    let lat = null;
    let lng = null;
    const normSearch = (cleanTitle + " " + description).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const k of sortedCoordsKeys) {
      if (normSearch.includes(k)) {
        const c = DESTINATION_CITY_COORDINATES[k];
        detectedCity = c.city;
        lat = c.lat;
        lng = c.lng;
        break;
      }
    }

    days.push({
      day: cur.dayNum,
      title: cleanTitle,
      dateStr: dateStr,
      city: detectedCity,
      lat: lat,
      lng: lng,
      description: description,
      timeline: extractVisitsFromDay(description, cleanTitle)
    });
  }

  return days;
}

function processPartnerPdfText(fullText, sourceName) {
  const statusEl = document.getElementById('partner-enrich-status');
  const previewEl = document.getElementById('partner-preview-container');
  const btnApply = document.getElementById('btn-apply-partner-enrich');
  const countEl = document.getElementById('partner-days-count');
  const listEl = document.getElementById('partner-comparison-list');

  const partnerDays = parsePartnerItinerary(fullText);

  if (!partnerDays || partnerDays.length === 0) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.borderColor = '#fca5a5';
      statusEl.style.background = '#fef2f2';
      statusEl.style.color = '#b91c1c';
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Aucune étape (ex: "JOUR 01 : ...") n'a été détectée dans ce document. Vérifiez le format du fichier PDF ou collez directement son texte.`;
    }
    return;
  }

  currentPartnerParsedDays = partnerDays;

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.borderColor = '#86efac';
    statusEl.style.background = '#f0fdf4';
    statusEl.style.color = '#15803d';
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>${partnerDays.length} étape(s) détectée(s)</strong> dans le document partenaire. Vérifiez l'aperçu ci-dessous et appliquez la mise à jour.`;
  }

  if (countEl) countEl.textContent = partnerDays.length;

  if (listEl) {
    const existingDays = tripData.itinerary || [];
    listEl.innerHTML = partnerDays.map(p => {
      const cur = existingDays.find(d => d.day === p.day);
      const curTitle = cur ? cur.title : '<em>(Nouveau jour à créer)</em>';
      const curDescLen = cur && cur.description ? cur.description.length : 0;
      const newDescLen = p.description ? p.description.length : 0;
      const visitsCount = p.timeline ? p.timeline.length : 0;

      return `
        <div style="border-bottom:1px solid #f1f5f9; padding:10px; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:6px;">
            <div style="font-weight:800; color:#1e293b;">
              <span style="display:inline-block; background:#2563eb; color:white; border-radius:4px; padding:1px 6px; font-size:0.72rem; margin-right:6px;">Jour ${p.day}</span>
              ${p.title}
            </div>
            <div style="font-size:0.75rem; color:#64748b;">
              ${p.dateStr ? `<i class="fa-regular fa-calendar"></i> ${p.dateStr} • ` : ''}
              <strong>${visitsCount} visite(s)</strong>
            </div>
          </div>
          <div style="font-size:0.75rem; color:#475569; margin-bottom:4px;">
            <span style="color:#64748b;">Trajet actuel :</span> ${curTitle}
          </div>
          <div style="font-size:0.75rem; color:#0f172a; background:#f8fafc; border-left:3px solid #2563eb; padding:6px 10px; border-radius:0 6px 6px 0; max-height:60px; overflow:hidden; text-overflow:ellipsis;">
            ${p.description.slice(0, 180)}...
            <span style="color:#2563eb; font-weight:700;">(${newDescLen} car. vs ${curDescLen} car.)</span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (previewEl) previewEl.style.display = 'block';
  if (btnApply) btnApply.style.display = 'inline-flex';
}

function applyPartnerEnrichmentToCurrentTrip() {
  if (!currentPartnerParsedDays || currentPartnerParsedDays.length === 0) return;
  if (!tripData) return;

  const updateDesc = document.getElementById('chk-partner-desc') ? document.getElementById('chk-partner-desc').checked : true;
  const updateTitle = document.getElementById('chk-partner-title') ? document.getElementById('chk-partner-title').checked : true;
  const updateVisits = document.getElementById('chk-partner-visits') ? document.getElementById('chk-partner-visits').checked : true;
  const keepHighlights = document.getElementById('chk-partner-keep-highlights') ? document.getElementById('chk-partner-keep-highlights').checked : true;

  if (!tripData.itinerary) tripData.itinerary = [];

  let updatedCount = 0;
  let addedCount = 0;

  currentPartnerParsedDays.forEach(p => {
    let dayObj = tripData.itinerary.find(d => d.day === p.day);
    if (dayObj) {
      if (updateTitle && p.title) dayObj.title = p.title;
      if (updateDesc && p.description) dayObj.description = p.description;
      if (updateVisits && p.timeline && p.timeline.length > 0) dayObj.timeline = p.timeline;
      if (p.dateStr && !dayObj.dateStr) dayObj.dateStr = p.dateStr;
      if (p.city && (!dayObj.city || dayObj.city.length <= 3)) {
        dayObj.city = p.city;
        if (p.lat && !dayObj.lat) {
          dayObj.lat = p.lat;
          dayObj.lng = p.lng;
        }
      }
      if (!keepHighlights) dayObj.highlight = "";
      updatedCount++;
    } else {
      tripData.itinerary.push({
        day: p.day,
        title: p.title,
        city: p.city || "",
        dateStr: p.dateStr || `Jour ${p.day}`,
        highlight: "",
        weather: "",
        description: p.description,
        lat: p.lat,
        lng: p.lng,
        timeline: p.timeline || []
      });
      addedCount++;
    }
  });

  // Trier les jours par numéro croissant
  tripData.itinerary.sort((a, b) => a.day - b.day);

  // Sauvegarder dans IndexedDB & localStorage sans toucher aux hôtels, vols et contacts
  saveTripToCatalogAndStorage(tripData);
  renderAdminDays();
  closePartnerEnrichModal();

  alert(`✓ Enrichissement réussi du voyage "${tripData.title}" !\n\n• ${updatedCount} journée(s) enrichie(s)\n${addedCount > 0 ? `• ${addedCount} nouvelle(s) étape(s) ajoutée(s)\n` : ''}• Vos hôtels, vols et contacts Girardot ont été rigoureusement conservés.`);
}
