(function (root) {
  'use strict';

  const GIRARDOT_INLINE_SVG = `<svg width="36" height="29" viewBox="0 0 33 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M32.9496 10.66C32.9496 16.54 28.5296 21.04 22.5596 21.28V16.33C25.5196 16.07 27.6996 13.73 27.6996 10.66C27.6996 7.4 25.2496 4.95 22.0196 4.95C20.1696 4.95 18.6396 5.73 17.7296 6.97C17.5296 7.21 17.3796 7.46 17.2496 7.73H21.4296V12.39H11.5496V12.37C11.5496 12.37 10.1296 0.51 21.2996 0.02C21.5296 0.01 21.7696 0 22.0196 0C28.2596 0 32.9496 4.6 32.9496 10.66Z" fill="#29513B"/>
    <path d="M0 15.48C0 9.6 4.42 5.1 10.39 4.86V9.81C7.43 10.07 5.25 12.41 5.25 15.48C5.25 18.74 7.7 21.19 10.93 21.19C12.78 21.19 14.31 20.41 15.22 19.17C15.42 18.93 15.57 18.68 15.7 18.41H11.52V13.75H21.4V13.77C21.4 13.77 22.82 25.63 11.65 26.12C11.42 26.13 11.18 26.14 10.93 26.14C4.69 26.14 0 21.54 0 15.48Z" fill="#1F3428"/>
  </svg>`;

  const PRINT_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

  function escapeExportHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeExportUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(raw)) {
      return raw;
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//')) {
      return raw;
    }
    return '';
  }

  function slugifyFilename(str) {
    const base = String(str || 'carnet-voyage')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return base || 'carnet-voyage';
  }

  function resolveImageSrc(url, inlinedMap) {
    const clean = safeExportUrl(url);
    if (!clean) return '';
    if (inlinedMap && inlinedMap[clean]) {
      return inlinedMap[clean];
    }
    return clean;
  }

  function isRelativeLocalImage(url) {
    const clean = safeExportUrl(url);
    if (!clean) return false;
    if (clean.startsWith('data:') || /^https?:\/\//i.test(clean)) return false;
    return true;
  }

  async function inlineLocalImageAsDataUri(url) {
    if (!isRelativeLocalImage(url) || typeof fetch !== 'function' || typeof FileReader === 'undefined') {
      return '';
    }
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 2500) : null;
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (!res || !res.ok) return '';
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return '';
    }
  }

  async function collectInlinedImages(ctx) {
    const map = {};
    const trip = (ctx && ctx.trip) || {};
    const candidates = new Set();
    if (trip.coverImage) candidates.add(trip.coverImage);
    if (trip.branding && trip.branding.partnerLogoUrl) candidates.add(trip.branding.partnerLogoUrl);
    if (Array.isArray(trip.itinerary)) {
      trip.itinerary.forEach((day) => {
        if (day && day.image) candidates.add(day.image);
      });
    }
    const tasks = Array.from(candidates)
      .filter((u) => isRelativeLocalImage(u))
      .map(async (u) => {
        const dataUri = await inlineLocalImageAsDataUri(u);
        if (dataUri) map[safeExportUrl(u)] = dataUri;
      });
    await Promise.all(tasks);
    return map;
  }

  function collectClientCarnetContext() {
    const trip = (typeof currentTrip !== 'undefined' && currentTrip)
      ? currentTrip
      : (root.currentTrip || null);
    const auth = root.GirardotAuth || null;
    const session = (auth && typeof auth.getSession === 'function') ? auth.getSession() : null;
    const personalization = (auth && trip && typeof auth.getSessionTripPersonalization === 'function')
      ? auth.getSessionTripPersonalization(trip.id)
      : null;

    const souvenirs = (typeof getSouvenirsList === 'function') ? (getSouvenirsList() || []) : [];

    const docs = [];
    if (trip && Array.isArray(trip.documents)) {
      trip.documents.forEach((d) => docs.push(Object.assign({ source: 'agency' }, d)));
    }
    if (typeof getNominativeTravelerDocs === 'function') {
      (getNominativeTravelerDocs() || []).forEach((d) => docs.push(d));
    }
    if (typeof getClientPersonalDocs === 'function') {
      (getClientPersonalDocs() || []).forEach((d) => docs.push(Object.assign({ source: 'personal' }, d)));
    }

    return {
      trip,
      session,
      personalization,
      souvenirs,
      documents: docs,
      exportedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    };
  }

  function normalizeOptionItem(opt) {
    if (!opt) return null;
    if (typeof opt === 'string') {
      const clean = opt.trim();
      return clean ? { title: clean, day: null, details: '' } : null;
    }
    if (typeof opt === 'object') {
      const title = String(opt.title || opt.label || opt.name || '').trim();
      if (!title) return null;
      const dayNum = opt.day != null && opt.day !== '' ? Number(opt.day) : null;
      return {
        title,
        day: (dayNum && !Number.isNaN(dayNum)) ? dayNum : null,
        details: String(opt.details || opt.description || opt.notes || '').trim()
      };
    }
    return null;
  }

  function formatRichText(text) {
    return escapeExportHtml(text).replace(/\n/g, '<br>');
  }

  function buildTravelerSection(ctx) {
    const session = ctx.session;
    const pers = ctx.personalization;
    const trip = ctx.trip || {};
    const welcomeMsg = (trip.branding && trip.branding.welcomeMessage) ? String(trip.branding.welcomeMessage).trim() : '';
    const isTraveler = !!(session && session.role === 'traveler');
    if (!isTraveler && !pers && !welcomeMsg) return '';

    const items = [];
    if (pers && pers.pickupPoint) {
      const timeStr = pers.pickupTime ? ` • ${pers.pickupTime}` : '';
      items.push(`<div class="kv-box"><div class="kv-label">Prise en charge</div><div class="kv-val">${escapeExportHtml(pers.pickupPoint + timeStr)}</div></div>`);
    }
    if (pers && pers.seatNumber) {
      items.push(`<div class="kv-box"><div class="kv-label">Place autocar</div><div class="kv-val">${escapeExportHtml(pers.seatNumber)}</div></div>`);
    }
    if (pers && (pers.cabinNumber || pers.roomNumber)) {
      const isCabin = !!pers.cabinNumber;
      items.push(`<div class="kv-box"><div class="kv-label">${isCabin ? 'Ma Cabine' : 'Ma Chambre'}</div><div class="kv-val">${escapeExportHtml(pers.cabinNumber || pers.roomNumber)}</div></div>`);
    }
    const dossierRef = (pers && pers.dossierRef) || (session && session.dossierRef) || '';
    if (dossierRef) {
      items.push(`<div class="kv-box"><div class="kv-label">Dossier</div><div class="kv-val">${escapeExportHtml(dossierRef)}</div></div>`);
    }

    const opts = (pers && Array.isArray(pers.options)) ? pers.options.map(normalizeOptionItem).filter(Boolean) : [];
    const optsHtml = opts.length ? `
      <div class="sub-block">
        <div class="sub-label">Mes options réservées</div>
        <ul class="clean-list">
          ${opts.map((o) => `<li><strong>${o.day ? `Jour ${o.day} — ` : ''}${escapeExportHtml(o.title)}</strong>${o.details ? ` : ${escapeExportHtml(o.details)}` : ''}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    return `
      <section class="export-section">
        <h2 class="section-title">Mon Dossier Voyageur</h2>
        <div class="card card-accent">
          ${isTraveler ? `<div class="traveler-name">Voyageur : <strong>${escapeExportHtml(session.displayName)}</strong></div>` : ''}
          ${welcomeMsg ? `<blockquote class="welcome-quote">${formatRichText(welcomeMsg)}</blockquote>` : ''}
          ${items.length ? `<div class="kv-grid">${items.join('')}</div>` : ''}
          ${optsHtml}
        </div>
      </section>
    `;
  }

  function buildAlertSection(trip) {
    if (!trip.alert || (!trip.alert.title && !trip.alert.text)) return '';
    const link = safeExportUrl(trip.alert.link);
    return `
      <section class="export-section">
        <h2 class="section-title">Formalités & Alerte Voyage</h2>
        <div class="card card-alert">
          ${trip.alert.title ? `<h3>${escapeExportHtml(trip.alert.title)}</h3>` : ''}
          ${trip.alert.text ? `<p>${formatRichText(trip.alert.text)}</p>` : ''}
          ${link ? `<p class="meta-link">Portail officiel : <a href="${escapeExportHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeExportHtml(link)}</a></p>` : ''}
        </div>
      </section>
    `;
  }

  function buildFlightsAndBaggageSection(trip) {
    const cards = [];

    if (Array.isArray(trip.flightsList) && trip.flightsList.length > 0) {
      trip.flightsList.forEach((f) => {
        cards.push(`
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-kicker">${escapeExportHtml(f.type || 'Vol')}</div>
                <div class="card-title">${escapeExportHtml(f.airline || 'Compagnie aérienne')}</div>
              </div>
              ${f.flightNumber ? `<span class="code-pill">${escapeExportHtml(f.flightNumber)}</span>` : ''}
            </div>
            <p class="flight-route">
              ${f.date ? `<span class="muted">${escapeExportHtml(f.date)} • </span>` : ''}
              <strong>${escapeExportHtml(f.departureAirport || 'Départ')}</strong>${f.departureTime ? ` (${escapeExportHtml(f.departureTime)})` : ''}
              → <strong>${escapeExportHtml(f.arrivalAirport || 'Arrivée')}</strong>${f.arrivalTime ? ` (${escapeExportHtml(f.arrivalTime)})` : ''}
            </p>
            ${f.via ? `<p class="muted-sm">Escale / VIA : ${escapeExportHtml(f.via)}</p>` : ''}
            ${f.notes ? `<p class="muted-sm">${escapeExportHtml(f.notes)}</p>` : ''}
          </div>
        `);
      });
    } else if (trip.flights && (trip.flights.outbound || trip.flights.inbound)) {
      const renderLegacyFlight = (label, fl) => {
        if (!fl || (!fl.airline && !fl.flightNumber && !fl.departureAirport)) return '';
        return `
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-kicker">${escapeExportHtml(label)}</div>
                <div class="card-title">${escapeExportHtml(fl.airline || 'Compagnie aérienne')}</div>
              </div>
              ${fl.flightNumber ? `<span class="code-pill">${escapeExportHtml(fl.flightNumber)}</span>` : ''}
            </div>
            <p class="flight-route">
              ${fl.date ? `<span class="muted">${escapeExportHtml(fl.date)} • </span>` : ''}
              <strong>${escapeExportHtml(fl.departureAirport || 'Départ')}</strong>${fl.departureTime ? ` (${escapeExportHtml(fl.departureTime)})` : ''}
              → <strong>${escapeExportHtml(fl.arrivalAirport || 'Arrivée')}</strong>${fl.arrivalTime ? ` (${escapeExportHtml(fl.arrivalTime)})` : ''}
            </p>
            ${fl.meetingTime ? `<p class="muted-sm">Convocation : ${escapeExportHtml(fl.meetingTime)}${fl.meetingPlace ? ` — ${escapeExportHtml(fl.meetingPlace)}` : ''}</p>` : ''}
            ${fl.layover ? `<p class="muted-sm">${escapeExportHtml(fl.layover)}</p>` : ''}
          </div>
        `;
      };
      if (trip.flights.outbound) cards.push(renderLegacyFlight('Vol Aller', trip.flights.outbound));
      if (trip.flights.inbound) cards.push(renderLegacyFlight('Vol Retour', trip.flights.inbound));
      if (Array.isArray(trip.flights.domesticFlights)) {
        trip.flights.domesticFlights.forEach((df) => {
          cards.push(`
            <div class="card">
              <div class="card-head">
                <div>
                  <div class="card-kicker">Vol Intérieur${df.day ? ` • Jour ${escapeExportHtml(df.day)}` : ''}</div>
                  <div class="card-title">${escapeExportHtml(df.label || df.airline || 'Vol intérieur')}</div>
                </div>
                ${df.flightNumber ? `<span class="code-pill">${escapeExportHtml(df.flightNumber)}</span>` : ''}
              </div>
              <p class="flight-route">
                <strong>${escapeExportHtml(df.departureAirport || df.departureCity || '')}</strong>${df.departureTime ? ` (${escapeExportHtml(df.departureTime)})` : ''}
                → <strong>${escapeExportHtml(df.arrivalAirport || df.arrivalCity || '')}</strong>${df.arrivalTime ? ` (${escapeExportHtml(df.arrivalTime)})` : ''}
              </p>
              ${df.notes ? `<p class="muted-sm">${escapeExportHtml(df.notes)}</p>` : ''}
            </div>
          `);
        });
      }
    }

    const bag = trip.baggage || (trip.flights && (trip.flights.baggage || trip.flights.luggage)) || null;
    if (bag && (bag.cabin || bag.hold || bag.checked || bag.details)) {
      const holdVal = bag.hold || bag.checked || '';
      cards.push(`
        <div class="card">
          <div class="card-title" style="margin-bottom:8px;">Franchise Bagages</div>
          <div class="kv-grid">
            ${bag.cabin ? `<div class="kv-box"><div class="kv-label">Bagage Cabine</div><div class="kv-val">${escapeExportHtml(bag.cabin)}</div></div>` : ''}
            ${holdVal ? `<div class="kv-box"><div class="kv-label">Bagage en Soute</div><div class="kv-val">${escapeExportHtml(holdVal)}</div></div>` : ''}
          </div>
          ${bag.details ? `<p class="muted-sm" style="margin-top:8px;">${formatRichText(bag.details)}</p>` : ''}
        </div>
      `);
    }

    const html = cards.filter(Boolean).join('');
    if (!html) return '';
    return `
      <section class="export-section">
        <h2 class="section-title">Plan de Vol & Bagages</h2>
        ${html}
      </section>
    `;
  }

  function buildItinerarySection(ctx, inlinedImages) {
    const trip = ctx.trip || {};
    if (!Array.isArray(trip.itinerary) || trip.itinerary.length === 0) return '';

    const rawOpts = (ctx.personalization && Array.isArray(ctx.personalization.options))
      ? ctx.personalization.options.map(normalizeOptionItem).filter(Boolean)
      : [];

    const daysHtml = trip.itinerary.map((day) => {
      const dayNum = Number(day.day);
      const dayImg = resolveImageSrc(day.image, inlinedImages);
      const timeline = Array.isArray(day.timeline) ? day.timeline : [];
      const dayOpts = rawOpts.filter((o) => o.day === dayNum);

      return `
        <article class="day-block">
          <header class="day-header">
            <div class="day-header-top">
              <span class="day-pill">Jour ${escapeExportHtml(day.day)}</span>
              ${day.dateStr ? `<span class="day-date">${escapeExportHtml(day.dateStr)}</span>` : ''}
              ${day.city ? `<span class="day-city">${escapeExportHtml(day.city)}</span>` : ''}
            </div>
            <h3 class="day-title">${escapeExportHtml(day.title || `Étape ${day.day}`)}</h3>
            ${day.highlight ? `<div class="day-highlight">${escapeExportHtml(day.highlight)}</div>` : ''}
          </header>

          ${dayImg ? `
            <div class="day-photo">
              <img src="${escapeExportHtml(dayImg)}" alt="${escapeExportHtml(day.city || day.title || '')}" onerror="this.parentElement.style.display='none'">
            </div>
          ` : ''}

          ${day.description ? `<p class="day-desc">${formatRichText(day.description)}</p>` : ''}

          ${timeline.length ? `
            <div class="timeline-list">
              ${timeline.map((step) => `
                <div class="timeline-step">
                  <div class="step-time">${escapeExportHtml(step.time || '•')}</div>
                  <div class="step-body">
                    <div class="step-title">${escapeExportHtml(step.title || '')}</div>
                    ${step.subtitle ? `<div class="step-sub">${formatRichText(step.subtitle)}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${dayOpts.length ? `
            <div class="day-options">
              <div class="sub-label">Mes options ce jour :</div>
              ${dayOpts.map((o) => `<div class="day-opt-item">• <strong>${escapeExportHtml(o.title)}</strong>${o.details ? ` — ${escapeExportHtml(o.details)}` : ''}</div>`).join('')}
            </div>
          ` : ''}
        </article>
      `;
    }).join('');

    return `
      <section class="export-section">
        <h2 class="section-title">Programme Jour par Jour (${trip.itinerary.length} jours)</h2>
        ${daysHtml}
      </section>
    `;
  }

  function buildHotelsSection(trip) {
    if (!Array.isArray(trip.hotels) || trip.hotels.length === 0) return '';

    const cards = trip.hotels.map((h) => {
      const p = h.presentation || null;
      const presParts = [];
      if (p) {
        if (p.intro) presParts.push(`<p><strong>Cadre & Ambiance :</strong> ${formatRichText(p.intro)}</p>`);
        if (p.chambres) presParts.push(`<p><strong>Les Chambres :</strong> ${formatRichText(p.chambres)}</p>`);
        if (p.restauration) presParts.push(`<p><strong>Restauration :</strong> ${formatRichText(p.restauration)}</p>`);
        if (p.formule) presParts.push(`<p><strong>Formule :</strong> ${formatRichText(p.formule)}</p>`);
        if (p.services) presParts.push(`<p><strong>Services & Loisirs :</strong> ${formatRichText(p.services)}</p>`);
        if (p.disposition) presParts.push(`<p><strong>À votre disposition :</strong> ${formatRichText(p.disposition)}</p>`);
      }

      return `
        <div class="card">
          <div class="card-head">
            <div>
              ${(h.dates || h.date) ? `<div class="card-kicker">${escapeExportHtml(h.dates || h.date)}</div>` : ''}
              <div class="card-title">${escapeExportHtml(h.name || 'Hébergement')}</div>
            </div>
            ${h.phone ? `<span class="muted-sm">${escapeExportHtml(h.phone)}</span>` : ''}
          </div>
          ${h.address ? `<p class="muted-sm">${escapeExportHtml(h.address)}</p>` : ''}
          ${h.notes ? `<p class="muted-sm">${formatRichText(h.notes)}</p>` : ''}
          ${presParts.length ? `<div class="sub-block stay-pres">${presParts.join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <section class="export-section">
        <h2 class="section-title">Hébergements</h2>
        ${cards}
      </section>
    `;
  }

  function buildFreeTimeSection(trip) {
    const list = Array.isArray(trip.freeTimeSuggestions) ? trip.freeTimeSuggestions : [];
    if (!list.length) return '';

    const grouped = {};
    list.forEach((s) => {
      const key = s.moment ? `${s.moment} — ${s.city || 'Étape'}` : (s.city || 'Suggestions');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    const groupsHtml = Object.entries(grouped).map(([title, items]) => `
      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">${escapeExportHtml(title)}</div>
        ${items.map((item) => `
          <div class="freetime-item">
            <div><strong>${escapeExportHtml(item.name || '')}</strong>${item.category ? ` <span class="tag-pill">${escapeExportHtml(item.category)}</span>` : ''}</div>
            ${item.description ? `<p class="muted-sm">${formatRichText(item.description)}</p>` : ''}
            ${item.address ? `<p class="muted-xs">Adresse : ${escapeExportHtml(item.address)}</p>` : ''}
            ${item.tips ? `<p class="muted-xs">Conseil : ${escapeExportHtml(item.tips)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');

    return `
      <section class="export-section">
        <h2 class="section-title">Temps Libre & Coups de Cœur</h2>
        ${groupsHtml}
      </section>
    `;
  }

  function buildPracticalSection(trip) {
    if (Array.isArray(trip.practicalTipsList) && trip.practicalTipsList.length > 0) {
      const cards = trip.practicalTipsList.map((tip) => `
        <div class="card">
          <div class="card-title">${escapeExportHtml(tip.title || 'Information pratique')}</div>
          <p class="muted-sm" style="margin-top:4px;">${formatRichText(tip.content || '')}</p>
        </div>
      `).join('');
      return `
        <section class="export-section">
          <h2 class="section-title">Informations & Conseils Pratiques</h2>
          ${cards}
        </section>
      `;
    }

    if (trip.practicalInfo) {
      const p = trip.practicalInfo;
      const rows = [
        ['Devise & Paiement', p.money],
        ['Électricité & Prises', p.electricity],
        ['Climat', p.climate],
        ['Vêtements conseillés', p.clothing],
        ['Pourboires', p.tips],
        ['Santé & Pharmacie', p.health]
      ].filter((pair) => pair[1]);
      if (!rows.length) return '';
      return `
        <section class="export-section">
          <h2 class="section-title">Informations & Conseils Pratiques</h2>
          <div class="card">
            ${rows.map(([label, val]) => `<p class="muted-sm" style="margin-bottom:6px;"><strong>${escapeExportHtml(label)} :</strong> ${formatRichText(val)}</p>`).join('')}
          </div>
        </section>
      `;
    }

    return '';
  }

  function buildContactsSection(trip) {
    const cards = [];
    if (Array.isArray(trip.contactsList) && trip.contactsList.length > 0) {
      trip.contactsList.forEach((c) => {
        cards.push(`
          <div class="card ${c.isEmergency ? 'card-alert' : ''}">
            <div class="card-kicker">${escapeExportHtml(c.category || 'Contact')}</div>
            ${c.name ? `<div class="card-title">${escapeExportHtml(c.name)}</div>` : ''}
            ${c.address ? `<p class="muted-sm">${formatRichText(c.address)}</p>` : ''}
            ${c.phone ? `<p class="muted-sm"><strong>Téléphone :</strong> ${escapeExportHtml(c.phone)}</p>` : ''}
          </div>
        `);
      });
    } else if (trip.contacts) {
      const c = trip.contacts;
      if (c.receptif && c.receptif.name) {
        cards.push(`<div class="card card-alert"><div class="card-kicker">Correspondant Local & Urgences</div><div class="card-title">${escapeExportHtml(c.receptif.name)}</div>${c.receptif.address ? `<p class="muted-sm">${escapeExportHtml(c.receptif.address)}</p>` : ''}${c.receptif.phone ? `<p class="muted-sm">Tél : ${escapeExportHtml(c.receptif.phone)}</p>` : ''}${c.receptif.emergency ? `<p class="muted-sm"><strong>Urgence :</strong> ${escapeExportHtml(c.receptif.emergency)}</p>` : ''}</div>`);
      }
      if (c.guide && c.guide.name) {
        cards.push(`<div class="card"><div class="card-kicker">${escapeExportHtml(c.guide.role || 'Accompagnateur')}</div><div class="card-title">${escapeExportHtml(c.guide.name)}</div>${c.guide.phone ? `<p class="muted-sm">Tél : ${escapeExportHtml(c.guide.phone)}</p>` : ''}</div>`);
      }
      if (c.agence && c.agence.name) {
        cards.push(`<div class="card"><div class="card-kicker">Agence</div><div class="card-title">${escapeExportHtml(c.agence.name)}</div>${c.agence.address ? `<p class="muted-sm">${escapeExportHtml(c.agence.address)}</p>` : ''}${c.agence.phone ? `<p class="muted-sm">Tél : ${escapeExportHtml(c.agence.phone)}</p>` : ''}${c.agence.email ? `<p class="muted-sm">${escapeExportHtml(c.agence.email)}</p>` : ''}</div>`);
      }
      if (c.ambassade && c.ambassade.name) {
        cards.push(`<div class="card"><div class="card-kicker">Ambassade / Consulat</div><div class="card-title">${escapeExportHtml(c.ambassade.name)}</div>${c.ambassade.address ? `<p class="muted-sm">${escapeExportHtml(c.ambassade.address)}</p>` : ''}${c.ambassade.phone ? `<p class="muted-sm">Tél : ${escapeExportHtml(c.ambassade.phone)}</p>` : ''}</div>`);
      }
      if (c.emergency && c.emergency.name) {
        cards.push(`<div class="card card-alert"><div class="card-kicker">Urgences</div><div class="card-title">${escapeExportHtml(c.emergency.name)}</div>${c.emergency.agency ? `<p class="muted-sm">${escapeExportHtml(c.emergency.agency)}</p>` : ''}${c.emergency.phone ? `<p class="muted-sm">Tél : ${escapeExportHtml(c.emergency.phone)}</p>` : ''}</div>`);
      }
    }

    if (!cards.length) return '';
    return `
      <section class="export-section">
        <h2 class="section-title">Contacts Clés & Urgences</h2>
        ${cards.join('')}
      </section>
    `;
  }

  function buildDocumentsSection(ctx) {
    const docs = Array.isArray(ctx.documents) ? ctx.documents : [];
    if (!docs.length) return '';

    const cards = docs.map((d) => {
      const imgData = (d.fileData && /^data:image\//i.test(d.fileData))
        ? d.fileData
        : ((d.url && /^data:image\//i.test(d.url)) ? d.url : '');
      return `
        <div class="card">
          <div class="card-head">
            <div>
              ${d.type ? `<div class="card-kicker">${escapeExportHtml(d.type)}</div>` : ''}
              <div class="card-title">${escapeExportHtml(d.title || d.name || 'Document')}</div>
            </div>
            ${d.reference ? `<span class="code-pill">${escapeExportHtml(d.reference)}</span>` : ''}
          </div>
          ${d.beneficiary ? `<p class="muted-sm">Titulaire : ${escapeExportHtml(d.beneficiary)}</p>` : ''}
          ${d.validity ? `<p class="muted-sm">Validité : ${escapeExportHtml(d.validity)}</p>` : ''}
          ${d.notes ? `<p class="muted-sm">${formatRichText(d.notes)}</p>` : ''}
          ${imgData ? `<div class="doc-thumb"><img src="${escapeExportHtml(imgData)}" alt="${escapeExportHtml(d.title || 'Document')}"></div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <section class="export-section">
        <h2 class="section-title">Mes Documents & Bons d'échange</h2>
        ${cards}
      </section>
    `;
  }

  function buildSouvenirsSection(ctx) {
    const list = Array.isArray(ctx.souvenirs) ? ctx.souvenirs : [];
    if (!list.length) return '';

    const items = list.map((s) => {
      const src = safeExportUrl(s.image);
      return `
        <figure class="souvenir-card">
          ${src ? `<img src="${escapeExportHtml(src)}" alt="${escapeExportHtml(s.title || 'Souvenir')}">` : ''}
          <figcaption>
            <div class="souv-title">${escapeExportHtml(s.title || 'Souvenir')}</div>
            ${s.date ? `<div class="souv-date">${escapeExportHtml(s.date)}</div>` : ''}
          </figcaption>
        </figure>
      `;
    }).join('');

    return `
      <section class="export-section">
        <h2 class="section-title">Mes Photos Souvenirs (${list.length})</h2>
        <div class="souvenirs-export-grid">${items}</div>
      </section>
    `;
  }

  function buildStandaloneCarnetHtml(ctx, options) {
    const opts = options || {};
    const mode = opts.mode === 'print' ? 'print' : 'download';
    const inlinedImages = opts.inlinedImages || {};
    const safeCtx = ctx || {};
    const trip = safeCtx.trip || {};
    const b = trip.branding || {};

    const primaryColor = /^#[0-9a-fA-F]{6}$/.test(b.primaryColor || '') ? b.primaryColor : '#144534';
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(b.accentColor || '') ? b.accentColor : '#c29958';
    const brandName = (b.partnerName && b.partnerName.trim()) ? b.partnerName.trim() : 'Voyages Girardot';
    const brandSub = (b.partnerName && b.partnerName.trim())
      ? (b.hideGirardotBrand ? 'CARNET DE VOYAGE' : 'AVEC VOYAGES GIRARDOT')
      : 'DEPUIS 1920';
    const hideGirardot = !!b.hideGirardotBrand;
    const partnerLogo = resolveImageSrc(b.partnerLogoUrl, inlinedImages);
    const coverImg = resolveImageSrc(trip.coverImage, inlinedImages);
    const exportedAt = safeCtx.exportedAt || new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const logoBlock = partnerLogo
      ? `<img src="${escapeExportHtml(partnerLogo)}" alt="${escapeExportHtml(brandName)}" class="partner-logo-export">`
      : (hideGirardot ? '' : GIRARDOT_INLINE_SVG);

    const toolbarHtml = mode === 'download' ? `
      <div class="export-toolbar no-print">
        <div class="toolbar-meta">Archive hors-ligne autonome • Générée le ${escapeExportHtml(exportedAt)}</div>
        <button type="button" class="toolbar-print-btn" onclick="window.print()">
          ${PRINT_ICON_SVG}
          <span>Imprimer / Enregistrer en PDF</span>
        </button>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carnet de Voyages — ${escapeExportHtml(trip.title || 'Voyages Girardot')}</title>
  <style>
    :root {
      --primary: ${primaryColor};
      --accent: ${accentColor};
      --sand: #fbfaf6;
      --ink: #18221b;
      --muted: #526258;
      --line: #dce3dd;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      background: #f2f4f2;
      line-height: 1.5;
      font-size: 14px;
    }
    .export-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      background: #ffffff;
      border-bottom: 1px solid var(--line);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .toolbar-meta { font-size: 12px; color: var(--muted); font-weight: 600; }
    .toolbar-print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .sheet {
      max-width: 820px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15, 35, 25, 0.08);
      padding: 28px 32px;
    }
    .doc-header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .partner-logo-export { max-height: 36px; max-width: 120px; object-fit: contain; }
    .brand-name { font-size: 18px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: var(--primary); line-height: 1.1; }
    .brand-sub { font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--accent); margin-top: 2px; }
    .doc-kicker {
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--primary);
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }
    .hero-cover {
      background: var(--sand);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 22px;
      break-inside: avoid;
    }
    .hero-cover img { width: 100%; max-height: 240px; object-fit: cover; display: block; }
    .hero-body { padding: 18px 20px; }
    .hero-sub { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 4px; }
    .hero-title { font-size: 26px; font-weight: 800; color: var(--primary); line-height: 1.18; margin-bottom: 6px; }
    .hero-dates { font-size: 13px; font-weight: 700; color: var(--muted); margin-bottom: 10px; }
    .hero-intro { font-size: 13.5px; color: #334155; }
    .export-section { margin-top: 24px; }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--primary);
      border-left: 4px solid var(--accent);
      padding-left: 10px;
      margin-bottom: 12px;
      break-after: avoid;
    }
    .card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    .card-accent { background: var(--sand); border-color: #d9cfa8; }
    .card-alert { background: #fffbeb; border-color: #fde68a; border-left: 4px solid #d97706; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
    .card-kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); }
    .card-title { font-size: 15px; font-weight: 800; color: var(--ink); }
    .code-pill { background: #f1f5f9; color: var(--primary); font-family: monospace; font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 6px; }
    .kv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 8px; }
    .kv-box { background: #ffffff; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
    .kv-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--muted); }
    .kv-val { font-size: 13px; font-weight: 700; color: var(--ink); }
    .welcome-quote { font-style: italic; color: #334155; background: #ffffff; border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
    .sub-block { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
    .sub-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 4px; }
    .clean-list { padding-left: 18px; font-size: 13px; }
    .flight-route { font-size: 13.5px; margin: 4px 0; }
    .muted { color: var(--muted); }
    .muted-sm { font-size: 13px; color: #334155; }
    .muted-xs { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .meta-link { font-size: 12.5px; margin-top: 6px; word-break: break-all; }
    .day-block { border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; background: #ffffff; }
    .day-header { margin-bottom: 10px; break-after: avoid; }
    .day-header-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 5px; }
    .day-pill { background: var(--primary); color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
    .day-date, .day-city { font-size: 12px; font-weight: 700; color: var(--muted); }
    .day-title { font-size: 16.5px; font-weight: 800; color: var(--ink); }
    .day-highlight { font-size: 12.5px; font-weight: 700; color: var(--accent); margin-top: 2px; }
    .day-photo { margin: 10px 0; border-radius: 10px; overflow: hidden; break-inside: avoid; }
    .day-photo img { width: 100%; max-height: 200px; object-fit: cover; display: block; }
    .day-desc { font-size: 13.5px; color: #334155; margin-bottom: 10px; }
    .timeline-list { border-top: 1px solid var(--line); padding-top: 10px; }
    .timeline-step { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px dotted #e5e9e6; break-inside: avoid; }
    .timeline-step:last-child { border-bottom: none; }
    .step-time { width: 58px; flex-shrink: 0; font-size: 12px; font-weight: 800; color: var(--primary); }
    .step-body { flex: 1; min-width: 0; }
    .step-title { font-size: 13.5px; font-weight: 800; color: var(--ink); }
    .step-sub { font-size: 12.8px; color: #334155; margin-top: 2px; }
    .day-options { margin-top: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; break-inside: avoid; }
    .day-opt-item { font-size: 12.5px; color: #78350f; margin-top: 2px; }
    .stay-pres p { font-size: 12.8px; color: #334155; margin-bottom: 5px; }
    .freetime-item { padding: 8px 0; border-bottom: 1px solid #eef2ef; break-inside: avoid; }
    .freetime-item:last-child { border-bottom: none; }
    .tag-pill { background: #eef7f2; color: var(--primary); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px; margin-left: 4px; }
    .doc-thumb { margin-top: 8px; }
    .doc-thumb img { max-width: 240px; max-height: 160px; border-radius: 8px; border: 1px solid var(--line); }
    .souvenirs-export-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .souvenir-card { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #ffffff; break-inside: avoid; }
    .souvenir-card img { width: 100%; height: 170px; object-fit: cover; display: block; }
    .souvenir-card figcaption { padding: 8px 10px; }
    .souv-title { font-size: 12.5px; font-weight: 700; color: var(--ink); }
    .souv-date { font-size: 11px; color: var(--muted); }
    .doc-footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      text-align: center;
      font-size: 11.5px;
      color: var(--muted);
    }
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    @media print {
      body { background: #ffffff; font-size: 11.5pt; }
      .no-print { display: none !important; }
      .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; border-radius: 0; }
      a { color: inherit; text-decoration: none; }
    }
    @media (max-width: 600px) {
      .sheet { margin: 0; border-radius: 0; padding: 18px 16px; }
      .souvenirs-export-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${toolbarHtml}
  <main class="sheet">
    <header class="doc-header">
      <div class="brand-row">
        ${logoBlock}
        <div>
          <div class="brand-name">${escapeExportHtml(brandName)}</div>
          <div class="brand-sub">${escapeExportHtml(brandSub)}</div>
        </div>
      </div>
      <div class="doc-kicker">Carnet de Voyages</div>
    </header>

    <section class="hero-cover">
      ${coverImg ? `<img src="${escapeExportHtml(coverImg)}" alt="${escapeExportHtml(trip.title || 'Destination')}" onerror="this.style.display='none'">` : ''}
      <div class="hero-body">
        ${trip.subtitle ? `<div class="hero-sub">${escapeExportHtml(trip.subtitle)}</div>` : ''}
        <h1 class="hero-title">${escapeExportHtml(trip.title || 'Votre Voyage')}</h1>
        ${trip.dates ? `<div class="hero-dates">${escapeExportHtml(trip.dates)}</div>` : ''}
        ${trip.intro ? `<p class="hero-intro">${formatRichText(trip.intro)}</p>` : ''}
      </div>
    </section>

    ${buildTravelerSection(safeCtx)}
    ${buildAlertSection(trip)}
    ${buildFlightsAndBaggageSection(trip)}
    ${buildItinerarySection(safeCtx, inlinedImages)}
    ${buildHotelsSection(trip)}
    ${buildFreeTimeSection(trip)}
    ${buildPracticalSection(trip)}
    ${buildContactsSection(trip)}
    ${buildDocumentsSection(safeCtx)}
    ${buildSouvenirsSection(safeCtx)}

    <footer class="doc-footer">
      ${escapeExportHtml(brandName)} • Document généré le ${escapeExportHtml(exportedAt)}
    </footer>
  </main>
</body>
</html>`;
  }

  function printClientCarnet() {
    const ctx = collectClientCarnetContext();
    if (!ctx.trip) {
      if (typeof showDiscreetSyncToast === 'function') {
        showDiscreetSyncToast('Aucun carnet chargé à imprimer.');
      }
      return;
    }

    const html = buildStandaloneCarnetHtml(ctx, { mode: 'print' });
    const iframe = document.createElement('iframe');
    iframe.title = "Aperçu d'impression du carnet de voyages";
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed; left:-9999px; top:0; width:0; height:0; border:0; opacity:0; pointer-events:none;';

    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (_) {}
    };

    iframe.onload = () => {
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) throw new Error('Print window unavailable');
          win.addEventListener('afterprint', cleanup, { once: true });
          win.focus();
          win.print();
          setTimeout(cleanup, 60000);
        } catch (err) {
          cleanup();
          const popup = root.open ? root.open('', '_blank') : null;
          if (popup) {
            popup.document.open();
            popup.document.write(html);
            popup.document.close();
            setTimeout(() => { try { popup.focus(); popup.print(); } catch (_) {} }, 250);
          } else if (typeof showDiscreetSyncToast === 'function') {
            showDiscreetSyncToast("Impossible d'ouvrir la boîte d'impression.");
          }
        }
      }, 150);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  }

  async function downloadClientCarnet() {
    const ctx = collectClientCarnetContext();
    if (!ctx.trip) {
      if (typeof showDiscreetSyncToast === 'function') {
        showDiscreetSyncToast('Aucun carnet chargé à télécharger.');
      }
      return;
    }

    const inlinedImages = await collectInlinedImages(ctx);
    const html = buildStandaloneCarnetHtml(ctx, { mode: 'download', inlinedImages });
    const filename = `Carnet-Voyage-${slugifyFilename(ctx.trip.title || ctx.trip.id)}.html`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);

    if (typeof showDiscreetSyncToast === 'function') {
      showDiscreetSyncToast(`Carnet téléchargé (${filename})`);
    }
  }

  const api = {
    GIRARDOT_INLINE_SVG,
    escapeExportHtml,
    safeExportUrl,
    slugifyFilename,
    collectClientCarnetContext,
    buildStandaloneCarnetHtml,
    printClientCarnet,
    downloadClientCarnet
  };

  root.GirardotCarnetExport = api;
  root.printClientCarnet = printClientCarnet;
  root.downloadClientCarnet = downloadClientCarnet;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
