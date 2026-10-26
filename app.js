// Service Worker Registration for Offline Mode
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('SW enregistré:', reg.scope);
    }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}

// App State
let currentTrip = null;
let activeDayIndex = 0; // Index of the selected day (0 for Day 1)
let leafletMap = null;
let mapMarkers = [];

// Recherche et récupération automatique du logo de compagnie aérienne
function getAirlineLogoUrl(airlineName = "", flightNumber = "") {
  if (!airlineName && !flightNumber) return null;

  const cleanName = (airlineName || "").trim().toLowerCase();
  const cleanFlight = (flightNumber || "").trim().toUpperCase();

  // Dictionnaire IATA des compagnies majeures
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

  // 2. Si non trouvé, tentative d'extraction par préfixe du n° de vol (ex: EK82 -> EK, FA168 -> FA)
  if (!code && cleanFlight) {
    const match = cleanFlight.match(/^([A-Z0-9]{2})\s*\d+/);
    if (match && match[1]) {
      code = match[1];
    }
  }

  if (code) {
    // Source Duffel haute résolution vectorielle / SVG ou CDN Kiwi 64px
    return {
      code: code,
      svg: `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code}.svg`,
      png: `https://images.kiwi.com/airlines/64/${code}.png`
    };
  }

  return null;
}

// Génère les liens directs de suivi de vol en direct (FlightAware & Flightradar24)
function getFlightTrackingLinks(flightNumber = "", airlineName = "") {
  if (!flightNumber && !airlineName) return null;

  // Nettoyage du numéro de vol (ex: "EK 82" -> "EK82")
  let cleanNum = (flightNumber || "").trim().toUpperCase().replace(/\s+/g, '');

  // Si on a un numéro de vol bien formé (ex: EK82, AF136, FA168)
  if (cleanNum && /^[A-Z0-9]{2,3}\d+$/.test(cleanNum)) {
    return {
      flightNumber: cleanNum,
      flightAwareUrl: `https://www.flightaware.com/live/flight/${encodeURIComponent(cleanNum)}`,
      flightradar24Url: `https://www.flightradar24.com/${encodeURIComponent(cleanNum)}`
    };
  }

  // Si le code IATA est déductible mais absent du numéro de vol
  const logoInfo = getAirlineLogoUrl(airlineName, flightNumber);
  if (logoInfo && logoInfo.code) {
    const numOnly = cleanNum.replace(/[^0-9]/g, '');
    if (numOnly) {
      const fullCallsign = `${logoInfo.code}${numOnly}`;
      return {
        flightNumber: fullCallsign,
        flightAwareUrl: `https://www.flightaware.com/live/flight/${encodeURIComponent(fullCallsign)}`,
        flightradar24Url: `https://www.flightradar24.com/${encodeURIComponent(fullCallsign)}`
      };
    }
  }

  if (cleanNum) {
    return {
      flightNumber: cleanNum,
      flightAwareUrl: `https://www.flightaware.com/live/flight/${encodeURIComponent(cleanNum)}`,
      flightradar24Url: `https://www.flightradar24.com/${encodeURIComponent(cleanNum)}`
    };
  }

  return null;
}

// Catalogue des voyages pour le client
function getClientAvailableTrips() {
  const customList = JSON.parse(localStorage.getItem('girardot_trips_catalog') || '[]');
  const predefined = (window.AVAILABLE_TRIPS || []).map(t => ({
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    dates: t.dates,
    file: t.file
  }));

  const map = new Map();
  predefined.forEach(p => map.set(p.id, p));
  customList.forEach(c => map.set(c.id, c));
  return Array.from(map.values());
}

// Load data: from URL parameter (?trip= ou ?id=), or localStorage, or default
function loadTripData() {
  const urlParams = new URLSearchParams(window.location.search);
  const tripParam = urlParams.get('trip');
  const idParam = urlParams.get('id');

  // 1. Paramètre Base64 complet dans l'URL
  if (tripParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(tripParam))));
      currentTrip = decoded;
      normalizeTripTransitMaps();
      // Sauvegarder dans le stockage du navigateur sous son ID sans toucher aux documents du client
      if (decoded && decoded.id) {
        localStorage.setItem(`girardot_trip_data_${decoded.id}`, JSON.stringify(decoded));
        localStorage.setItem('girardot_active_trip_id', decoded.id);
      }
      return;
    } catch (e) {
      console.warn('Impossible de charger le voyage depuis l URL:', e);
    }
  }

  // 2. Paramètre ID dans l'URL (?id=san-francisco ou ?id=italie-dolomites-2026)
  if (idParam) {
    const stored = localStorage.getItem(`girardot_trip_data_${idParam}`);
    if (stored) {
      try {
        currentTrip = JSON.parse(stored);
        normalizeTripTransitMaps();
        return;
      } catch (e) {}
    }
    // Vérifier si le voyage est présent dans les voyages préenregistrés du dossier voyages/
    const foundPredefined = (window.AVAILABLE_TRIPS || []).find(t => t.id === idParam || t.alias === idParam || (t.aliases && t.aliases.includes(idParam)));
    const targetFile = (foundPredefined && foundPredefined.file) ? foundPredefined.file : `voyages/${idParam}.json`;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', encodeURI(targetFile), false); // Synchrone pour initialisation immédiate
      xhr.send(null);
      if (xhr.status === 200 || xhr.status === 0) {
        currentTrip = JSON.parse(xhr.responseText);
        normalizeTripTransitMaps();
        localStorage.setItem(`girardot_trip_data_${currentTrip.id}`, JSON.stringify(currentTrip));
        localStorage.setItem('girardot_active_trip_id', currentTrip.id);
        return;
      }
    } catch (err) {
      console.warn('Chargement synchrone du fichier voyage impossible, essai différé:', err);
    }
  }

  // 3. Voyage actif mémorisé
  const activeId = localStorage.getItem('girardot_active_trip_id');
  if (activeId) {
    const storedTrip = localStorage.getItem(`girardot_trip_data_${activeId}`);
    if (storedTrip) {
      try {
        currentTrip = JSON.parse(storedTrip);
        normalizeTripTransitMaps();
        return;
      } catch (e) {}
    }
  }

  const legacyStored = localStorage.getItem('girardot_active_carnet');
  if (legacyStored) {
    try {
      currentTrip = JSON.parse(legacyStored);
      normalizeTripTransitMaps();
      return;
    } catch (e) {
      console.error(e);
    }
  }

  currentTrip = window.defaultTravelData;
  normalizeTripTransitMaps();
}

function normalizeTripDocuments() {
  if (!currentTrip) return;
  const isSouthAfrica = (currentTrip.id === 'afrique-du-sud-2026') || 
    ((currentTrip.title || '') + ' ' + (currentTrip.destination || '')).toLowerCase().includes('afrique du sud');

  if (!isSouthAfrica) {
    const defaultSaDocIds = ['doc-flight-out', 'doc-voucher-safari', 'doc-ticket-tablemt'];
    if (Array.isArray(currentTrip.documents)) {
      currentTrip.documents = currentTrip.documents.filter(d => !defaultSaDocIds.includes(d.id));
    }
    // Nettoyer les reliquats d'Afrique du Sud dans les étapes pour les autres voyages
    const saQrCodes = ['VOUCHER-SOWETO-01', 'VOUCHER-KRUGER-BIGFIVE-GIRARDOT', 'TICKET-TABLE-MOUNTAIN-GIRARDOT-2026', 'E-TICKET-EK82-LYS-JNB-GIRARDOT', 'VOUCHER-BLYDE-CANYON-04', 'VOUCHER-NDEBELE-VILLAGE-02'];
    if (Array.isArray(currentTrip.itinerary)) {
      currentTrip.itinerary.forEach(day => {
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


function normalizeTripItinerary() {
  if (!currentTrip || !Array.isArray(currentTrip.itinerary)) return;
  currentTrip.itinerary.forEach((item, idx) => {
    if (!item.day && item.dayNumber) item.day = item.dayNumber;
    if (!item.day) item.day = idx + 1;
    if (!item.dayNumber) item.dayNumber = item.day;
    if (!item.dateStr && item.date) item.dateStr = item.date;
    if (!item.timeline && Array.isArray(item.steps)) {
      item.timeline = item.steps.map(s => ({
        time: s.time || '',
        title: s.title || '',
        subtitle: s.desc || s.subtitle || '',
        description: s.desc || s.description || '',
        icon: (s.time === '08:00' || s.time === '08:30' || s.time === '09:00') ? 'anchor' : 'location-dot',
        lat: s.lat || item.lat,
        lng: s.lng || item.lng
      }));
    }
  });
}

function normalizeTripTransitMaps() {
  normalizeTripDocuments();
  normalizeTripItinerary();
  if (!currentTrip || !currentTrip.conciergerie || !currentTrip.conciergerie.themes) return;
  const transportTheme = currentTrip.conciergerie.themes.find(t => t.id === 'transports');
  if (!transportTheme) return;

  const tripText = ((currentTrip.title || '') + ' ' + (currentTrip.destination || '') + ' ' + (currentTrip.subtitle || '')).toLowerCase();
  
  // Correction automatique si le plan de transport pointe vers l'ancien lien SF 404 ou si c'est San Francisco sans image locale
  if (tripText.includes('san francisco') || tripText.includes('francisco') || (transportTheme.transitMapImageUrl && transportTheme.transitMapImageUrl.includes('sfmta.com'))) {
    if (!transportTheme.transitMapImageUrl || transportTheme.transitMapImageUrl.includes('sfmta.com/sites/default/files') || transportTheme.transitMapImageUrl.includes('Nov_2022.png')) {
      transportTheme.transitMapImageUrl = "assets/sf-metro-map.jpg";
    }
    if (!transportTheme.transitMapUrl) {
      transportTheme.transitMapUrl = "https://www.sfmta.com/maps";
    }
  }

  // Idem pour Chicago
  if (tripText.includes('chicago')) {
    if (!transportTheme.transitMapImageUrl) {
      transportTheme.transitMapImageUrl = "assets/chicago-metro-map.svg";
    }
    if (!transportTheme.transitMapUrl) {
      transportTheme.transitMapUrl = "https://www.transitchicago.com/maps/";
    }
  }
}

// Rendu du sélecteur client (désactivé pour n'afficher que le carnet prévu)
function renderClientTripSelector() {
  const select = document.getElementById('client-trip-quick-selector');
  if (select) select.style.display = 'none';
}

function onClientTripSwitch(tripId) {
  // Sauvegarder comme voyage actif
  localStorage.setItem('girardot_active_trip_id', tripId);
  sessionStorage.removeItem('girardot_selected_day');

  // Si présent en local
  const localData = localStorage.getItem(`girardot_trip_data_${tripId}`);
  if (localData) {
    currentTrip = JSON.parse(localData);
    refreshAppAfterTripChange();
    return;
  }

  // Si présent dans les voyages prédéfinis (Italie, San Francisco, Chicago, Mexique...)
  const predefinedTrip = (window.AVAILABLE_TRIPS || []).find(t => t.id === tripId || t.alias === tripId || (t.aliases && t.aliases.includes(tripId)));
  if (predefinedTrip && predefinedTrip.file) {
    fetch(encodeURI(predefinedTrip.file))
      .then(res => res.json())
      .then(data => {
        currentTrip = data;
        localStorage.setItem(`girardot_trip_data_${currentTrip.id}`, JSON.stringify(currentTrip));
        refreshAppAfterTripChange();
      })
      .catch(() => {
        window.location.href = `index.html?id=${tripId}`;
      });
    return;
  }

  // Si c'est l'Afrique du Sud
  if (tripId === 'afrique-du-sud-2026') {
    currentTrip = window.defaultTravelData;
    refreshAppAfterTripChange();
    return;
  }

  window.location.href = `index.html?id=${tripId}`;
}

function refreshAppAfterTripChange() {
  normalizeTripTransitMaps();
  activeDayIndex = determineInitialDayIndex();
  renderClientTripSelector();
  renderDaySelectorPills();
  renderTodayFocus();
  renderFullCircuit();
  renderSouvenirs();
  renderConciergerie();
  renderHotelsAndFlights();
  renderContactsAndAlert();
  updateMapFilterButtonsVisibility();
  if (leafletMap) {
    renderMapMarkers('all');
  }
}

// Determine initial day based on travel dates
function determineInitialDayIndex() {
  if (!currentTrip || !currentTrip.itinerary || !currentTrip.itinerary.length) return 0;
  
  // If the user previously selected a day in this session, keep it
  const savedDay = sessionStorage.getItem('girardot_selected_day');
  if (savedDay !== null) {
    const idx = parseInt(savedDay);
    if (idx >= 0 && idx < currentTrip.itinerary.length) return idx;
  }

  // Calculate day based on current date
  const today = new Date();
  if (currentTrip.startDate) {
    const start = new Date(currentTrip.startDate);
    const diffTime = today - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < currentTrip.itinerary.length) {
      return diffDays;
    }
  }

  // Default to day 1 (or day 0 in index)
  return 0;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialiser la navigation par onglets EN PREMIER pour garantir l'interactivité quoi qu'il arrive
  initNavigation();

  // 2. Charger les données du voyage et normaliser
  loadTripData();
  normalizeTripItinerary();
  renderClientTripSelector();
  activeDayIndex = determineInitialDayIndex();
  
  // 3. Rendu sécurisé de chaque sous-composant
  try { renderDaySelectorPills(); } catch(e) { console.error('Pills error:', e); }
  try { renderTodayFocus(); } catch(e) { console.error('TodayFocus error:', e); }
  try { renderFullCircuit(); } catch(e) { console.error('FullCircuit error:', e); }
  try { renderSouvenirs(); } catch(e) { console.error('Souvenirs error:', e); }
  try { renderConciergerie(); } catch(e) { console.error('Conciergerie error:', e); }
  try { renderHotelsAndFlights(); } catch(e) { console.error('HotelsFlights error:', e); }
  try { renderContactsAndAlert(); } catch(e) { console.error('Contacts error:', e); }
  try { renderClientDocuments(); } catch(e) { console.error('ClientDocs error:', e); }
  try { initCaptureFeature(); } catch(e) { console.error('Capture error:', e); }
});

// Helper: Open GPS route (Google Maps / Apple Maps / Waze)
function getGpsUrl(lat, lng, queryName = '') {
  const encodedName = encodeURIComponent(queryName);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedName}`;
}

// 1. DAY SELECTOR PILLS
function renderDaySelectorPills() {
  const strip = document.getElementById('days-pill-strip');
  strip.innerHTML = '';
  if (!currentTrip.itinerary) return;

  currentTrip.itinerary.forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.className = `day-pill-btn ${idx === activeDayIndex ? 'active' : ''}`;
    btn.innerText = `Jour ${item.day}`;
    btn.onclick = () => {
      selectDay(idx);
    };
    strip.appendChild(btn);
  });
}

function selectDay(index) {
  activeDayIndex = index;
  sessionStorage.setItem('girardot_selected_day', index);
  renderDaySelectorPills();
  renderTodayFocus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 2. RENDER THE MAGAZINE "TODAY" FOCUS (Page d'accueil)
function renderTodayFocus() {
  const currentDay = currentTrip.itinerary[activeDayIndex];
  if (!currentDay) return;

  // 1. Bannière générale de la destination (En haut du carnet)
  const heroBanner = document.getElementById('destination-hero-banner');
  const heroImg = document.getElementById('destination-hero-img');
  const heroTitle = document.getElementById('destination-hero-title');
  const heroSub = document.getElementById('destination-hero-sub');

  if (heroBanner && currentTrip.coverImage) {
    heroImg.src = currentTrip.coverImage;
    heroTitle.innerText = currentTrip.title || "Votre Voyage";
    heroSub.innerText = currentTrip.subtitle || "Voyages Girardot";
    heroBanner.style.display = 'block';
  } else if (heroBanner) {
    heroBanner.style.display = 'none';
  }

  // 2. Photo d'illustration spécifique de l'étape (Jour sélectionné)
  const dayPhotoBox = document.getElementById('day-focus-photo-box');
  const dayPhotoImg = document.getElementById('day-focus-photo-img');
  const dayPhotoCaption = document.getElementById('day-focus-photo-caption');

  if (dayPhotoBox && currentDay.image) {
    dayPhotoImg.src = currentDay.image;
    dayPhotoCaption.innerText = currentDay.highlight || currentDay.title || `Étape Jour ${currentDay.day}`;
    dayPhotoBox.style.display = 'block';
  } else if (dayPhotoBox) {
    dayPhotoBox.style.display = 'none';
  }

  // Header Title & Weather
  document.getElementById('day-headline').innerText = `Jour ${currentDay.day} • ${currentDay.city || ''}`;
  document.getElementById('day-date-text').innerText = currentDay.dateStr || `Étape ${currentDay.day}`;
  
  const weatherPill = document.getElementById('day-weather-pill');
  if (currentDay.weather) {
    weatherPill.innerHTML = `<i class="fa-solid fa-cloud-sun"></i> ${currentDay.weather}`;
  } else {
    weatherPill.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${currentDay.city || ''}`;
  }

  // Next Event Card
  const nextEvent = currentDay.nextEvent || {
    title: currentDay.highlight || currentDay.title,
    sub: currentDay.description ? (currentDay.description.slice(0, 75) + '...') : "Programme de la journée",
    qrCodeText: `GIRARDOT-JOUR-${currentDay.day}`
  };

  document.getElementById('next-title').innerText = nextEvent.title;
  document.getElementById('next-sub').innerText = nextEvent.badge || nextEvent.sub || "Programme Girardot";
  
  const qrBtn = document.getElementById('btn-show-qr');
  qrBtn.onclick = () => {
    if (nextEvent.docId && findDocById(nextEvent.docId)) {
      viewClientDocDetails(nextEvent.docId, true);
    } else {
      openQrModal(nextEvent.title, nextEvent.qrCodeText || `GIRARDOT-JOUR-${currentDay.day}`);
    }
  };

  // Timeline Stream (Liste avec points, lignes pointillées et photos)
  const timelineStream = document.getElementById('timeline-stream');
  timelineStream.innerHTML = '';

  const timelineItems = currentDay.timeline || [
    { time: "09:00", title: currentDay.title, subtitle: currentDay.description, icon: "route" }
  ];

  // Retrieve user checked timeline entries from storage
  const checkedKey = `girardot_timeline_checked_${currentTrip.id}_j${currentDay.day}`;
  let checkedItems = JSON.parse(localStorage.getItem(checkedKey) || '[]');

  timelineItems.forEach((entry, idx) => {
    const isChecked = checkedItems.includes(idx);
    const isLast = (idx === timelineItems.length - 1);
    const itemEl = document.createElement('div');
    itemEl.className = 'timeline-entry';

    const gpsUrl = (entry.lat && entry.lng) ? getGpsUrl(entry.lat, entry.lng, entry.title) : null;
    const hasLinkedDoc = entry.docId && findDocById(entry.docId);

    itemEl.innerHTML = `
      <div class="timeline-track-col">
        <span class="timeline-time-label">${entry.time || ''}</span>
        <div class="timeline-node-icon ${isChecked ? 'done' : (idx === 1 ? 'next' : '')}" id="node-icon-${idx}" onclick="toggleTimelineCheck(${activeDayIndex}, ${idx})">
          <i class="fa-solid ${isChecked ? 'fa-check' : (entry.icon || 'location-dot')}"></i>
        </div>
        ${!isLast ? '<div class="timeline-line-stem"></div>' : ''}
      </div>

      <div class="timeline-content-card ${idx === 1 ? 'featured-next' : ''}">
        <div class="entry-title">${entry.title}</div>
        <div class="entry-subtitle">${entry.subtitle || ''}</div>
        
        ${entry.image ? `
          <div class="entry-photo-wrapper">
            <img src="${entry.image}" alt="${entry.title}" loading="lazy">
          </div>
        ` : ''}

        <div class="entry-actions-row" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div>
            ${gpsUrl ? `
              <a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps">
                <i class="fa-solid fa-location-arrow"></i> Itinéraire
              </a>
            ` : '<span style="font-size:0.7rem; color:#94a3b8;"><i class="fa-regular fa-clock"></i> Visite organisée</span>'}
          </div>

          ${(hasLinkedDoc || entry.qrCodeText) ? `
            <button class="btn-entry-gps" style="background:#0284c7; color:white; border:none; cursor:pointer;" onclick="${hasLinkedDoc ? `viewClientDocDetails('${entry.docId}', true)` : `openQrModal('${entry.title.replace(/'/g, "\\'")}', '${entry.qrCodeText}')`}">
              <i class="fa-solid fa-qrcode"></i> Bon d'échange
            </button>
          ` : ''}

          <button class="btn-entry-note" onclick="quickAddPhotoForEntry('${entry.title}')">
            <i class="fa-solid fa-camera"></i> Souvenir
          </button>
        </div>
      </div>
    `;

    timelineStream.appendChild(itemEl);
  });
}

function toggleTimelineCheck(dayIdx, entryIdx) {
  const currentDay = currentTrip.itinerary[dayIdx];
  const checkedKey = `girardot_timeline_checked_${currentTrip.id}_j${currentDay.day}`;
  let checkedItems = JSON.parse(localStorage.getItem(checkedKey) || '[]');
  
  if (checkedItems.includes(entryIdx)) {
    checkedItems = checkedItems.filter(i => i !== entryIdx);
  } else {
    checkedItems.push(entryIdx);
  }
  localStorage.setItem(checkedKey, JSON.stringify(checkedItems));
  renderTodayFocus();
}

// QR Code Modal Dialog
function openQrModal(title, qrContent) {
  const modal = document.getElementById('qr-modal');
  document.getElementById('qr-modal-title').innerText = title;
  const qrImg = document.getElementById('qr-modal-img');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrContent)}&color=20-69-52`;
  modal.classList.add('open');
}

function closeQrModal() {
  document.getElementById('qr-modal').classList.remove('open');
}

// Transit / Metro Map Modal Dialog
function downloadTransitMapFile(url, fileName) {
  if (!url) return;
  
  // Déterminer l'extension
  let ext = 'png';
  if (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf')) {
    ext = 'pdf';
  } else if (url.startsWith('data:image/svg') || url.toLowerCase().includes('.svg')) {
    ext = 'svg';
  } else if (url.startsWith('data:image/jpeg') || url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')) {
    ext = 'jpg';
  } else if (url.startsWith('data:image/webp') || url.toLowerCase().includes('.webp')) {
    ext = 'webp';
  }

  let defaultName = fileName || `Document-Voyage-${(currentTrip && currentTrip.destination) ? currentTrip.destination.replace(/[^a-zA-Z0-9]/g, '_') : 'Girardot'}.${ext}`;
  if (!defaultName.includes('.')) {
    defaultName += `.${ext}`;
  }

  // 1. Si c'est une data-URL base64
  if (url.startsWith('data:')) {
    try {
      const parts = url.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      return;
    } catch (e) {
      console.warn("Erreur téléchargement data-URL via Blob, fallback classique :", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }

  // 2. Si c'est un chemin local ou même origine
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 3. Si c'est une URL distante, fetch blob pour forcer le téléchargement local sans blocage navigateur
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    })
    .catch(err => {
      console.warn("Téléchargement direct via Blob impossible, ouverture directe :", err);
      window.open(url, '_blank');
    });
}

function openTransitMapModal(imageUrl, title = "Plan du Réseau de Métro & Transports") {
  const modal = document.getElementById('transit-map-modal');
  if (!modal) return;
  const modalTitle = document.getElementById('transit-map-modal-title');
  const modalImg = document.getElementById('transit-map-modal-img');
  const downloadBtn = document.getElementById('transit-map-modal-download-btn');

  if (modalTitle) modalTitle.innerText = title;
  if (modalImg) {
    modalImg.src = imageUrl;
    modalImg.style.maxWidth = '100%';
  }
  if (downloadBtn) {
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      downloadTransitMapFile(imageUrl);
    };
  }
  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closeTransitMapModal() {
  const modal = document.getElementById('transit-map-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
}

// 3. RENDER FULL CIRCUIT TAB
function renderFullCircuit() {
  const container = document.getElementById('full-days-container');
  const badge = document.getElementById('total-days-badge');
  container.innerHTML = '';
  if (!currentTrip.itinerary) return;

  badge.innerText = `${currentTrip.itinerary.length} jours au programme`;

  currentTrip.itinerary.forEach((item, idx) => {
    const card = document.createElement('div');
    card.style = "background:white; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid var(--border-light); box-shadow:var(--shadow-subtle);";
    const gpsUrl = (item.lat && item.lng) ? getGpsUrl(item.lat, item.lng, item.title) : null;

    card.innerHTML = `
      ${item.image ? `
        <div style="height:140px; margin:-16px -16px 12px -16px; border-radius:18px 18px 0 0; overflow:hidden; position:relative;">
          <img src="${item.image}" alt="${item.title}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
          <div style="position:absolute; bottom:8px; left:12px; background:rgba(0,0,0,0.6); color:white; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; backdrop-filter:blur(2px);">
            <i class="fa-solid fa-camera"></i> ${item.city || `Jour ${item.day}`}
          </div>
        </div>
      ` : ''}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="background:var(--primary-color); color:white; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:20px;">
          Jour ${item.day}
        </span>
        <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${item.city || ''}</span>
      </div>
      <h3 style="font-size:1rem; font-weight:800; color:var(--text-main); margin-bottom:4px;">${item.title}</h3>
      <p style="font-size:0.84rem; color:#475569; line-height:1.45; margin-bottom:10px;">${item.description}</p>
      <div style="display:flex; gap:8px;">
        <button class="btn-entry-gps" style="background:#eef7f2; color:var(--primary-color);" onclick="switchMainTab('tab-today'); selectDay(${idx});">
          <i class="fa-regular fa-calendar-check"></i> Voir la journée
        </button>
        ${gpsUrl ? `
          <a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps">
            <i class="fa-solid fa-location-arrow"></i> GPS
          </a>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// 4. SOUVENIRS / PHOTO CAPTURE (avec compression automatique pour préserver le quota localStorage)
function compressImageFile(file, maxWidth = 1024, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = evt.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initCaptureFeature() {
  const quickCaptureBtn = document.getElementById('btn-quick-capture');
  const addSouvenirBtn = document.getElementById('add-souvenir-btn');
  const fileInput = document.getElementById('camera-file-input');

  const triggerCamera = () => {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const compressedBase64 = await compressImageFile(file);
          saveSouvenir({
            id: 'souv_' + Date.now(),
            title: `Souvenir Jour ${activeDayIndex + 1}`,
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            image: compressedBase64
          });
          switchMainTab('tab-souvenirs');
        } catch (err) {
          console.error('Erreur compression image:', err);
        } finally {
          fileInput.value = '';
        }
      }
    };
    fileInput.click();
  };

  quickCaptureBtn.addEventListener('click', triggerCamera);
  addSouvenirBtn.addEventListener('click', triggerCamera);
}

function quickAddPhotoForEntry(entryTitle) {
  const fileInput = document.getElementById('camera-file-input');
  fileInput.onchange = async function(e) {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageFile(file);
        saveSouvenir({
          id: 'souv_' + Date.now(),
          title: entryTitle,
          date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          image: compressedBase64
        });
        switchMainTab('tab-souvenirs');
      } catch (err) {
        console.error('Erreur compression image:', err);
      } finally {
        fileInput.value = '';
      }
    }
  };
  fileInput.click();
}

function saveSouvenir(item) {
  const key = `girardot_souvenirs_${currentTrip.id}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.unshift(item);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    alert("L'espace de stockage local de votre navigateur est plein. Supprimez d'anciennes photos pour en ajouter de nouvelles.");
  }
  renderSouvenirs();
}

function deleteSouvenir(souvId) {
  const key = `girardot_souvenirs_${currentTrip.id}`;
  let list = JSON.parse(localStorage.getItem(key) || '[]');
  list = list.filter(s => s.id !== souvId);
  localStorage.setItem(key, JSON.stringify(list));
  renderSouvenirs();
}

function renderSouvenirs() {
  const grid = document.getElementById('souvenirs-list');
  const key = `girardot_souvenirs_${currentTrip.id}`;
  let list = JSON.parse(localStorage.getItem(key) || '[]');

  // Uniquement pour l'Afrique du Sud si aucun souvenir n'a été pris
  if (list.length === 0 && currentTrip.id === 'afrique-du-sud-2026') {
    list = [
      { id: 'def1', title: 'Safari Big Five • Kruger', date: 'Jour 5', image: 'Business Profile Girardot/resource_atKV0GRzzlHfARUCYbAOW1.png', isDemo: true },
      { id: 'def2', title: 'Colonie des manchots', date: 'Jour 10', image: 'Business Profile Girardot/resource_81SHDV3ufg44rvmTPYt_h0.png', isDemo: true }
    ];
  }

  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; background:white; border:1px dashed #cbd5e1; border-radius:16px; padding:24px; text-align:center; color:#64748b; font-size:0.85rem;">
        <i class="fa-solid fa-camera-retro" style="font-size:1.6rem; color:var(--accent-gold); margin-bottom:8px; display:block;"></i>
        Aucun souvenir enregistré pour le moment.<br>Appuyez sur <strong>« Ajouter une photo »</strong> ou sur le bouton <strong>CAPTURE</strong> pour immortaliser votre voyage !
      </div>
    `;
  } else {
    list.forEach(s => {
      const card = document.createElement('div');
      card.className = 'souvenir-card';
      card.style.position = 'relative';
      card.innerHTML = `
        <img src="${s.image}" alt="${s.title}">
        ${!s.isDemo ? `
          <button onclick="deleteSouvenir('${s.id}')" title="Supprimer cette photo" style="position:absolute; top:8px; right:8px; background:rgba(15,23,42,0.65); color:white; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:0.75rem;">
            <i class="fa-solid fa-trash"></i>
          </button>
        ` : ''}
        <div class="souvenir-body">
          <div class="souvenir-title">${s.title}</div>
          <div class="souvenir-date">${s.date}</div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Also render compact suggestions in Souvenirs tab
  const freetimeBox = document.getElementById('freetime-compact-container');
  if (freetimeBox) {
    freetimeBox.innerHTML = '';
    const tripTitle = ((currentTrip.title || "") + " " + (currentTrip.destination || "") + " " + (currentTrip.subtitle || "")).toLowerCase();
    const isSouthAfricaTrip = tripTitle.includes('afrique') || tripTitle.includes('kruger') || tripTitle.includes('cap');

    let validSuggs = (currentTrip.freeTimeSuggestions || []).filter(sug => {
      if (!isSouthAfricaTrip) {
        const text = ((sug.name || "") + " " + (sug.location || "") + " " + (sug.description || "")).toLowerCase();
        if (text.includes('table mountain') || text.includes('kirstenbosch') || text.includes('le cap') || text.includes('kruger') || text.includes('fynbos') || text.includes('pot luck club')) {
          return false;
        }
        if (sug.lat && sug.lat < 0 && !isSouthAfricaTrip) return false;
      }
      return true;
    });

    if (validSuggs.length === 0 && currentTrip.conciergerie && currentTrip.conciergerie.themes) {
      const visitesTheme = currentTrip.conciergerie.themes.find(t => t.id === 'visites' && t.enabled !== false);
      if (visitesTheme && visitesTheme.places) {
        validSuggs = visitesTheme.places.map(p => ({
          name: p.name,
          category: p.category || "Coup de cœur",
          location: p.location,
          description: p.description,
          lat: p.lat,
          lng: p.lng
        }));
      }
    }

    validSuggs.slice(0, 3).forEach(sug => {
      const el = document.createElement('div');
      el.style = "background:white; border-radius:14px; padding:12px; margin-bottom:10px; border:1px solid var(--border-light);";
      const gpsUrl = (sug.lat && sug.lng) ? getGpsUrl(sug.lat, sug.lng, sug.name) : '#';
      el.innerHTML = `
        <span style="font-size:0.7rem; background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:4px; font-weight:bold;">${sug.category || 'Coup de cœur'}</span>
        <h4 style="font-size:0.92rem; font-weight:700; margin:4px 0 2px;">${sug.name}</h4>
        <p style="font-size:0.78rem; color:#64748b; margin-bottom:6px;">${sug.location || ''}</p>
        <a href="${gpsUrl}" target="_blank" class="btn-entry-gps"><i class="fa-solid fa-location-arrow"></i> S'y rendre en GPS</a>
      `;
      freetimeBox.appendChild(el);
    });
  }
}

// 4. bis - CONCIERGERIE IA EMBARQUÉE (100% Offline & Recherche Voix / Texte)
function renderConciergerie() {
  const themesList = document.getElementById('concierge-themes-list');
  if (!themesList || !currentTrip.conciergerie) return;

  const c = currentTrip.conciergerie;
  if (c.welcomeMessage) {
    document.getElementById('concierge-welcome-sub').innerText = c.welcomeMessage;
  }

  initConciergeQueryEngine();

  themesList.innerHTML = '';

  // Adaptation croisière : Bannière d'orientation & suggestions rapides
  const isCruise = currentTrip && (currentTrip.isCruise || currentTrip.shipName || (c.themes && c.themes.some(t => t.id === 'transports' && t.icon === 'ship')));
  const quickSuggestionsEl = document.getElementById('concierge-quick-suggestions');
  if (quickSuggestionsEl) {
    if (isCruise) {
      quickSuggestionsEl.innerHTML = `
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="selectConciergeTheme('transports')">🚢 Plan des 20 Ponts</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Où est ma cabine 8214 ?')">🚪 Ma Cabine (Pont & Côté)</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Comment aller à l\\'infirmerie ?')">🏥 Où est l'Infirmerie ?</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Activer la boussole pour m\\'orienter à bord')">🧭 Boussole & Cap</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Quels sont les restaurants inclus à bord ?')">🍽️ Restaurants & Buffets</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Où trouver un bar ou un cocktail Spritz ?')">🍸 Bars & Salons</button>
      `;
    } else {
      quickSuggestionsEl.innerHTML = `
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Comment prendre le métro et acheter un pass transport ?')">🚇 Métro, Bus & Pass</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Où manger le meilleur burger ?')">🍔 Meilleur Burger</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Trouver un restaurant végétarien ou végane')">🥗 Végétarien & Bio</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Un restaurant asiatique ou des dim sum')">🥢 Asiatique & Dim Sum</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Une table gastronomique ou étoilée')">⭐ Gastronomique / Étoilé</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Où manger du poisson ou des fruits de mer ?')">🐟 Poissons & Fruits de mer</button>
        <button class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;" onclick="setConciergeExample('Où trouver un rooftop avec vue ?')">🍸 Rooftop avec vue</button>
      `;
    }
  }

  if (isCruise) {
    const banner = document.createElement('div');
    banner.className = 'cruise-orientation-banner';
    banner.onclick = () => selectConciergeTheme('transports');
    banner.innerHTML = `
      <div>
        <span style="background:rgba(255,255,255,0.2); font-size:0.7rem; font-weight:800; text-transform:uppercase; padding:3px 8px; border-radius:6px; letter-spacing:0.5px;">
          <i class="fa-solid fa-compass"></i> 100% Hors-Ligne & Sans GPS
        </span>
        <h4 style="font-size:1.05rem; font-weight:800; margin-top:6px; margin-bottom:2px; line-height:1.25;">
          Plan Interactif des 20 Ponts & Boussole
        </h4>
        <p style="font-size:0.8rem; opacity:0.9; margin:0; line-height:1.35;">
          Repérez votre cabine, explorez les aménagements du ${currentTrip.shipName || 'navire'} et trouvez votre itinéraire sans réseau.
        </p>
      </div>
      <div style="background:white; color:#0369a1; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1rem; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    `;
    themesList.appendChild(banner);
  }

  // Only display themes that are enabled (or true by default if property omitted)
  const activeThemes = c.themes.filter(th => th.enabled !== false);

  if (activeThemes.length === 0) {
    themesList.innerHTML = `
      <div style="background:white; border-radius:16px; padding:20px; text-align:center; color:var(--text-muted); border:1px solid var(--border-light);">
        <i class="fa-solid fa-circle-check" style="color:var(--primary-color); font-size:1.8rem; margin-bottom:8px;"></i>
        <p style="font-size:0.9rem; font-weight:700; color:var(--primary-dark);">Tout est inclus dans votre circuit !</p>
        <p style="font-size:0.8rem; margin-top:4px;">Tous vos repas, visites et transports sont intégralement pris en charge par notre accompagnateur Girardot.</p>
      </div>
    `;
    return;
  }

  activeThemes.forEach(th => {
    const btn = document.createElement('div');
    btn.className = 'concierge-theme-pill';
    btn.onclick = () => selectConciergeTheme(th.id);

    btn.innerHTML = `
      <div class="concierge-theme-left">
        <div class="theme-icon-circle" style="background: ${th.color || 'var(--primary-color)'};">
          <i class="fa-solid fa-${th.icon || 'star'}"></i>
        </div>
        <div>
          <div class="theme-text-title">${th.label}</div>
          <div class="theme-text-desc">${th.description}</div>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right" style="color: #94a3b8; font-size: 0.85rem;"></i>
    `;
    themesList.appendChild(btn);
  });
}

function setConciergeExample(text) {
  const input = document.getElementById('concierge-query-input');
  if (input) {
    input.value = text;
    executeConciergeQuery(text);
  }
}

// Voice Recognition & Text Engine
function initConciergeQueryEngine() {
  const input = document.getElementById('concierge-query-input');
  const sendBtn = document.getElementById('concierge-send-btn');
  const micBtn = document.getElementById('concierge-mic-btn');

  if (sendBtn && input) {
    sendBtn.onclick = () => {
      const q = input.value.trim();
      if (q) executeConciergeQuery(q);
    };
    input.onkeyup = (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) executeConciergeQuery(q);
      }
    };
  }

  if (micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = false;

      micBtn.onclick = () => {
        try {
          recognition.start();
          micBtn.style.background = '#fee2e2';
          micBtn.style.color = '#dc2626';
          input.placeholder = "Écoute en cours... parlez maintenant";
        } catch(err) {
          console.warn(err);
        }
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        micBtn.style.background = '#f1f5f9';
        micBtn.style.color = 'var(--primary-color)';
        input.placeholder = "Ex: Restaurant de poissons demain soir à 19h...";
        executeConciergeQuery(transcript);
      };

      recognition.onerror = () => {
        micBtn.style.background = '#f1f5f9';
        micBtn.style.color = 'var(--primary-color)';
        input.placeholder = "Ex: Restaurant de poissons demain soir à 19h...";
      };

      recognition.onend = () => {
        micBtn.style.background = '#f1f5f9';
        micBtn.style.color = 'var(--primary-color)';
      };
    } else {
      micBtn.title = "Saisie vocale non prise en charge par ce navigateur";
      micBtn.onclick = () => {
        alert("La reconnaissance vocale nécessite un navigateur compatible (ex: Safari sur iOS ou Chrome sur Android/PC). Vous pouvez saisir votre demande par écrit dans le champ texte !");
      };
    }
  }
}

// Natural Language AI Solver directly in Browser (100% Offline)
function executeConciergeQuery(query) {
  const c = currentTrip.conciergerie;
  if (!c || !c.themes) return;

  const q = query.toLowerCase();
  const resultsBox = document.getElementById('concierge-results-container');
  const titleEl = document.getElementById('concierge-results-title');
  const listEl = document.getElementById('concierge-places-list');
  const welcomeBubble = document.getElementById('concierge-main-bubble');

  // Active themes only
  const activeThemes = c.themes.filter(t => t.enabled !== false);
  let matchedPlaces = [];
  let answerIntro = "";

  // 1. Détection de requêtes TRANSPORTS / CARTE / ITINÉRAIRES
  
  const isCruiseTrip = currentTrip && (currentTrip.isCruise || currentTrip.shipName || (c.themes && c.themes.some(t => t.id === 'transports' && t.icon === 'ship')));
  if (isCruiseTrip) {
    const isCruiseNavQuery = q.includes('cabine') || q.includes('chambre') || q.includes('pont') || q.includes('boussole') ||
      q.includes('cap') || q.includes('orientation') || q.includes('ascenseur') || q.includes('proue') || q.includes('poupe') ||
      q.includes('babord') || q.includes('bâbord') || q.includes('tribord') || q.includes('infirmerie') || q.includes('navire') ||
      /\b\d{3,5}\b/.test(q);

    if (isCruiseNavQuery) {
      const numMatch = q.match(/\b\d{3,5}\b/);
      let cabinDecoded = null;
      if (numMatch) {
        cabinDecoded = decodeCruiseCabin(numMatch[0]);
      } else {
        const stored = getCruiseStoredCabin();
        if (stored) cabinDecoded = decodeCruiseCabin(stored);
      }

      titleEl.innerHTML = `<i class="fa-solid fa-compass" style="color:#0284c7; margin-right:8px;"></i> Orientation & Déplacements à Bord`;

      let answerHtml = '';
      if (cabinDecoded) {
        answerHtml = `
          <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:16px; padding:16px; margin-bottom:14px;">
            <h4 style="font-size:0.95rem; font-weight:800; color:#166534; margin-bottom:6px;">
              <i class="fa-solid fa-door-open"></i> Localisation de la cabine ${cabinDecoded.raw} :
            </h4>
            <p style="font-size:0.86rem; color:#14532d; line-height:1.5; margin-bottom:10px;">
              Votre cabine <strong>${cabinDecoded.raw}</strong> est située au <strong>Pont ${cabinDecoded.deck} (${cabinDecoded.deckName})</strong>, côté <strong>${cabinDecoded.sideName}</strong> (${cabinDecoded.navLight}).
              Elle se trouve en zone <strong>${cabinDecoded.zoneName}</strong>.
            </p>
            <div style="background:white; border-radius:10px; padding:10px 12px; font-size:0.8rem; color:#334155; margin-bottom:10px; border:1px solid #bbf7d0;">
              <strong>🛗 Ascenseurs recommandés :</strong> ${cabinDecoded.elevatorName}.
            </div>
            <button type="button" onclick="selectConciergeTheme('transports'); viewCabinOnDeck(${cabinDecoded.deck});" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
              <i class="fa-solid fa-map-location-dot"></i> Afficher le plan du Pont ${cabinDecoded.deck}
            </button>
          </div>
        `;
      } else if (q.includes('infirmerie') || q.includes('docteur') || q.includes('medical') || q.includes('médical') || q.includes('santé')) {
        answerHtml = `
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:16px; padding:16px; margin-bottom:14px;">
            <h4 style="font-size:0.95rem; font-weight:800; color:#1e40af; margin-bottom:6px;">
              <i class="fa-solid fa-shield-heart"></i> Centre Médical & Infirmerie du Bord :
            </h4>
            <p style="font-size:0.86rem; color:#1e3a8a; line-height:1.5; margin-bottom:10px;">
              Le Centre Médical est situé au <strong>Pont 4 (Palermo)</strong>, à la <strong>Proue (l'Avant du navire)</strong>, accessible par les ascenseurs Avant (Théâtre). Équipe médicale disponible 24h/24 en cas d'urgence depuis le téléphone de votre cabine.
            </p>
            <button type="button" onclick="selectConciergeTheme('transports'); switchCruiseDeck(4);" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
              <i class="fa-solid fa-map-location-dot"></i> Ouvrir le plan du Pont 4 (Infirmerie)
            </button>
          </div>
        `;
      } else {
        answerHtml = `
          <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:16px; padding:16px; margin-bottom:14px;">
            <h4 style="font-size:0.95rem; font-weight:800; color:#0369a1; margin-bottom:6px;">
              <i class="fa-solid fa-compass"></i> Système d'Orientation & Plan des Ponts :
            </h4>
            <p style="font-size:0.86rem; color:#0f172a; line-height:1.5; margin-bottom:10px;">
              À bord du ${currentTrip.shipName || 'navire'}, vous pouvez explorer les 20 ponts, repérer votre cabine (Bâbord/Tribord) et calculer votre itinéraire ou utiliser la boussole marine 100% hors-ligne.
            </p>
            <button type="button" onclick="selectConciergeTheme('transports');" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
              <i class="fa-solid fa-ship"></i> Ouvrir le Plan du Navire & Navigation
            </button>
          </div>
        `;
      }

      listEl.innerHTML = answerHtml;
      resultsBox.style.display = 'block';
      resultsBox.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  const isTransportQuery = q.includes('aller') || q.includes('rejoindre') || q.includes('transport') || q.includes('comment') || q.includes('taxi') || q.includes('bus') || q.includes('trajet') || q.includes('métro') || q.includes('metro') || q.includes('carte') || q.includes('plan');

  if (isTransportQuery) {
    const transportTheme = activeThemes.find(t => t.id === 'transports');
    if (!transportTheme) {
      titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> Transport inclus dans le circuit`;
      listEl.innerHTML = `
        <div style="background:white; border-radius:16px; padding:16px; border:1px solid var(--border-light);">
          <p style="font-size:0.88rem; color:#334155;">Tous les déplacements de ce voyage sont organisés et inclus en autocar privatisé avec votre accompagnateur Girardot. Aucun transport additionnel n'est à votre charge !</p>
        </div>
      `;
      resultsBox.style.display = 'block';
      resultsBox.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Récupérer le nom de l'hôtel de destination s'il existe
    const sfHotels = (currentTrip.hotels || []).filter(h => {
      const txt = ((h.name || "") + " " + (h.city || "") + " " + (h.address || "")).toLowerCase();
      const isFrance = txt.includes('france') || txt.includes('lyon') || txt.includes('paris') || txt.includes('roissy') || txt.includes('cdg') || txt.includes('saint-exupéry') || txt.includes('saint exupéry');
      return !isFrance;
    });
    const currentHotel = sfHotels.length > 0 ? sfHotels[0] : (currentTrip.hotels && currentTrip.hotels[0]);
    const hotelName = currentHotel ? currentHotel.name : "votre hôtel";

    // Déterminer la destination mentionnée si spécifique
    let destName = "";
    let destCoords = null;
    if (q.includes('table mountain') || q.includes('montagne')) {
      destName = "la Montagne de la Table (Table Mountain)";
      destCoords = [-33.9573, 18.4031];
    } else if (q.includes('waterfront') || q.includes('port')) {
      destName = "le V&A Waterfront";
      destCoords = [-33.9056, 18.4208];
    } else if (q.includes('kirstenbosch') || q.includes('jardin')) {
      destName = "le Jardin Botanique de Kirstenbosch";
      destCoords = [-33.9877, 18.4326];
    } else if (q.includes('aeroport') || q.includes('aéroport')) {
      destName = "l'Aéroport";
    }

    titleEl.innerHTML = destName 
      ? `<i class="fa-solid fa-route" style="color:#0891b2; margin-right:8px;"></i> Se déplacer vers ${destName}`
      : `<i class="fa-solid fa-train-subway" style="color:#0891b2; margin-right:8px;"></i> Transports en commun, Bus & Métro`;

    listEl.innerHTML = `
      <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:16px; padding:16px; margin-bottom:14px;">
        <h4 style="font-size:0.95rem; font-weight:800; color:#0369a1; margin-bottom:4px;">
          <i class="fa-solid fa-sparkles"></i> Conseils de votre Concierge Girardot :
        </h4>
        <p style="font-size:0.86rem; color:#0f172a; line-height:1.5;">
          ${destName ? `Pour vos déplacements vers <strong>${destName}</strong> depuis <strong>${hotelName}</strong>, ` : `Depuis <strong>${hotelName}</strong>, `}
          vous pouvez utiliser le réseau de transports en commun officiel, les taxis ou commander un VTC (Uber / Lyft) directement sur votre smartphone.
        </p>
        ${destCoords ? `
          <div style="margin-top:10px;">
            <a href="${getGpsUrl(destCoords[0], destCoords[1], destName)}" target="_blank" class="btn-entry-gps" style="background:#0284c7; color:white;">
              <i class="fa-solid fa-location-arrow"></i> Ouvrir l'itinéraire GPS direct
            </a>
          </div>
        ` : ''}
      </div>
    `;

    // Ajouter les modules de transport disponibles
    // Ajouter les modules de transport disponibles (Carte du métro directement affichée & Téléchargement)
    if (transportTheme.transitMapImageUrl) {
      listEl.innerHTML += `
        <div style="background:white; border-radius:16px; border:1px solid #bae6fd; padding:16px; margin-bottom:16px; box-shadow:0 4px 15px rgba(2,132,199,0.06);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <div>
              <strong style="color:#0369a1; font-size:1rem;"><i class="fa-solid fa-train-subway"></i> Plan officiel du Réseau de Métro</strong>
              <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">Consultez directement le plan ou téléchargez-le pour y accéder hors-connexion</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" onclick="downloadTransitMapFile('${transportTheme.transitMapImageUrl}')" class="btn-entry-gps" style="background:#059669; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
                <i class="fa-solid fa-download"></i> Télécharger le plan
              </button>
              <button type="button" onclick="openTransitMapModal('${transportTheme.transitMapImageUrl}', 'Plan du réseau de métro')" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
                <i class="fa-solid fa-expand"></i> Agrandir / Plein écran
              </button>
            </div>
          </div>

          <div onclick="openTransitMapModal('${transportTheme.transitMapImageUrl}', 'Plan du réseau de métro')" style="position:relative; width:100%; max-height:280px; overflow:hidden; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; background:#f8fafc; text-align:center;">
            <img src="${transportTheme.transitMapImageUrl}" alt="Plan du métro" style="width:100%; height:auto; max-height:280px; object-fit:cover; object-position:center top; transition:transform 0.3s ease;">
            <div style="position:absolute; bottom:8px; right:8px; background:rgba(15,23,42,0.75); color:white; padding:5px 12px; border-radius:20px; font-size:0.75rem; font-weight:700; backdrop-filter:blur(4px);">
              <i class="fa-solid fa-magnifying-glass-plus"></i> Cliquer pour agrandir
            </div>
          </div>
          ${transportTheme.transitMapUrl ? `
            <div style="margin-top:10px; text-align:right;">
              <a href="${transportTheme.transitMapUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:#0284c7; text-decoration:none; font-weight:700;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Accéder au site web & horaires officiels en direct
              </a>
            </div>
          ` : ''}
        </div>
      `;
    } else if (transportTheme.transitMapUrl) {
      listEl.innerHTML += `
        <div style="background:white; border-radius:14px; border:1px solid #bae6fd; padding:14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="color:#0369a1; font-size:0.92rem;"><i class="fa-solid fa-map-location-dot"></i> Carte interactive des transports en commun</strong>
            <div style="font-size:0.8rem; color:#64748b;">Plan complet des lignes de métro, bus et trains de la ville</div>
          </div>
          <a href="${transportTheme.transitMapUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:6px 14px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir le plan
          </a>
        </div>
      `;
    }
    if (transportTheme.guideHtml) {
      listEl.innerHTML += `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:14px; padding:16px; margin-bottom:16px; font-size:0.86rem; color:#334155; line-height:1.55;">
          ${transportTheme.guideHtml}
        </div>
      `;
    }

    transportTheme.places.forEach(place => {
      listEl.appendChild(createConciergePlaceCard(place, 'transports'));
    });

    resultsBox.style.display = 'block';
    resultsBox.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // 2. Détection par type de cuisine et catégorie : BURGER / VÉGÉTARIEN / ASIATIQUE / GASTRONOMIQUE / POISSON etc.
  let filteredPlaces = [];
  let filterContext = "";

  activeThemes.forEach(theme => {
    theme.places.forEach(place => {
      const pText = (place.name + " " + place.category + " " + (place.tag || "") + " " + place.description + " " + (place.tips || "")).toLowerCase();
      let matchScore = 0;

      // Filtre Burger / Fast-food gourmet
      if (q.includes('burger') || q.includes('cheeseburger') || q.includes('frite')) {
        if (pText.includes('burger') || pText.includes('cheeseburger') || pText.includes('cheval')) matchScore += 20;
        filterContext = "burgers gourmets";
      }

      // Filtre Végétarien / Végane / Végétal / Bio
      if (q.includes('végé') || q.includes('vege') || q.includes('vegan') || q.includes('végan') || q.includes('salade') || q.includes('bio') || q.includes('plante')) {
        if (pText.includes('végé') || pText.includes('vege') || pText.includes('vegan') || pText.includes('sans viande') || pText.includes('végétal')) matchScore += 20;
        filterContext = "végétarien & végane";
      }

      // Filtre Asiatique / Japonais / Chinois / Wok / Dim Sum / Sushi / Ramen
      if (q.includes('asiatique') || q.includes('asie') || q.includes('chinois') || q.includes('japonais') || q.includes('sushi') || q.includes('wok') || q.includes('dim sum') || q.includes('ramen') || q.includes('canard') || q.includes('nouille')) {
        if (pText.includes('asiatique') || pText.includes('asie') || pText.includes('sushi') || pText.includes('wok') || pText.includes('dim sum') || pText.includes('duck') || pText.includes('chinois') || pText.includes('japonais')) matchScore += 20;
        filterContext = "cuisine asiatique & dim sum";
      }

      // Filtre Gastronomique / Étoilé / Michelin / Raffiné / Haut de gamme
      if (q.includes('gastro') || q.includes('gastronomique') || q.includes('étoilé') || q.includes('etoile') || q.includes('michelin') || q.includes('raffiné') || q.includes('chef') || q.includes('chic') || q.includes('haut de gamme')) {
        if (pText.includes('gastronomique') || pText.includes('michelin') || pText.includes('étoil') || pText.includes('etoil') || pText.includes('alinea') || pText.includes('chef') || pText.includes('d\'exception')) matchScore += 20;
        filterContext = "haute gastronomie & tables d'exception";
      }

      // Filtre Pizza / Pâtes / Italien
      if (q.includes('pizza') || q.includes('deep dish') || q.includes('italien') || q.includes('pâte') || q.includes('pate')) {
        if (pText.includes('pizza') || pText.includes('deep dish') || pText.includes('italien') || pText.includes('pâte')) matchScore += 20;
        filterContext = "pizzas & spécialités italiennes";
      }

      // Filtre Viande / Steak / Steakhouse / Grillade / Bœuf
      if (q.includes('viande') || q.includes('steak') || q.includes('bœuf') || q.includes('boeuf') || q.includes('grill') || q.includes('barbecue') || q.includes('bbq')) {
        if (pText.includes('steak') || pText.includes('viande') || pText.includes('angus') || pText.includes('bœuf') || pText.includes('gibsons')) matchScore += 20;
        filterContext = "steakhouses & viandes d'exception";
      }

      // Filtre Poisson / Fruits de mer
      if (q.includes('poisson') || q.includes('fish') || q.includes('mer') || q.includes('crabe') || q.includes('homard') || q.includes('huître') || q.includes('huitre') || q.includes('seafood')) {
        if (pText.includes('poisson') || pText.includes('mer') || pText.includes('harbour') || pText.includes('crabe') || pText.includes('crab') || pText.includes('huître') || pText.includes('huitre')) matchScore += 20;
        filterContext = "poissons & fruits de mer";
      }

      // Filtre Restaurant / Manger / Dîner généraliste
      if (q.includes('restaurant') || q.includes('manger') || q.includes('dîner') || q.includes('diner') || q.includes('repas') || q.includes('midi') || q.includes('soir') || q.includes('table')) {
        if (theme.id === 'resto') matchScore += 5;
      }

      // Filtre Bars / Boire / Café / Rooftop
      if (q.includes('bar') || q.includes('boire') || q.includes('café') || q.includes('cafe') || q.includes('verre') || q.includes('rooftop') || q.includes('cocktail') || q.includes('jazz')) {
        if (theme.id === 'detente' || pText.includes('rooftop') || pText.includes('bar') || pText.includes('cocktail')) matchScore += 15;
        filterContext = "bars, cafés & rooftops";
      }

      // Filtre Change / Banque / Argent / DAB
      if (q.includes('change') || q.includes('argent') || q.includes('banque') || q.includes('dab') || q.includes('distributeur') || q.includes('devises') || q.includes('dollar') || q.includes('rand') || q.includes('euro')) {
        if (theme.id === 'pratique' || pText.includes('dab') || pText.includes('banque') || pText.includes('change')) matchScore += 15;
        filterContext = "change & distributeurs";
      }

      // Filtre Pharmacie / Santé
      if (q.includes('pharmacie') || q.includes('santé') || q.includes('sante') || q.includes('médicament') || q.includes('pansement')) {
        if (pText.includes('pharmacie') || pText.includes('santé')) matchScore += 20;
        filterContext = "pharmacies & santé";
      }

      // Filtre Visites / Balade / Monuments
      if (q.includes('visite') || q.includes('voir') || q.includes('musée') || q.includes('musee') || q.includes('balade') || q.includes('monument') || q.includes('panorama') || q.includes('tour')) {
        if (theme.id === 'visites' || pText.includes('musée') || pText.includes('monument') || pText.includes('croisière') || pText.includes('croisiere')) matchScore += 15;
        filterContext = "visites & panoramas";
      }

      // Filtre Shopping / Magasins / Boutiques
      if (q.includes('shopping') || q.includes('magasin') || q.includes('boutique') || q.includes('souvenir') || q.includes('achat')) {
        if (theme.id === 'shopping' || pText.includes('shopping') || pText.includes('boutique')) matchScore += 15;
        filterContext = "boutiques & shopping";
      }

      // Match textuel direct si un mot de la requête est présent dans le nom ou la catégorie
      const qWords = q.split(/\s+/).filter(w => w.length > 3);
      qWords.forEach(w => {
        if (pText.includes(w)) matchScore += 3;
      });

      if (matchScore > 0) {
        filteredPlaces.push({ place: place, score: matchScore, theme: theme });
      }
    });
  });

  // Trier par pertinence
  filteredPlaces.sort((a, b) => b.score - a.score);

  if (filteredPlaces.length > 0) {
    const isTomorrow19h = q.includes('demain') || q.includes('19h') || q.includes('soir');
    titleEl.innerHTML = `<i class="fa-solid fa-sparkles" style="color:#10b981; margin-right:8px;"></i> Sélection personnalisée (${filteredPlaces.length} adresses trouvées)`;

    listEl.innerHTML = `
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px; padding:12px 14px; font-size:0.85rem; color:#065f46; margin-bottom:14px;">
        <i class="fa-solid fa-circle-check"></i> Voici les établissements ${filterContext ? 'spécialisés en <strong>' + filterContext + '</strong>' : ''} vérifiés et ouverts en soirée ${isTomorrow19h ? '<strong>(service du soir à partir de 19h)</strong>' : ''} :
      </div>
    `;

    filteredPlaces.forEach(item => {
      listEl.appendChild(createConciergePlaceCard(item.place, (item.theme && item.theme.id) ? item.theme.id : ''));
    });
  } else {
    // Si aucun mot-clé strict n'est trouvé, afficher un message d'aide
    titleEl.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Conseils de votre concierge`;
    listEl.innerHTML = `
      <div style="background:white; border-radius:16px; padding:16px; border:1px solid var(--border-light); font-size:0.86rem; color:#475569;">
        <p style="margin-bottom:8px;">Votre Concierge Girardot dispose des meilleures adresses sélectionnées pour vous dans les catégories ci-dessous :</p>
        <p>• <strong>Restauration :</strong> Demandez « un restaurant de poissons » ou « une table typique ».<br>
        • <strong>Mobilité :</strong> Demandez « comment aller à Table Mountain » ou « le meilleur taxi ».<br>
        • <strong>Pratique :</strong> Demandez « où faire du change » ou « une pharmacie ».</p>
      </div>
    `;
  }

  resultsBox.style.display = 'block';
  resultsBox.scrollIntoView({ behavior: 'smooth' });
}

function selectConciergeTheme(themeId) {
  const c = currentTrip.conciergerie;
  if (!c || !c.themes) return;

  const theme = c.themes.find(t => t.id === themeId);
  if (!theme) return;

  const resultsBox = document.getElementById('concierge-results-container');
  const titleEl = document.getElementById('concierge-results-title');
  const listEl = document.getElementById('concierge-places-list');

  // Highlight pill
  document.querySelectorAll('.concierge-theme-pill').forEach(p => p.classList.remove('active'));

  titleEl.innerHTML = `<i class="fa-solid fa-${theme.icon || 'star'}" style="color:${theme.color || 'var(--primary-color)'}; margin-right:8px;"></i> ${theme.label} (${(theme.places || []).length} adresses)`;

  listEl.innerHTML = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px 14px; font-size:0.85rem; color:#475569; margin-bottom:14px;">
      ${theme.description}
    </div>
  `;

  const isCruise = currentTrip && (currentTrip.isCruise || currentTrip.shipName || (theme.id === 'transports' && theme.icon === 'ship'));

  // CAS SPÉCIAL CROISIÈRE : Afficher le module d'orientation et de navigation intérieure 100% hors-ligne
  if (theme.id === 'transports' && isCruise) {
    renderCruiseDeckOrientationModule(listEl, currentTrip);
    if (theme.places && theme.places.length > 0) {
      const placesTitle = document.createElement('h4');
      placesTitle.style.cssText = 'font-size:1rem; font-weight:800; color:var(--primary-dark); margin:20px 0 10px 0; display:flex; align-items:center; gap:8px;';
      placesTitle.innerHTML = `<i class="fa-solid fa-ship" style="color:#0891b2;"></i> Espaces & Lieux remarquables du navire`;
      listEl.appendChild(placesTitle);
      theme.places.forEach(place => {
        listEl.appendChild(createConciergePlaceCard(place, theme.id));
      });
    }
    resultsBox.style.display = 'block';
    resultsBox.scrollIntoView({ behavior: 'smooth' });
    return;
  }


  // 1. Carte Officielle du Réseau de Métro & Transports si disponible (Affichage direct & Téléchargement)
  if (theme.transitMapImageUrl) {
    listEl.innerHTML += `
      <div style="background:white; border-radius:16px; border:1px solid #bae6fd; padding:16px; margin-bottom:16px; box-shadow:0 4px 15px rgba(2,132,199,0.06);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <strong style="color:#0369a1; font-size:1rem;"><i class="fa-solid fa-train-subway"></i> Plan officiel du Réseau de Métro</strong>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">Consultez directement le plan ci-dessous ou téléchargez-le pour un accès hors-ligne</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="downloadTransitMapFile('${theme.transitMapImageUrl}')" class="btn-entry-gps" style="background:#059669; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
              <i class="fa-solid fa-download"></i> Télécharger le plan
            </button>
            <button type="button" onclick="openTransitMapModal('${theme.transitMapImageUrl}', 'Plan du réseau de métro')" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:7px 14px; border:none; cursor:pointer;">
              <i class="fa-solid fa-expand"></i> Agrandir / Plein écran
            </button>
          </div>
        </div>

        <div onclick="openTransitMapModal('${theme.transitMapImageUrl}', 'Plan du réseau de métro')" style="position:relative; width:100%; max-height:280px; overflow:hidden; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; background:#f8fafc; text-align:center;">
          <img src="${theme.transitMapImageUrl}" alt="Plan du métro" style="width:100%; height:auto; max-height:280px; object-fit:cover; object-position:center top; transition:transform 0.3s ease;">
          <div style="position:absolute; bottom:8px; right:8px; background:rgba(15,23,42,0.75); color:white; padding:5px 12px; border-radius:20px; font-size:0.75rem; font-weight:700; backdrop-filter:blur(4px);">
            <i class="fa-solid fa-magnifying-glass-plus"></i> Cliquer pour agrandir
          </div>
        </div>
        ${theme.transitMapUrl ? `
          <div style="margin-top:10px; text-align:right;">
            <a href="${theme.transitMapUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:#0284c7; text-decoration:none; font-weight:700;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Accéder au site web & horaires officiels en direct
            </a>
          </div>
        ` : ''}
      </div>
    `;
  } else if (theme.transitMapUrl) {
    listEl.innerHTML += `
      <div style="background:white; border-radius:14px; border:1px solid #bae6fd; padding:14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong style="color:#0369a1; font-size:0.95rem;"><i class="fa-solid fa-map-location-dot"></i> Carte & Plan officiel des Transports</strong>
          <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">Plan interactif complet du réseau (métro, bus, trams)</div>
        </div>
        <a href="${theme.transitMapUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:6px 14px;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir le plan
        </a>
      </div>
    `;
  }

  // 2. Paragraphe explicatif / Guide d'utilisation des transports en commun
  if (theme.guideHtml) {
    listEl.innerHTML += `
      <div style="background:#f0f9ff; border:1px solid #bae6fd; border-left:4px solid #0284c7; border-radius:14px; padding:16px; margin-bottom:16px; font-size:0.86rem; color:#1e293b; line-height:1.6;">
        <h4 style="font-size:0.95rem; font-weight:800; color:#0369a1; margin-bottom:8px;">
          <i class="fa-solid fa-circle-question"></i> Guide pratique des transports en commun
        </h4>
        ${theme.guideHtml}
      </div>
    `;
  }

  if (!theme.places || theme.places.length === 0) {
    listEl.innerHTML += `
      <div style="background:white; border-radius:14px; padding:16px; text-align:center; color:#94a3b8; font-size:0.85rem; border:1px dashed #cbd5e1;">
        Aucune adresse ou société répertoriée pour le moment dans cette thématique.
      </div>
    `;
  } else {
    theme.places.forEach(place => {
      listEl.appendChild(createConciergePlaceCard(place, theme.id));
    });
  }

  resultsBox.style.display = 'block';
  resultsBox.scrollIntoView({ behavior: 'smooth' });
}

function createConciergePlaceCard(place, themeId = '') {
  const card = document.createElement('div');
  card.className = 'concierge-place-card';
  const gpsUrl = (place.lat && place.lng) ? getGpsUrl(place.lat, place.lng, place.name) : '#';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <span class="concierge-tag-badge" style="background:#f1f5f9; color:#334155;">
        ${place.category}
      </span>
      ${place.tag ? `<span class="concierge-tag-badge" style="background:#ecfdf5; color:#047857;"><i class="fa-solid fa-check"></i> ${place.tag}</span>` : ''}
    </div>

    <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin-bottom:2px;">
      ${place.name}
    </h4>
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
      <i class="fa-solid fa-map-pin" style="color:#ef4444; margin-right:4px;"></i> ${place.location}
    </div>

    <p style="font-size:0.85rem; color:#475569; line-height:1.45; margin-bottom:8px;">
      ${place.description}
    </p>

    ${place.tips ? `
      <div style="background:#f8fafc; border-left:3px solid var(--accent-gold); padding:8px 10px; border-radius:6px; font-size:0.78rem; color:#334155; margin-bottom:12px;">
        <strong><i class="fa-regular fa-lightbulb" style="color:var(--accent-gold);"></i> Conseil Girardot :</strong> ${place.tips}
      </div>
    ` : ''}

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
      ${place.phone ? (() => {
        const text = (place.name + " " + place.category + " " + (themeId || '')).toLowerCase();
        let phoneLabel = "Appeler";
        let phoneIcon = "fa-phone";
        if (themeId === 'resto' || text.includes('resto') || text.includes('dîner') || text.includes('gastronom') || text.includes('pizza') || text.includes('burger') || text.includes('brasserie') || text.includes('cuisine') || text.includes('bistro')) {
          phoneLabel = "Appeler le restaurant";
          phoneIcon = "fa-phone";
        } else if (text.includes('taxi') || text.includes('vtc') || text.includes('chauffeur')) {
          phoneLabel = "Commander / Appeler taxi";
          phoneIcon = "fa-taxi";
        } else if (text.includes('bus') || text.includes('métro') || text.includes('navette') || text.includes('transport') || text.includes('train')) {
          phoneLabel = "Infos & Contact réseau";
          phoneIcon = "fa-headset";
        } else if (text.includes('pharmacie') || text.includes('santé') || text.includes('médic')) {
          phoneLabel = "Appeler la pharmacie";
          phoneIcon = "fa-notes-medical";
        } else if (text.includes('banque') || text.includes('change') || text.includes('dab')) {
          phoneLabel = "Contacter l'agence";
          phoneIcon = "fa-building-columns";
        } else if (text.includes('musée') || text.includes('visite') || text.includes('croisière') || text.includes('monument')) {
          phoneLabel = "Contacter le site";
          phoneIcon = "fa-circle-info";
        } else if (text.includes('vélo') || text.includes('bike')) {
          phoneLabel = "Service assistance";
          phoneIcon = "fa-bicycle";
        } else {
          phoneLabel = "Appeler l'établissement";
          phoneIcon = "fa-phone";
        }

        return `
          <a href="tel:${place.phone.replace(/[^0-9+]/g, '')}" class="btn-entry-gps" style="background:#16a34a; color:white;">
            <i class="fa-solid ${phoneIcon}"></i> ${phoneLabel}
          </a>
        `;
      })() : ''}

      ${place.bookingUrl ? (() => {
        const text = (place.name + " " + place.category + " " + (themeId || '')).toLowerCase();
        let bookLabel = "Réserver en ligne";
        let bookIcon = "fa-calendar-check";
        if (text.includes('taxi') || text.includes('vtc') || text.includes('uber') || text.includes('curb') || text.includes('bolt') || text.includes('lyft')) {
          bookLabel = "Commander en ligne / App";
          bookIcon = "fa-mobile-screen-button";
        } else if (text.includes('vélo') || text.includes('bike') || text.includes('divvy')) {
          bookLabel = "Louer / Déverrouiller";
          bookIcon = "fa-bicycle";
        } else if (text.includes('horaire') || text.includes('plan') || text.includes('carte') || text.includes('cta') || text.includes('ligne')) {
          bookLabel = "Site officiel & Horaires";
          bookIcon = "fa-arrow-up-right-from-square";
        } else if (text.includes('billet') || text.includes('musée') || text.includes('croisière') || text.includes('skydeck') || text.includes('tour')) {
          bookLabel = "Billetterie officielle";
          bookIcon = "fa-ticket";
        } else if (themeId === 'resto' || text.includes('resto') || text.includes('table') || text.includes('dîner')) {
          bookLabel = "Réserver une table";
          bookIcon = "fa-utensils";
        }

        return `
          <a href="${place.bookingUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#ea580c; color:white;">
            <i class="fa-solid ${bookIcon}"></i> ${bookLabel}
          </a>
        `;
      })() : ''}

      <a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:var(--primary-color); color:white;">
        <i class="fa-solid fa-location-arrow"></i> S'y rendre (GPS)
      </a>
    </div>
  `;
  return card;
}

function resetConciergeView() {
  document.getElementById('concierge-results-container').style.display = 'none';
  document.querySelectorAll('.concierge-theme-pill').forEach(p => p.classList.remove('active'));
  window.scrollTo({ top: 120, behavior: 'smooth' });
}


// =============================================================================
// NAVIGATION & GÉOLOCALISATION INTÉRIEURE CROISIÈRE (100% HORS-LIGNE)
// =============================================================================

const CRUISE_SHIP_DECKS = [
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
      { name: "Piazza di Spagna & Grand Escalier", zone: "Poupe (Arrière)", side: "Poupe", icon: "sun", color: "#ea580c", desc: "Gradins extérieurs monumentaux ouverts sur l'horizon marin." },
      { name: "Restaurant Tutti a Tavola", zone: "Poupe (Arrière)", side: "Tribord", icon: "people-roof", color: "#0891b2", desc: "Restaurant familial convivial avec animations." }
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
      { name: "Restaurant Japonais Teppanyaki", zone: "Poupe (Arrière)", side: "Tribord", icon: "fire-burner", color: "#b91c1c", desc: "Show cooking japonais spectaculaire sous vos yeux." },
      { name: "Ferrari Spazio Bollicine", zone: "Centre", side: "Tribord", icon: "champagne-glasses", color: "#c29958", desc: "Bar à vins pétillants italiens de la prestigieuse maison Ferrari Trento." }
    ]
  },
  {
    deck: 9,
    name: "Napoli",
    category: "Pont Cabines",
    description: "Cabines passagers intérieures, extérieures avec vue mer et avec balcon privé. Coursives Bâbord (numéros pairs) et Tribord (numéros impairs).",
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
      { name: "Cabines Pont 10 (10001 à 10390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Accès par les ascenseurs Avant (Théâtre), Centraux (Colosseo) ou Arrière (Piazza)." }
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
    description: "Cabines et Suites vénitiennes (note maritime : pas de pont 13).",
    highlights: [
      { name: "Cabines Pont 14 (14001 à 14390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "Ascenseurs Avant, Centraux et Arrière." }
    ]
  },
  {
    deck: 15,
    name: "Milano",
    category: "Pont Cabines",
    description: "Cabines avec balcon supérieur et suites. Accès immédiat aux ponts de loisirs 16 et 17.",
    highlights: [
      { name: "Cabines Pont 15 (15001 à 15390)", zone: "Tout le pont", side: "Bâbord & Tribord", icon: "door-closed", color: "#64748b", desc: "À un seul escalier du Spa et des piscines supérieures." }
    ]
  },
  {
    deck: 16,
    name: "Como",
    category: "Bien-être, Spa & Piscines",
    description: "Spa Solemio, Espace Beauté, Sauna, Hammam, Salle de Fitness & Gym panoramique, Piscine intérieure tempérée La Spiaggia.",
    highlights: [
      { name: "Spa Solemio & Massages", zone: "Proue (Avant)", side: "Centre", icon: "spa", color: "#0d9488", desc: "Parcours thermal thermal luxueux, cabine de neige, sauna vue mer." },
      { name: "Salle de Gym & Fitness Panoramique", zone: "Proue (Avant)", side: "Tribord", icon: "dumbbell", color: "#0284c7", desc: "Équipements Technogym avec vue plongeante sur l'étrave du navire." },
      { name: "Piscine Intérieure Tempérée La Spiaggia", zone: "Centre", side: "Centre", icon: "water-ladder", color: "#0891b2", desc: "Grand bassin couvert avec verrière rétractable et jacuzzis." }
    ]
  },
  {
    deck: 17,
    name: "Bellagio",
    category: "Piscines, Aqua Park & Cocktails",
    description: "Piscines extérieures La Spiaggia, Bar Aperol Spritz, Nutella Café, Gelateria Amarillo, Aqua Park avec toboggans aquatiques.",
    highlights: [
      { name: "Aqua Park & Toboggans", zone: "Centre / Poupe", side: "Centre", icon: "water", color: "#0284c7", desc: "Toboggans aquatiques vertigineux surplombant l'océan." },
      { name: "Aperol Spritz Bar & Solarium", zone: "Centre", side: "Bâbord", icon: "wine-glass", color: "#f97316", desc: "Cocktails face au coucher de soleil sur le bleu méditerranéen." },
      { name: "Gelateria Amarillo & Nutella Café", zone: "Centre", side: "Tribord", icon: "ice-cream", color: "#d97706", desc: "Glaces italiennes bio artisanales et crêpes gourmandes." }
    ]
  },
  {
    deck: 18,
    name: "Torino",
    category: "Sports & Solarium",
    description: "Terrain multisports plein air, Piste de jogging panoramique, Solarium avec transats.",
    highlights: [
      { name: "Terrain Multisports Plein Air", zone: "Poupe (Arrière)", side: "Centre", icon: "basketball", color: "#ea580c", desc: "Football, basketball et tennis au grand air de la mer." },
      { name: "Piste de Jogging Panoramique", zone: "Pourtour du pont", side: "Bâbord & Tribord", icon: "person-running", color: "#059669", desc: "Circuit de marche et course avec panorama à 360° sur les flots." }
    ]
  },
  {
    deck: 19,
    name: "Cortina",
    category: "Passerelle Panoramique Volare",
    description: "Promenade panoramique suspendue 'Volare' avec plancher de verre surplombant la mer à 65 mètres au-dessus des flots.",
    highlights: [
      { name: "Passerelle de Verre 'Volare'", zone: "Poupe (Arrière)", side: "Centre", icon: "eye", color: "#0891b2", desc: "Vue aérienne à couper le souffle, point le plus haut accessible." }
    ]
  },
  {
    deck: 20,
    name: "Trieste",
    category: "Solarium Sommet",
    description: "Solarium supérieur tout en haut du paquebot, calme absolu sous le ciel méditerranéen.",
    highlights: [
      { name: "Solarium Sommet 360°", zone: "Centre", side: "Centre", icon: "sun", color: "#eab308", desc: "Transats exclusifs sous le soleil marin avec horizon infini." }
    ]
  }
];

const CRUISE_KEY_LOCATIONS = [
  { id: 'infirmerie', name: 'Centre Médical & Infirmerie', deck: 4, deckName: 'Palermo', side: 'Bâbord', zone: 'Proue (Avant)', elevator: 'Avant (Théâtre)', icon: 'shield-heart', color: '#2563eb' },
  { id: 'reception', name: 'Réception & Information 24h', deck: 7, deckName: 'Positano', side: 'Centre', zone: 'Centre (Atrium)', elevator: 'Centraux (Colosseo)', icon: 'bell-concierge', color: '#059669' },
  { id: 'bornes_carte', name: 'Bornes Enregistrement Carte Cabine', deck: 7, deckName: 'Positano', side: 'Tribord', zone: 'Centre (Près Réception)', elevator: 'Centraux (Colosseo)', icon: 'credit-card', color: '#2563eb' },
  { id: 'resto_colombina', name: 'Restaurant Principal La Colombina', deck: 5, deckName: 'Taormina', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Arrière (Piazza)', icon: 'utensils', color: '#e11d48' },
  { id: 'resto_meneghino', name: 'Restaurants Il Meneghino & Arlecchino', deck: 6, deckName: 'Matera', side: 'Bâbord/Tribord', zone: 'Poupe (Arrière)', elevator: 'Arrière (Piazza)', icon: 'utensils', color: '#e11d48' },
  { id: 'buffet_sagra', name: 'Buffet La Sagra dei Sapori', deck: 8, deckName: 'Capri', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Arrière (Piazza)', icon: 'bowl-food', color: '#e11d48' },
  { id: 'pizzeria', name: 'Pizzeria Pummid\'Oro', deck: 8, deckName: 'Capri', side: 'Bâbord', zone: 'Centre (Atrium)', elevator: 'Centraux (Colosseo)', icon: 'pizza-slice', color: '#ea580c' },
  { id: 'teppanyaki', name: 'Restaurant Show Cooking Teppanyaki', deck: 8, deckName: 'Capri', side: 'Tribord', zone: 'Poupe (Arrière)', elevator: 'Arrière (Piazza)', icon: 'fire-burner', color: '#b91c1c' },
  { id: 'theatre', name: 'Grand Théâtre Sanremo', deck: 6, deckName: 'Matera', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Avant (Théâtre)', icon: 'masks-theater', color: '#7c3aed' },
  { id: 'bar_campari', name: 'Bar Campari (Atrium Colosseo)', deck: 7, deckName: 'Positano', side: 'Bâbord', zone: 'Centre (Colosseo)', elevator: 'Centraux (Colosseo)', icon: 'martini-glass-citrus', color: '#dc2626' },
  { id: 'bar_aperol', name: 'Aperol Spritz Bar & Vue Mer', deck: 17, deckName: 'Bellagio', side: 'Bâbord', zone: 'Ponts Extérieurs (Piscine)', elevator: 'Centraux (Colosseo)', icon: 'wine-glass', color: '#f97316' },
  { id: 'bar_mastroianni', name: 'Grand Bar Mastroianni (Musique Live)', deck: 6, deckName: 'Matera', side: 'Centre', zone: 'Centre', elevator: 'Centraux (Colosseo)', icon: 'music', color: '#9333ea' },
  { id: 'duty_free', name: 'Galleria Sanremo & Boutiques Tax-Free', deck: 8, deckName: 'Capri', side: 'Bâbord/Tribord', zone: 'Centre (Atrium)', elevator: 'Centraux (Colosseo)', icon: 'bag-shopping', color: '#d97706' },
  { id: 'piscine', name: 'Piscines La Spiaggia & Aqua Park', deck: 17, deckName: 'Bellagio', side: 'Centre', zone: 'Centre / Extérieur', elevator: 'Centraux (Colosseo)', icon: 'water-ladder', color: '#0284c7' },
  { id: 'spa', name: 'Spa Solemio & Gym Panoramique', deck: 16, deckName: 'Como', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Avant (Théâtre)', icon: 'spa', color: '#0d9488' },
  { id: 'volare', name: 'Passerelle Panoramique Volare (Sol verre 65m)', deck: 19, deckName: 'Cortina', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Arrière (Piazza)', icon: 'eye', color: '#0891b2' }
];

// État local du module croisière
let currentActiveCruiseDeck = 8; // Par défaut Pont 8 (Cœur de vie Capri)
let currentCruiseCompassHeading = 0;
let isCruiseCompassActive = false;
let cruiseCompassOrientationHandler = null;

// Décodeur mathématique de cabine Costa
function decodeCruiseCabin(rawInput) {
  if (!rawInput) return null;
  const cleaned = rawInput.toString().trim().replace(/\D/g, '');
  if (!cleaned || cleaned.length < 3) return null;

  const num = parseInt(cleaned, 10);
  let deck = 0;
  let roomNumber = 0;

  if (cleaned.length === 3) {
    deck = Math.floor(num / 100);
    roomNumber = num % 100;
  } else if (cleaned.length === 4) {
    deck = Math.floor(num / 1000);
    roomNumber = num % 1000;
  } else {
    // 5 chiffres (ex: 11025 ou 14340)
    deck = Math.floor(num / 1000);
    roomNumber = num % 1000;
  }

  const deckObj = CRUISE_SHIP_DECKS.find(d => d.deck === deck);
  const deckName = deckObj ? deckObj.name : `Pont ${deck}`;

  // Parité : Pair = Bâbord (gauche, feux rouges), Impair = Tribord (droite, feux verts)
  const isPortSide = (num % 2 === 0);
  const sideName = isPortSide ? "Bâbord (Côté Gauche)" : "Tribord (Côté Droit)";
  const sideBadgeClass = isPortSide ? "side-badge-port" : "side-badge-starboard";
  const sideIcon = isPortSide ? "fa-circle-arrow-left" : "fa-circle-arrow-right";
  const navLight = isPortSide ? "Feu Rouge (Gauche)" : "Feu Vert (Droite)";

  // Zone longitudinale & ascenseurs
  let zoneName = "";
  let elevatorName = "";
  let elevatorCode = "";
  let xRatio = 0.5;

  if (roomNumber < 130) {
    zoneName = "Proue (Avant du navire)";
    elevatorName = "Ascenseurs Avant (Théâtre Sanremo)";
    elevatorCode = "avant";
    xRatio = 0.22;
  } else if (roomNumber <= 270) {
    zoneName = "Milieu / Centre (Atrium)";
    elevatorName = "Ascenseurs Centraux (Atrium Colosseo)";
    elevatorCode = "centre";
    xRatio = 0.50;
  } else {
    zoneName = "Poupe (Arrière du navire)";
    elevatorName = "Ascenseurs Arrière (Piazza di Spagna)";
    elevatorCode = "arriere";
    xRatio = 0.78;
  }

  // Y ratio pour l'affichage SVG (0.28 = Bâbord / haut, 0.72 = Tribord / bas)
  const yRatio = isPortSide ? 0.30 : 0.70;

  return {
    raw: cleaned,
    deck,
    deckName,
    roomNumber,
    isPortSide,
    sideName,
    sideBadgeClass,
    sideIcon,
    navLight,
    zoneName,
    elevatorName,
    elevatorCode,
    xRatio,
    yRatio
  };
}

function getCruiseStoredCabin() {
  if (!currentTrip) return "";
  const tripKey = currentTrip.id || 'current';
  return localStorage.getItem(`girardot_cruise_cabin_${tripKey}`) || "";
}

function saveCruiseStoredCabin(val) {
  if (!currentTrip) return;
  const tripKey = currentTrip.id || 'current';
  if (val) {
    localStorage.setItem(`girardot_cruise_cabin_${tripKey}`, val.trim());
  } else {
    localStorage.removeItem(`girardot_cruise_cabin_${tripKey}`);
  }
}

// Dessin SVG vectoriel élégant du navire et positionnement 100% hors-ligne
function renderShipDeckSvg(deckNum, activeCabin, targetPlace) {
  const deckObj = CRUISE_SHIP_DECKS.find(d => d.deck === deckNum) || { deck: deckNum, name: `Pont ${deckNum}` };
  const hasCabinOnDeck = activeCabin && activeCabin.deck === deckNum;
  const hasTargetOnDeck = targetPlace && targetPlace.deck === deckNum;

  // Coordonnées SVG de la cabine
  const cabinX = hasCabinOnDeck ? Math.round(70 + activeCabin.xRatio * 380) : 0;
  const cabinY = hasCabinOnDeck ? Math.round(activeCabin.yRatio * 130) : 0;

  return `
    <div class="deck-svg-container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.75rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
        <div><i class="fa-solid fa-anchor"></i> Proue (Avant)</div>
        <div style="color:#38bdf8; font-weight:800; font-size:0.85rem;">
          <i class="fa-solid fa-layer-group"></i> Pont ${deckObj.deck} ${deckObj.name}
        </div>
        <div>Poupe (Arrière) <i class="fa-solid fa-water"></i></div>
      </div>

      <svg viewBox="0 0 520 130" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));">
        <defs>
          <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
            <stop offset="50%" stop-color="#0369a1" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.35"/>
          </linearGradient>
          <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="1"/>
            <stop offset="70%" stop-color="#ef4444" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- Coque du navire profilée -->
        <path d="M 60 65 C 75 25, 130 18, 220 18 L 470 18 C 500 18, 510 40, 510 65 C 510 90, 500 112, 470 112 L 220 112 C 130 112, 75 105, 60 65 Z"
              fill="url(#hullGrad)" stroke="#38bdf8" stroke-width="2"/>

        <!-- Lignes de repère des coursives Bâbord et Tribord -->
        <line x1="85" y1="42" x2="480" y2="42" stroke="#334155" stroke-dasharray="4,4" stroke-width="1.2"/>
        <line x1="85" y1="88" x2="480" y2="88" stroke="#334155" stroke-dasharray="4,4" stroke-width="1.2"/>

        <!-- Indications de bord -->
        <text x="95" y="32" fill="#f87171" font-size="9" font-weight="800" letter-spacing="1">BÂBORD (Gauche - Pairs)</text>
        <text x="95" y="104" fill="#34d399" font-size="9" font-weight="800" letter-spacing="1">TRIBORD (Droite - Impairs)</text>

        <!-- Cage d'Ascenseurs Avant -->
        <g transform="translate(150, 48)">
          <rect width="32" height="34" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.2"/>
          <text x="16" y="16" fill="#38bdf8" font-size="10" text-anchor="middle">🛗</text>
          <text x="16" y="28" fill="#e2e8f0" font-size="6.5" font-weight="800" text-anchor="middle">AVANT</text>
        </g>

        <!-- Cage d'Ascenseurs Centraux (Colosseo) -->
        <g transform="translate(265, 48)">
          <rect width="36" height="34" rx="6" fill="#1e293b" stroke="#c29958" stroke-width="1.5"/>
          <text x="18" y="16" fill="#c29958" font-size="10" text-anchor="middle">🛗</text>
          <text x="18" y="28" fill="#f7e7ce" font-size="6.5" font-weight="800" text-anchor="middle">CENTRE</text>
        </g>

        <!-- Cage d'Ascenseurs Arrière (Piazza di Spagna) -->
        <g transform="translate(395, 48)">
          <rect width="32" height="34" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.2"/>
          <text x="16" y="16" fill="#38bdf8" font-size="10" text-anchor="middle">🛗</text>
          <text x="16" y="28" fill="#e2e8f0" font-size="6.5" font-weight="800" text-anchor="middle">ARRIÈRE</text>
        </g>

        <!-- Marqueur pulsant de la Cabine si présente sur ce pont -->
        ${hasCabinOnDeck ? `
          <circle cx="${cabinX}" cy="${cabinY}" r="16" fill="url(#pinGlow)">
            <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${cabinX}" cy="${cabinY}" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
          <g transform="translate(${cabinX - 35}, ${cabinY > 65 ? cabinY - 26 : cabinY + 12})">
            <rect width="70" height="18" rx="4" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>
            <text x="35" y="12" fill="#ffffff" font-size="7.5" font-weight="900" text-anchor="middle">
              CABINE ${activeCabin.raw}
            </text>
          </g>
        ` : ''}

        <!-- Marqueur lieu de destination si présent sur ce pont -->
        ${hasTargetOnDeck ? `
          <g transform="translate(330, 25)">
            <circle cx="0" cy="0" r="14" fill="#0284c7" opacity="0.4">
              <animate attributeName="r" values="8;18;8" dur="2.2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="0" cy="0" r="5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
            <rect x="-45" y="8" width="90" height="16" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
            <text x="0" y="20" fill="#38bdf8" font-size="7" font-weight="800" text-anchor="middle">
              ${targetPlace.name.substring(0, 15)}...
            </text>
          </g>
        ` : ''}
      </svg>

      <div style="display:flex; justify-content:space-around; align-items:center; margin-top:8px; font-size:0.75rem; color:#cbd5e1; flex-wrap:wrap; gap:8px;">
        <div><span style="color:#f87171;">●</span> Coursive Bâbord (Gauche)</div>
        <div><span style="color:#38bdf8;">🛗</span> 3 Noyaux d'Ascenseurs</div>
        <div><span style="color:#34d399;">●</span> Coursive Tribord (Droite)</div>
      </div>
    </div>
  `;
}

// Algorithme de calcul d'itinéraire intérieur (Wayfinding)
function calculateCruiseRoute(fromCabinInput, targetId) {
  const target = CRUISE_KEY_LOCATIONS.find(l => l.id === targetId);
  if (!target) return null;

  const cabin = decodeCruiseCabin(fromCabinInput);
  const steps = [];

  if (cabin) {
    // 1. Sortie de cabine
    steps.push({
      num: 1,
      icon: cabin.sideIcon,
      color: cabin.sideColor,
      title: `Sortie de votre cabine ${cabin.raw}`,
      desc: `Sortez de votre cabine et engagez-vous sur la coursive <strong>${cabin.sideName}</strong> (${cabin.navLight}).`
    });

    // 2. Choix de la cage d'ascenseur
    steps.push({
      num: 2,
      icon: "fa-elevator",
      color: "#0284c7",
      title: `Rejoignez les ${cabin.elevatorName}`,
      desc: `Marchez le long du couloir vers la zone <strong>${cabin.zoneName}</strong> pour atteindre les ascenseurs (distance : environ 25 à 40 mètres).`
    });

    // 3. Mouvement vertical (Ponts)
    const delta = target.deck - cabin.deck;
    if (delta === 0) {
      steps.push({
        num: 3,
        icon: "fa-person-walking",
        color: "#059669",
        title: `Même niveau : Pont ${cabin.deck} (${cabin.deckName})`,
        desc: `Vous êtes déjà sur le bon pont ! Aucun ascenseur requis. Marchez directement le long de la coursive vers la zone ${target.zone}.`
      });
    } else if (delta > 0) {
      steps.push({
        num: 3,
        icon: "fa-arrow-up",
        color: "#0284c7",
        title: `Montez de ${delta} pont${delta > 1 ? 's' : ''}`,
        desc: `Prenez l'ascenseur ou l'escalier et <strong>MONTEZ du Pont ${cabin.deck} au Pont ${target.deck} (${target.deckName})</strong>.`
      });
    } else {
      const down = Math.abs(delta);
      steps.push({
        num: 3,
        icon: "fa-arrow-down",
        color: "#d97706",
        title: `Descendez de ${down} pont${down > 1 ? 's' : ''}`,
        desc: `Prenez l'ascenseur ou l'escalier et <strong>DESCENDEZ du Pont ${cabin.deck} au Pont ${target.deck} (${target.deckName})</strong>.`
      });
    }

    // 4. Arrivée à destination
    steps.push({
      num: 4,
      icon: "fa-location-dot",
      color: target.color,
      title: `Arrivée au Pont ${target.deck} (${target.deckName})`,
      desc: `À la sortie des ascenseurs, suivez le fléchage vers <strong>${target.zone}</strong> (côté ${target.side}). Votre destination <strong>${target.name}</strong> est à quelques pas.`
    });
  } else {
    // Départ depuis un lieu ou pont général
    steps.push({
      num: 1,
      icon: "fa-elevator",
      color: "#0284c7",
      title: `Rejoignez les ascenseurs ${target.elevator}`,
      desc: `Prenez les ascenseurs recommandés les plus proches de votre position actuelle.`
    });
    steps.push({
      num: 2,
      icon: "fa-layer-group",
      color: target.color,
      title: `Rendez-vous au Pont ${target.deck} (${target.deckName})`,
      desc: `Sélectionnez le <strong>Pont ${target.deck}</strong> dans la cabine d'ascenseur.`
    });
    steps.push({
      num: 3,
      icon: "fa-location-dot",
      color: target.color,
      title: `Arrivée : ${target.name}`,
      desc: `Suivez la signalétique vers la zone <strong>${target.zone}</strong> (côté ${target.side}).`
    });
  }

  const estimatedMinutes = Math.min(4, Math.max(1, Math.round(1 + Math.abs(target.deck - (cabin ? cabin.deck : target.deck)) * 0.4)));
  const estimatedMeters = 40 + Math.abs(target.deck - (cabin ? cabin.deck : target.deck)) * 15 + 40;

  return {
    target,
    cabin,
    steps,
    estimatedMinutes,
    estimatedMeters
  };
}

// Module Principal d'Orientation à bord (Interface utilisateur)
function renderCruiseDeckOrientationModule(containerEl, trip) {
  const shipName = trip.shipName || "Costa Smeralda";
  const storedCabin = getCruiseStoredCabin();
  const initialCabinDecoded = storedCabin ? decodeCruiseCabin(storedCabin) : null;
  if (initialCabinDecoded) {
    currentActiveCruiseDeck = initialCabinDecoded.deck;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'deck-nav-wrapper';
  wrapper.id = 'cruise-deck-navigator-module';

  wrapper.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
      <div>
        <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.4px;">
          <i class="fa-solid fa-compass"></i> Orientation 100% Hors-Ligne & Embarquée
        </span>
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--primary-dark); margin-top:4px;">
          Navigation à Bord & Plan des Ponts
        </h3>
        <p style="font-size:0.8rem; color:#64748b; margin:0;">
          La coque en acier bloquant le signal GPS, ce système calcule votre position et itinéraire à bord du ${shipName} sans connexion.
        </p>
      </div>
    </div>

    <!-- Encart : Ma Cabine & Mon Repère -->
    <div class="cabin-decoder-card" id="cruise-cabin-box">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-door-open" style="color:#059669; font-size:1.1rem;"></i>
          <strong style="font-size:0.92rem; color:#14532d;">Ma Cabine à bord :</strong>
        </div>
        <div style="display:flex; gap:6px;">
          <input type="text" id="cruise-cabin-input" value="${storedCabin}" placeholder="Ex: 8214 ou 11025"
                 style="width:130px; padding:6px 10px; border-radius:8px; border:1px solid #86efac; font-size:0.85rem; font-weight:700; text-align:center;"
                 maxlength="6" oninput="onCruiseCabinInputChange(this.value)">
          <button type="button" onclick="saveCruiseCabinBtn()" class="btn-entry-gps" style="background:#059669; color:white; font-size:0.78rem; padding:6px 12px; border:none; cursor:pointer;">
            <i class="fa-solid fa-floppy-disk"></i> Mémoriser
          </button>
        </div>
      </div>

      <div id="cruise-cabin-decode-feedback">
        ${initialCabinDecoded ? renderCabinDecodedBadge(initialCabinDecoded) : `
          <p style="font-size:0.78rem; color:#166534; margin:0;">
            <i class="fa-solid fa-circle-info"></i> Saisissez le numéro de votre cabine (figurant sur votre carte Costa ou carnet) pour calculer vos trajets personnalisés et afficher votre repère sur les plans.
          </p>
        `}
      </div>
    </div>

    <!-- Onglets de navigation : Plan des Ponts | Itinéraires | Boussole Marine -->
    <div class="deck-tabs-header">
      <button type="button" class="deck-tab-btn active" id="btn-subtab-decks" onclick="switchCruiseSubTab('decks')">
        <i class="fa-solid fa-layer-group"></i> Plan des Ponts
      </button>
      <button type="button" class="deck-tab-btn" id="btn-subtab-wayfinder" onclick="switchCruiseSubTab('wayfinder')">
        <i class="fa-solid fa-route"></i> Itinéraires
      </button>
      <button type="button" class="deck-tab-btn" id="btn-subtab-compass" onclick="switchCruiseSubTab('compass')">
        <i class="fa-solid fa-compass"></i> Boussole Marine
      </button>
    </div>

    <!-- CONTENU VUE 1 : PLAN DES PONTS & DÉTAILS -->
    <div id="cruise-subtab-content-decks">
      <!-- Sélecteur horizontal des ponts -->
      <div class="deck-selector-strip" id="cruise-deck-pills-strip"></div>

      <!-- Plan SVG Interactif du navire pour le pont sélectionné -->
      <div id="cruise-deck-svg-mount"></div>

      <!-- Fiche détaillée du pont actif -->
      <div id="cruise-deck-details-mount" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin-top:12px;"></div>
    </div>

    <!-- CONTENU VUE 2 : CALCULATEUR D'ITINÉRAIRES INTÉRIEURS -->
    <div id="cruise-subtab-content-wayfinder" style="display:none;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:16px; margin-bottom:14px;">
        <h4 style="font-size:0.95rem; font-weight:800; color:#0369a1; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-route"></i> Comment aller à bord ?
        </h4>

        <div style="margin-bottom:10px;">
          <label style="font-size:0.78rem; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Point de départ :</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" id="wayfinder-from-cabin" value="${storedCabin ? 'Ma Cabine ' + storedCabin : ''}" placeholder="Ex: Cabine 8214"
                   style="flex:1; padding:7px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem;">
            <button type="button" onclick="useStoredCabinAsWayfinderStart()" class="btn-entry-gps" style="background:#f1f5f9; color:#334155; font-size:0.75rem; padding:7px 10px;">
              Ma Cabine
            </button>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="font-size:0.78rem; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Où souhaitez-vous vous rendre ?</label>
          <select id="wayfinder-to-select" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:0.85rem; font-weight:600; background:white;">
            <option value="infirmerie">🏥 Centre Médical & Infirmerie (Pont 4)</option>
            <option value="resto_colombina">🍽️ Restaurant Principal La Colombina (Pont 5)</option>
            <option value="theatre">🎭 Grand Théâtre Sanremo (Pont 6 & 7)</option>
            <option value="reception">🛎️ Réception Centrale 24h & Bureau Information (Pont 7)</option>
            <option value="bornes_carte">💳 Bornes Enregistrement Carte Cabine (Pont 7)</option>
            <option value="bar_campari">🍹 Bar Campari & Atrium Colosseo (Pont 7)</option>
            <option value="buffet_sagra">🥗 Buffet La Sagra dei Sapori (Pont 8)</option>
            <option value="pizzeria">🍕 Pizzeria Pummid'Oro (Pont 8)</option>
            <option value="teppanyaki">🔥 Restaurant Teppanyaki (Pont 8)</option>
            <option value="duty_free">🛍️ Galleria Duty Free & Boutiques (Pont 8)</option>
            <option value="spa">🧘 Spa Solemio & Salle de Gym (Pont 16)</option>
            <option value="piscine">🏊 Piscines La Spiaggia & Aqua Park (Pont 17)</option>
            <option value="bar_aperol">🍸 Aperol Spritz Bar & Solarium (Pont 17)</option>
            <option value="volare">🌅 Passerelle Panoramique Volare (Sol verre 65m - Pont 19)</option>
          </select>
        </div>

        <button type="button" onclick="executeCruiseRouteWayfinder()" class="btn-entry-gps" style="width:100%; background:#0284c7; color:white; font-size:0.88rem; font-weight:700; padding:10px 16px; border:none; cursor:pointer; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:8px;">
          <i class="fa-solid fa-calculator"></i> Calculer mon itinéraire intérieur
        </button>
      </div>

      <div id="cruise-wayfinder-results"></div>
    </div>

    <!-- CONTENU VUE 3 : BOUSSOLE MARINE ÉLECTRONIQUE HORS-LIGNE -->
    <div id="cruise-subtab-content-compass" style="display:none; text-align:center;">
      <div style="background:#0f172a; border-radius:18px; padding:18px; color:white; margin-bottom:14px; box-shadow:0 8px 25px rgba(15,23,42,0.4);">
        <span style="background:rgba(2,132,199,0.25); color:#38bdf8; font-size:0.72rem; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
          Capteurs Smartphone 100% Hors-Ligne
        </span>
        <h4 style="font-size:1.05rem; font-weight:800; margin-top:6px; margin-bottom:4px; color:#ffffff;">
          Boussole Marine d'Orientation
        </h4>
        <p style="font-size:0.8rem; color:#94a3b8; margin:0 auto 12px; max-width:420px; line-height:1.4;">
          Utilise le magnétomètre et gyroscope intégrés de votre smartphone pour vous orienter dans les coursives sans réseau cellulaire.
        </p>

        <!-- Cadran rotatif de la boussole -->
        <div style="position:relative; width:170px; height:170px; margin:0 auto 12px;">
          <div class="marine-compass-dial" id="marine-compass-dial-el">
            <div style="position:absolute; top:6px; font-size:0.75rem; font-weight:900; color:#ef4444;">N</div>
            <div style="position:absolute; bottom:6px; font-size:0.75rem; font-weight:900; color:#cbd5e1;">S</div>
            <div style="position:absolute; right:8px; font-size:0.75rem; font-weight:900; color:#cbd5e1;">E</div>
            <div style="position:absolute; left:8px; font-size:0.75rem; font-weight:900; color:#cbd5e1;">O</div>
            <div class="marine-compass-needle" id="marine-compass-needle-el"></div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div id="marine-compass-heading-text" style="font-size:1.6rem; font-weight:900; color:#38bdf8; letter-spacing:1px;">
            0° NORD
          </div>
          <div id="marine-compass-ship-relative" style="font-size:0.82rem; color:#f1f5f9; margin-top:2px;">
            Orientation : Face à la <strong>Proue (Avant du navire)</strong>
          </div>
        </div>

        <button type="button" id="btn-toggle-compass" onclick="toggleCruiseCompass()" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.82rem; padding:8px 18px; border:none; cursor:pointer; border-radius:20px; font-weight:700;">
          <i class="fa-solid fa-play"></i> Activer les capteurs de bord
        </button>
      </div>

      <!-- Contrôles manuels pour tester sur ordinateur / sans magnétomètre -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px; font-size:0.78rem; color:#64748b;">
        <div style="font-weight:700; color:#334155; margin-bottom:6px;">Simulation manuelle de cap (si PC ou capteur absent) :</div>
        <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
          <button type="button" onclick="rotateManualCompass(-30)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">-30°</button>
          <button type="button" onclick="setManualCompassHeading(0)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">⚓ Proue 0°</button>
          <button type="button" onclick="setManualCompassHeading(90)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">🟢 Tribord 90°</button>
          <button type="button" onclick="setManualCompassHeading(180)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">⚓ Poupe 180°</button>
          <button type="button" onclick="setManualCompassHeading(270)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">🔴 Bâbord 270°</button>
          <button type="button" onclick="rotateManualCompass(30)" class="day-pill-btn" style="font-size:0.72rem; padding:4px 10px;">+30°</button>
        </div>
      </div>
    </div>
  `;

  containerEl.appendChild(wrapper);

  // Rendu initial des ponts
  renderCruiseDeckPills();
  renderActiveCruiseDeckView();
}

function renderCabinDecodedBadge(cabin) {
  return `
    <div style="background:white; border:1px solid #86efac; border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <div style="font-size:0.92rem; font-weight:800; color:#14532d; display:flex; align-items:center; gap:6px;">
          <span>Cabine ${cabin.raw} :</span>
          <span style="color:#0284c7;">Pont ${cabin.deck} (${cabin.deckName})</span>
          <span class="${cabin.sideBadgeClass}">
            <i class="fa-solid ${cabin.sideIcon}"></i> ${cabin.sideName}
          </span>
        </div>
        <div style="font-size:0.78rem; color:#475569; margin-top:3px;">
          <i class="fa-solid fa-location-crosshairs"></i> Emplacement : <strong>${cabin.zoneName}</strong> &bull; ${cabin.elevatorName}
        </div>
      </div>
      <button type="button" onclick="viewCabinOnDeck(${cabin.deck})" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.75rem; padding:5px 12px; border:none; cursor:pointer;">
        <i class="fa-solid fa-eye"></i> Voir sur le plan
      </button>
    </div>
  `;
}

function onCruiseCabinInputChange(val) {
  const feedbackEl = document.getElementById('cruise-cabin-decode-feedback');
  if (!feedbackEl) return;
  const decoded = decodeCruiseCabin(val);
  if (decoded) {
    feedbackEl.innerHTML = renderCabinDecodedBadge(decoded);
    const wayfinderInput = document.getElementById('wayfinder-from-cabin');
    if (wayfinderInput) wayfinderInput.value = 'Ma Cabine ' + decoded.raw;
  } else {
    feedbackEl.innerHTML = `
      <p style="font-size:0.78rem; color:#166534; margin:0;">
        <i class="fa-solid fa-circle-info"></i> Saisissez un numéro de cabine valide (ex: 8214, 11025) pour obtenir le décodage immédiat.
      </p>
    `;
  }
}

function saveCruiseCabinBtn() {
  const input = document.getElementById('cruise-cabin-input');
  if (!input) return;
  const val = input.value.trim();
  const decoded = decodeCruiseCabin(val);
  if (!decoded) {
    alert("Veuillez saisir un numéro de cabine valide (ex: 8214 pour le Pont 8).");
    return;
  }
  saveCruiseStoredCabin(decoded.raw);
  alert(`Cabine ${decoded.raw} enregistrée avec succès ! Pont ${decoded.deck} (${decoded.deckName}), côté ${decoded.sideName}.`);
  switchCruiseDeck(decoded.deck);
}

function viewCabinOnDeck(deckNum) {
  switchCruiseSubTab('decks');
  switchCruiseDeck(deckNum);
}

function renderCruiseDeckPills() {
  const strip = document.getElementById('cruise-deck-pills-strip');
  if (!strip) return;
  strip.innerHTML = '';

  CRUISE_SHIP_DECKS.forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `deck-btn-pill ${d.deck === currentActiveCruiseDeck ? 'active' : ''}`;
    btn.onclick = () => switchCruiseDeck(d.deck);
    btn.innerHTML = `
      <div>Pont ${d.deck}</div>
      <div class="sub-name">${d.name}</div>
    `;
    strip.appendChild(btn);
  });
}

function switchCruiseDeck(deckNum) {
  currentActiveCruiseDeck = deckNum;
  document.querySelectorAll('.deck-btn-pill').forEach(btn => {
    const txt = btn.innerText;
    if (txt.includes(`Pont ${deckNum}`)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  renderActiveCruiseDeckView();
}

function renderActiveCruiseDeckView() {
  const svgMount = document.getElementById('cruise-deck-svg-mount');
  const detailsMount = document.getElementById('cruise-deck-details-mount');
  if (!svgMount || !detailsMount) return;

  const storedCabin = getCruiseStoredCabin();
  const cabinDecoded = storedCabin ? decodeCruiseCabin(storedCabin) : null;
  const deckObj = CRUISE_SHIP_DECKS.find(d => d.deck === currentActiveCruiseDeck) || { deck: currentActiveCruiseDeck, name: '', description: '', highlights: [] };

  svgMount.innerHTML = renderShipDeckSvg(currentActiveCruiseDeck, cabinDecoded, null);

  let highlightsHtml = '';
  if (deckObj.highlights && deckObj.highlights.length > 0) {
    highlightsHtml = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-top:10px;">
        ${deckObj.highlights.map(h => `
          <div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:10px 12px; display:flex; gap:10px; align-items:flex-start;">
            <div style="width:34px; height:34px; border-radius:8px; background:${h.color || '#0284c7'}; color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid fa-${h.icon || 'star'}"></i>
            </div>
            <div style="flex:1;">
              <div style="font-size:0.85rem; font-weight:800; color:#0f172a; line-height:1.25;">${h.name}</div>
              <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">
                <span style="font-weight:700; color:#0284c7;">${h.zone}</span> &bull; Côté ${h.side}
              </div>
              <div style="font-size:0.75rem; color:#334155; margin-top:4px; line-height:1.35;">${h.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  detailsMount.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
      <div>
        <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:0;">
          Pont ${deckObj.deck} &mdash; ${deckObj.name}
        </h4>
        <div style="font-size:0.75rem; font-weight:700; color:#0284c7; text-transform:uppercase; margin-top:2px;">
          ${deckObj.category}
        </div>
      </div>
      <button type="button" onclick="planWayfinderToDeck(${deckObj.deck})" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.75rem; padding:5px 12px; border:none; cursor:pointer;">
        <i class="fa-solid fa-route"></i> Comment y aller
      </button>
    </div>

    <p style="font-size:0.82rem; color:#475569; margin:8px 0 0 0; line-height:1.45;">
      ${deckObj.description}
    </p>

    ${highlightsHtml}
  `;
}

function planWayfinderToDeck(deckNum) {
  switchCruiseSubTab('wayfinder');
  const target = CRUISE_KEY_LOCATIONS.find(l => l.deck === deckNum);
  if (target) {
    const sel = document.getElementById('wayfinder-to-select');
    if (sel) sel.value = target.id;
  }
  executeCruiseRouteWayfinder();
}

function switchCruiseSubTab(tabId) {
  const tabs = ['decks', 'wayfinder', 'compass'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btn-subtab-${t}`);
    const content = document.getElementById(`cruise-subtab-content-${t}`);
    if (btn) {
      if (t === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    if (content) {
      if (t === tabId) content.style.display = 'block';
      else content.style.display = 'none';
    }
  });

  if (tabId === 'compass' && !isCruiseCompassActive) {
    // Proposer l'activation
  }
}

function useStoredCabinAsWayfinderStart() {
  const stored = getCruiseStoredCabin();
  const input = document.getElementById('wayfinder-from-cabin');
  if (input) {
    input.value = stored ? ('Ma Cabine ' + stored) : '';
  }
}

function executeCruiseRouteWayfinder() {
  const fromInput = document.getElementById('wayfinder-from-cabin');
  const toSelect = document.getElementById('wayfinder-to-select');
  const resultsMount = document.getElementById('cruise-wayfinder-results');
  if (!toSelect || !resultsMount) return;

  const fromVal = fromInput ? fromInput.value : '';
  const toId = toSelect.value;
  const route = calculateCruiseRoute(fromVal, toId);
  if (!route) return;

  resultsMount.innerHTML = `
    <div style="background:white; border:1px solid #bae6fd; border-radius:16px; padding:16px; box-shadow:0 4px 15px rgba(2,132,199,0.06);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #f1f5f9;">
        <div>
          <span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
            Feuille de Route Intérieure
          </span>
          <h4 style="font-size:1.02rem; font-weight:800; color:#0f172a; margin-top:4px;">
            Itinéraire vers ${route.target.name}
          </h4>
          <div style="font-size:0.78rem; color:#64748b;">
            Destination : <strong>Pont ${route.target.deck} (${route.target.deckName})</strong> &bull; ${route.target.zone}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem; font-weight:900; color:#0284c7;">~ ${route.estimatedMinutes} min</div>
          <div style="font-size:0.72rem; color:#64748b;">${route.estimatedMeters} mètres à pied</div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        ${route.steps.map(s => `
          <div class="wayfinding-step">
            <div class="wayfinding-step-num" style="background:${s.color || '#0284c7'};">${s.num}</div>
            <div style="flex:1;">
              <div style="font-size:0.86rem; font-weight:800; color:#0f172a;">${s.title}</div>
              <div style="font-size:0.8rem; color:#334155; line-height:1.4; margin-top:2px;">${s.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" onclick="switchCruiseDeck(${route.target.deck}); switchCruiseSubTab('decks');" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.78rem; padding:6px 14px; border:none; cursor:pointer;">
          <i class="fa-solid fa-eye"></i> Voir le Pont ${route.target.deck} sur le plan
        </button>
      </div>
    </div>
  `;
}

// Boussole Marine (Capteurs locaux Smartphone 100% Offline)
function toggleCruiseCompass() {
  const btn = document.getElementById('btn-toggle-compass');
  if (isCruiseCompassActive) {
    stopCruiseCompass();
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Activer les capteurs de bord';
      btn.style.background = '#0284c7';
    }
  } else {
    startCruiseCompass();
  }
}

function startCruiseCompass() {
  const btn = document.getElementById('btn-toggle-compass');
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ permission request
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          attachCompassEventListener();
        } else {
          alert("Accès aux capteurs refusé par le navigateur. Vous pouvez utiliser les boutons manuels pour simuler votre cap.");
        }
      })
      .catch(err => {
        attachCompassEventListener();
      });
  } else {
    attachCompassEventListener();
  }
}

function attachCompassEventListener() {
  const btn = document.getElementById('btn-toggle-compass');
  cruiseCompassOrientationHandler = (event) => {
    let heading = 0;
    if (event.webkitCompassHeading) {
      // iOS
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      // Android / W3C standard
      heading = (360 - event.alpha) % 360;
    }
    updateCompassDisplay(Math.round(heading));
  };

  window.addEventListener('deviceorientation', cruiseCompassOrientationHandler, true);
  isCruiseCompassActive = true;
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Capteurs Actifs (Pause)';
    btn.style.background = '#059669';
  }
}

function stopCruiseCompass() {
  if (cruiseCompassOrientationHandler) {
    window.removeEventListener('deviceorientation', cruiseCompassOrientationHandler, true);
    cruiseCompassOrientationHandler = null;
  }
  isCruiseCompassActive = false;
}

function updateCompassDisplay(heading) {
  currentCruiseCompassHeading = heading;
  const dialEl = document.getElementById('marine-compass-dial-el');
  const headingText = document.getElementById('marine-compass-heading-text');
  const shipRelative = document.getElementById('marine-compass-ship-relative');

  if (dialEl) {
    dialEl.style.transform = `rotate(-${heading}deg)`;
  }

  // Direction cardinale
  const cardinals = ["NORD", "NORD-EST", "EST", "SUD-EST", "SUD", "SUD-OUEST", "OUEST", "NORD-OUEST"];
  const cardinalIndex = Math.round(heading / 45) % 8;
  const cardinal = cardinals[cardinalIndex];

  if (headingText) {
    headingText.innerText = `${heading}° ${cardinal}`;
  }

  // Orientation par rapport à la proue du navire
  if (shipRelative) {
    let shipDir = "Proue (Avant du navire)";
    if (heading >= 45 && heading < 135) {
      shipDir = "<span style='color:#34d399;'>Tribord (Côté Droit / Mer)</span>";
    } else if (heading >= 135 && heading < 225) {
      shipDir = "Poupe (Arrière du navire)";
    } else if (heading >= 225 && heading < 315) {
      shipDir = "<span style='color:#f87171;'>Bâbord (Côté Gauche / Mer)</span>";
    }
    shipRelative.innerHTML = `Orientation : Face à la <strong>${shipDir}</strong>`;
  }
}

function setManualCompassHeading(deg) {
  stopCruiseCompass();
  const btn = document.getElementById('btn-toggle-compass');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Activer les capteurs de bord';
    btn.style.background = '#0284c7';
  }
  updateCompassDisplay(deg);
}

function rotateManualCompass(delta) {
  stopCruiseCompass();
  let next = (currentCruiseCompassHeading + delta) % 360;
  if (next < 0) next += 360;
  updateCompassDisplay(next);
}


// 5. RENDER HOTELS, FLIGHTS & PRATIQUE
function renderHotelsAndFlights() {
  const flightsContainer = document.getElementById('flights-container');
  flightsContainer.innerHTML = '';

  // 1. Si une liste multi-vols existe (nouveau format)
  if (currentTrip.flightsList && currentTrip.flightsList.length > 0) {
    flightsContainer.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:10px;">
        <i class="fa-solid fa-plane-departure" style="color:var(--accent-gold); margin-right:6px;"></i> Plan de Vol & Liaisons Aériennes
      </h3>
    `;

    currentTrip.flightsList.forEach(f => {
      const isDomestic = f.type === 'Intérieur';
      const logoInfo = getAirlineLogoUrl(f.airline, f.flightNumber);
      const trackingLinks = getFlightTrackingLinks(f.flightNumber, f.airline);
      const card = document.createElement('div');
      card.style = `background:${isDomestic ? '#f0f9ff' : 'white'}; border-radius:16px; border:1px solid ${isDomestic ? '#bae6fd' : 'var(--border-light)'}; padding:14px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);`;
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${logoInfo ? `
              <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:3px 6px; display:flex; align-items:center; justify-content:center; min-width:44px; height:32px; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <img src="${logoInfo.svg}" alt="${f.airline}" onerror="this.onerror=null; this.src='${logoInfo.png}'; this.parentElement.style.display='inline-flex';" style="max-height:22px; max-width:54px; object-fit:contain;">
              </div>
            ` : `
              <div style="background:#eef7f2; border-radius:8px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; color:var(--primary-color);">
                <i class="fa-solid fa-plane"></i>
              </div>
            `}
            <div>
              <div style="font-weight:800; font-size:0.92rem; color:${isDomestic ? '#0369a1' : 'var(--primary-dark)'};">
                ${f.airline || 'Compagnie Aérienne'}
              </div>
              <div style="font-size:0.75rem; color:#64748b; font-weight:600;">
                ${f.type || 'Vol'}
              </div>
            </div>
          </div>
          <span style="color:var(--primary-color); font-weight:800; font-family:monospace; font-size:0.95rem; background:#f1f5f9; padding:3px 8px; border-radius:6px;">
            ${f.flightNumber || ''}
          </span>
        </div>

        <div style="font-size:0.84rem; color:#0f172a; margin:6px 0; font-weight:600;">
          ${f.date ? `<span style="color:#64748b; font-weight:normal;">${f.date} • </span>` : ''}<strong>${f.departureAirport || 'Départ'}</strong> ${f.departureTime ? `(${f.departureTime})` : ''} ➔ <strong>${f.arrivalAirport || 'Arrivée'}</strong> ${f.arrivalTime ? `(${f.arrivalTime})` : ''}
        </div>
        ${f.via ? `
          <div style="font-size:0.78rem; color:#b45309; background:#fffbeb; padding:4px 8px; border-radius:6px; margin:4px 0; display:inline-block;">
            <i class="fa-solid fa-arrows-split-up-and-left"></i> <strong>Escale / VIA :</strong> ${f.via}
          </div>
        ` : ''}
        ${f.notes ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${f.notes}</div>` : ''}

        ${trackingLinks ? `
          <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #e2e8f0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:5px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 2px rgba(22,163,74,0.2); animation:pulse 2s infinite;"></span>
              <strong>Suivi en temps réel :</strong>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <a href="${trackingLinks.flightAwareUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;" title="Suivre l'avancement, retards et porte sur FlightAware">
                <i class="fa-solid fa-satellite-dish"></i> Statut FlightAware
              </a>
              <a href="${trackingLinks.flightradar24Url}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#1e293b; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;" title="Radar direct sur Flightradar24">
                <i class="fa-solid fa-radar"></i> Radar Flightradar24
              </a>
            </div>
          </div>
        ` : ''}
      `;
      flightsContainer.appendChild(card);
    });
  } else if (currentTrip.flights && currentTrip.flights.outbound) {
    // Rétrocompatibilité avec l'ancien format d'origine
    const f = currentTrip.flights;
    const outboundLogo = getAirlineLogoUrl(f.outbound.airline, f.outbound.flightNumber);
    const outboundTracking = getFlightTrackingLinks(f.outbound.flightNumber, f.outbound.airline);
    flightsContainer.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:10px;">
        <i class="fa-solid fa-plane-departure" style="color:var(--accent-gold); margin-right:6px;"></i> Vols Internationaux & Intérieurs
      </h3>
      <div style="background:white; border-radius:16px; border:1px solid var(--border-light); padding:14px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${outboundLogo ? `
              <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:3px 6px; display:flex; align-items:center; justify-content:center; min-width:44px; height:32px;">
                <img src="${outboundLogo.svg}" alt="${f.outbound.airline}" onerror="this.onerror=null; this.src='${outboundLogo.png}';" style="max-height:22px; max-width:54px; object-fit:contain;">
              </div>
            ` : ''}
            <div>
              <div style="font-weight:800; font-size:0.92rem; color:var(--primary-dark);">Vol Aller : ${f.outbound.airline}</div>
            </div>
          </div>
          <span style="color:var(--primary-color); font-weight:800; font-family:monospace; font-size:0.95rem; background:#f1f5f9; padding:3px 8px; border-radius:6px;">${f.outbound.flightNumber}</span>
        </div>
        <div style="font-size:0.84rem; color:#0f172a; margin:4px 0;">
          ${f.outbound.date} • ${f.outbound.departureAirport} (${f.outbound.departureTime}) ➔ ${f.outbound.arrivalAirport}
        </div>
        <div style="font-size:0.76rem; color:#64748b;">${f.outbound.layover}</div>

        ${outboundTracking ? `
          <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #e2e8f0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:5px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 2px rgba(22,163,74,0.2);"></span>
              <strong>Suivi en temps réel :</strong>
            </div>
            <div style="display:flex; gap:6px;">
              <a href="${outboundTracking.flightAwareUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;">
                <i class="fa-solid fa-satellite-dish"></i> FlightAware
              </a>
              <a href="${outboundTracking.flightradar24Url}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#1e293b; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;">
                <i class="fa-solid fa-radar"></i> Flightradar24
              </a>
            </div>
          </div>
        ` : ''}
      </div>

      ${(f.domesticFlights && f.domesticFlights.length) ? f.domesticFlights.map(df => {
        const dfLogo = getAirlineLogoUrl(df.airline, df.flightNumber);
        const dfTracking = getFlightTrackingLinks(df.flightNumber, df.airline);
        return `
          <div style="background:#f0f9ff; border-radius:16px; border:1px solid #bae6fd; padding:14px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                ${dfLogo ? `
                  <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:3px 6px; display:flex; align-items:center; justify-content:center; min-width:44px; height:32px;">
                    <img src="${dfLogo.svg}" alt="${df.airline}" onerror="this.onerror=null; this.src='${dfLogo.png}';" style="max-height:22px; max-width:54px; object-fit:contain;">
                  </div>
                ` : ''}
                <div>
                  <div style="font-weight:800; font-size:0.9rem; color:#0369a1;"><i class="fa-solid fa-plane"></i> Vol Intérieur (Jour ${df.day}) : ${df.airline}</div>
                </div>
              </div>
              <span style="color:#0284c7; font-weight:800; font-family:monospace; font-size:0.9rem; background:white; padding:3px 8px; border-radius:6px;">${df.flightNumber}</span>
            </div>
            <div style="font-size:0.82rem; color:#0f172a; margin:4px 0;">
              ${df.departureAirport} ➔ ${df.arrivalAirport}
            </div>
            <div style="font-size:0.76rem; color:#0284c7;">${df.notes}</div>

            ${dfTracking ? `
              <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #bae6fd; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="font-size:0.75rem; color:#0369a1; display:flex; align-items:center; gap:5px;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 2px rgba(22,163,74,0.2);"></span>
                  <strong>Suivi en temps réel :</strong>
                </div>
                <div style="display:flex; gap:6px;">
                  <a href="${dfTracking.flightAwareUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;">
                    <i class="fa-solid fa-satellite-dish"></i> FlightAware
                  </a>
                  <a href="${dfTracking.flightradar24Url}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#1e293b; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px; text-decoration:none;">
                    <i class="fa-solid fa-radar"></i> Flightradar24
                  </a>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('') : ''}
    `;
  }

  const hotelsContainer = document.getElementById('hotels-container');
  hotelsContainer.innerHTML = '';
  if (currentTrip.hotels) {
    hotelsContainer.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:10px;">
        <i class="fa-solid fa-bed" style="color:var(--accent-gold); margin-right:6px;"></i> Hébergement
      </h3>
    `;
    currentTrip.hotels.forEach(h => {
      const el = document.createElement('div');
      el.style = "background:white; border-radius:16px; border:1px solid var(--border-light); padding:14px; margin-bottom:10px;";
      const gpsUrl = (h.lat && h.lng) ? getGpsUrl(h.lat, h.lng, h.name) : '#';
      el.innerHTML = `
        <div style="font-size:0.75rem; color:var(--accent-gold); font-weight:800;">${h.dates || h.date || h.day || ""}</div>
        <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">${h.name}</div>
        <div style="font-size:0.8rem; color:#64748b; margin:2px 0 6px;">${h.address}</div>
        <a href="${gpsUrl}" target="_blank" class="btn-entry-gps"><i class="fa-solid fa-location-arrow"></i> GPS Hébergement</a>
      `;
      hotelsContainer.appendChild(el);
    });
  }
}

function renderContactsAndAlert() {
  const alertBox = document.getElementById('alert-banner-box');
  if (currentTrip.alert && currentTrip.alert.title) {
    alertBox.innerHTML = `
      <div style="background:#fffbeb; border:1px solid #fef3c7; border-left:4px solid #d97706; border-radius:14px; padding:14px; margin-bottom:16px;">
        <h4 style="font-size:0.9rem; font-weight:800; color:#92400e; margin-bottom:3px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentTrip.alert.title}</h4>
        <p style="font-size:0.82rem; color:#78350f; line-height:1.4;">${currentTrip.alert.text}</p>
        ${currentTrip.alert.link ? `<a href="${currentTrip.alert.link}" target="_blank" style="font-size:0.78rem; font-weight:bold; color:#b45309; text-decoration:underline; display:inline-block; margin-top:4px;">Remplir la formalité en ligne</a>` : ''}
      </div>
    `;
  }

  const contactsBox = document.getElementById('contacts-container');
  // 1. Nouveau format contactsList
  if (currentTrip.contactsList && currentTrip.contactsList.length > 0) {
    contactsBox.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:12px;">
        <i class="fa-solid fa-phone-volume" style="color:var(--accent-gold); margin-right:6px;"></i> Contacts Clés & Urgences
      </h3>
    `;

    currentTrip.contactsList.forEach(c => {
      const isUrgent = c.isEmergency;
      const card = document.createElement('div');
      card.style = `background:${isUrgent ? '#fef2f2' : 'white'}; border:1px solid ${isUrgent ? '#fee2e2' : 'var(--border-light)'}; border-left:4px solid ${isUrgent ? '#dc2626' : 'var(--primary-color)'}; border-radius:16px; padding:16px; margin-bottom:14px;`;
      
      card.innerHTML = `
        <h4 style="font-size:0.96rem; font-weight:800; color:${isUrgent ? '#dc2626' : 'var(--primary-dark)'}; margin-bottom:4px;">
          <i class="fa-solid ${isUrgent ? 'fa-triangle-exclamation' : 'fa-address-card'}"></i> ${c.category}
        </h4>
        <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${c.name}</div>
        ${c.address ? `<div style="font-size:0.82rem; color:#475569; margin:3px 0 6px;">${c.address}</div>` : ''}
        ${c.phone ? `
          <div style="margin-top:6px;">
            <a href="tel:${c.phone.replace(/[^0-9+]/g, '')}" class="btn-entry-gps" style="background:${isUrgent ? '#dc2626' : 'var(--primary-color)'}; color:white;">
              <i class="fa-solid fa-phone"></i> ${c.phone}
            </a>
          </div>
        ` : ''}
      `;
      contactsBox.appendChild(card);
    });
  } else if (currentTrip.contacts) {
    // Rétrocompatibilité format objet initial
    const c = currentTrip.contacts;
    contactsBox.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:12px;">
        <i class="fa-solid fa-phone-volume" style="color:var(--accent-gold); margin-right:6px;"></i> Contacts Clés & Urgences
      </h3>
    `;

    if (c.receptif && c.receptif.name) {
      contactsBox.innerHTML += `
        <div style="background:#fef2f2; border:1px solid #fee2e2; border-left:4px solid #dc2626; border-radius:16px; padding:16px; margin-bottom:14px;">
          <h4 style="font-size:0.98rem; font-weight:800; color:#dc2626; margin-bottom:4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Correspondant Local & Urgences 24/7
          </h4>
          <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">${c.receptif.name}</div>
          <div style="font-size:0.82rem; color:#475569; margin:4px 0 8px;">${c.receptif.address || ''}</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="tel:${c.receptif.emergency ? c.receptif.emergency.replace(/[^0-9+]/g, '') : ''}" class="btn-entry-gps" style="background:#dc2626; color:white; padding:8px 14px; font-size:0.82rem;">
              <i class="fa-solid fa-phone-volume"></i> Urgence : ${c.receptif.emergency}
            </a>
          </div>
        </div>
      `;
    }

    if (c.guide && c.guide.name) {
      contactsBox.innerHTML += `
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-left:4px solid #16a34a; border-radius:16px; padding:16px; margin-bottom:14px;">
          <h4 style="font-size:0.98rem; font-weight:800; color:#166534; margin-bottom:4px;">
            <i class="fa-solid fa-user-tie"></i> ${c.guide.role || 'Accompagnateur Girardot'}
          </h4>
          <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">${c.guide.name}</div>
          ${c.guide.phone ? `
            <div style="margin-top:6px;">
              <a href="tel:${c.guide.phone.replace(/[^0-9+]/g, '')}" class="btn-entry-gps" style="background:#16a34a; color:white; padding:8px 14px; font-size:0.82rem;">
                <i class="fa-solid fa-phone"></i> ${c.guide.phone}
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (c.emergency && c.emergency.name) {
      contactsBox.innerHTML += `
        <div style="background:#fef2f2; border:1px solid #fee2e2; border-left:4px solid #dc2626; border-radius:16px; padding:16px; margin-bottom:14px;">
          <h4 style="font-size:0.98rem; font-weight:800; color:#dc2626; margin-bottom:4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> ${c.emergency.name}
          </h4>
          <div style="font-size:0.82rem; color:#475569; margin:4px 0 8px;">${c.emergency.agency || 'Assistance 24/7'}</div>
          ${c.emergency.phone ? `
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <a href="tel:${c.emergency.phone.replace(/[^0-9+]/g, '')}" class="btn-entry-gps" style="background:#dc2626; color:white; padding:8px 14px; font-size:0.82rem;">
                <i class="fa-solid fa-phone-volume"></i> ${c.emergency.phone}
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  const practicalBox = document.getElementById('practical-container');
  // 1. Nouveau format practicalTipsList
  if (currentTrip.practicalTipsList && currentTrip.practicalTipsList.length > 0) {
    practicalBox.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:12px;">
        <i class="fa-solid fa-lightbulb" style="color:var(--accent-gold); margin-right:6px;"></i> Conseils Pratiques du Voyageur
      </h3>
      <div style="background:white; border:1px solid var(--border-light); border-radius:16px; padding:16px;">
        ${currentTrip.practicalTipsList.map((tip, idx) => `
          <div style="${idx < currentTrip.practicalTipsList.length - 1 ? 'margin-bottom:14px; border-bottom:1px dashed #e2e8f0; padding-bottom:10px;' : ''}">
            <strong><i class="fa-solid fa-check" style="color:var(--accent-gold); margin-right:6px;"></i> ${tip.title} :</strong>
            <p style="font-size:0.85rem; color:#475569; margin-top:3px; line-height:1.45;">${tip.content}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else if (currentTrip.practicalInfo) {
    const p = currentTrip.practicalInfo;
    practicalBox.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:12px;">
        <i class="fa-solid fa-lightbulb" style="color:var(--accent-gold); margin-right:6px;"></i> Conseils Pratiques du Voyageur
      </h3>
      <div style="background:white; border:1px solid var(--border-light); border-radius:16px; padding:16px;">
        <div style="margin-bottom:12px;">
          <strong><i class="fa-solid fa-coins" style="color:var(--accent-gold); margin-right:6px;"></i> Devise & Paiement :</strong>
          <p style="font-size:0.84rem; color:#475569; margin-top:2px;">${p.money}</p>
        </div>
        <div style="margin-bottom:12px;">
          <strong><i class="fa-solid fa-plug" style="color:var(--accent-gold); margin-right:6px;"></i> Électricité & Prises :</strong>
          <p style="font-size:0.84rem; color:#475569; margin-top:2px;">${p.electricity}</p>
        </div>
        <div style="margin-bottom:12px;">
          <strong><i class="fa-solid fa-shirt" style="color:var(--accent-gold); margin-right:6px;"></i> Vêtements conseillés :</strong>
          <p style="font-size:0.84rem; color:#475569; margin-top:2px;">${p.clothing}</p>
        </div>
        <div style="margin-bottom:12px;">
          <strong><i class="fa-solid fa-hand-holding-dollar" style="color:var(--accent-gold); margin-right:6px;"></i> Pourboires :</strong>
          <p style="font-size:0.84rem; color:#475569; margin-top:2px;">${p.tips}</p>
        </div>
      </div>
    `;
  }
}

// 6. LEAFLET MAP LOGIC
function initMap() {
  const mapElement = document.getElementById('travel-map');
  if (!mapElement || typeof L === 'undefined') return;

  if (leafletMap) {
    updateMapFilterButtonsVisibility();
    setTimeout(() => {
      leafletMap.invalidateSize(true);
    }, 100);
    return;
  }

  // Trouver le centre initial selon les étapes, visites ou hôtels du voyage
  let initialCenter = [46.2276, 2.2137]; // Défaut France
  let initialZoom = 5;

  if (currentTrip) {
    // 1. Chercher dans l'itinéraire (étapes ou visites)
    if (currentTrip.itinerary && Array.isArray(currentTrip.itinerary)) {
      for (const it of currentTrip.itinerary) {
        const lat = parseFloat(it.lat);
        const lng = parseFloat(it.lng);
        if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
          initialCenter = [lat, lng];
          initialZoom = 11;
          break;
        }
        if (it.timeline && Array.isArray(it.timeline)) {
          const v = it.timeline.find(t => {
            const vlat = parseFloat(t.lat);
            const vlng = parseFloat(t.lng);
            return !isNaN(vlat) && !isNaN(vlng) && (vlat !== 0 || vlng !== 0);
          });
          if (v) {
            initialCenter = [parseFloat(v.lat), parseFloat(v.lng)];
            initialZoom = 12;
            break;
          }
        }
      }
    }
    // 2. Si pas encore trouvé, chercher dans les hôtels
    if (initialZoom === 5 && currentTrip.hotels && Array.isArray(currentTrip.hotels)) {
      const hWithGps = currentTrip.hotels.find(h => {
        const hlat = parseFloat(h.lat);
        const hlng = parseFloat(h.lng);
        return !isNaN(hlat) && !isNaN(hlng) && (hlat !== 0 || hlng !== 0);
      });
      if (hWithGps) {
        initialCenter = [parseFloat(hWithGps.lat), parseFloat(hWithGps.lng)];
        initialZoom = 12;
      }
    }
  }

  // OpenStreetMap France Tiles
  leafletMap = L.map('travel-map', {
    center: initialCenter,
    zoom: initialZoom,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    maxZoom: 20,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap France | Voyages Girardot'
  }).addTo(leafletMap);

  renderMapMarkers('all');
  setupMapFilterButtons();

  setTimeout(() => {
    leafletMap.invalidateSize(true);
    if (mapMarkers.length > 0) {
      const activeBtn = document.querySelector('.map-filters .filter-btn.active');
      const cat = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
      renderMapMarkers(cat);
    }
  }, 250);
}

function renderMapMarkers(filterCategory = 'all') {
  if (!leafletMap || typeof L === 'undefined') return;

  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];
  const bounds = [];

  // 1. Itinerary & Visits
  if (filterCategory === 'all' || filterCategory === 'itinerary') {
    if (currentTrip.itinerary) {
      currentTrip.itinerary.forEach((item) => {
        const itemLat = parseFloat(item.lat);
        const itemLng = parseFloat(item.lng);

        if (!isNaN(itemLat) && !isNaN(itemLng) && (itemLat !== 0 || itemLng !== 0)) {
          const gpsUrl = getGpsUrl(itemLat, itemLng, item.title);
          const icon = L.divIcon({
            className: 'custom-map-pin',
            html: `<div style="background:#144534; color:white; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${item.day}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const marker = L.marker([itemLat, itemLng], { icon: icon }).addTo(leafletMap);
          marker.bindPopup(`
            <div style="font-family:'Archivo',sans-serif; max-width:210px;">
              <strong style="color:#144534;">Jour ${item.day} • ${item.city || ''}</strong><br>
              <div style="font-size:12px; margin:4px 0;">${item.title}</div>
              <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#0284c7; color:white; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">
                <i class="fa-solid fa-location-arrow"></i> Lancer GPS
              </a>
            </div>
          `);
          mapMarkers.push(marker);
          bounds.push([itemLat, itemLng]);
        }

        // Points des visites précises du jour si géolocalisées
        if (item.timeline && Array.isArray(item.timeline)) {
          item.timeline.forEach(visit => {
            const vLat = parseFloat(visit.lat);
            const vLng = parseFloat(visit.lng);
            if (!isNaN(vLat) && !isNaN(vLng) && (vLat !== 0 || vLng !== 0)) {
              const gpsUrl = getGpsUrl(vLat, vLng, visit.title);
              const icon = L.divIcon({
                className: 'custom-map-pin-visit',
                html: `<div style="background:#0284c7; color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.25);" title="${visit.title}"><i class="fa-solid fa-location-dot"></i></div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
              });

              const vMarker = L.marker([vLat, vLng], { icon: icon }).addTo(leafletMap);
              vMarker.bindPopup(`
                <div style="font-family:'Archivo',sans-serif; max-width:210px;">
                  <span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:bold;">Jour ${item.day} • ${visit.time || 'Visite'}</span>
                  <div style="font-size:12px; font-weight:bold; margin:4px 0 2px; color:#0f172a;">${visit.title}</div>
                  ${visit.subtitle ? `<div style="font-size:11px; color:#64748b; margin-bottom:4px;">${visit.subtitle}</div>` : ''}
                  <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:4px; background:#0284c7; color:white; padding:3px 8px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">
                    <i class="fa-solid fa-location-arrow"></i> GPS
                  </a>
                </div>
              `);
              mapMarkers.push(vMarker);
              bounds.push([vLat, vLng]);
            }
          });
        }
      });
    }
  }

  // 2. Domestic flight line & Plane icon (vols intérieurs uniquement si demandé ou vue globale)
  if (filterCategory === 'all' || filterCategory === 'flights') {
    const domesticFlights = (currentTrip.flights && currentTrip.flights.domesticFlights) ? currentTrip.flights.domesticFlights : [];
    domesticFlights.forEach((flight) => {
      const fLat = parseFloat(flight.fromLat);
      const fLng = parseFloat(flight.fromLng);
      const tLat = parseFloat(flight.toLat);
      const tLng = parseFloat(flight.toLng);

      if (!isNaN(fLat) && !isNaN(fLng) && !isNaN(tLat) && !isNaN(tLng)) {
        const fromPoint = [fLat, fLng];
        const toPoint = [tLat, tLng];

        const flightLine = L.polyline([fromPoint, toPoint], {
          color: '#0284c7',
          weight: 3.5,
          opacity: 0.9,
          dashArray: '8, 8',
          className: 'flight-path'
        }).addTo(leafletMap);

        mapMarkers.push(flightLine);

        const midLat = (fLat + tLat) / 2;
        const midLng = (fLng + tLng) / 2;

        const planeIcon = L.divIcon({
          className: 'plane-marker-icon',
          html: `<div class="plane-mid-marker" title="${flight.label}"><i class="fa-solid fa-plane"></i></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const planeMarker = L.marker([midLat, midLng], { icon: planeIcon }).addTo(leafletMap);
        planeMarker.bindPopup(`
          <div style="font-family:'Archivo',sans-serif; max-width:220px;">
            <strong style="color:#0284c7; font-size:13px;"><i class="fa-solid fa-plane-departure"></i> ${flight.label}</strong><br>
            <span style="font-size:12px;">${flight.airline} • ${flight.departureTime}</span>
          </div>
        `);
        mapMarkers.push(planeMarker);

        bounds.push(fromPoint);
        bounds.push(toPoint);
      }
    });
  }

  // 3. Hotels
  if (filterCategory === 'all' || filterCategory === 'hotels') {
    if (currentTrip.hotels) {
      currentTrip.hotels.forEach((hotel) => {
        const hLat = parseFloat(hotel.lat);
        const hLng = parseFloat(hotel.lng);
        if (!isNaN(hLat) && !isNaN(hLng) && (hLat !== 0 || hLng !== 0)) {
          const gpsUrl = getGpsUrl(hLat, hLng, hotel.name);
          const icon = L.divIcon({
            className: 'custom-map-pin-hotel',
            html: `<div style="background:#c29958; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"><i class="fa-solid fa-bed"></i></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          const marker = L.marker([hLat, hLng], { icon: icon }).addTo(leafletMap);
          marker.bindPopup(`
            <div style="font-family:'Archivo',sans-serif; max-width:220px;">
              <strong style="color:#c29958;"><i class="fa-solid fa-bed"></i> ${hotel.name}</strong><br>
              <span style="font-size:11px; color:#64748b;">${hotel.dates}</span><br>
              <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#0284c7; color:white; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">GPS Hébergement</a>
            </div>
          `);
          mapMarkers.push(marker);
          bounds.push([hLat, hLng]);
        }
      });
    }
  }

  // 4. Free time & Coups de cœur de la destination
  if (filterCategory === 'all' || filterCategory === 'freetime') {
    const tripTitle = ((currentTrip.title || "") + " " + (currentTrip.destination || "") + " " + (currentTrip.subtitle || "")).toLowerCase();
    const isSouthAfricaTrip = tripTitle.includes('afrique') || tripTitle.includes('kruger') || tripTitle.includes('cap');

    // Récupérer les suggestions de temps libre propres au voyage en éliminant les reliquats d'Afrique du Sud si ce n'est pas le voyage AF Sud
    let validSuggs = (currentTrip.freeTimeSuggestions || []).filter(sug => {
      if (!isSouthAfricaTrip) {
        const text = ((sug.name || "") + " " + (sug.location || "") + " " + (sug.description || "")).toLowerCase();
        if (text.includes('table mountain') || text.includes('kirstenbosch') || text.includes('le cap') || text.includes('kruger') || text.includes('fynbos') || text.includes('pot luck club')) {
          return false;
        }
        // Éliminer les coordonnées GPS en Afrique du Sud (lat négative autour de -33°) si voyage aux USA / Europe
        if (sug.lat && sug.lat < 0 && !isSouthAfricaTrip) return false;
      }
      return true;
    });

    // Si le voyage n'a pas de freeTimeSuggestions manuelles mais possède des visites libres dans la conciergerie, les inclure sur la carte
    if (validSuggs.length === 0 && currentTrip.conciergerie && currentTrip.conciergerie.themes) {
      const visitesTheme = currentTrip.conciergerie.themes.find(t => t.id === 'visites' && t.enabled !== false);
      if (visitesTheme && visitesTheme.places) {
        visitesTheme.places.forEach(p => {
          if (p.lat && p.lng) {
            validSuggs.push({
              name: p.name,
              category: p.category || "Coup de cœur",
              location: p.location,
              description: p.description,
              lat: p.lat,
              lng: p.lng
            });
          }
        });
      }
    }

    validSuggs.forEach((sug) => {
      const sLat = parseFloat(sug.lat);
      const sLng = parseFloat(sug.lng);
      if (!isNaN(sLat) && !isNaN(sLng) && (sLat !== 0 || sLng !== 0)) {
        const gpsUrl = getGpsUrl(sLat, sLng, sug.name);
        const icon = L.divIcon({
          className: 'custom-map-pin-sug',
          html: `<div style="background:#e11d48; color:white; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:11px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"><i class="fa-solid fa-heart"></i></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker([sLat, sLng], { icon: icon }).addTo(leafletMap);
        marker.bindPopup(`
          <div style="font-family:'Archivo',sans-serif; max-width:220px;">
            <strong style="color:#1e293b; font-size:13px;">${sug.name}</strong><br>
            <span style="font-size:11px; color:#64748b;">${sug.location || ''}</span><br>
            <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#0284c7; color:white; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">GPS Visite</a>
          </div>
        `);
        mapMarkers.push(marker);
        bounds.push([sLat, sLng]);
      }
    });
  }

  if (bounds.length > 0) {
    try {
      if (bounds.length === 1) {
        leafletMap.setView(bounds[0], 13);
      } else {
        // Détecter si les points sont aberrants / mondiaux (> 50 degrés d'écart, ex: Chicago + Afrique du Sud)
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        bounds.forEach(pt => {
          if (pt[0] < minLat) minLat = pt[0];
          if (pt[0] > maxLat) maxLat = pt[0];
          if (pt[1] < minLng) minLng = pt[1];
          if (pt[1] > maxLng) maxLng = pt[1];
        });

        // Si l'écart est gigantesque (deux continents distincts), on se focalise sur les étapes du voyage
        if ((maxLat - minLat > 50) || (maxLng - minLng > 80)) {
          const itPt = (currentTrip.itinerary || []).find(it => parseFloat(it.lat) && parseFloat(it.lng));
          if (itPt) {
            leafletMap.setView([parseFloat(itPt.lat), parseFloat(itPt.lng)], 12);
          } else {
            leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
          }
        } else {
          leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      }
    } catch(e) {
      console.warn('fitBounds error:', e);
    }
  } else {
    // Si aucun point dans ce filtre, recentrer sur le voyage (hôtel ou étape) pour éviter la carte du monde
    if (currentTrip) {
      let fallbackPoint = null;
      if (currentTrip.itinerary && currentTrip.itinerary.length) {
        const it = currentTrip.itinerary.find(x => parseFloat(x.lat) && parseFloat(x.lng));
        if (it) fallbackPoint = [parseFloat(it.lat), parseFloat(it.lng)];
      }
      if (!fallbackPoint && currentTrip.hotels && currentTrip.hotels.length) {
        const h = currentTrip.hotels.find(x => parseFloat(x.lat) && parseFloat(x.lng));
        if (h) fallbackPoint = [parseFloat(h.lat), parseFloat(h.lng)];
      }
      if (fallbackPoint) {
        leafletMap.setView(fallbackPoint, 12);
      }
    }
  }
}

function hasDomesticFlights() {
  if (!currentTrip) return false;
  const legacyDomestic = (currentTrip.flights && currentTrip.flights.domesticFlights && currentTrip.flights.domesticFlights.length > 0);
  const listDomestic = (currentTrip.flightsList && currentTrip.flightsList.some(f => f.type === 'Intérieur'));
  return Boolean(legacyDomestic || listDomestic);
}

function updateMapFilterButtonsVisibility() {
  const flightBtn = document.querySelector('.filter-btn[data-filter="flights"]');
  if (!flightBtn) return;
  const showFlightBtn = hasDomesticFlights();
  flightBtn.style.display = showFlightBtn ? 'inline-flex' : 'none';

  // Si le bouton était sélectionné mais n'existe plus, revenir à 'Tout'
  if (!showFlightBtn && flightBtn.classList.contains('active')) {
    flightBtn.classList.remove('active');
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
  }
}

function setupMapFilterButtons() {
  updateMapFilterButtonsVisibility();
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.onclick = () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMapMarkers(btn.getAttribute('data-filter'));
    };
  });
}

// 7. BOTTOM NAVIGATION LOGIC
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-tab-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      switchMainTab(targetId);
    });
  });
}

function switchMainTab(targetId) {
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
  });

  document.querySelectorAll('.tab-page-view').forEach(tab => {
    tab.classList.toggle('active', tab.id === targetId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (targetId === 'tab-carte') {
    initMap();
    if (leafletMap) {
      const activeFilterBtn = document.querySelector('.map-filters .filter-btn.active');
      const currentFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
      renderMapMarkers(currentFilter);
      setTimeout(() => {
        leafletMap.invalidateSize(true);
      }, 150);
    }
  }

  if (targetId === 'tab-documents') {
    renderClientDocuments();
  }
}

// -----------------------------------------------------------------------------
// 8. GESTION DES DOCUMENTS DE VOYAGE (AGENCE + SCANNER PERSONNEL CLIENT)
// -----------------------------------------------------------------------------
let activeDocFilter = 'all';
let currentPendingScan = null; // Données en cours de validation dans le modal d'ajout

function getClientPersonalDocsKey() {
  return `girardot_personal_docs_${currentTrip ? currentTrip.id : 'default'}`;
}

function getClientPersonalDocs() {
  try {
    return JSON.parse(localStorage.getItem(getClientPersonalDocsKey()) || '[]');
  } catch(e) {
    return [];
  }
}

function saveClientPersonalDocs(list) {
  localStorage.setItem(getClientPersonalDocsKey(), JSON.stringify(list));
}

// Détection automatique intelligente du type de document
function detectDocTypeFromTextAndFilename(text = "", filename = "") {
  const combined = (text + " " + filename).toLowerCase();

  // 1. Passeport / Pièce d'identité
  if (combined.includes('passeport') || combined.includes('passport') || combined.includes('cni') || combined.includes('identit') || combined.includes('republique') || combined.includes('nationalite') || combined.includes('naissance')) {
    return {
      type: "identity",
      label: "Passeport / Pièce d'identité",
      icon: "fa-passport",
      color: "#0369a1",
      suggestedTitle: "Passeport / Pièce d'identité"
    };
  }

  // 2. Visa électronique / Autorisation
  if (combined.includes('visa') || combined.includes('esta') || combined.includes('eta') || combined.includes('evisa') || combined.includes('consul') || combined.includes('immigration') || combined.includes('sars')) {
    return {
      type: "visa",
      label: "Visa électronique / Autorisation",
      icon: "fa-id-card-clip",
      color: "#7c3aed",
      suggestedTitle: "Visa électronique d'entrée"
    };
  }

  // 3. Billets d'avion / Boarding pass
  if (combined.includes('vol') || combined.includes('flight') || combined.includes('air') || combined.includes('embarquement') || combined.includes('boarding') || combined.includes('pnr') || combined.includes('ticket') && combined.includes('plane') || combined.includes('aeroport') || combined.includes('airport')) {
    return {
      type: "flight",
      label: "Billet d'avion / Carte d'embarquement",
      icon: "fa-plane-departure",
      color: "#0284c7",
      suggestedTitle: "Billet d'avion / Carte d'embarquement"
    };
  }

  // 4. Billets d'entrée / Activités
  if (combined.includes('entree') || combined.includes('billet') || combined.includes('musee') || combined.includes('museum') || combined.includes('pass') || combined.includes('monument') || combined.includes('croisiere') || combined.includes('spectacle')) {
    return {
      type: "ticket",
      label: "Billet d'entrée / Activité",
      icon: "fa-ticket",
      color: "#ea580c",
      suggestedTitle: "Billet d'entrée visite / activité"
    };
  }

  // 5. Bon d'échange / Voucher hôtel ou transport
  if (combined.includes('voucher') || combined.includes('echange') || combined.includes('hotel') || combined.includes('booking') || combined.includes('reservation') || combined.includes('chambre') || combined.includes('location')) {
    return {
      type: "voucher",
      label: "Bon d'échange (Voucher)",
      icon: "fa-hotel",
      color: "#059669",
      suggestedTitle: "Bon d'échange / Voucher"
    };
  }

  // 6. Autre document
  return {
    type: "other",
    label: "Document personnel",
    icon: "fa-file-lines",
    color: "#475569",
    suggestedTitle: filename ? filename.replace(/\.[^/.]+$/, "") : "Document personnel de voyage"
  };
}

function getDocTypeInfo(type) {
  const map = {
    flight: { label: "Billet d'avion", icon: "fa-plane-departure", color: "#0284c7" },
    voucher: { label: "Bon d'échange", icon: "fa-hotel", color: "#059669" },
    ticket: { label: "Billet d'entrée", icon: "fa-ticket", color: "#ea580c" },
    identity: { label: "Passeport / CNI", icon: "fa-passport", color: "#0369a1" },
    visa: { label: "Visa électronique", icon: "fa-id-card-clip", color: "#7c3aed" },
    guide: { label: "Plan & Guide", icon: "fa-map-location-dot", color: "#0891b2" },
    other: { label: "Document", icon: "fa-file-lines", color: "#475569" }
  };
  return map[type] || map.other;
}

function renderClientDocuments() {
  const container = document.getElementById('client-documents-list');
  if (!container) return;

  const agencyDocs = (currentTrip && currentTrip.documents) ? currentTrip.documents.map(d => ({ ...d, source: 'agency' })) : [];
  const personalDocs = getClientPersonalDocs().map(d => ({ ...d, source: 'personal' }));
  const allDocs = [...agencyDocs, ...personalDocs];

  // Mettre à jour les compteurs des badges de filtre
  const counts = {
    all: allDocs.length,
    agency: agencyDocs.length,
    flight: allDocs.filter(d => d.type === 'flight').length,
    voucher: allDocs.filter(d => d.type === 'voucher').length,
    identity: allDocs.filter(d => d.type === 'identity').length,
    visa: allDocs.filter(d => d.type === 'visa').length,
    ticket: allDocs.filter(d => d.type === 'ticket').length
  };

  for (const k in counts) {
    const el = document.getElementById(`count-docs-${k}`);
    if (el) el.innerText = counts[k];
  }

  // Filtrer la liste
  let filtered = allDocs;
  if (activeDocFilter === 'agency') {
    filtered = allDocs.filter(d => d.source === 'agency');
  } else if (activeDocFilter !== 'all') {
    filtered = allDocs.filter(d => d.type === activeDocFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background:white; border-radius:18px; padding:32px 20px; text-align:center; border:1px dashed #cbd5e1; box-shadow:var(--shadow-subtle);">
        <div style="background:#f0f9ff; width:64px; height:64px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#0284c7; font-size:1.8rem; margin-bottom:12px;">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <h4 style="font-size:1.05rem; font-weight:800; color:var(--primary-dark); margin-bottom:4px;">Aucun document dans cette catégorie</h4>
        <p style="font-size:0.84rem; color:#64748b; margin-bottom:16px;">
          Vous pouvez scanner votre passeport, visa, carte d'embarquement ou billets pour les conserver hors-ligne.
        </p>
        <button type="button" onclick="triggerClientDocScanner()" class="btn-entry-gps" style="background:#0284c7; color:white; padding:8px 18px; font-size:0.85rem; border:none; cursor:pointer;">
          <i class="fa-solid fa-camera"></i> Scanner ou ajouter un document
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(doc => {
    const typeInfo = getDocTypeInfo(doc.type);
    const isAgency = doc.source === 'agency';
    const card = document.createElement('div');
    card.className = `client-doc-card ${isAgency ? 'agency-doc' : 'personal-doc'}`;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
        <span class="doc-badge-source ${isAgency ? 'doc-badge-agency' : 'doc-badge-personal'}">
          <i class="fa-solid ${isAgency ? 'fa-building' : 'fa-user-shield'}"></i>
          ${isAgency ? 'Document Agence' : 'Mon Coffre-Fort'}
        </span>
        <span style="font-size:0.75rem; font-weight:700; color:${typeInfo.color}; display:inline-flex; align-items:center; gap:4px;">
          <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.label}
        </span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
        <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin:0;">${doc.title}</h3>
        ${doc.type === 'flight' ? (() => {
          const lInfo = getAirlineLogoUrl(doc.title + " " + (doc.notes || ''), doc.reference);
          return lInfo ? `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:6px; padding:2px 6px; display:inline-flex; align-items:center; justify-content:center; height:26px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
              <img src="${lInfo.svg}" alt="Logo" onerror="this.onerror=null; this.src='${lInfo.png}';" style="max-height:18px; max-width:44px; object-fit:contain;">
            </div>
          ` : '';
        })() : ''}
      </div>
      ${doc.reference ? `<div style="font-size:0.82rem; font-family:monospace; font-weight:700; color:#0284c7; margin-bottom:4px;"><i class="fa-solid fa-barcode"></i> ${doc.reference}</div>` : ''}
      
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:0.8rem; color:#64748b; margin:6px 0 10px;">
        ${doc.beneficiary ? `<span><i class="fa-solid fa-user"></i> ${doc.beneficiary}</span>` : ''}
        ${doc.date ? `<span><i class="fa-regular fa-calendar"></i> ${doc.date}</span>` : ''}
      </div>

      ${doc.notes ? `
        <div style="background:#f8fafc; border-radius:8px; padding:8px 10px; font-size:0.78rem; color:#475569; margin-bottom:12px; border-left:3px solid #cbd5e1;">
          ${doc.notes}
        </div>
      ` : ''}

      <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px dashed #e2e8f0; padding-top:10px;">
        ${doc.type === 'flight' ? (() => {
          const tLinks = getFlightTrackingLinks(doc.reference, doc.title + " " + (doc.notes || ''));
          return tLinks ? `
            <a href="${tLinks.flightAwareUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.8rem; padding:6px 12px; text-decoration:none;" title="Suivre ce vol en direct">
              <i class="fa-solid fa-satellite-dish"></i> Suivi Live
            </a>
          ` : '';
        })() : ''}

        ${doc.qrCode ? `
          <button type="button" onclick="openDocQrModal('${doc.id}')" class="btn-entry-gps" style="background:#0284c7; color:white; font-size:0.8rem; padding:6px 14px; border:none; cursor:pointer;">
            <i class="fa-solid fa-qrcode"></i> Présenter le QR Code
          </button>
        ` : ''}

        <button type="button" onclick="viewClientDocDetails('${doc.id}')" class="btn-entry-gps" style="background:#f1f5f9; color:#334155; font-size:0.8rem; padding:6px 14px; border:none; cursor:pointer;">
          <i class="fa-solid fa-eye"></i> Voir le document
        </button>

        ${doc.fileUrl ? `
          <button type="button" onclick="downloadTransitMapFile('${doc.fileUrl}', '${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.png')" class="btn-entry-gps" style="background:#eef7f2; color:#16a34a; font-size:0.8rem; padding:6px 12px; border:none; cursor:pointer;" title="Télécharger hors-ligne">
            <i class="fa-solid fa-download"></i>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function filterClientDocuments(filterKey) {
  activeDocFilter = filterKey;
  document.querySelectorAll('.doc-filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filterKey);
  });
  renderClientDocuments();
}

// Déclencheur du scanner / sélecteur photo
function triggerClientDocScanner() {
  const input = document.getElementById('client-doc-file-input');
  if (input) input.click();
}

function handleClientDocFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Data = evt.target.result;
    
    // Détection auto intelligente
    const detected = detectDocTypeFromTextAndFilename(file.name, file.name);

    currentPendingScan = {
      id: 'doc_user_' + Date.now(),
      fileData: base64Data,
      fileName: file.name,
      fileSize: file.size,
      detectedType: detected.type
    };

    // Pré-remplir le modal d'ajout
    const previewImg = document.getElementById('add-doc-preview-img');
    const badgeLabel = document.getElementById('add-doc-detected-label');
    const typeSelect = document.getElementById('add-doc-type');
    const titleInp = document.getElementById('add-doc-title');
    const refInp = document.getElementById('add-doc-ref');
    const dateInp = document.getElementById('add-doc-date');
    const qrInp = document.getElementById('add-doc-qr');
    const notesInp = document.getElementById('add-doc-notes');

    if (previewImg) previewImg.src = base64Data;
    if (badgeLabel) badgeLabel.innerText = detected.label;
    if (typeSelect) typeSelect.value = detected.type;
    if (titleInp) titleInp.value = detected.suggestedTitle;
    if (refInp) refInp.value = "";
    if (dateInp) dateInp.value = "";
    if (qrInp) qrInp.value = "";
    if (notesInp) notesInp.value = "";

    // Ouvrir le modal
    const modal = document.getElementById('doc-add-modal');
    if (modal) modal.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function onManualDocTypeChange(val) {
  const typeInfo = getDocTypeInfo(val);
  const badgeLabel = document.getElementById('add-doc-detected-label');
  if (badgeLabel) badgeLabel.innerText = typeInfo.label;
}

function closeDocAddModal() {
  const modal = document.getElementById('doc-add-modal');
  if (modal) modal.style.display = 'none';
  currentPendingScan = null;
  const input = document.getElementById('client-doc-file-input');
  if (input) input.value = '';
}

function saveNewClientDocument() {
  if (!currentPendingScan) return;

  const titleInp = document.getElementById('add-doc-title');
  const typeSelect = document.getElementById('add-doc-type');
  const refInp = document.getElementById('add-doc-ref');
  const dateInp = document.getElementById('add-doc-date');
  const qrInp = document.getElementById('add-doc-qr');
  const notesInp = document.getElementById('add-doc-notes');

  const title = (titleInp && titleInp.value.trim()) ? titleInp.value.trim() : "Document personnel";
  const type = typeSelect ? typeSelect.value : "other";

  const newDoc = {
    id: currentPendingScan.id,
    type: type,
    title: title,
    reference: refInp ? refInp.value.trim() : "",
    beneficiary: "Moi",
    date: dateInp ? dateInp.value.trim() : "",
    qrCode: qrInp ? qrInp.value.trim() : "",
    notes: notesInp ? notesInp.value.trim() : "",
    fileUrl: currentPendingScan.fileData
  };

  const list = getClientPersonalDocs();
  list.unshift(newDoc);
  saveClientPersonalDocs(list);

  closeDocAddModal();
  renderClientDocuments();
}

function findDocById(docId) {
  const agencyDocs = (currentTrip && currentTrip.documents) ? currentTrip.documents.map(d => ({ ...d, source: 'agency' })) : [];
  const personalDocs = getClientPersonalDocs().map(d => ({ ...d, source: 'personal' }));
  return [...agencyDocs, ...personalDocs].find(d => d.id === docId);
}

function openDocQrModal(docId) {
  const doc = findDocById(docId);
  if (!doc) return;
  viewClientDocDetails(docId, true);
}

function viewClientDocDetails(docId, focusQr = false) {
  const doc = findDocById(docId);
  if (!doc) return;

  const modal = document.getElementById('doc-viewer-modal');
  const titleEl = document.getElementById('doc-modal-title');
  const subEl = document.getElementById('doc-modal-sub');
  const badgeIcon = document.getElementById('doc-modal-icon-badge');
  const qrBox = document.getElementById('doc-modal-qr-container');
  const qrImg = document.getElementById('doc-modal-qr-img');
  const qrText = document.getElementById('doc-modal-qr-text');
  const fileBox = document.getElementById('doc-modal-file-container');
  const fileImg = document.getElementById('doc-modal-file-img');
  const benRow = document.getElementById('doc-modal-beneficiary-row');
  const benEl = document.getElementById('doc-modal-beneficiary');
  const dateRow = document.getElementById('doc-modal-date-row');
  const dateEl = document.getElementById('doc-modal-date');
  const notesRow = document.getElementById('doc-modal-notes-row');
  const notesEl = document.getElementById('doc-modal-notes');
  const downloadBtn = document.getElementById('doc-modal-download-btn');
  const deleteBtn = document.getElementById('doc-modal-delete-btn');

  const typeInfo = getDocTypeInfo(doc.type);

  if (titleEl) titleEl.innerText = doc.title;
  if (subEl) subEl.innerText = (doc.reference ? `${doc.reference} • ` : '') + (doc.source === 'agency' ? "Document officiel Agence" : "Coffre-fort personnel");
  if (badgeIcon) {
    badgeIcon.style.background = typeInfo.color;
    badgeIcon.innerHTML = `<i class="fa-solid ${typeInfo.icon}"></i>`;
  }

  // QR Code
  if (doc.qrCode) {
    qrBox.style.display = 'block';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(doc.qrCode)}&color=2-132-199`;
    qrText.innerText = doc.qrCode;
  } else {
    qrBox.style.display = 'none';
  }

  // Fichier / Image jointe
  const pdfBox = document.getElementById('doc-modal-pdf-box');
  const pdfOpenBtn = document.getElementById('doc-modal-open-pdf-btn');
  const pdfNameEl = document.getElementById('doc-modal-pdf-filename');

  if (doc.fileUrl && doc.fileUrl.trim()) {
    fileBox.style.display = 'block';
    const urlLower = doc.fileUrl.toLowerCase();
    const isPdf = doc.fileUrl.startsWith('data:application/pdf') || urlLower.includes('.pdf');

    if (isPdf) {
      if (fileImg) fileImg.style.display = 'none';
      if (pdfBox) {
        pdfBox.style.display = 'block';
        if (pdfNameEl) pdfNameEl.innerText = `${doc.title} (Document PDF)`;
        if (pdfOpenBtn) {
          pdfOpenBtn.onclick = () => {
            if (doc.fileUrl.startsWith('data:application/pdf')) {
              // Ouvrir un blob PDF dans un nouvel onglet
              try {
                const parts = doc.fileUrl.split(',');
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
              } catch (err) {
                window.open(doc.fileUrl, '_blank');
              }
            } else {
              window.open(doc.fileUrl, '_blank');
            }
          };
        }
      }
    } else {
      if (pdfBox) pdfBox.style.display = 'none';
      if (fileImg) {
        fileImg.style.display = 'inline-block';
        fileImg.src = doc.fileUrl;
        fileImg.onerror = () => {
          // Si l'image ne charge pas (ex: PDF sans mime image ou lien brisé)
          fileImg.style.display = 'none';
          if (pdfBox) {
            pdfBox.style.display = 'block';
            if (pdfNameEl) pdfNameEl.innerText = `${doc.title} (Fichier joint)`;
            if (pdfOpenBtn) {
              pdfOpenBtn.onclick = () => window.open(doc.fileUrl, '_blank');
            }
          }
        };
      }
    }

    downloadBtn.style.display = 'inline-flex';
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      const ext = isPdf ? 'pdf' : 'png';
      downloadTransitMapFile(doc.fileUrl, `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`);
    };
  } else {
    fileBox.style.display = 'none';
    if (fileImg) fileImg.style.display = 'none';
    if (pdfBox) pdfBox.style.display = 'none';
    downloadBtn.style.display = 'none';
  }

  // Informations
  if (doc.beneficiary) {
    benRow.style.display = 'block';
    benEl.innerText = doc.beneficiary;
  } else {
    benRow.style.display = 'none';
  }

  if (doc.date) {
    dateRow.style.display = 'block';
    dateEl.innerText = doc.date;
  } else {
    dateRow.style.display = 'none';
  }

  if (doc.notes) {
    notesRow.style.display = 'block';
    notesEl.innerText = doc.notes;
  } else {
    notesRow.style.display = 'none';
  }

  // Bouton suppression (uniquement pour les documents personnels du client)
  if (doc.source === 'personal') {
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => {
      if (confirm("Supprimer définitivement ce document de votre coffre-fort ?")) {
        const list = getClientPersonalDocs().filter(d => d.id !== doc.id);
        saveClientPersonalDocs(list);
        closeDocViewerModal();
        renderClientDocuments();
      }
    };
  } else {
    deleteBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeDocViewerModal() {
  const modal = document.getElementById('doc-viewer-modal');
  if (modal) modal.style.display = 'none';
}
