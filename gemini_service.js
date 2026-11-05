// =============================================================================
// GOOGLE GEMINI API SERVICE (FREE TIER: GEMINI 2.0 FLASH / 1.5 FLASH)
// Assistant d'intelligence artificielle pour Voyages Girardot (Temps Libre & Conciergerie)
// =============================================================================

(function(global) {

  const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

  function getStoredGeminiKey() {
    return localStorage.getItem('girardot_gemini_api_key') || '';
  }

  function getStoredGeminiModel() {
    let m = localStorage.getItem('girardot_gemini_model');
    // Migration automatique si un ancien modèle obsolète (2.0, 2.5, 1.5) était encore en cache
    if (!m || m.includes('2.0') || m.includes('2.5') || m.includes('1.5') || m === 'gemini-2.0-flash' || m === 'gemini-2.5-flash') {
      m = DEFAULT_MODEL;
      localStorage.setItem('girardot_gemini_model', m);
    }
    return m;
  }

  function updateGeminiStatusIndicator() {
    const key = getStoredGeminiKey();
    const model = getStoredGeminiModel();
    const indicator = document.getElementById('gemini-status-indicator');
    const badge = document.getElementById('gemini-header-status-badge');

    if (indicator) {
      if (key) {
        indicator.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; margin-right:4px;"></span>Gemini Connecté`;
        indicator.parentElement.style.borderColor = '#86efac';
        indicator.parentElement.style.background = '#f0fdf4';
        indicator.parentElement.style.color = '#15803d';
      } else {
        indicator.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#f59e0b; margin-right:4px;"></span>IA Gemini (Free)`;
        indicator.parentElement.style.borderColor = '#ddd6fe';
        indicator.parentElement.style.background = '#f5f3ff';
        indicator.parentElement.style.color = '#6d28d9';
      }
    }

    if (badge) {
      badge.innerText = key ? `${model.replace('gemini-', '')} (Prêt)` : 'Clé requise';
      badge.style.color = key ? '#86efac' : '#fca5a5';
    }
  }

  function openGeminiConfigModal() {
    const modal = document.getElementById('gemini-config-modal');
    if (!modal) return;
    const input = document.getElementById('gemini-api-key-input');
    const select = document.getElementById('gemini-model-select');
    const feedback = document.getElementById('gemini-test-feedback');

    const key = getStoredGeminiKey();
    if (input) input.value = key;
    if (select) select.value = getStoredGeminiModel();
    if (feedback) feedback.innerHTML = '';
    modal.style.display = 'flex';

    if (key && select) {
      discoverAvailableGeminiModels(key).then(models => {
        if (models && models.length > 0) {
          models.forEach(m => {
            if (!Array.from(select.options).some(opt => opt.value === m)) {
              const opt = document.createElement('option');
              opt.value = m;
              opt.innerText = `${m} (Détecté actif pour votre compte)`;
              select.appendChild(opt);
            }
          });
        }
      });
    }
  }

  function closeGeminiConfigModal() {
    const modal = document.getElementById('gemini-config-modal');
    if (modal) modal.style.display = 'none';
  }

  function saveGeminiConfig() {
    const input = document.getElementById('gemini-api-key-input');
    const select = document.getElementById('gemini-model-select');
    const feedback = document.getElementById('gemini-test-feedback');

    const key = (input ? input.value : '').trim();
    const model = select ? select.value : DEFAULT_MODEL;

    if (!key) {
      if (feedback) feedback.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Veuillez renseigner votre clé API Google Gemini.</span>`;
      return;
    }

    localStorage.setItem('girardot_gemini_api_key', key);
    localStorage.setItem('girardot_gemini_model', model);
    updateGeminiStatusIndicator();

    if (feedback) feedback.innerHTML = `<span style="color:#059669;"><i class="fa-solid fa-check"></i> Clé API enregistrée avec succès pour ${model} !</span>`;
    setTimeout(() => {
      closeGeminiConfigModal();
    }, 800);
  }

  function disconnectGeminiKey() {
    localStorage.removeItem('girardot_gemini_api_key');
    const input = document.getElementById('gemini-api-key-input');
    if (input) input.value = '';
    updateGeminiStatusIndicator();
    const feedback = document.getElementById('gemini-test-feedback');
    if (feedback) feedback.innerHTML = `<span style="color:#64748b;">Clé Gemini effacée de ce navigateur.</span>`;
  }


    // ---------------------------------------------------------------------------
  // DÉCOUVERTE DYNAMIQUE DES MODÈLES DISPONIBLES SUR LA CLÉ
  // ---------------------------------------------------------------------------
  async function discoverAvailableGeminiModels(apiKey) {
    if (!apiKey) return [];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.models || !Array.isArray(data.models)) return [];
      return data.models
        .filter(m => (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) || (m.supportedActions && m.supportedActions.includes('generateContent')))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(name => name.includes('flash') || name.includes('lite'));
    } catch (e) {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // EXÉCUTION AVEC BASCULE AUTOMATIQUE SUR MODÈLES DE SECOURS (FALLBACK CHAIN)
  // ---------------------------------------------------------------------------
  async function callGeminiApiWithFallback(apiKey, preferredModel, payload) {
    let discovered = [];
    try {
      discovered = await discoverAvailableGeminiModels(apiKey);
    } catch (e) {}

    const candidateModels = [
      preferredModel,
      ...discovered,
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    let lastError = null;

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg = err.error?.message || `Erreur HTTP ${res.status}`;
          if (res.status === 404 || /not found|no longer available|is not supported|deprecated/i.test(errMsg)) {
            console.warn(`[Gemini] Modèle ${m} indisponible (${errMsg}), tentative avec le modèle suivant...`);
            lastError = new Error(errMsg);
            continue;
          }
          throw new Error(errMsg);
        }

        const data = await res.json();
        if (m !== preferredModel) {
          console.info(`[Gemini] Bascule automatique réussie sur le modèle actif : ${m}`);
          localStorage.setItem('girardot_gemini_model', m);
          updateGeminiStatusIndicator();
        }
        return { data, workingModel: m };

      } catch (err) {
        lastError = err;
        if (/not found|no longer available|is not supported|404/i.test(err.message)) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Aucun modèle Gemini actif n'a pu répondre avec cette clé.");
  }

  async function testGeminiConnection() {
    const input = document.getElementById('gemini-api-key-input');
    const select = document.getElementById('gemini-model-select');
    const feedback = document.getElementById('gemini-test-feedback');
    const key = (input ? input.value : '').trim();
    let model = select ? select.value : DEFAULT_MODEL;

    if (!key) {
      if (feedback) feedback.innerHTML = `<span style="color:#dc2626;">Veuillez saisir une clé API à tester.</span>`;
      return;
    }

    if (feedback) feedback.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#4f46e5;"></i> Test de connexion en cours avec Google Gemini (${model})...`;

    try {
      const { data, workingModel } = await callGeminiApiWithFallback(key, model, {
        contents: [{ parts: [{ text: "Bonjour, réponds en un mot : OK" }] }]
      });

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK";

      if (select && workingModel !== model) {
        select.value = workingModel;
      }

      if (feedback) {
        feedback.innerHTML = `<span style="color:#059669;"><i class="fa-solid fa-check"></i> Connexion réussie à Google Gemini (${workingModel}) ! Réponse : "${reply}".</span>`;
      }
    } catch (err) {
      if (feedback) {
        feedback.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-circle-xmark"></i> Échec : ${err.message}. Vérifiez la clé sur Google AI Studio.</span>`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATION DE SUGGESTIONS CIBLÉES POUR TEMPS LIBRE
  // ---------------------------------------------------------------------------
  let pendingGeminiSuggestions = [];

  async function generateFreeTimeWithGemini() {
    const apiKey = getStoredGeminiKey();
    if (!apiKey) {
      openGeminiConfigModal();
      const feedback = document.getElementById('gemini-test-feedback');
      if (feedback) {
        feedback.innerHTML = `<span style="color:#b45309;"><i class="fa-solid fa-key"></i> Veuillez renseigner votre clé gratuite Google AI Studio ci-dessous pour utiliser le générateur.</span>`;
      }
      return;
    }

    const daySelect = document.getElementById('gemini-day-select');
    const momentSelect = document.getElementById('gemini-moment-select');
    const targetTypeSelect = document.getElementById('gemini-target-type');
    const customPromptInput = document.getElementById('gemini-custom-prompt');
    const statusEl = document.getElementById('gemini-freetime-status');
    const btn = document.getElementById('btn-trigger-gemini-freetime');

    const selectedDayValue = daySelect ? daySelect.value : '';
    const moment = momentSelect ? momentSelect.value : 'Après-midi libre';
    const targetType = targetTypeSelect ? targetTypeSelect.value : 'mix';
    const customPrompt = customPromptInput ? customPromptInput.value.trim() : '';

    let dayNum = 1;
    let cityName = "";
    if (typeof tripData !== 'undefined' && tripData && tripData.itinerary && Array.isArray(tripData.itinerary)) {
      const dayObj = tripData.itinerary.find(d => String(d.day) === String(selectedDayValue));
      if (dayObj) {
        dayNum = dayObj.day;
        cityName = dayObj.city || "";
        if (!cityName || cityName.toLowerCase().includes('votre') || cityName.length <= 4) {
          let cleanTitle = dayObj.title.replace(/votre\s+r[ée]gion\s*[-–—•]\s*/i, '').trim();
          if (cleanTitle.includes('-') || cleanTitle.includes('—') || cleanTitle.includes('–')) {
            const parts = cleanTitle.split(/[-–—•]/).map(p => p.trim()).filter(Boolean);
            cityName = parts[parts.length - 1] || cleanTitle;
          } else {
            cityName = cleanTitle;
          }
        }
      }
    }
    if (!cityName && typeof tripData !== 'undefined' && tripData) {
      cityName = tripData.title || "Ville d'étape";
    }

    let hotelContext = "";
    if (typeof tripData !== 'undefined' && tripData && tripData.hotels && Array.isArray(tripData.hotels) && tripData.hotels.length > 0) {
      const h = tripData.hotels.find(ht => (ht.city && cityName && ht.city.toLowerCase().includes(cityName.toLowerCase()))) || tripData.hotels[0];
      if (h && h.name) hotelContext = `${h.name} (${h.address || h.city || ''})`;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Génération...`;
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = '#e0e7ff';
      statusEl.style.color = '#3730a3';
      statusEl.style.border = '1px solid #c7d2fe';
      statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Recherche des meilleures adresses pour <strong>${moment} à ${cityName}</strong> via Google Gemini...`;
    }

    try {
      const prompt = `Tu es l'expert de conception de voyages pour Voyages Girardot (spécialiste français des circuits touristiques accompagnés et croisières).
Destination globale : "${typeof tripData !== 'undefined' && tripData ? tripData.title : cityName}".
Étape : Jour ${dayNum} à ${cityName}.
Moment de liberté client : "${moment}".
${hotelContext ? `Hôtel d'étape ou point de départ : "${hotelContext}".` : ''}
${customPrompt ? `Consigne spécifique de l'agence : "${customPrompt}".` : ''}
Type de sélection : ${targetType === 'food' ? 'Restaurants typiques et cafés locaux' : (targetType === 'visits' ? 'Visites libres, balades et panoramas' : (targetType === 'shopping' ? 'Boutiques artisanales et spécialités régionales' : 'Mix de 2-3 restaurants typiques et 2 visites libres à pied'))}.

Propose 3 à 5 adresses ou idées de visite RÉELLES, existantes et authentiques.
Pour chaque suggestion, fournis obligatoirement :
- name : Nom officiel du restaurant, café ou lieu de visite
- category : Catégorie courte (ex: "Trattoria Traditionnelle", "Café Historique", "Musée & Galerie", "Point de Vue")
- tag : Mention accrocheuse (ex: "Spécialité locale", "À 5 min à pied", "Coup de cœur Girardot", "Terrasse au calme")
- description : Description alléchante en français (2 phrases mettant en valeur l'ambiance et pourquoi c'est idéal pour ce temps libre)
- address : Adresse physique ou localisation précise
- lat : latitude approximative (nombre flottant décimal)
- lng : longitude approximative (nombre flottant décimal)
- tips : Conseil pratique ou astuce Girardot (ex: "Idéal au coucher du soleil", "Réservation conseillée", "Entrée gratuite")
- moment : "${moment}"
- day : ${dayNum}
- city : "${cityName}"

Réponds STRICTEMENT sous format JSON valide avec la clé racine "suggestions": [ ... ].`;

      const model = getStoredGeminiModel();
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      };

      const { data, workingModel } = await callGeminiApiWithFallback(apiKey, model, payload);
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(jsonText);
      const suggestions = parsed.suggestions || (Array.isArray(parsed) ? parsed : []);

      if (!suggestions || suggestions.length === 0) {
        throw new Error("Aucune suggestion générée par le modèle.");
      }

      pendingGeminiSuggestions = suggestions;

      if (statusEl) {
        statusEl.style.background = '#ecfdf5';
        statusEl.style.color = '#065f46';
        statusEl.style.border = '1px solid #a7f3d0';
        statusEl.innerHTML = `✓ ${suggestions.length} suggestions générées avec succès pour <strong>${moment} à ${cityName}</strong> !`;
      }

      showGeminiResultsModal(suggestions, moment, cityName, dayNum);

    } catch (err) {
      console.error('Gemini generation error:', err);
      if (statusEl) {
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#991b1b';
        statusEl.style.border = '1px solid #fecaca';
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erreur lors de la génération : ${err.message}.`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-sparkles"></i> Générer avec Gemini`;
      }
    }
  }

  function showGeminiResultsModal(suggestions, moment, cityName, dayNum) {
    const modal = document.getElementById('gemini-results-modal');
    if (!modal) return;

    const titleEl = document.getElementById('gemini-results-modal-title');
    const subEl = document.getElementById('gemini-results-modal-sub');
    const container = document.getElementById('gemini-results-modal-content');

    if (titleEl) titleEl.innerText = `Suggestions pour : ${moment} — Jour ${dayNum} (${cityName})`;
    if (subEl) subEl.innerText = `${suggestions.length} adresses trouvées par Gemini Flash. Cochez celles à intégrer dans le carnet :`;

    if (container) {
      container.innerHTML = suggestions.map((sug, idx) => `
        <div class="section-box" style="margin-bottom:12px; padding:14px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; display:flex; gap:12px; align-items:flex-start;">
          <input type="checkbox" id="gemini-sug-chk-${idx}" checked style="width:20px; height:20px; margin-top:3px; accent-color:#4f46e5; cursor:pointer;">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
              <strong style="font-size:0.95rem; color:#1e1b4b;">${sug.name || 'Lieu'}</strong>
              <div style="display:flex; gap:6px;">
                <span style="background:#e0e7ff; color:#3730a3; font-size:0.72rem; padding:2px 8px; border-radius:6px; font-weight:700;">${sug.category || 'Visite'}</span>
                ${sug.tag ? `<span style="background:#fef3c7; color:#92400e; font-size:0.72rem; padding:2px 8px; border-radius:6px; font-weight:700;">${sug.tag}</span>` : ''}
              </div>
            </div>
            <p style="font-size:0.84rem; color:#334155; margin:0 0 6px 0; line-height:1.45;">${sug.description || ''}</p>
            <div style="font-size:0.78rem; color:#64748b;">
              <i class="fa-solid fa-location-dot" style="color:#0284c7;"></i> ${sug.address || cityName}
            </div>
            ${sug.tips ? `
              <div style="font-size:0.76rem; color:#047857; background:#ecfdf5; padding:4px 8px; border-radius:6px; margin-top:6px; display:inline-block;">
                <i class="fa-solid fa-lightbulb"></i> <strong>Astuce :</strong> ${sug.tips}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  function closeGeminiResultsModal() {
    const modal = document.getElementById('gemini-results-modal');
    if (modal) modal.style.display = 'none';
  }

  function applyGeminiSuggestionsToCarnet() {
    if (!pendingGeminiSuggestions || pendingGeminiSuggestions.length === 0) {
      closeGeminiResultsModal();
      return;
    }

    if (typeof tripData === 'undefined' || !tripData) {
      alert("Aucun voyage actif chargé dans l'administration.");
      return;
    }

    if (!tripData.freeTimeSuggestions) tripData.freeTimeSuggestions = [];

    let countAdded = 0;
    pendingGeminiSuggestions.forEach((sug, idx) => {
      const chk = document.getElementById(`gemini-sug-chk-${idx}`);
      if (chk && chk.checked) {
        tripData.freeTimeSuggestions.push({
          name: sug.name,
          category: sug.category || "Temps Libre",
          tag: sug.tag || "Coup de cœur",
          city: sug.city || tripData.title || "",
          moment: sug.moment || "Temps libre",
          day: sug.day || 1,
          description: sug.description || "",
          address: sug.address || "",
          location: sug.address || "",
          tips: sug.tips || "",
          lat: sug.lat || null,
          lng: sug.lng || null
        });
        countAdded++;
      }
    });

    closeGeminiResultsModal();

    if (typeof renderAdminFreeTime === 'function') {
      renderAdminFreeTime();
    }

    // Basculer automatiquement le profil conciergerie sur "guided" ou "freetime_only"
    if (tripData.conciergeMode === 'disabled') {
      tripData.conciergeMode = 'guided';
      const sel = document.getElementById('adm-concierge-mode');
      if (sel) sel.value = 'guided';
    }

    alert(`✓ ${countAdded} suggestion(s) Gemini insérée(s) dans le carnet de voyage !`);
  }

  // ---------------------------------------------------------------------------
  // 5. NETTOYAGE INTELLIGENT DU PROGRAMME ET DES ÉTAPES PAR GEMINI IA
  // ---------------------------------------------------------------------------
  async function cleanParsedTripWithGemini() {
    const tripToClean = (typeof currentParsedTrip !== 'undefined' && currentParsedTrip) ? currentParsedTrip : null;
    if (!tripToClean || !tripToClean.itinerary || tripToClean.itinerary.length === 0) {
      alert("Aucun programme n'est actuellement analysé dans la modale d'import.");
      return;
    }

    const apiKey = getStoredGeminiKey();
    if (!apiKey) {
      openGeminiConfigModal();
      const feedback = document.getElementById('gemini-test-feedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef3c7';
        feedback.style.color = '#92400e';
        feedback.style.borderColor = '#fde68a';
        feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Renseignez votre clé API Gemini pour activer le nettoyage intelligent du programme.`;
      }
      return;
    }

    const statusEl = document.getElementById('pdf-import-status');
    const btnClean = document.getElementById('btn-clean-with-gemini');
    const btnBannerClean = document.getElementById('btn-banner-clean-gemini');
    const originalBtnHtml = btnClean ? btnClean.innerHTML : '';
    const originalBannerHtml = btnBannerClean ? btnBannerClean.innerHTML : '';

    if (btnClean) {
      btnClean.disabled = true;
      btnClean.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Nettoyage IA en cours...`;
    }
    if (btnBannerClean) {
      btnBannerClean.disabled = true;
      btnBannerClean.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Nettoyage IA en cours...`;
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.borderColor = '#c084fc';
      statusEl.style.background = '#faf5ff';
      statusEl.style.color = '#7e22ce';
      statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <strong>Nettoyage IA Gemini en cours :</strong> Restructuration des étapes, élimination des fausses visites, normalisation des titres et détection des hôtels...`;
    }

    try {
      const model = getStoredGeminiModel();

      // Préparer un résumé structuré du voyage actuel pour Gemini
      const itinerarySample = tripToClean.itinerary.map(d => ({
        day: d.day,
        title: d.title,
        city: d.city,
        description: (d.description || "").substring(0, 1500)
      }));

      // Extraire un extrait du texte brut d'origine si disponible
      const rawTextSample = (tripToClean._rawImportedText || "").slice(0, 25000);

      const promptText = `Tu es l'expert éditorial et logistique des programmes de voyages touristiques de l'agence "Voyages Girardot".
Voici un programme de voyage extrait d'un document ou carnet :
TITRE : ${tripToClean.title}
SOUS-TITRE : ${tripToClean.subtitle || ""}
DATES : ${tripToClean.dates || ""}

JOURNÉES EXTRAITES INITIALES :
${JSON.stringify(itinerarySample, null, 2)}

EXTRAIT DU DOCUMENT SOURCE :
${rawTextSample}

TA MISSION :
Nettoyer, corriger et restructurer fidèlement le voyage en respectant STRICTEMENT les règles éditoriales Girardot :
1. TITRES D'ÉTAPES / VISITES STRICTEMENT NOMINAUX ET COURTS :
   - Un titre de visite NE DOIT JAMAIS ÊTRE UNE PHRASE, ni commencer par un verbe conjugué (JAMAIS de "Visite de...", "En route pour...", "Découverte de...", "Route vers...", "Ce sanctuaire...").
   - Utilise le NOM PROPRE NOBLE du lieu, du monument, du transport ou du temps fort :
     Exemples corrects : "Fort d'Amber", "Palais des Vents", "Temple de Karni Mata", "Dunes de Sam", "Taj Mahal", "Mosquée Jama Masjid", "Puits de Chand Baoli", "Vol intérieur", "Train Shatabdi Express", "Journée libre", "Spectacle de danses".
   - Élimine les fausses étapes créées par des phrases descriptives, poétiques ou d'ambiance.
   - Intègre les explications et détails dans le champ 'subtitle'.
2. COMPLÉTUDE DES JOURS :
   - Proposer obligatoirement la TOTALITÉ des jours du voyage (du Jour 1 au dernier jour, sans aucun jour manquant).
   - Si une journée n'a pas de visite guidée (séjour ou journée libre), mettre en titre "Journée libre" et en subtitle "Journée libre en pension complète, demi-pension ou nuit+petit-déjeuner selon le programme".
3. VILLES ÉTAPES :
   - Assigner pour chaque jour la ville étape principale ('city') où se déroulent les visites et la nuitée.
4. HÔTELS DU CIRCUIT :
   - Extraire tous les hôtels réels du voyage (depuis le tableau des hôtels, les coordonnées ou le déroulé). Pour chaque hôtel : 'name' (avec catégorie si mentionnée, ex: "Deventure Sarovar Portico 4*"), 'city', 'dates' (ou jours associés, ex: "Du 2 au 3 décembre" ou "Jours 2 et 14").

RÉPONDS STRICTEMENT AU FORMAT JSON SUIVANT, SANS BALISE MARKDOWN NI TEXTE AUTOUR :
{
  "title": "Titre propre du voyage",
  "subtitle": "Sous-titre ou descriptif court",
  "days": [
    {
      "day": 1,
      "title": "Titre propre du jour (ex: Paris - Delhi)",
      "city": "Ville étape",
      "timeline": [
        {
          "title": "Nom court étape",
          "subtitle": "Description synthétique de l'étape",
          "time": ""
        }
      ]
    }
  ],
  "hotels": [
    {
      "name": "Nom de l'hôtel",
      "city": "Ville",
      "dates": "Période ou jours"
    }
  ]
}`;

      const payload = {
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      const { data } = await callGeminiApiWithFallback(apiKey, model, payload);
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonStr) throw new Error("Aucune réponse textuelle reçue de Gemini.");

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(e) {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Format JSON invalide dans la réponse de Gemini.");
      }

      if (parsed.title) tripToClean.title = parsed.title;
      if (parsed.subtitle) tripToClean.subtitle = parsed.subtitle;

      // Mise à jour de l'itinéraire
      if (parsed.days && Array.isArray(parsed.days) && parsed.days.length > 0) {
        parsed.days.forEach(aiDay => {
          let existingDay = tripToClean.itinerary.find(d => d.day === aiDay.day);
          if (!existingDay) {
            existingDay = {
              day: aiDay.day,
              title: aiDay.title,
              city: aiDay.city || "",
              lat: null,
              lng: null,
              highlight: "",
              description: "",
              dateStr: `Jour ${aiDay.day}`,
              timeline: []
            };
            tripToClean.itinerary.push(existingDay);
          }

          if (aiDay.title) existingDay.title = aiDay.title;
          if (aiDay.city) existingDay.city = aiDay.city;
          if (aiDay.timeline && Array.isArray(aiDay.timeline) && aiDay.timeline.length > 0) {
            existingDay.timeline = aiDay.timeline.map(t => ({
              title: t.title || "Visite",
              subtitle: t.subtitle || "",
              time: t.time || ""
            }));
          }

          // Résolution GPS automatique pour la ville de la journée
          if (typeof DESTINATION_CITY_COORDINATES !== 'undefined' && existingDay.city) {
            const normC = (typeof normStr === 'function') ? normStr(existingDay.city) : existingDay.city.toLowerCase();
            const foundKey = Object.keys(DESTINATION_CITY_COORDINATES).find(k => normC === k || normC.includes(k) || k.includes(normC));
            if (foundKey) {
              existingDay.lat = DESTINATION_CITY_COORDINATES[foundKey].lat;
              existingDay.lng = DESTINATION_CITY_COORDINATES[foundKey].lng;
            }
          }
        });
        tripToClean.itinerary.sort((a, b) => a.day - b.day);
      }

      // Mise à jour des hôtels si détectés par Gemini
      if (parsed.hotels && Array.isArray(parsed.hotels) && parsed.hotels.length > 0) {
        const newHotels = parsed.hotels.map(h => {
          let lat = null, lng = null;
          if (typeof DESTINATION_CITY_COORDINATES !== 'undefined' && h.city) {
            const normC = (typeof normStr === 'function') ? normStr(h.city) : h.city.toLowerCase();
            const foundKey = Object.keys(DESTINATION_CITY_COORDINATES).find(k => normC === k || normC.includes(k) || k.includes(normC));
            if (foundKey) {
              lat = DESTINATION_CITY_COORDINATES[foundKey].lat;
              lng = DESTINATION_CITY_COORDINATES[foundKey].lng;
            }
          }
          return {
            name: h.name,
            city: h.city || "",
            dates: h.dates || "",
            address: h.address || (h.city ? `Hôtel à ${h.city}` : ""),
            phone: h.phone || "",
            lat: lat,
            lng: lng,
            notes: "",
            isStayHotel: false,
            presentation: null
          };
        });

        if (newHotels.length >= tripToClean.hotels.length || tripToClean.hotels.length <= 1) {
          tripToClean.hotels = newHotels;
          tripToClean.hotelsList = newHotels;
        }
      }

      if (typeof renderParsedTripSummaryInModal === 'function') {
        renderParsedTripSummaryInModal();
      }

      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.borderColor = '#86efac';
        statusEl.style.background = '#f0fdf4';
        statusEl.style.color = '#15803d';
        statusEl.innerHTML = `<i class="fa-solid fa-sparkles" style="color:#9333ea;"></i> <strong>Nettoyage IA réussi !</strong> Le programme a été restructuré avec succès : titres nominaux courts, fausses visites éliminées, ${tripToClean.itinerary.length} journée(s) et ${tripToClean.hotels.length} hôtel(s) identifié(s).`;
      }

    } catch(err) {
      console.error("Erreur nettoyage Gemini:", err);
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.borderColor = '#fca5a5';
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#b91c1c';
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erreur lors du nettoyage IA : ${err.message}. L'import standard reste intact.`;
      }
    } finally {
      if (btnClean) {
        btnClean.disabled = false;
        btnClean.innerHTML = originalBtnHtml || `<i class="fa-solid fa-wand-magic-sparkles"></i> Nettoyage IA du programme`;
      }
      if (btnBannerClean) {
        btnBannerClean.disabled = false;
        btnBannerClean.innerHTML = originalBannerHtml || `<i class="fa-solid fa-sparkles"></i> Nettoyer avec l'IA`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. NETTOYAGE IA DES ÉTAPES DU CARNET ACTIF (ONGLET PROGRAMME)
  // ---------------------------------------------------------------------------
  async function cleanActiveCarnetWithGemini() {
    if (typeof tripData === 'undefined' || !tripData || !tripData.itinerary || tripData.itinerary.length === 0) {
      alert("Aucun voyage actif avec des étapes n'est chargé.");
      return;
    }

    if (!confirm(`Voulez-vous lancer le nettoyage IA des étapes pour le voyage "${tripData.title}" ?\n\nL'IA Gemini va :\n• Remplacer les débuts de phrases par des noms propres courts de visites\n• Éliminer les étapes descriptives parasites\n• Respecter strictement l'ordre de vos ${tripData.itinerary.length} journées`)) {
      return;
    }

    const apiKey = getStoredGeminiKey();
    if (!apiKey) {
      openGeminiConfigModal();
      return;
    }

    const model = getStoredGeminiModel();
    const btn = document.getElementById('btn-admin-clean-days-ia');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Nettoyage IA...`;
    }

    try {
      const itinerarySample = tripData.itinerary.map(d => ({
        day: d.day,
        title: d.title,
        city: d.city,
        timeline: (d.timeline || []).map(t => ({ title: t.title, subtitle: t.subtitle, time: t.time })),
        description: (d.description || "").substring(0, 1500)
      }));

      const promptText = `Tu es l'expert éditorial de "Voyages Girardot".
Nettoie et normalise les étapes et visites de ce voyage :
TITRE : ${tripData.title}
SOUS-TITRE : ${tripData.subtitle || ""}
PAYS : ${tripData.primaryDestinationCountry || ""}

JOURNÉES :
${JSON.stringify(itinerarySample, null, 2)}

RÈGLES STRICTES :
1. Titres de visites STRICTEMENT NOMINAUX ET COURTS (Jamais de phrase, pas de "Visite de...", pas de verbes conjugués).
2. Éliminer les fausses étapes parasites et fondre leurs explications dans 'subtitle'.
3. Conserver strictement l'ordre des jours et des visites.

RÉPONDS STRICTEMENT AU FORMAT JSON SUIVANT :
{
  "days": [
    {
      "day": 1,
      "title": "Titre propre du jour",
      "city": "Ville étape",
      "timeline": [
        {
          "title": "Nom court étape",
          "subtitle": "Description synthétique",
          "time": ""
        }
      ]
    }
  ]
}`;

      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      };

      const { data } = await callGeminiApiWithFallback(apiKey, model, payload);
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonStr) throw new Error("Aucune réponse textuelle reçue de Gemini.");

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(e) {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Format JSON invalide.");
      }

      let countCleaned = 0;
      if (parsed.days && Array.isArray(parsed.days)) {
        parsed.days.forEach(aiDay => {
          const d = tripData.itinerary.find(day => day.day === aiDay.day);
          if (d) {
            if (aiDay.title) d.title = aiDay.title;
            if (aiDay.city) d.city = aiDay.city;
            if (aiDay.timeline && Array.isArray(aiDay.timeline) && aiDay.timeline.length > 0) {
              d.timeline = aiDay.timeline.map(t => ({
                title: t.title || "Visite",
                subtitle: t.subtitle || "",
                time: t.time || ""
              }));
              countCleaned++;
            }
          }
        });
      }

      if (typeof saveTripToCatalogAndStorage === 'function') {
        saveTripToCatalogAndStorage(tripData);
      }
      if (typeof renderAdminDays === 'function') {
        renderAdminDays();
      }

      alert(`✓ Nettoyage IA réussi ! Les étapes de ${countCleaned} journée(s) ont été nettoyées et normalisées.`);

    } catch(err) {
      console.error("Erreur nettoyage IA actif:", err);
      alert("Erreur lors du nettoyage IA : " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml || `<i class="fa-solid fa-wand-magic-sparkles"></i> Nettoyage IA des étapes`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // EXPOSITION GLOBALE
  // ---------------------------------------------------------------------------
  global.getStoredGeminiKey = getStoredGeminiKey;
  global.getStoredGeminiModel = getStoredGeminiModel;
  global.updateGeminiStatusIndicator = updateGeminiStatusIndicator;
  global.openGeminiConfigModal = openGeminiConfigModal;
  global.closeGeminiConfigModal = closeGeminiConfigModal;
  global.saveGeminiConfig = saveGeminiConfig;
  global.disconnectGeminiKey = disconnectGeminiKey;
  global.testGeminiConnection = testGeminiConnection;
  global.generateFreeTimeWithGemini = generateFreeTimeWithGemini;
  global.showGeminiResultsModal = showGeminiResultsModal;
  global.closeGeminiResultsModal = closeGeminiResultsModal;
  global.applyGeminiSuggestionsToCarnet = applyGeminiSuggestionsToCarnet;
  global.cleanParsedTripWithGemini = cleanParsedTripWithGemini;
  global.cleanActiveCarnetWithGemini = cleanActiveCarnetWithGemini;
  global.callGeminiApiWithFallback = callGeminiApiWithFallback;

})(typeof window !== 'undefined' ? window : global);
