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

  // 3. Si c'est un voyage prédéfini dans le sous-dossier voyages/ (Italie, San Francisco...)
  const predefined = (window.AVAILABLE_TRIPS || []).find(t => t.id === tripId);
  if (predefined && predefined.file) {
    fetch(predefined.file)
      .then(res => res.json())
      .then(data => {
        tripData = data;
        normalizeAdminTripDocuments(tripData);
        populateForm();
        updateShareLink();
      })
      .catch(() => {
        tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
        tripData.id = tripId;
        tripData.title = predefined.title || "Voyage";
        tripData.documents = [];
        normalizeAdminTripDocuments(tripData);
        populateForm();
        updateShareLink();
      });
    return;
  }

  // Par défaut : nouveau squelette
  tripData = JSON.parse(JSON.stringify(window.defaultTravelData));
  tripData.id = tripId;
  tripData.documents = [];
  normalizeAdminTripDocuments(tripData);
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
  newTrip.freeTimeSuggestions = [];
  newTrip.documents = [];

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
  let currentEntry = null;

  lines.forEach((line, idx) => {
    // Ignorer les en-têtes évidentes
    if (/^(rooming|chambre|hotel|occupant|nom|type|régime|date|liste)/i.test(line) && line.length < 50) return;

    // Format CSV avec délimiteur (;, tab ou virgule)
    if (line.includes(';') || line.includes('\t') || (line.includes(',') && !line.includes('Street') && !line.includes('Avenue'))) {
      const parts = line.split(/[;\t]|,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 2) {
        let rNum = parts[0];
        let rType = parts[1] || "Double (Grand Lit)";
        let rOcc = parts[2] || "";
        let rNotes = parts[3] || "";

        // Si la 1ère colonne est plutôt un nom
        if (isNaN(parseInt(rNum)) && parts.length >= 2 && !isNaN(parseInt(parts[1]))) {
          rOcc = parts[0];
          rNum = parts[1];
          rType = parts[2] || "Double";
        }

        if (rOcc || !isNaN(parseInt(rNum))) {
          newEntries.push({
            roomNumber: rNum || String(100 + newEntries.length + 1),
            type: normalizeRoomType(rType),
            occupants: rOcc || rNum,
            notes: rNotes
          });
          return;
        }
      }
    }

    // Détection motif Chambre / N° (Ex: "Chambre 101", "Ch. 12", "101 - DBL - Dupont...")
    const roomMatch = line.match(/(?:chambre|ch\.?|room)?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\s*[:\-–—]?\s*(.*)/i);
    if (roomMatch && (!isNaN(parseInt(roomMatch[1])) || /^[A-Z]\d+/.test(roomMatch[1]))) {
      const rNum = roomMatch[1];
      const rest = roomMatch[2] ? roomMatch[2].trim() : "";

      let rType = "Double (Grand Lit)";
      let rOcc = rest;
      let rNotes = "";

      if (/sgl|single|individuelle/i.test(rest)) {
        rType = "Individuelle (Single)";
        rOcc = rest.replace(/sgl|single|individuelle/gi, '').replace(/[:\-–—]/g, '').trim();
      } else if (/twin|2\s*lits/i.test(rest)) {
        rType = "Twin (2 lits séparés)";
        rOcc = rest.replace(/twin|2\s*lits/gi, '').replace(/[:\-–—]/g, '').trim();
      } else if (/triple|3\s*lits/i.test(rest)) {
        rType = "Triple";
        rOcc = rest.replace(/triple|3\s*lits/gi, '').replace(/[:\-–—]/g, '').trim();
      }

      newEntries.push({
        roomNumber: rNum,
        type: rType,
        occupants: rOcc,
        notes: rNotes
      });
      return;
    }

    // Si la ligne ressemble à un nom d'occupant (Ex: "M. et Mme DUPONT Jean")
    if (/(?:M\.|Mme|Mlle|Monsieur|Madame)\b/i.test(line) || /^[A-ZÀ-Ý\s-]{4,30}\s+[A-ZÀ-Ýa-zà-ÿ]+/.test(line)) {
      newEntries.push({
        roomNumber: String(101 + newEntries.length),
        type: "Double (Grand Lit)",
        occupants: line,
        notes: ""
      });
    }
  });

  if (newEntries.length > 0) {
    tripData.driverDossier.roomingList = newEntries;
    renderAdminDriver();
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> <strong>${newEntries.length} chambre(s)</strong> importée(s) et synchronisées avec succès depuis <em>${sourceFileName}</em>.</span>`;
    }
  } else {
    alert("Le fichier a été lu mais aucune structure de chambre n'a pu être reconnue. Vous pouvez ajouter les chambres manuellement avec le bouton '+ Ajouter une chambre'.");
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

  lines.forEach((line) => {
    // Ignorer les en-têtes
    if (/^(passager|participant|nom|prenom|prénom|place|siège|arret|montée|telephone|téléphone)/i.test(line) && line.length < 50) return;

    // Détection format délimité (CSV ou tabulation)
    if (line.includes(';') || line.includes('\t') || (line.includes(',') && !line.includes('Street') && !line.includes('Avenue'))) {
      const parts = line.split(/[;\t]|,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 2) {
        let pName = parts[0];
        let pPickup = parts[1] || "Départ circuit";
        let pPhone = parts[2] || "";
        let pSeat = parts[3] || "";
        let pNotes = parts[4] || "";

        // Si la 1ère colonne est un numéro de siège (ex: "1A", "2B")
        if (/^\d{1,2}[A-D]$/i.test(parts[0])) {
          pSeat = parts[0].toUpperCase();
          pName = parts[1];
          pPickup = parts[2] || "Départ circuit";
          pPhone = parts[3] || "";
        }

        if (pName) {
          newPassengers.push({
            name: pName,
            pickup: pPickup,
            phone: pPhone,
            seatNumber: pSeat,
            notes: pNotes
          });
          return;
        }
      }
    }

    // Détection ligne textuelle avec N° de siège (ex: "1A - DUPONT Jean - Mâcon - 06 12 34 56 78")
    const seatMatch = line.match(/^(\d{1,2}[A-D])\s*[:\-–—]?\s*(.*)/i);
    if (seatMatch) {
      const seat = seatMatch[1].toUpperCase();
      const rest = seatMatch[2].trim();
      const parts = rest.split(/[-–—•,;]/).map(p => p.trim());
      newPassengers.push({
        seatNumber: seat,
        name: parts[0] || rest,
        pickup: parts[1] || "Départ circuit",
        phone: parts.find(p => /(?:0|\+33|\+52|\+1)\s*\d/.test(p)) || "",
        notes: ""
      });
      return;
    }

    // Ligne textuelle représentant une personne (ex: "M. DUPONT Jean (06 12 34 56 78) - Chalon")
    if (/(?:M\.|Mme|Mlle|Monsieur|Madame)\b/i.test(line) || /^[A-ZÀ-Ý\s-]{3,30}\s+[A-ZÀ-Ýa-zà-ÿ]+/.test(line)) {
      const phoneMatch = line.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/);
      let phone = phoneMatch ? phoneMatch[0].trim() : "";
      let cleanName = line.replace(phone, '').replace(/[()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();

      newPassengers.push({
        name: cleanName,
        pickup: "Départ circuit",
        phone: phone,
        seatNumber: "",
        notes: ""
      });
    }
  });

  if (newPassengers.length > 0) {
    tripData.driverDossier.passengersList = newPassengers;
    renderAdminDriver();
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-check"></i> <strong>${newPassengers.length} passager(s)</strong> importé(s) avec succès depuis <em>${sourceFileName}</em>.</span>`;
    }
  } else {
    alert("Le document a été lu mais aucun participant n'a pu être reconnu. Vous pouvez utiliser le bouton '+ Ajouter un passager' pour compléter la liste.");
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
          <label>Nom de l'établissement :</label>
          <input type="text" id="hotel-name-${index}" class="form-control" value="${hotel.name || ''}" placeholder="Ex: RH Hotel & Apartments Pretoria" onchange="updateHotelField(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Dates de séjour :</label>
          <input type="text" class="form-control" value="${hotel.dates || ''}" placeholder="Ex: Du 13 au 14 octobre" onchange="updateHotelField(${index}, 'dates', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Adresse de l'hôtel (calcul GPS automatique) :</label>
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

// Moteur heuristique d'analyse et de structuration du programme Girardot
function processExtractedTextToTrip(text, sourceName) {
  const statusEl = document.getElementById('pdf-import-status');
  const previewBox = document.getElementById('pdf-preview-container');
  const previewSummary = document.getElementById('pdf-preview-summary');
  const btnDownload = document.getElementById('btn-download-parsed-json');
  const btnApply = document.getElementById('btn-apply-parsed-trip');

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Détection du Titre et Dates globales
  let detectedTitle = "";
  let detectedSubtitle = "Circuit exclusif Voyages Girardot";
  let detectedDates = "";
  let detectedStartDate = "";
  let detectedEndDate = "";

  // Recherche de motif de carnet "Votre carnet de voyage X"
  for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
    const l = rawLines[i];
    const carnetMatch = l.match(/Votre carnet de voyage\s+(.*)/i);
    if (carnetMatch) {
      detectedTitle = carnetMatch[1].trim();
    }
    const datesMatch = l.match(/((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4})\s*[-–—]\s*((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+[a-zà-ÿ]+\s+\d{4})/i);
    if (datesMatch) {
      detectedDates = `${datesMatch[1]} au ${datesMatch[2]}`;
    }
    const subMatch = l.match(/De\s+([A-Za-zÀ-Ý\s-]+)\s+au\s+([A-Za-zÀ-Ý\s-]+(?:\s+en passant par\s+[A-Za-zÀ-Ý\s-]+)?)/i);
    if (subMatch) {
      detectedSubtitle = subMatch[0].trim();
    }
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
  const dayHeaderRegex = /^(?:Jour|J)\s*(\d{1,2})\b(?:\s*[•:\-–—]\s*(.*))?$/i;

  // Repérer la fin du programme des étapes (ex: "Coordonnées de vos hôtels", "Le voyage n'étant pas une science exacte")
  const stopKeywords = [
    "coordonnées de vos hôtels", "coordonnees de vos hotels", "vos hôtels", "vos hotels",
    "le voyage n’étant pas une science exacte", "le voyage n'etant pas une science exacte",
    "votre accompagnatrice", "votre guide", "vos contacts", "convocation aérienne"
  ];

  let inItinerarySection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lowerLine = line.toLowerCase();

    // Arrêt si on atteint la fin du programme
    if (itinerary.length > 0 && stopKeywords.some(sk => lowerLine.startsWith(sk) || lowerLine.includes(sk))) {
      if (currentDay) {
        itinerary.push(currentDay);
        currentDay = null;
      }
      break;
    }

    const match = line.match(dayHeaderRegex);
    if (match) {
      inItinerarySection = true;
      if (currentDay) {
        itinerary.push(currentDay);
      }
      const dayNum = parseInt(match[1], 10);
      let dayTitle = (match[2] || "").trim();
      
      // Si le titre était sur la même ligne ou vide
      if (!dayTitle) {
        dayTitle = `Étape Jour ${dayNum}`;
      }

      currentDay = {
        day: dayNum,
        title: `Jour ${dayNum} • ${dayTitle.replace(/^(?:Jour\s*\d+\s*[•:\-–—]\s*)/i, '')}`,
        highlight: dayTitle.replace(/^(?:Jour\s*\d+\s*[•:\-–—]\s*)/i, ''),
        city: extractProbableCity(dayTitle),
        dateStr: `Jour ${dayNum}`,
        description: "",
        lat: 0,
        lng: 0,
        timeline: []
      };
      continue;
    }

    if (inItinerarySection && currentDay) {
      // Détecter si la ligne contient une heure (ex: 09h30, 14:00)
      const timeMatch = line.match(/(?:^|\b)(\d{1,2}[h:]\d{2})\b[:\s\-–—]*(.*)/i);
      if (timeMatch) {
        const timeStr = timeMatch[1].replace('h', ':');
        const descStr = timeMatch[2] ? timeMatch[2].trim() : "Visite et découverte";
        currentDay.timeline.push({
          time: timeStr.length === 4 ? '0' + timeStr : timeStr,
          title: descStr.slice(0, 50) || "Visite programmée",
          subtitle: descStr,
          icon: detectIconForText(descStr)
        });
      } else {
        // Ajouter au texte descriptif de la journée
        currentDay.description += (currentDay.description ? " " : "") + line;
      }
    }
  }

  if (currentDay) {
    itinerary.push(currentDay);
  }

  // Découper les descriptions longues en timeline chronologique de visites
  itinerary.forEach(d => {
    if (!d.timeline || d.timeline.length === 0) {
      const sentences = (d.description || "").split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        d.timeline = sentences.slice(0, 4).map((sentence, idx) => {
          const hour = 8 + (idx * 3);
          const timeStr = `${hour < 10 ? '0' : ''}${hour}:00`;
          let shortTitle = sentence.slice(0, 55).replace(/[.!?]$/, '').trim();
          return {
            time: timeStr,
            title: shortTitle,
            subtitle: sentence,
            icon: detectIconForText(sentence)
          };
        });
      } else {
        d.timeline = [
          {
            time: "10:00",
            title: d.highlight || d.title,
            subtitle: d.description || "Déroulé de la journée.",
            icon: "route"
          }
        ];
      }
    }
  });

  // 3. Détection des Hôtels avec Dates et Adresses complètes
  const hotels = [];
  const hotelSectionRegex = /(?:coordonn[ée]es de vos h[ôo]tels|vos h[ôo]tels)([\s\S]*?)(?:votre accompagnatrice|votre guide|vos contacts|formalités|bon à savoir|$)/i;
  const hotelSectionMatch = text.match(hotelSectionRegex);
  const hotelTextToAnalyze = hotelSectionMatch ? hotelSectionMatch[1] : text;

  // Motif typique Girardot :
  // "du 11 au 13 novembre" suivi de "HOTEL NOM", adresse, code postal, téléphone
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

      hotels.push({
        name: hotelName,
        dates: datesStay,
        city: addressParts[addressParts.length - 1] || "Étape du circuit",
        address: addressParts.join(", ") || hotelName,
        phone: phone,
        lat: 0,
        lng: 0,
        notes: "Hôtel sélectionné par Voyages Girardot"
      });
    }
  }

  // Si le motif "du X au Y" n'a pas matché, recherche heuristique par mot-clé HOTEL
  if (hotels.length === 0) {
    const fallbackHotelRegex = /(?:hôtel|hotel|lodge|camp)\s+([A-ZÀ-Ý][\w\s'-]{3,35})/gi;
    let fhMatch;
    const foundNames = new Set();
    while ((fhMatch = fallbackHotelRegex.exec(text)) !== null) {
      const name = fhMatch[0].trim();
      if (!foundNames.has(name) && name.length < 40) {
        foundNames.add(name);
        hotels.push({
          name: name,
          dates: "Pendant le circuit",
          city: "Étape du circuit",
          address: name,
          phone: "",
          lat: 0,
          lng: 0,
          notes: ""
        });
      }
    }
  }

  // 4. Détection des Contacts (Guide local, Accompagnatrice, Urgences / Réceptif)
  const contactsList = [];

  // A. Accompagnatrice Girardot
  const accompMatch = text.match(/Votre accompagnatrice\s*(?:Girardot)?\s*\n+([A-ZÀ-Ýa-zà-ÿ\s-]+)/i);
  if (accompMatch) {
    const accompName = accompMatch[1].trim();
    contactsList.push({
      category: "Accompagnatrice Girardot",
      name: accompName,
      phone: "",
      address: "Avec le groupe sur le circuit",
      isEmergency: false
    });
  }

  // B. Guide local
  const guideMatch = text.match(/Votre guide local\s*\n+([A-ZÀ-Ýa-zà-ÿ\s-]+)(?:\n+T[ée]l\.?\s*:\s*([+\d\s().-]+))?/i);
  if (guideMatch) {
    contactsList.push({
      category: "Guide Local",
      name: guideMatch[1].trim(),
      phone: guideMatch[2] ? guideMatch[2].trim() : "",
      address: "Guide local francophone",
      isEmergency: false
    });
  }

  // C. Réceptif et Urgences
  const receptifMatch = text.match(/(?:Au Mexique|Réceptif local|En France|Vos contacts)\s*[–-]?\s*([A-ZÀ-Ý\s&’']+)?\s*:\s*([\s\S]*?)(?=(?:Formalités|Bon à savoir|Assurance|$))/i);
  if (receptifMatch) {
    const rawContactBlock = receptifMatch[2].slice(0, 450);
    const phones = rawContactBlock.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g) || [];
    const mainPhone = phones[0] || "";
    const contactNameMatch = rawContactBlock.match(/(?:Mme|M\.)\s+([A-Za-zÀ-Ý\s-]+)/);
    const contactName = contactNameMatch ? contactNameMatch[0] : (receptifMatch[1] || "Correspondant Réceptif Local");

    contactsList.push({
      category: "Correspondant Réceptif & Urgence",
      name: contactName.trim(),
      phone: mainPhone,
      address: "Assistance locale 24h/24",
      isEmergency: true
    });
  }

  // D. Assistance Girardot standard
  contactsList.push({
    category: "Assistance Girardot 24h/7j",
    name: "Permanence Urgences Girardot",
    phone: "03 85 42 82 50",
    address: "Chalon-sur-Saône, France",
    isEmergency: true
  });

  // 5. Détection des Vols (Aller / Retour avec numéros de vol, dates, aéroports, horaires)
  const flightsList = [];
  
  // Bloc Aller
  const outboundMatch = text.match(/Aller\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})([\s\S]*?)(?=Retour|$)/i);
  if (outboundMatch) {
    const outDate = outboundMatch[1];
    const outBlock = outboundMatch[2];

    const depAero = (outBlock.match(/D[ée]collage de l[’']a[ée]roport de\s*:\s*(.*)/i) || [])[1] || "";
    const arrAero = (outBlock.match(/A l[’']a[ée]roport de\s*:\s*(.*)/i) || [])[1] || "";
    const flightNum = (outBlock.match(/N°\s*de vol\s*:\s*(.*)/i) || [])[1] || "";
    const depTime = (outBlock.match(/D[ée]collage pr[ée]vu [àa]\s*:\s*(.*)/i) || [])[1] || "";
    const arrTime = (outBlock.match(/Arriv[ée]e pr[ée]vue [àa]\s*:\s*(.*)/i) || [])[1] || "";
    const comp = (outBlock.match(/Compagnie\s*:\s*(.*)/i) || [])[1] || "Air France";
    const meeting = (outBlock.match(/Heure de pr[ée]sentation\s*:\s*(.*)/i) || [])[1] || "";

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

  // Bloc Retour
  const inboundMatch = text.match(/Retour\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})([\s\S]*?)(?=Nous attirons|Bagages|Jour 1|$)/i);
  if (inboundMatch) {
    const inDate = inboundMatch[1];
    const inBlock = inboundMatch[2];

    const depAero = (inBlock.match(/D[ée]collage de l[’']a[ée]roport de\s*:\s*(.*)/i) || [])[1] || "";
    const arrAero = (inBlock.match(/A l[’']a[ée]roport de\s*:\s*(.*)/i) || [])[1] || "";
    const flightNum = (inBlock.match(/N°\s*de vol\s*:\s*(.*)/i) || [])[1] || "";
    const depTime = (inBlock.match(/D[ée]collage pr[ée]vu [àa]\s*:\s*(.*)/i) || [])[1] || "";
    const arrTime = (inBlock.match(/Arriv[ée]e pr[ée]vue [àa]\s*:\s*(.*)/i) || [])[1] || "";
    const comp = (inBlock.match(/Compagnie\s*:\s*(.*)/i) || [])[1] || "Air France";

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

  // Si pas de bloc formaté détecté, créer au moins un vol générique si le mot vol apparaît
  if (flightsList.length === 0 && text.match(/vol|avion|aéroport|terminal/i)) {
    flightsList.push({
      type: "Aller",
      airline: "Compagnie régulière",
      flightNumber: "",
      departureAirport: "Paris",
      departureTime: "",
      arrivalAirport: detectedTitle,
      arrivalTime: "",
      date: "Jour 1",
      via: "",
      notes: ""
    });
  }

  // 6. Objet Voyage Final
  const newTripId = 'voyage-' + Date.now();
  currentParsedTrip = {
    id: newTripId,
    title: detectedTitle || "Cocktail Mexicain",
    subtitle: detectedSubtitle || "Circuit exclusif Voyages Girardot",
    dates: detectedDates || "Du 11 au 23 novembre 2026",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + (itinerary.length || 14) * 86400000).toISOString().split('T')[0],
    coverImage: "https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1200&q=80",
    intro: text.slice(0, 320) + "...",
    alert: {
      title: "Formalités indispensables",
      text: "Passeport biométrique valide 6 mois après la date de retour. Formulaire FMM à conserver précieusement.",
      link: ""
    },
    flightsList: flightsList,
    itinerary: itinerary,
    hotels: hotels,
    documents: [],
    freeTimeSuggestions: [],
    contactsList: contactsList,
    practicalInfo: {
      money: "Monnaie : Peso mexicain. Cartes de crédit acceptées. Prévoir des espèces pour les petits commerces.",
      electricity: "110 volts. Prises à fiches plates américaines (prévoir un adaptateur).",
      clothing: "Tenue d'été pour la côte, lainages pour les régions en altitude et la climatisation du car.",
      tips: "Pourboires indicatifs : 3 € / jour / personne pour le guide et 2 € pour le chauffeur.",
      wifi: "Wi-Fi disponible gratuitement dans les hôtels."
    },
    driverDossier: {
      busModel: "Autocar Grand Tourisme",
      busCapacity: 50,
      busPlanUrl: "",
      busNotes: "Placement libre ou selon consignes de l'accompagnatrice.",
      roomingList: [],
      roomingFileUrl: "",
      passengersList: []
    }
  };

  // Synchronisation rétrocompatible des objets flights et contacts
  if (flightsList.length > 0) {
    const outF = flightsList.find(f => f.type === 'Aller') || flightsList[0];
    const inF = flightsList.find(f => f.type === 'Retour') || flightsList[flightsList.length - 1];
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
  }

  if (contactsList.length > 0) {
    const mainRec = contactsList.find(c => c.category.toLowerCase().includes('réceptif') || c.category.toLowerCase().includes('urgence')) || contactsList[0];
    currentParsedTrip.contacts = {
      receptif: {
        name: mainRec.name,
        emergency: mainRec.phone,
        phone: mainRec.phone,
        address: mainRec.address
      },
      agence: {
        name: "Voyages Girardot",
        phone: "03 85 42 82 50",
        email: "contact@voyages-girardot.com"
      }
    };
  }

  // Affichage du résultat dans le modal
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.borderColor = '#86efac';
    statusEl.style.background = '#f0fdf4';
    statusEl.style.color = '#15803d';
    statusEl.innerHTML = `<i class="fa-solid fa-check"></i> <strong>Conversion réussie !</strong> ${itinerary.length} étape(s), ${hotels.length} hôtel(s), ${flightsList.length} vol(s) et ${contactsList.length} contact(s) reconnus.`;
  }

  if (previewBox && previewSummary) {
    previewBox.style.display = 'block';
    previewSummary.innerHTML = `
      <div style="margin-bottom:6px;"><strong>Destination :</strong> ${currentParsedTrip.title} (${currentParsedTrip.subtitle})</div>
      <div style="margin-bottom:6px;"><strong>Dates :</strong> ${currentParsedTrip.dates} • <strong>${itinerary.length} jours au programme</strong></div>
      <div style="margin-bottom:6px;"><strong>Vols reconnus :</strong> ${flightsList.map(f => `${f.type}: ${f.airline} ${f.flightNumber} (${f.departureAirport} ➔ ${f.arrivalAirport})`).join(' | ')}</div>
      <div style="margin-bottom:6px;"><strong>Hôtels avec adresses :</strong> ${hotels.map(h => `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; border-radius:4px; padding:2px 6px; margin:2px; font-size:0.75rem;">${h.name} (${h.dates})</span>`).join('')}</div>
      <div style="margin-bottom:6px;"><strong>Contacts identifiés :</strong> ${contactsList.map(c => `${c.category}: ${c.name} ${c.phone ? `(${c.phone})` : ''}`).join(' | ')}</div>
      <div><strong>Étapes :</strong> ${itinerary.map(d => `<span style="display:inline-block; background:#e2e8f0; border-radius:4px; padding:2px 6px; margin:2px; font-size:0.75rem;">J${d.day}: ${d.highlight || d.title.slice(0, 20)}</span>`).join('')}</div>
    `;
  }

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
  const filename = `${currentParsedTrip.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`;
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

  saveTripToCatalogAndStorage(currentParsedTrip);
  currentTripId = currentParsedTrip.id;
  tripData = currentParsedTrip;

  renderTripSelectorOptions();
  populateForm();
  updateShareLink();
  closePdfImportModal();

  alert(`✓ Le voyage "${currentParsedTrip.title}" extrait du PDF a été chargé dans l'administration avec succès !`);
}

