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
      return;
    } catch (e) {
      console.warn('Impossible de charger le voyage depuis l URL:', e);
    }
  }

  // 2. Paramètre ID dans l'URL (?id=italie-dolomites-2026)
  if (idParam) {
    const stored = localStorage.getItem(`girardot_trip_data_${idParam}`);
    if (stored) {
      try {
        currentTrip = JSON.parse(stored);
        return;
      } catch (e) {}
    }
  }

  // 3. Voyage actif mémorisé
  const activeId = localStorage.getItem('girardot_active_trip_id');
  if (activeId) {
    const storedTrip = localStorage.getItem(`girardot_trip_data_${activeId}`);
    if (storedTrip) {
      try {
        currentTrip = JSON.parse(storedTrip);
        return;
      } catch (e) {}
    }
  }

  const legacyStored = localStorage.getItem('girardot_active_carnet');
  if (legacyStored) {
    try {
      currentTrip = JSON.parse(legacyStored);
      return;
    } catch (e) {
      console.error(e);
    }
  }

  currentTrip = window.defaultTravelData;
}

// Rendu du sélecteur client
function renderClientTripSelector() {
  const select = document.getElementById('client-trip-quick-selector');
  if (!select) return;

  const catalog = getClientAvailableTrips();
  if (catalog.length <= 1) {
    select.style.display = 'none';
    return;
  }
  select.style.display = 'inline-block';
  select.innerHTML = '';

  catalog.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    if (currentTrip && currentTrip.id === t.id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
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

  // Si c'est l'Italie
  if (tripId === 'italie-dolomites-2026') {
    fetch('voyages/italie-dolomites-2026.json')
      .then(res => res.json())
      .then(data => {
        currentTrip = data;
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
  loadTripData();
  renderClientTripSelector();
  activeDayIndex = determineInitialDayIndex();
  
  renderDaySelectorPills();
  renderTodayFocus();
  renderFullCircuit();
  renderSouvenirs();
  renderConciergerie();
  renderHotelsAndFlights();
  renderContactsAndAlert();
  initNavigation();
  initCaptureFeature();
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
    sub: currentDay.description.slice(0, 75) + '...',
    qrCodeText: `GIRARDOT-JOUR-${currentDay.day}`
  };

  document.getElementById('next-title').innerText = nextEvent.title;
  document.getElementById('next-sub').innerText = nextEvent.badge || nextEvent.sub || "Programme Girardot";
  
  const qrBtn = document.getElementById('btn-show-qr');
  qrBtn.onclick = () => {
    openQrModal(nextEvent.title, nextEvent.qrCodeText || `GIRARDOT-JOUR-${currentDay.day}`);
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

        <div class="entry-actions-row">
          <div>
            ${gpsUrl ? `
              <a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps">
                <i class="fa-solid fa-location-arrow"></i> Itinéraire
              </a>
            ` : '<span style="font-size:0.7rem; color:#94a3b8;"><i class="fa-regular fa-clock"></i> Visite organisée</span>'}
          </div>
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

// 4. SOUVENIRS / PHOTO CAPTURE
function initCaptureFeature() {
  const quickCaptureBtn = document.getElementById('btn-quick-capture');
  const addSouvenirBtn = document.getElementById('add-souvenir-btn');
  const fileInput = document.getElementById('camera-file-input');

  const triggerCamera = () => {
    fileInput.click();
  };

  quickCaptureBtn.addEventListener('click', triggerCamera);
  addSouvenirBtn.addEventListener('click', triggerCamera);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64 = evt.target.result;
        saveSouvenir({
          id: 'souv_' + Date.now(),
          title: `Souvenir Jour ${activeDayIndex + 1}`,
          date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          image: base64
        });
        switchMainTab('tab-souvenirs');
      };
      reader.readAsDataURL(file);
    }
  });
}

function quickAddPhotoForEntry(entryTitle) {
  const fileInput = document.getElementById('camera-file-input');
  fileInput.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        saveSouvenir({
          id: 'souv_' + Date.now(),
          title: entryTitle,
          date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          image: evt.target.result
        });
        switchMainTab('tab-souvenirs');
      };
      reader.readAsDataURL(file);
    }
  };
  fileInput.click();
}

function saveSouvenir(item) {
  const key = `girardot_souvenirs_${currentTrip.id}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.unshift(item);
  localStorage.setItem(key, JSON.stringify(list));
  renderSouvenirs();
}

function renderSouvenirs() {
  const grid = document.getElementById('souvenirs-list');
  const key = `girardot_souvenirs_${currentTrip.id}`;
  let list = JSON.parse(localStorage.getItem(key) || '[]');

  // Default sample souvenirs from trip images if empty
  if (list.length === 0) {
    list = [
      { id: 'def1', title: 'Safari Big Five • Kruger', date: 'Jour 5', image: 'Business Profile Girardot/resource_atKV0GRzzlHfARUCYbAOW1.png' },
      { id: 'def2', title: 'Colonie des manchots', date: 'Jour 10', image: 'Business Profile Girardot/resource_81SHDV3ufg44rvmTPYt_h0.png' }
    ];
  }

  grid.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'souvenir-card';
    card.innerHTML = `
      <img src="${s.image}" alt="${s.title}">
      <div class="souvenir-body">
        <div class="souvenir-title">${s.title}</div>
        <div class="souvenir-date">${s.date}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Also render compact suggestions in Souvenirs tab
  const freetimeBox = document.getElementById('freetime-compact-container');
  if (freetimeBox && currentTrip.freeTimeSuggestions) {
    freetimeBox.innerHTML = '';
    currentTrip.freeTimeSuggestions.slice(0, 3).forEach(sug => {
      const el = document.createElement('div');
      el.style = "background:white; border-radius:14px; padding:12px; margin-bottom:10px; border:1px solid var(--border-light);";
      const gpsUrl = (sug.lat && sug.lng) ? getGpsUrl(sug.lat, sug.lng, sug.name) : '#';
      el.innerHTML = `
        <span style="font-size:0.7rem; background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:4px; font-weight:bold;">${sug.category}</span>
        <h4 style="font-size:0.92rem; font-weight:700; margin:4px 0 2px;">${sug.name}</h4>
        <p style="font-size:0.78rem; color:#64748b; margin-bottom:6px;">${sug.location}</p>
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

  // 1. Détection de requêtes TRANSPORTS / ITINÉRAIRES
  const isTransportQuery = q.includes('aller') || q.includes('rejoindre') || q.includes('transport') || q.includes('comment') || q.includes('taxi') || q.includes('bus') || q.includes('trajet');

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

    // Déterminer la destination mentionnée
    let destName = "votre destination";
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
      destName = "l'Aéroport du Cap (CPT)";
      destCoords = [-33.9715, 18.6021];
    }

    titleEl.innerHTML = `<i class="fa-solid fa-route" style="color:#0891b2; margin-right:8px;"></i> Meilleure solution pour rejoindre ${destName}`;
    listEl.innerHTML = `
      <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:16px; padding:16px; margin-bottom:14px;">
        <h4 style="font-size:0.95rem; font-weight:800; color:#0369a1; margin-bottom:4px;">
          <i class="fa-solid fa-sparkles"></i> Recommandation de votre Concierge Girardot :
        </h4>
        <p style="font-size:0.86rem; color:#0f172a; line-height:1.5;">
          Pour rejoindre <strong>${destName}</strong> depuis votre hôtel (ANEW Green Point), la solution la plus sûre et rapide est le <strong>VTC Uber</strong> (course directe d'env. 10 à 15 min, tarif indicatif : 70 à 120 ZAR / ~4 à 6 €).
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
    transportTheme.places.forEach(place => {
      listEl.appendChild(createConciergePlaceCard(place));
    });

    resultsBox.style.display = 'block';
    resultsBox.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // 2. Détection par type : POISSON / RESTAURANT / BARS / CHANGE
  let filteredPlaces = [];
  let filterContext = "";

  activeThemes.forEach(theme => {
    theme.places.forEach(place => {
      const pText = (place.name + " " + place.category + " " + place.description + " " + place.tips).toLowerCase();
      let matchScore = 0;

      // Filtre Poisson / Fruits de mer
      if (q.includes('poisson') || q.includes('fish') || q.includes('mer')) {
        if (pText.includes('poisson') || pText.includes('mer') || pText.includes('harbour')) matchScore += 10;
        filterContext = "poissons & fruits de mer";
      }

      // Filtre Restaurant / Manger / Dîner
      if (q.includes('restaurant') || q.includes('manger') || q.includes('dîner') || q.includes('diner') || q.includes('repas') || q.includes('midi') || q.includes('soir')) {
        if (theme.id === 'resto') matchScore += 5;
      }

      // Filtre Bars / Boire / Café
      if (q.includes('bar') || q.includes('boire') || q.includes('café') || q.includes('cafe') || q.includes('verre') || q.includes('rooftop')) {
        if (theme.id === 'detente') matchScore += 5;
        filterContext = "bars & cafés";
      }

      // Filtre Change / Banque / Argent
      if (q.includes('change') || q.includes('argent') || q.includes('banque') || q.includes('dab') || q.includes('distributeur') || q.includes('devises') || q.includes('rand')) {
        if (theme.id === 'pratique') matchScore += 5;
        filterContext = "change & distributeurs";
      }

      // Filtre Visites / Balade
      if (q.includes('visite') || q.includes('voir') || q.includes('musée') || q.includes('musee') || q.includes('balade') || q.includes('monument')) {
        if (theme.id === 'visites') matchScore += 5;
        filterContext = "visites";
      }

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
      listEl.appendChild(createConciergePlaceCard(item.place));
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

function createConciergePlaceCard(place) {
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
      ${place.phone ? `
        <a href="tel:${place.phone.replace(/[^0-9+]/g, '')}" class="btn-entry-gps" style="background:#16a34a; color:white;">
          <i class="fa-solid fa-phone"></i> Appeler le restaurant
        </a>
      ` : ''}

      ${place.bookingUrl ? `
        <a href="${place.bookingUrl}" target="_blank" rel="noopener noreferrer" class="btn-entry-gps" style="background:#ea580c; color:white;">
          <i class="fa-solid fa-calendar-check"></i> Réserver en ligne
        </a>
      ` : ''}

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
      const card = document.createElement('div');
      card.style = `background:${isDomestic ? '#f0f9ff' : 'white'}; border-radius:16px; border:1px solid ${isDomestic ? '#bae6fd' : 'var(--border-light)'}; padding:14px; margin-bottom:12px;`;
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:0.9rem; color:${isDomestic ? '#0369a1' : 'var(--primary-dark)'};">
          <span><i class="fa-solid fa-plane"></i> ${f.type || 'Vol'} : ${f.airline || ''}</span>
          <span style="color:var(--primary-color);">${f.flightNumber || ''}</span>
        </div>
        <div style="font-size:0.82rem; color:#0f172a; margin:4px 0;">
          ${f.date ? `${f.date} • ` : ''}${f.departureAirport || 'Départ'} ${f.departureTime ? `(${f.departureTime})` : ''} ➔ ${f.arrivalAirport || 'Arrivée'} ${f.arrivalTime ? `(${f.arrivalTime})` : ''}
        </div>
        ${f.via ? `
          <div style="font-size:0.78rem; color:#b45309; background:#fffbeb; padding:4px 8px; border-radius:6px; margin:4px 0; display:inline-block;">
            <i class="fa-solid fa-arrows-split-up-and-left"></i> <strong>Escale / VIA :</strong> ${f.via}
          </div>
        ` : ''}
        ${f.notes ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${f.notes}</div>` : ''}
      `;
      flightsContainer.appendChild(card);
    });
  } else if (currentTrip.flights) {
    // Rétrocompatibilité avec l'ancien format d'origine
    const f = currentTrip.flights;
    flightsContainer.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:10px;">
        <i class="fa-solid fa-plane-departure" style="color:var(--accent-gold); margin-right:6px;"></i> Vols Internationaux & Intérieurs
      </h3>
      <div style="background:white; border-radius:16px; border:1px solid var(--border-light); padding:14px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:0.9rem;">
          <span>Vol Aller : ${f.outbound.airline}</span>
          <span style="color:var(--primary-color);">${f.outbound.flightNumber}</span>
        </div>
        <div style="font-size:0.8rem; color:#475569; margin:4px 0;">
          ${f.outbound.date} • ${f.outbound.departureAirport} (${f.outbound.departureTime}) ➔ ${f.outbound.arrivalAirport}
        </div>
        <div style="font-size:0.76rem; color:#64748b;">${f.outbound.layover}</div>
      </div>

      ${(f.domesticFlights && f.domesticFlights.length) ? f.domesticFlights.map(df => `
        <div style="background:#f0f9ff; border-radius:16px; border:1px solid #bae6fd; padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:0.9rem; color:#0369a1;">
            <span><i class="fa-solid fa-plane"></i> Vol Intérieur (Jour ${df.day})</span>
            <span>${df.airline} • ${df.flightNumber}</span>
          </div>
          <div style="font-size:0.82rem; color:#0f172a; margin:4px 0;">
            ${df.departureAirport} ➔ ${df.arrivalAirport}
          </div>
          <div style="font-size:0.76rem; color:#0284c7;">${df.notes}</div>
        </div>
      `).join('') : ''}
    `;
  }

  const hotelsContainer = document.getElementById('hotels-container');
  hotelsContainer.innerHTML = '';
  if (currentTrip.hotels) {
    hotelsContainer.innerHTML = `
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary-dark); margin-bottom:10px;">
        <i class="fa-solid fa-hotel" style="color:var(--accent-gold); margin-right:6px;"></i> Vos Hôtels
      </h3>
    `;
    currentTrip.hotels.forEach(h => {
      const el = document.createElement('div');
      el.style = "background:white; border-radius:16px; border:1px solid var(--border-light); padding:14px; margin-bottom:10px;";
      const gpsUrl = (h.lat && h.lng) ? getGpsUrl(h.lat, h.lng, h.name) : '#';
      el.innerHTML = `
        <div style="font-size:0.75rem; color:var(--accent-gold); font-weight:800;">${h.dates}</div>
        <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">${h.name}</div>
        <div style="font-size:0.8rem; color:#64748b; margin:2px 0 6px;">${h.address}</div>
        <a href="${gpsUrl}" target="_blank" class="btn-entry-gps"><i class="fa-solid fa-location-arrow"></i> GPS Hôtel</a>
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

      <div style="background:#fef2f2; border:1px solid #fee2e2; border-left:4px solid #dc2626; border-radius:16px; padding:16px; margin-bottom:14px;">
        <h4 style="font-size:0.98rem; font-weight:800; color:#dc2626; margin-bottom:4px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Correspondant Local & Urgences 24/7
        </h4>
        <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">${c.receptif.name}</div>
        <div style="font-size:0.82rem; color:#475569; margin:4px 0 8px;">${c.receptif.address}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="tel:${c.receptif.emergency ? c.receptif.emergency.replace(/[^0-9+]/g, '') : ''}" class="btn-entry-gps" style="background:#dc2626; color:white; padding:8px 14px; font-size:0.82rem;">
            <i class="fa-solid fa-phone-volume"></i> Urgence : ${c.receptif.emergency}
          </a>
        </div>
      </div>
    `;
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
  if (!mapElement) return;

  if (leafletMap) {
    updateMapFilterButtonsVisibility();
    setTimeout(() => {
      leafletMap.invalidateSize(true);
    }, 100);
    return;
  }

  // OpenStreetMap France Tiles
  leafletMap = L.map('travel-map', {
    center: [-29.0, 25.0],
    zoom: 5,
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
  }, 250);
}

function renderMapMarkers(filterCategory = 'all') {
  if (!leafletMap) return;

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

  // 2. Domestic flight line & Plane icon
  if (filterCategory === 'all' || filterCategory === 'flights' || filterCategory === 'itinerary') {
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
              <strong style="color:#c29958;"><i class="fa-solid fa-hotel"></i> ${hotel.name}</strong><br>
              <span style="font-size:11px; color:#64748b;">${hotel.dates}</span><br>
              <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#0284c7; color:white; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">GPS Hôtel</a>
            </div>
          `);
          mapMarkers.push(marker);
          bounds.push([hLat, hLng]);
        }
      });
    }
  }

  // 4. Free time
  if (filterCategory === 'all' || filterCategory === 'freetime') {
    if (currentTrip.freeTimeSuggestions) {
      currentTrip.freeTimeSuggestions.forEach((sug) => {
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
              <span style="font-size:11px; color:#64748b;">${sug.location}</span><br>
              <a href="${gpsUrl}" target="_blank" style="display:inline-block; margin-top:6px; background:#0284c7; color:white; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; font-weight:bold;">GPS Visite</a>
            </div>
          `);
          mapMarkers.push(marker);
          bounds.push([sLat, sLng]);
        }
      });
    }
  }

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40] });
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
      renderMapMarkers('all');
      setTimeout(() => {
        leafletMap.invalidateSize(true);
      }, 150);
    }
  }
}
