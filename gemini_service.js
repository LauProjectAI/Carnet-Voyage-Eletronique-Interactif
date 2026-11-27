// =============================================================================
// GOOGLE GEMINI API SERVICE (FREE TIER: GEMINI 2.0 FLASH / 1.5 FLASH)
// Assistant d'intelligence artificielle pour Voyages Girardot (Temps Libre & Conciergerie)
// =============================================================================

(function(global) {

  const DEFAULT_MODEL = 'gemini-2.5-flash';

  function getStoredGeminiKey() {
    return localStorage.getItem('girardot_gemini_api_key') || '';
  }

  function getStoredGeminiModel() {
    let m = localStorage.getItem('girardot_gemini_model');
    // Réinitialiser les anciens modèles expérimentaux ou dépréciés
    if (!m || m.includes('3.5') || m.includes('3.8')) {
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
  // DÉTECTION DES ERREURS AVEC BASCULE DE MODÈLE (SATURATION, PIC D'AFFLUENCE, 404, QUOTA)
  // ---------------------------------------------------------------------------
  function isRetryableGeminiModelError(status, errMsg) {
    if (status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    const msg = (errMsg || '').toLowerCase();
    return msg.includes('high demand') ||
           msg.includes('spikes in demand') ||
           msg.includes('overloaded') ||
           msg.includes('resource_exhausted') ||
           msg.includes('quota') ||
           msg.includes('rate limit') ||
           msg.includes('temporarily unavailable') ||
           msg.includes('try again later') ||
           msg.includes('not found') ||
           msg.includes('no longer available') ||
           msg.includes('is not supported') ||
           msg.includes('deprecated');
  }

  function formatGeminiUserErrorMessage(err) {
    const msg = err?.message || '';
    if (/high demand|spikes in demand|overloaded|503/i.test(msg)) {
      return "Les serveurs Google Gemini rencontrent actuellement un pic mondial d'affluence temporaire. Veuillez patienter quelques secondes puis réessayez, ou choisissez un autre modèle dans les réglages IA.";
    }
    if (/quota|resource_exhausted|429/i.test(msg)) {
      return "Le quota de requêtes par minute de votre clé Gemini a été temporairement dépassé. Patientez environ 30 secondes avant de relancer.";
    }
    if (/api key not valid|invalid api key/i.test(msg)) {
      return "La clé API Google Gemini est invalide ou expirée. Vérifiez-la dans la configuration IA.";
    }
    return msg;
  }

  // ---------------------------------------------------------------------------
  // EXÉCUTION AVEC BASCULE AUTOMATIQUE SUR MODÈLES DE SECOURS (FALLBACK CHAIN)
  // ---------------------------------------------------------------------------
  async function callGeminiApiWithFallback(apiKey, preferredModel, payload) {
    let discovered = [];
    try {
      discovered = await discoverAvailableGeminiModels(apiKey);
    } catch (e) {}

    // Liste ordonnée de modèles réels Google Gemini avec priorité aux modèles ultra-stables
    const candidateModels = [
      preferredModel,
      ...discovered,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
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
          
          if (isRetryableGeminiModelError(res.status, errMsg)) {
            console.warn(`[Gemini] Modèle ${m} indisponible ou surchargé (${errMsg}), bascule automatique sur le modèle suivant...`);
            lastError = new Error(errMsg);
            continue; // Tente immédiatement le modèle suivant dans la chaîne de secours
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
        if (isRetryableGeminiModelError(0, err.message)) {
          console.warn(`[Gemini] Exception sur ${m} (${err.message}), tentative modèle suivant...`);
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
      statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <strong>Structuration IA (Skill Import Carnet) :</strong> Application des règles d'extraction : étapes courtes, inclusion systématique de Déjeuner et Dîner logement, explications d'origine sans résumé...`;
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
Tu appliques STRICTEMENT la compétence (Skill) : "Import et Structuration de Carnet de Voyage".

Voici les données du programme à structurer :
TITRE : ${tripToClean.title}
SOUS-TITRE : ${tripToClean.subtitle || ""}
DATES : ${tripToClean.dates || ""}

JOURNÉES EXTRAITES INITIALES :
${JSON.stringify(itinerarySample, null, 2)}

EXTRAIT DU DOCUMENT SOURCE COMPLET :
${rawTextSample}

CONSIGNES STRICTES DE LA SKILL "IMPORT CARNET DE VOYAGE" :
1. FORMAT ET TITRES D'ÉTAPES :
   - Titres d'étapes STRICTEMENT NOMINAUX ET COURTS (Jamais de phrase, pas de "Visite de...", "Route vers...", "Découverte de...", "Ce site...").
   - Utilise le nom noble ou clair du monument, de la visite, de l'activité, du transport ou du temps fort.
     Exemples : "Qutub Minar et India Gate", "Fort de Junagarh", "Puits d'Abhaneri", "Taj Mahal", "Dunes de Sam", "Vol intérieur", "Train Shatabdi Express", "Déjeuner", "Dîner logement".

2. FIDÉLITÉ TEXTUELLE STRICTE (ZÉRO RÉSUMÉ DANS L'EXPLICATION) :
   - Pour chaque étape, le champ 'subtitle' (explication) DOIT reprendre EXACTEMENT le texte d'origine du document source.
   - NE JAMAIS résumer, abréger, reformuler ou paraphraser. Insère la ou les phrases exactes issues du document source.

3. INCLUSION SYSTÉMATIQUE DES REPAS :
   - Chaque journée DOIT comporter obligatoirement une étape Déjeuner (title: "Déjeuner") et une étape Dîner logement (title: "Dîner logement" ou "Dîner et nuit à bord").
   - Seule exception : s'il est expressément indiqué "déjeuner libre", "dîner libre" ou "repas libres" dans le document, l'indiquer explicitement en titre ("Déjeuner libre", "Dîner libre").
   - Si le document détaille le repas (ex: "Arrêt déjeuner au fort de Pokharan", "Déjeuner dans une ancienne haveli avec petit spectacle de marionnettes", "Spectacle de danses folkloriques Rajasthani suivi du dîner au campement. Logement.", "Dîner et nuit à bord"), inscrire cette phrase exacte dans 'subtitle'.
   - Si le repas est juste mentionné ou implicite dans la formule pension complète, inscrire "Déjeuner." ou "Dîner logement." dans le 'subtitle'.
   - Pour le jour du réacheminement final de retour dans la région d'origine (sans nuitée hôtel), ne pas forcer de dîner logement.

4. COMPLÉTUDE ET ORDRE STRICT DES JOURS :
   - Proposer obligatoirement la TOTALITÉ des jours du voyage (du Jour 1 au dernier jour, dans l'ordre chronologique exact sans omission).
   - Pour chaque jour, assigner la ville étape principale ('city').

5. HÔTELS DU CIRCUIT :
   - Extraire tous les hôtels réels du voyage (depuis le tableau des hôtels, les coordonnées ou le déroulé). Pour chaque hôtel : 'name' (avec catégorie si mentionnée, ex: "Deventure Sarovar Portico 4*"), 'city', 'dates' (ou jours associés, ex: "Du 2 au 3 décembre" ou "Jours 2 et 14").

RÉPONDS STRICTEMENT AU FORMAT JSON SUIVANT, SANS BALISE MARKDOWN NI TEXTE AUTOUR :
{
  "title": "Titre propre du voyage",
  "subtitle": "Sous-titre ou descriptif court",
  "days": [
    {
      "day": 1,
      "title": "Titre propre du jour (ex: Votre région - Genève - Delhi)",
      "city": "Ville étape",
      "timeline": [
        {
          "title": "Nom court étape",
          "subtitle": "Texte exact d'origine de l'étape sans aucun résumé",
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
        statusEl.innerHTML = `<i class="fa-solid fa-sparkles" style="color:#9333ea;"></i> <strong>Structuration IA réussie !</strong> Le programme a été structuré avec succès selon la Skill Import : titres courts nominaux, inclusion systématique des repas (Déjeuner & Dîner logement), explications conformes à la source, ${tripToClean.itinerary.length} journée(s) et ${tripToClean.hotels.length} hôtel(s) identifié(s).`;
      }

    } catch(err) {
      console.error("Erreur nettoyage Gemini:", err);
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.borderColor = '#fca5a5';
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#b91c1c';
        const friendlyMsg = formatGeminiUserErrorMessage(err);
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Nettoyage IA : ${friendlyMsg}. L'import standard reste intact.`;
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

    if (!confirm(`Voulez-vous lancer la restructuration IA des étapes selon la Skill Import pour le voyage "${tripData.title}" ?\n\nL'IA Gemini va :\n• Structurer des titres d'étapes courts et nominaux\n• Inclure systématiquement les étapes Déjeuner et Dîner logement\n• Conserver le texte d'origine exact sans le résumer dans les explications\n• Respecter strictement l'ordre de vos ${tripData.itinerary.length} journées`)) {
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
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Structuration IA...`;
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
Tu appliques STRICTEMENT la compétence (Skill) : "Import et Structuration de Carnet de Voyage".
Nettoie et normalise les étapes et visites de ce voyage :
TITRE : ${tripData.title}
SOUS-TITRE : ${tripData.subtitle || ""}
PAYS : ${tripData.primaryDestinationCountry || ""}

JOURNÉES :
${JSON.stringify(itinerarySample, null, 2)}

CONSIGNES STRICTES DE LA SKILL "IMPORT CARNET DE VOYAGE" :
1. Titres d'étapes STRICTEMENT NOMINAUX ET COURTS (Jamais de phrase, pas de "Visite de...", pas de verbes conjugués).
2. FIDÉLITÉ TEXTUELLE STRICTE (ZÉRO RÉSUMÉ) : Le champ 'subtitle' DOIT reprendre exactement le texte d'origine sans le résumer ni le paraphraser.
3. INCLUSION SYSTÉMATIQUE DES REPAS : Inclure obligatoirement les étapes Déjeuner (title: "Déjeuner") et Dîner logement (title: "Dîner logement" ou "Dîner et nuit à bord") dans chaque journée, sauf mention expresse de repas libre ("Déjeuner libre", "Dîner libre"). Si le texte source détaille le repas, inscrire cette phrase exacte dans 'subtitle'.
4. Conserver strictement l'ordre chronologique des jours et des étapes.

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
          "subtitle": "Texte exact d'origine",
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
      alert("Nettoyage IA : " + formatGeminiUserErrorMessage(err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml || `<i class="fa-solid fa-wand-magic-sparkles"></i> Nettoyage IA des étapes`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ENRICHISSEMENT FICHE HÔTEL DE SÉJOUR (IA GEMINI + PARSEUR LOCAL + DOCX)
  // ---------------------------------------------------------------------------
  function stripB2BCommercialNoise(rawText) {
    let txt = String(rawText || '').replace(/\r\n?/g, '\n');
    const cutoffRe = /^\s*(?:DESCRIPTIF\s+TARIFAIRE|TARIFS?\s+NET\s+DE\s+COMMISSION|LE\s+PRIX\s+COMPREND|LE\s+PRIX\s+NE\s+COMPREND\s+PAS|Devis\s+établi\s+le|Devis\s+sous\s+réserve|PACK\s+ACTIVI?T[ÉE]S?\s+EXCURSIONS|VOTRE\s+COMMISSION)\b/im;
    const cutMatch = txt.match(cutoffRe);
    if (cutMatch && typeof cutMatch.index === 'number') {
      txt = txt.slice(0, cutMatch.index);
    }

    const noiseLinePatterns = [
      /net\s+de\s+commission/i,
      /\d+\s*€\s*\/\s*pers/i,
      /CLIQUER\s+ICI\s+pour\s+le\s+Descriptif/i,
      /Descriptif\s+étant\s+amené\s+à\s+évoluer/i,
      /^<td\b/i
    ];
    return txt
      .split('\n')
      .filter(line => !noiseLinePatterns.some(re => re.test(line)))
      .join('\n')
      .trim();
  }

  function cleanHotelBlockText(str) {
    return String(str || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function detectHotelMetaFromText(text) {
    const clean = String(text || '');
    let name = '';
    const brandMatch = clean.match(/\b((?:Framissima|Club\s+Marmara|Club\s+Lookéa|Top\s+Clubs?|TUI\s+Blue|Club\s+Med|Hôtel|Hotel|Resort)\s+[A-ZÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’\-\s]{2,45}?(?:\s*\d\s*\*+)?)(?=\s*[!.,\n]|$)/i);
    if (brandMatch) {
      name = brandMatch[1].replace(/\s+/g, ' ').trim();
    } else {
      const starMatch = clean.match(/^([A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9'’\-\s]{2,40}\s+\d\s*\*+)/m);
      if (starMatch) name = starMatch[1].replace(/\s+/g, ' ').trim();
    }

    let city = '';
    const cityMatch = clean.match(/(?:commune\s+d['’]|situé(?:e)?\s+(?:à|dans\s+la\s+ville\s+de)\s+)([A-ZÀ-ÿ][A-Za-zÀ-ÿ\-']{2,30})/i);
    if (cityMatch) {
      city = cityMatch[1].trim();
    }

    let phone = '';
    const phoneMatch = clean.match(/(?:Tél\.?|Téléphone)\s*[:\-]?\s*(\+?[\d\s.\-()]{8,20})/i);
    if (phoneMatch) phone = phoneMatch[1].trim();

    return { name, city, phone };
  }

  function parseHotelDocumentLocally(rawText) {
    const clean = stripB2BCommercialNoise(rawText);
    const meta = detectHotelMetaFromText(clean);

    // Titres de rubriques reconnus : soit en MAJUSCULES, soit suivis de ":", soit seuls sur la ligne
    const headingPatterns = [
      { key: 'ignore_info', re: /^(INFORMATIONS?\s+PRATIQUES?|FORMALIT[ÉE]S?)(\s*:)?\s*(.*)$/i },
      { key: 'chambres', re: /^(LOGEMENT|H[ÉE]BERGEMENT|LES\s+CHAMBRES|CHAMBRES?)(\s*:)?\s*(.*)$/i },
      { key: 'equipements', re: /^([ÉE]QUIPEMENTS?)(\s*:)?\s*(.*)$/i },
      { key: 'animation', re: /^(ANIMATIONS?)(\s*:)?\s*(.*)$/i },
      { key: 'enfants', re: /^(ACTIVIT[ÉE]S?\s+ENFANTS?|CLUB\s+ENFANTS?|ENFANTS?\s*(?:&|ET)\s*ADOS?)(\s*:)?\s*(.*)$/i },
      { key: 'sports', re: /^(SPORTS?\s*(?:&|ET)\s*LOISIRS?|BIEN[- ]ÊTRE\s*(?:&|ET)\s*SPA|SPA\s*(?:&|ET)\s*LOISIRS?)(\s*:)?\s*(.*)$/i },
      { key: 'supplement', re: /^(AVEC\s+SUPPL[ÉE]MENT)(\s*:)?\s*(.*)$/i },
      { key: 'restauration', re: /^(RESTAURATION|RESTAURANTS?\s*(?:&|ET)\s*BARS?)(\s*:)?\s*(.*)$/i },
      { key: 'formule', re: /^(FORMULE(?:\s+REPAS|\s+TOUT\s+INCLUS|\s+ALL\s+INCLUSIVE)?|TOUT\s+INCLUS|TOUT\s+COMPRIS)(\s*:)?\s*(.*)$/i },
      { key: 'bon_a_savoir', re: /^(BON\s+[ÀA]\s+SAVOIR|[ÀA]\s+VOTRE\s+DISPOSITION)(\s*:)?\s*(.*)$/i }
    ];

    const buckets = {
      intro: [],
      ignore_info: [],
      chambres: [],
      equipements: [],
      animation: [],
      enfants: [],
      sports: [],
      supplement: [],
      restauration: [],
      formule: [],
      bon_a_savoir: []
    };

    let currentKey = 'intro';
    const lines = clean.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let matchedHeading = false;
      for (let h = 0; h < headingPatterns.length; h++) {
        const hp = headingPatterns[h];
        const m = line.match(hp.re);
        if (m) {
          const kw = m[1] || '';
          const hasColon = Boolean(m[2] && m[2].includes(':'));
          const rest = (m[3] || '').trim();
          const isAllCapsKw = kw === kw.toUpperCase() && /[A-ZÀ-Ÿ]/.test(kw);
          const isStandalone = rest.length === 0;
          if (!isAllCapsKw && !hasColon && !isStandalone) {
            continue;
          }
          // Ne traiter "AVEC SUPPLEMENT" comme rubrique que s'il est en majuscules / sans puce
          if (hp.key === 'supplement' && !isAllCapsKw) {
            continue;
          }
          currentKey = hp.key;
          if (rest) {
            buckets[currentKey].push(rest);
          }
          matchedHeading = true;
          break;
        }
      }
      if (matchedHeading) continue;

      // Si on était dans INFORMATIONS PRATIQUES / FORMALITES et qu'on détecte le début de la fiche hôtel, revenir en mode intro
      if (currentKey === 'ignore_info' && /^(?:CAPE\s+EAST|FRAMISSIMA|CLUB\s+MARMARA|CLUB\s+LOOK[ÉE]A|TOP\s+CLUB|Votre\s+équipe|R[ée]servez\s+votre\s+s[ée]jour|Situ[ée]\s+dans|L['’]h[ôo]tel|[A-ZÀ-ÿ0-9'’\-\s]{3,40}\s+\d\s*\*+)/i.test(line)) {
        currentKey = 'intro';
      }

      buckets[currentKey].push(line);
    }

    // Si on a capturé des paragraphes de destination pays tout au début avant INFORMATIONS PRATIQUES, ne garder dans intro que la partie hôtel si présente
    let introLines = buckets.intro.slice();
    const hotelAnchorIdx = introLines.findIndex(l => /(?:R[ée]servez\s+votre\s+s[ée]jour|Situ[ée]\s+dans\s+la\s+commune|Votre\s+équipe\s+d['’]animation|accueille\s+dans\s+des\s+chambres)/i.test(l));
    if (hotelAnchorIdx > 0) {
      introLines = introLines.slice(hotelAnchorIdx);
    }

    const intro = cleanHotelBlockText(introLines.join('\n').replace(/CAPE\s+EAST\s+3\*\s*Arrivée\s+Kemi/gi, '').trim());
    const chambres = cleanHotelBlockText(buckets.chambres.join('\n'));
    const restauration = cleanHotelBlockText(buckets.restauration.join('\n'));

    // Extraire les éléments de Formule depuis buckets.formule + phrases clés de restauration / bon à savoir
    const formuleParts = [];
    if (buckets.formule.length) formuleParts.push(buckets.formule.join('\n'));
    const allRestLines = buckets.restauration.join('\n').split(/(?<=[.!?])\s+|\n/);
    allRestLines.forEach(s => {
      if (/(?:formule\s+(?:pension|tout\s+inclus|demi-pension)|inclus\s+pour\s+le\s+déjeuner|avec\s+supplément\s*:|bar\s+lounge|boissons)/i.test(s)) {
        if (!formuleParts.some(p => p.includes(s.trim()))) {
          formuleParts.push(s.trim());
        }
      }
    });
    const formule = cleanHotelBlockText(formuleParts.join('\n'));

    // Règle métier explicite : Animation, Sports et Loisirs, Club/Activités Enfants (+ Avec supplément) -> Services, Sports & Loisirs
    const servicesParts = [];
    if (buckets.animation.length) servicesParts.push(`Animation :\n${buckets.animation.join('\n')}`);
    if (buckets.enfants.length) servicesParts.push(`Club & Activités Enfants :\n${buckets.enfants.join('\n')}`);
    if (buckets.sports.length) servicesParts.push(`Sports & Loisirs :\n${buckets.sports.join('\n')}`);
    if (buckets.supplement.length) servicesParts.push(`Avec supplément :\n${buckets.supplement.join('\n')}`);
    const services = cleanHotelBlockText(servicesParts.join('\n\n'));

    // Règle métier explicite : Équipements (+ Bon à savoir pratique) -> À votre disposition
    const dispoParts = [];
    if (buckets.equipements.length) dispoParts.push(`Équipements :\n${buckets.equipements.join('\n')}`);
    if (buckets.bon_a_savoir.length) dispoParts.push(`Bon à savoir :\n${buckets.bon_a_savoir.join('\n')}`);
    const disposition = cleanHotelBlockText(dispoParts.join('\n\n'));

    return {
      name: meta.name,
      city: meta.city,
      address: '',
      phone: meta.phone,
      presentation: {
        intro,
        chambres,
        restauration,
        formule,
        services,
        disposition
      }
    };
  }

  async function analyzeHotelDocumentWithGemini(rawText, existingHotel) {
    const apiKey = getStoredGeminiKey();
    if (!apiKey) {
      throw new Error("Aucune clé API Google Gemini configurée. Utilisez le bouton « IA Gemini (Free) » en haut à droite ou cliquez sur « Remplissage rapide (sans IA) ».");
    }

    const cleanSource = stripB2BCommercialNoise(rawText);
    if (!cleanSource || cleanSource.length < 30) {
      throw new Error("Le texte du document hôtel est trop court pour être analysé.");
    }

    const model = getStoredGeminiModel();
    const existingName = existingHotel && existingHotel.name ? existingHotel.name : '';

    const systemPrompt = `Tu es un expert en production touristique chez Voyages Girardot.
À partir d'une fiche descriptive d'hôtel ou de club de séjour fournie par un tour-opérateur (ex: FRAM, Framissima, Marmara, TUI, Top Clubs), tu dois extraire et classer fidèlement les informations dans les 6 cadres pré-établis de la fiche "Hôtel de Séjour".

RÈGLES DE CLASSEMENT STRICTES :
1. "intro" (Cadre & Ambiance) : présentation générale de l'hôtel, situation géographique, distance centre-ville / aéroports, ambiance globale.
2. "chambres" (Les Chambres) : capacité totale, bâtiments, superficie, literie, équipements en chambre, capacité maximale, remarques chambre.
3. "restauration" (Restauration) : restaurants, buffets, horaires des repas, dîners à thème (ex: dîner tipi), bars, remarques restauration.
4. "formule" (Formule Repas / Tout Inclus) : régime de pension (pension complète, tout inclus, demi-pension), boissons incluses ou en supplément, snacks, dîners de fêtes inclus.
5. "services" (Services, Sports & Loisirs) : OBLIGATOIREMENT toutes les rubriques Animation, Sports et Loisirs, Spa / Piscines / Fitness, Club ou Activités Enfants / Ados, et activités avec supplément.
6. "disposition" (À votre disposition) : OBLIGATOIREMENT la rubrique Équipements de l'hôtel (réception, Wi-Fi, parking, salles de conférence...) ainsi que les informations pratiques utiles au client (Bon à savoir : horaires arrivée/départ, ménage, prêt de tenue grand froid ou serviettes, animaux, PMR, paiement CB, classification locale).

INTERDICTIONS STRICTES :
- N'invente aucune information absente du document.
- Exclue totalement les prix, tarifs nets de commission, devis, suppléments chiffrés de vente et commissions d'agence.
- Rédige en français clair, structuré et directement lisible par le voyageur.`;

    const userPrompt = `${existingName ? `Hôtel concerné : ${existingName}\n\n` : ''}DOCUMENT SOURCE À ANALYSER :
${cleanSource.slice(0, 28000)}

Retourne UNIQUEMENT un objet JSON valide au format exact :
{
  "name": "Nom de l'hôtel avec catégorie si mentionnée",
  "city": "Ville ou commune de l'hôtel",
  "address": "Adresse postale si présente sinon chaîne vide",
  "phone": "Téléphone si présent sinon chaîne vide",
  "presentation": {
    "intro": "...",
    "chambres": "...",
    "restauration": "...",
    "formule": "...",
    "services": "...",
    "disposition": "..."
  }
}`;

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    const { data } = await callGeminiApiWithFallback(apiKey, model, payload);
    const jsonStr = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : '';
    if (!jsonStr) throw new Error("Aucune réponse JSON reçue de Gemini.");

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Format JSON invalide retourné par Gemini.");
      parsed = JSON.parse(m[0]);
    }

    const p = (parsed && parsed.presentation && typeof parsed.presentation === 'object') ? parsed.presentation : {};
    return {
      name: String(parsed.name || existingName || '').trim(),
      city: String(parsed.city || '').trim(),
      address: String(parsed.address || '').trim(),
      phone: String(parsed.phone || '').trim(),
      presentation: {
        intro: cleanHotelBlockText(p.intro || ''),
        chambres: cleanHotelBlockText(p.chambres || ''),
        restauration: cleanHotelBlockText(p.restauration || ''),
        formule: cleanHotelBlockText(p.formule || ''),
        services: cleanHotelBlockText(p.services || ''),
        disposition: cleanHotelBlockText(p.disposition || '')
      }
    };
  }

  function decodeXmlEntities(str) {
    return String(str || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  async function extractTextFromDocxArrayBuffer(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Localiser End of Central Directory (PK\x05\x06)
    let eocdOffset = -1;
    const minOffset = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minOffset; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error("Fichier Word (.docx) invalide ou corrompu.");
    }

    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');

    let pos = cdOffset;
    const cdEnd = cdOffset + cdSize;
    let xmlText = '';

    while (pos < cdEnd && pos + 46 <= bytes.length) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const compMethod = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);
      const fileName = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

      if (fileName === 'word/document.xml') {
        const lfhNameLen = view.getUint16(localHeaderOffset + 26, true);
        const lfhExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
        const compressedSlice = bytes.subarray(dataStart, dataStart + compSize);

        if (compMethod === 0) {
          xmlText = decoder.decode(compressedSlice);
        } else if (compMethod === 8) {
          if (typeof DecompressionStream === 'undefined') {
            throw new Error("Ce navigateur ne prend pas en charge la décompression native des fichiers .docx.");
          }
          const ds = new DecompressionStream('deflate-raw');
          const decompressedStream = new Blob([compressedSlice]).stream().pipeThrough(ds);
          const outBuf = await new Response(decompressedStream).arrayBuffer();
          xmlText = decoder.decode(new Uint8Array(outBuf));
        } else {
          throw new Error(`Méthode de compression .docx non supportée (${compMethod}).`);
        }
        break;
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }

    if (!xmlText) {
      throw new Error("Contenu word/document.xml introuvable dans ce fichier .docx.");
    }

    // Convertir les paragraphes Word (<w:p>) et sauts de ligne (<w:br/>) en texte structuré
    const paragraphs = xmlText.split(/<\/w:p>/i);
    const outLines = [];
    paragraphs.forEach(pXml => {
      const withBreaks = pXml
        .replace(/<w:br\b[^>]*\/?>/gi, '\n')
        .replace(/<w:tab\b[^>]*\/?>/gi, ' ');
      const runs = [];
      const tRe = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi;
      let m;
      while ((m = tRe.exec(withBreaks)) !== null) {
        runs.push(decodeXmlEntities(m[1]));
      }
      const line = runs.join('').replace(/[ \t]+/g, ' ').trim();
      if (line) outLines.push(line);
    });

    return outLines.join('\n');
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
  global.parseHotelDocumentLocally = parseHotelDocumentLocally;
  global.analyzeHotelDocumentWithGemini = analyzeHotelDocumentWithGemini;
  global.extractTextFromDocxArrayBuffer = extractTextFromDocxArrayBuffer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseHotelDocumentLocally,
      analyzeHotelDocumentWithGemini,
      extractTextFromDocxArrayBuffer
    };
  }

})(typeof window !== 'undefined' ? window : global);
