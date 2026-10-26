// =============================================================================
// CRUISE FLEET REPOSITORY & INTELLIGENT DECK TEMPLATES
// Partenaires : Costa Croisières, MSC Croisières, CroisiEurope (Fluvial),
// Ponant (Yachts & Expédition), Grands Espaces (Expédition Polaire), Voyages d'Exception
// =============================================================================

(function(global) {

  // ---------------------------------------------------------------------------
  // 1. DÉTECTION DE LA COMPAGNIE & DU TYPE DE NAVIRE
  // ---------------------------------------------------------------------------
  function detectCruiseLineAndShip(shipName = "", rawText = "") {
    const combined = `${shipName} ${rawText}`.toLowerCase();

    // 1. COSTA CROISIÈRES
    if (combined.includes('costa') || combined.includes('smeralda') || combined.includes('diadema') || combined.includes('toscana') || combined.includes('fascinosa') || combined.includes('deliziosa') || combined.includes('favolosa') || combined.includes('pacifica') || combined.includes('fortuna')) {
      let specificShip = "Costa Croisières";
      if (combined.includes('diadema')) specificShip = "Costa Diadema";
      else if (combined.includes('smeralda')) specificShip = "Costa Smeralda";
      else if (combined.includes('toscana')) specificShip = "Costa Toscana";
      else if (combined.includes('fascinosa')) specificShip = "Costa Fascinosa";
      else if (combined.includes('deliziosa')) specificShip = "Costa Deliziosa";
      else if (combined.includes('favolosa')) specificShip = "Costa Favolosa";
      else if (combined.includes('pacifica')) specificShip = "Costa Pacifica";
      else if (combined.includes('fortuna')) specificShip = "Costa Fortuna";
      else if (shipName.trim()) specificShip = shipName.trim();

      return {
        line: 'costa',
        companyName: 'Costa Croisières',
        shipName: specificShip,
        category: 'maritime_geant',
        isRiver: false,
        isPolar: false
      };
    }

    // 2. MSC CROISIÈRES
    if (combined.includes('msc') || combined.includes('world europa') || combined.includes('euribia') || combined.includes('grandiosa') || combined.includes('meraviglia') || combined.includes('bellissima') || combined.includes('virtuosa') || combined.includes('seaside') || combined.includes('seaview') || combined.includes('seashore') || combined.includes('seascape') || combined.includes('fantasia') || combined.includes('splendida') || combined.includes('divina') || combined.includes('preziosa') || combined.includes('poesia') || combined.includes('orchestra') || combined.includes('musica') || combined.includes('magnifica') || combined.includes('sinfonia') || combined.includes('armonia') || combined.includes('opera') || combined.includes('lirica')) {
      let specificShip = "MSC Croisières";
      if (combined.includes('world europa')) specificShip = "MSC World Europa";
      else if (combined.includes('euribia')) specificShip = "MSC Euribia";
      else if (combined.includes('grandiosa')) specificShip = "MSC Grandiosa";
      else if (combined.includes('meraviglia')) specificShip = "MSC Meraviglia";
      else if (combined.includes('bellissima')) specificShip = "MSC Bellissima";
      else if (combined.includes('virtuosa')) specificShip = "MSC Virtuosa";
      else if (combined.includes('seaside')) specificShip = "MSC Seaside";
      else if (combined.includes('seaview')) specificShip = "MSC Seaview";
      else if (combined.includes('seashore')) specificShip = "MSC Seashore";
      else if (combined.includes('seascape')) specificShip = "MSC Seascape";
      else if (combined.includes('fantasia')) specificShip = "MSC Fantasia";
      else if (combined.includes('splendida')) specificShip = "MSC Splendida";
      else if (combined.includes('divina')) specificShip = "MSC Divina";
      else if (combined.includes('preziosa')) specificShip = "MSC Preziosa";
      else if (shipName.trim()) specificShip = shipName.trim();

      return {
        line: 'msc',
        companyName: 'MSC Croisières',
        shipName: specificShip,
        category: 'maritime_geant',
        isRiver: false,
        isPolar: false
      };
    }

    // 3. PONANT (YACHTS DE LUXE & EXPÉDITION)
    if (combined.includes('ponant') || combined.includes('le boréal') || combined.includes('le boreal') || combined.includes("l'austral") || combined.includes('le soléal') || combined.includes('le soleal') || combined.includes('le lyrial') || combined.includes('commandant charcot') || combined.includes('le lapérouse') || combined.includes('le laperouse') || combined.includes('le champlain') || combined.includes('le bougainville') || combined.includes("le dumont-d'urville") || combined.includes('le bellot') || combined.includes('le jacques cartier')) {
      let specificShip = "Ponant";
      if (combined.includes('commandant charcot')) specificShip = "Le Commandant Charcot";
      else if (combined.includes('boréal') || combined.includes('boreal')) specificShip = "Le Boréal";
      else if (combined.includes('austral')) specificShip = "L'Austral";
      else if (combined.includes('soléal') || combined.includes('soleal')) specificShip = "Le Soléal";
      else if (combined.includes('lyrial')) specificShip = "Le Lyrial";
      else if (combined.includes('champlain')) specificShip = "Le Champlain";
      else if (combined.includes('lapérouse') || combined.includes('laperouse')) specificShip = "Le Lapérouse";
      else if (combined.includes('bougainville')) specificShip = "Le Bougainville";
      else if (combined.includes("dumont-d'urville")) specificShip = "Le Dumont-d'Urville";
      else if (combined.includes('bellot')) specificShip = "Le Bellot";
      else if (combined.includes('jacques cartier')) specificShip = "Le Jacques Cartier";
      else if (shipName.trim()) specificShip = shipName.trim();

      return {
        line: 'ponant',
        companyName: 'Ponant (Yachts & Expédition)',
        shipName: specificShip,
        category: 'yacht_luxe',
        isRiver: false,
        isPolar: combined.includes('charcot') || combined.includes('arctique') || combined.includes('antarctique') || combined.includes('spitzberg') || combined.includes('groenland')
      };
    }

    // 4. GRANDS ESPACES (EXPÉDITIONS POLAIRES)
    if (combined.includes('grands espaces') || combined.includes('polarfront') || combined.includes('nanook') || combined.includes('ocean nova') || combined.includes('plancius') || combined.includes('ortelius') || combined.includes('hondius') || combined.includes('rembrandt van rijn')) {
      let specificShip = "Grands Espaces";
      if (combined.includes('polarfront')) specificShip = "Le Polarfront";
      else if (combined.includes('nanook')) specificShip = "Le Nanook";
      else if (combined.includes('ocean nova')) specificShip = "L'Ocean Nova";
      else if (combined.includes('plancius')) specificShip = "Le Plancius";
      else if (combined.includes('ortelius')) specificShip = "L'Ortelius";
      else if (combined.includes('hondius')) specificShip = "L'Hondius";
      else if (shipName.trim()) specificShip = shipName.trim();

      return {
        line: 'grands_espaces',
        companyName: 'Grands Espaces (Expéditions Polaires)',
        shipName: specificShip,
        category: 'expedition_polaire',
        isRiver: false,
        isPolar: true
      };
    }

    // 5. CROISIEUROPE & CROISIÈRES FLUVIALES (RHIN, DANUBE, RHÔNE, SEINE, DOURO...)
    if (combined.includes('croisieurope') || combined.includes('fluviale') || combined.includes('fluvial') || combined.includes('péniche') || combined.includes('fleuve') || combined.includes('rhin') || combined.includes('danube') || combined.includes('rhône') || combined.includes('rhone') || combined.includes('seine') || combined.includes('douro') || combined.includes('elbe') || combined.includes('mékong') || combined.includes('mekong') || /\bms\s+[a-zà-ÿ]+/i.test(combined)) {
      let specificShip = "CroisiEurope";
      const msMatch = combined.match(/\b(ms\s+[A-ZÀ-Ýa-zà-ÿ\s'-]{3,22})\b/i);
      if (msMatch) specificShip = msMatch[1].trim();
      else if (shipName.trim()) specificShip = shipName.trim();

      return {
        line: 'croisieurope',
        companyName: 'CroisiEurope',
        shipName: specificShip,
        category: 'fluvial',
        isRiver: true,
        isPolar: false
      };
    }

    // 6. VOYAGES D'EXCEPTION
    if (combined.includes("voyages d'exception") || combined.includes('voyages d exception')) {
      const isFluvial = combined.includes('fleuve') || combined.includes('danube') || combined.includes('rhin') || combined.includes('douro') || combined.includes('volga');
      return {
        line: 'voyages_exception',
        companyName: "Voyages d'Exception",
        shipName: shipName.trim() || "Navire Voyages d'Exception",
        category: isFluvial ? 'fluvial' : 'yacht_luxe',
        isRiver: isFluvial,
        isPolar: false
      };
    }

    // DÉFAUT MARITIME
    return {
      line: 'general',
      companyName: 'Croisière Maritime',
      shipName: shipName.trim() || 'Navire de Croisière',
      category: 'maritime_geant',
      isRiver: false,
      isPolar: false
    };
  }

  // ---------------------------------------------------------------------------
  // 2. PROFILS DE PONTS (DECK PLANS)
  // ---------------------------------------------------------------------------

  // Profil A : CroisiEurope (Bateau Fluvial 3 Ponts)
  const CROISIEUROPE_DECKS = [
    {
      deck: 1,
      name: "Pont Principal",
      category: "Cabines & Calme",
      description: "Cabines passagers confortables avec grandes fenêtres hautes, coursives calmes, accès facile vers les ponts supérieurs.",
      highlights: [
        { name: "Cabines Pont Principal", zone: "Coursives Bâbord & Tribord", side: "Centre", icon: "bed", color: "#0284c7", desc: "Cabines extérieures avec fenêtres offrant une vue apaisante au ras de l'eau." },
        { name: "Point de rassemblement & Gilet de sauvetage", zone: "Cabines", side: "Centre", icon: "life-ring", color: "#ea580c", desc: "Équipements de sécurité individuels en penderie de cabine." }
      ]
    },
    {
      deck: 2,
      name: "Pont Supérieur",
      category: "Cœur de Vie & Restauration",
      description: "Restaurant Panoramique (Arrière), Réception & Accueil 24h, Boutique de bord, Grand Salon-Bar Panoramique avec piste de danse et terrasse (Avant), Passerelle d'embarquement.",
      highlights: [
        { name: "Restaurant Panoramique", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Cuisine française raffinée servie en un seul service, grandes baies vitrées sur les berges." },
        { name: "Réception & Capitainerie", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Accueil permanent en français, coffre-fort, remise des clés et informations d'escale." },
        { name: "Grand Salon-Bar Panoramique & Piste de danse", zone: "Proue (Avant)", side: "Centre", icon: "martini-glass", color: "#9333ea", desc: "Cocktails, jeux apéritifs, conférences de l'accompagnatrice et soirées dansantes." },
        { name: "Boutique CroisiEurope", zone: "Centre", side: "Tribord", icon: "bag-shopping", color: "#d97706", desc: "Produits régionaux, cartes postales, souvenirs nautiques et prêt-à-porter." },
        { name: "Passerelle de Débarquement Escale", zone: "Centre", side: "Bâbord / Tribord", icon: "door-open", color: "#0891b2", desc: "Accès direct au quai à pied, au cœur même des centres historiques visités." }
      ]
    },
    {
      deck: 3,
      name: "Pont Soleil",
      category: "Plein Air & Panorama 360°",
      description: "Grande terrasse panoramique plein air avec transats, chaises longues, piste de marche / gym matinale, Timonerie de navigation.",
      highlights: [
        { name: "Terrasse Panoramique 360° & Solarium", zone: "Plein Air", side: "Centre", icon: "sun", color: "#f59e0b", desc: "Transats et fauteuils confortables pour admirer les châteaux, vignobles et paysages." },
        { name: "Piste de Gym Matinale & Promenade", zone: "Pourtour", side: "Pourtour", icon: "person-walking", color: "#10b981", desc: "Piste de marche en plein air pour garder la forme au fil de l'eau." },
        { name: "Timonerie & Poste de Pilotage", zone: "Proue (Avant)", side: "Centre", icon: "compass", color: "#3b82f6", desc: "Poste de commandement du Commandant de bord (rabattable lors des passages sous ponts bas)." }
      ]
    }
  ];

  // Profil B : Ponant (Yacht de Luxe & Expédition 5 Ponts)
  const PONANT_DECKS = [
    {
      deck: 3,
      name: "Pont 3 - Passerelle & Marina",
      category: "Gastronomie, Accueil & Zodiacs",
      description: "Restaurant Gastronomique principal (table d'exception), Réception & Bureau Expéditions, Centre Médical de bord, Marina & Plateforme d'embarquement Zodiacs.",
      highlights: [
        { name: "Restaurant Gastronomique", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Haute gastronomie française avec carte signée Ducasse Conseil et cave de grands crus." },
        { name: "Réception & Bureau des Relations Passagers", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Accueil permanent francophone, conciergerie 24h et suivi personnalisé." },
        { name: "Centre Médical & Médecin Urgentiste", zone: "Proue (Avant)", side: "Bâbord", icon: "shield-heart", color: "#2563eb", desc: "Consultations médicales, soins d'urgence et médicaments de bord 24h/24." },
        { name: "Marina & Embarquement Flotte Zodiacs", zone: "Poupe (Arrière)", side: "Centre", icon: "anchor", color: "#0891b2", desc: "Plateforme d'accès direct sur la mer pour les sorties d'exploration en Zodiacs." }
      ]
    },
    {
      deck: 4,
      name: "Pont 4 - Salons & Culture",
      category: "Grand Salon & Théâtre",
      description: "Grand Salon panoramique avec piano bar et terrasse extérieure, Théâtre / Auditorium de conférences, Boutique de prestige.",
      highlights: [
        { name: "Grand Salon & Piano Bar", zone: "Poupe (Arrière)", side: "Centre", icon: "music", color: "#9333ea", desc: "Cocktails signatures, ambiance musicale live et thés gourmands l'après-midi." },
        { name: "Théâtre & Auditorium de Conférences", zone: "Proue (Avant)", side: "Centre", icon: "masks-theater", color: "#7c3aed", desc: "Exposés naturalistes des chefs d'expédition, projections et soirées spectacles." },
        { name: "Boutique de Prestige Ponant", zone: "Centre", side: "Tribord", icon: "bag-shopping", color: "#d97706", desc: "Maroquinerie de luxe, horlogerie, vêtements techniques d'expédition et bijoux." }
      ]
    },
    {
      deck: 5,
      name: "Pont 5 - Passerelle de Commandement",
      category: "Cabines & Passerelle",
      description: "Passerelle de commandement des Officiers, Cabines Privilège et Suites Prestige avec balcon.",
      highlights: [
        { name: "Passerelle de Navigation (Commandement)", zone: "Proue (Avant)", side: "Centre", icon: "compass", color: "#1d4ed8", desc: "Poste de pilotage haute technologie du Capitaine et de ses officiers." },
        { name: "Suites & Cabines Prestige", zone: "Poupe & Centre", side: "Bâbord & Tribord", icon: "bed", color: "#0284c7", desc: "Cabines spacieuses avec baie vitrée coulissante et balcon privatif sur l'océan." }
      ]
    },
    {
      deck: 6,
      name: "Pont 6 - Observatoire & Spa",
      category: "Observation & Bien-être",
      description: "Salon Observatoire Panoramique 180° avec jumelles et bibliothèque, Restaurant Grill extérieur, Spa Ponant & Fitness.",
      highlights: [
        { name: "Salon Observatoire Panoramique", zone: "Proue (Avant)", side: "Centre", icon: "binoculars", color: "#0891b2", desc: "Vue spectaculaire à 180° sur les glaces ou côtes, bibliothèque et télescopes." },
        { name: "Restaurant Grill en Plein Air", zone: "Poupe (Arrière)", side: "Centre", icon: "fire-burner", color: "#ea580c", desc: "Déjeuners au grand air et dîners sous les étoiles dans une ambiance décontractée." },
        { name: "Spa Ponant & Salle de Fitness", zone: "Centre", side: "Bâbord", icon: "spa", color: "#059669", desc: "Soins visage et corps, hammam avec vue mer et appareils de cardio-training." }
      ]
    },
    {
      deck: 7,
      name: "Pont 7 - Solarium & Piscine",
      category: "Détente Supérieure",
      description: "Piscine extérieure chauffée, Bar de pont Solarium, transats en teck et vue imprenable à 360°.",
      highlights: [
        { name: "Piscine Extérieure Chauffée", zone: "Poupe (Arrière)", side: "Centre", icon: "water-ladder", color: "#0284c7", desc: "Baignade revigorante en eau douce chauffée même dans les régions fraîches." },
        { name: "Bar Solarium Plein Air", zone: "Poupe (Arrière)", side: "Tribord", icon: "martini-glass-citrus", color: "#f59e0b", desc: "Rafraîchissements, jus frais et coupe de champagne face à l'horizon marin." }
      ]
    }
  ];

  // Profil C : Grands Espaces (Expédition Polaire 5 Ponts)
  const GRANDS_ESPACES_DECKS = [
    {
      deck: 1,
      name: "Pont 1 - Zone Logistique",
      category: "Technique & Sécurité",
      description: "Stockage du matériel d'expédition polaire, moteurs et cales sécurisées.",
      highlights: [
        { name: "Cale à Équipements Expédition", zone: "Centre", side: "Centre", icon: "gears", color: "#64748b", desc: "Matériel lourd d'expédition, hydrophones et sondes scientifiques." }
      ]
    },
    {
      deck: 2,
      name: "Pont 2 - Expédition & Mudroom",
      category: "Préparation Débarquements",
      description: "Vestiaire 'Mudroom' (bottes thermiques, parkas), Porte de coupée & Embarquement Zodiacs, Infirmerie Polaire.",
      highlights: [
        { name: "Vestiaire 'Mudroom' & Casiers Bottes", zone: "Centre / Poupe", side: "Centre", icon: "socks", color: "#0284c7", desc: "Espace chauffé pour enfiler et sécher vos bottes polaires Muck Boots fournies et vos parkas." },
        { name: "Embarquement Zodiacs d'Expédition", zone: "Poupe (Arrière)", side: "Bâbord & Tribord", icon: "anchor", color: "#0891b2", desc: "Plateforme basse d'embarquement rapide et sécurisée pour les safaris parmi les icebergs." },
        { name: "Infirmerie Polaire & Médecin d'Expédition", zone: "Centre", side: "Bâbord", icon: "shield-heart", color: "#dc2626", desc: "Cabinet médical équipé pour le grand froid, mal de mer et urgences polaires." }
      ]
    },
    {
      deck: 3,
      name: "Pont 3 - Salle à Manger & Accueil",
      category: "Convivialité & Cabines",
      description: "Salle à manger chaleureuse du bord (repas partagés avec les guides-naturalistes), Réception & Bibliothèque polaire.",
      highlights: [
        { name: "Salle à Manger Polaire", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Cuisine revigorante et copieuse, ambiance chaleureuse et tablées conviviales d'explorateurs." },
        { name: "Réception & Tableau des Débarquements", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Programme météo, cartes de glaces et horaires des sorties Zodiacs mis à jour en temps réel." },
        { name: "Bibliothèque Naturaliste Polaire", zone: "Centre", side: "Tribord", icon: "book-open", color: "#b45309", desc: "Ouvrages de référence sur la faune arctique/antarctique, récits de Charcot et Nansen." }
      ]
    },
    {
      deck: 4,
      name: "Pont 4 - Observation & Conférences",
      category: "Sciences & Panorama",
      description: "Grand Salon d'Observation Panoramique avec thés/cafés 24h, Salle de Conférences scientifiques, Ponts extérieurs d'observation de la faune.",
      highlights: [
        { name: "Salon d'Observation Panoramique", zone: "Proue (Avant)", side: "Centre", icon: "binoculars", color: "#0891b2", desc: "Grandes baies vitrées pour guetter les ours polaires, morses, baleines et oiseaux marins." },
        { name: "Salle de Conférences & Projections", zone: "Centre", side: "Centre", icon: "chalkboard-user", color: "#7c3aed", desc: "Exposés quotidiens passionnants par les glaciologues, biologistes et historiens de bord." },
        { name: "Station Boissons Chaudes Permanente 24h", zone: "Centre", side: "Bâbord", icon: "mug-hot", color: "#b45309", desc: "Café, thé, chocolat chaud et biscuits offerts à discrétion à tout moment du jour et de la nuit." }
      ]
    },
    {
      deck: 5,
      name: "Pont 5 - Passerelle Ouverte (Open Bridge)",
      category: "Commandement & Faune 360°",
      description: "Passerelle de commandement 'Open Bridge' ouverte aux passagers 24h/24, Pont supérieur d'observation météo et glaces.",
      highlights: [
        { name: "Passerelle Ouverte 24h/24 (Open Bridge)", zone: "Proue (Avant)", side: "Centre", icon: "compass", color: "#1d4ed8", desc: "Accès libre pour échanger avec le Capitaine, observer les radars et le cheminement dans la banquise." },
        { name: "Pont Extérieur d'Observation Faune 360°", zone: "Plein Air", side: "Pourtour", icon: "eye", color: "#10b981", desc: "Plateforme élevée idéale pour la photographie animalière et l'observation des aurores boréales." }
      ]
    }
  ];

  // Profil D : MSC Croisières (Grand Paquebot Maritime 18 Ponts)
  const MSC_GENERIC_DECKS = [
    {
      deck: 4,
      name: "Pont 4",
      category: "Santé & Débarquement",
      description: "Centre Médical & Infirmerie (Avant), Passerelle d'accès à quai en escale.",
      highlights: [
        { name: "Centre Médical & Hôpital de Bord", zone: "Proue (Avant)", side: "Bâbord", icon: "shield-heart", color: "#2563eb", desc: "Consultations, urgences, pharmacie et médecin 24h/24." },
        { name: "Passerelle de Débarquement Escale", zone: "Centre / Poupe", side: "Bâbord & Tribord", icon: "door-open", color: "#0891b2", desc: "Sortie piétonne pour les excursions à terre." }
      ]
    },
    {
      deck: 5,
      name: "Pont 5",
      category: "Accueil & Atrium",
      description: "Atrium central monumental avec escaliers en cristal Swarovski, Réception & Guest Service 24h, Infinity Bar, Restaurant Principal.",
      highlights: [
        { name: "Réception Principale & Guest Service 24h/24", zone: "Centre", side: "Centre", icon: "bell-concierge", color: "#059669", desc: "Accueil permanent en français, questions pratiques et gestion de carte de bord." },
        { name: "Escaliers en Cristal Swarovski", zone: "Centre", side: "Bâbord & Tribord", icon: "gem", color: "#38bdf8", desc: "Escaliers iconiques étincelants pour vos photos souvenirs de gala." },
        { name: "Infinity Bar (Atrium)", zone: "Centre", side: "Centre", icon: "martini-glass", color: "#9333ea", desc: "Bar lounge musical au cœur de l'animation de l'Atrium." },
        { name: "Restaurant Principal (Niveau 1)", zone: "Poupe (Arrière)", side: "Centre", icon: "utensils", color: "#e11d48", desc: "Dîners servis à table inclus, saveurs méditerranéennes renouvelées chaque soir." }
      ]
    },
    {
      deck: 6,
      name: "Pont 6",
      category: "Promenade Intérieure & Boutiques",
      description: "Galleria Promenade avec dôme LED géant spectaculaire, Grand Théâtre Broadway (Avant), Restaurants de spécialités, Boutiques Duty Free.",
      highlights: [
        { name: "Promenade Intérieure & Dôme LED", zone: "Centre", side: "Centre", icon: "film", color: "#f59e0b", desc: "Spectacle visuel permanent sur un plafond d'écrans LED de 90m de long." },
        { name: "Grand Théâtre de style Broadway", zone: "Proue (Avant)", side: "Centre", icon: "masks-theater", color: "#7c3aed", desc: "Grandioses spectacles musicaux, chanteurs, acrobates et danseurs chaque soir." },
        { name: "Boutiques Tax-Free & Mode Italienne", zone: "Centre", side: "Bâbord & Tribord", icon: "bag-shopping", color: "#d97706", desc: "Parfumerie détaxée, maroquinerie, montres et chocolaterie Jean-Philippe Maury." },
        { name: "Bornes d'Enregistrement Cruise Card", zone: "Centre", side: "Tribord", icon: "credit-card", color: "#2563eb", desc: "Bornes automatiques pour lier votre carte bancaire dès le premier jour." }
      ]
    },
    {
      deck: 7,
      name: "Pont 7",
      category: "Pubs, Salons & Gastronomie",
      description: "Masters of the Sea (Pub anglais authentique), Champagne Bar, Steakhouse Butcher's Cut, Kaito Sushi Bar, Casino MSC.",
      highlights: [
        { name: "Pub Anglais Masters of the Sea", zone: "Centre", side: "Bâbord", icon: "beer-mug-empty", color: "#b45309", desc: "Bières artisanales brassées à bord, retransmissions sportives et musique live." },
        { name: "Steakhouse Butcher's Cut", zone: "Poupe (Arrière)", side: "Tribord", icon: "drumstick-bite", color: "#dc2626", desc: "Viandes maturées d'exception et grillades au feu de bois." },
        { name: "Champagne Bar & Bar à Huîtres", zone: "Centre", side: "Centre", icon: "champagne-glasses", color: "#f59e0b", desc: "Dégustation de champagnes de prestige et fruits de mer frais." }
      ]
    },
    {
      deck: 15,
      name: "Pont 15",
      category: "Piscines & Buffet Géant",
      description: "Grand Buffet Marketplace (ouvert 20h/24), Piscine Principale extérieure avec écrans géants, Bain à remous, Bar Lido.",
      highlights: [
        { name: "Grand Buffet Marketplace", zone: "Poupe (Arrière)", side: "Centre", icon: "bowl-food", color: "#e11d48", desc: "Buffet géant avec cuisine ouverte, pizzas artisanales faites minute, coin desserts." },
        { name: "Piscine Principale & Solarium Lido", zone: "Centre", side: "Centre", icon: "water-ladder", color: "#0284c7", desc: "Bassin central en plein air, transats, animations et cours de danse." },
        { name: "Bar Gelateria & Glaces Italiennes", zone: "Centre", side: "Bâbord", icon: "ice-cream", color: "#f59e0b", desc: "Véritables glaces italiennes artisanales et crêpes fraîches." }
      ]
    },
    {
      deck: 16,
      name: "Pont 16",
      category: "Bien-être & Sport",
      description: "MSC Aurea Spa (thermes balinais, sauna, hammam), Salle de Sport panoramique Technogym, Piste de marche extérieure.",
      highlights: [
        { name: "MSC Aurea Spa & Espace Balinais", zone: "Proue (Avant)", side: "Centre", icon: "spa", color: "#059669", desc: "Bains thermaux, salle de sel, massages balinais et soins de bien-être relaxants." },
        { name: "Salle de Sport Panoramique Technogym", zone: "Proue (Avant)", side: "Tribord", icon: "dumbbell", color: "#2563eb", desc: "Équipements cardio et musculation haut de gamme avec vue plongeante sur la mer." },
        { name: "Piste de Jogging Plein Air", zone: "Pourtour", side: "Pourtour", icon: "person-running", color: "#10b981", desc: "Piste de course et de marche rapide faisant le tour du navire." }
      ]
    },
    {
      deck: 18,
      name: "Pont 18",
      category: "Parc Aquatique & Sensations",
      description: "Aqua Park avec toboggans géants, passerelle suspendue, Top Solarium réservé aux adultes.",
      highlights: [
        { name: "Aqua Park & Toboggans Aquatiques", zone: "Poupe (Arrière)", side: "Centre", icon: "water", color: "#0891b2", desc: "Toboggans à sensations, jeux d'eau pour toute la famille." },
        { name: "Top 18 Exclusive Solarium", zone: "Proue (Avant)", side: "Centre", icon: "umbrella-beach", color: "#ea580c", desc: "Espace solarium calme et réservé avec lits balinais et service au transat." }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 3. FONCTIONS D'ACCÈS AUX PONTS
  // ---------------------------------------------------------------------------
  function getCruiseShipDecks(shipName = "", rawText = "") {
    const info = detectCruiseLineAndShip(shipName, rawText);

    if (info.line === 'costa') {
      const s = (shipName || "").toLowerCase();
      if (s.includes('diadema') && typeof COSTA_DIADEMA_DECKS !== 'undefined') return COSTA_DIADEMA_DECKS;
      if ((s.includes('smeralda') || s.includes('toscana')) && typeof COSTA_SMERALDA_DECKS !== 'undefined') return COSTA_SMERALDA_DECKS;
      if (typeof COSTA_DIADEMA_DECKS !== 'undefined') return COSTA_DIADEMA_DECKS;
      return MSC_GENERIC_DECKS;
    }

    if (info.line === 'croisieurope' || info.isRiver) {
      return CROISIEUROPE_DECKS;
    }

    if (info.line === 'ponant') {
      return PONANT_DECKS;
    }

    if (info.line === 'grands_espaces') {
      return GRANDS_ESPACES_DECKS;
    }

    if (info.line === 'msc') {
      return MSC_GENERIC_DECKS;
    }

    if (info.line === 'voyages_exception') {
      return info.isRiver ? CROISIEUROPE_DECKS : PONANT_DECKS;
    }

    if (typeof COSTA_DIADEMA_DECKS !== 'undefined') return COSTA_DIADEMA_DECKS;
    return MSC_GENERIC_DECKS;
  }

  // ---------------------------------------------------------------------------
  // 4. LIEUX CLÉS & WAYFINDING DU NAVIRE (POINTS D'INTÉRÊT)
  // ---------------------------------------------------------------------------
  function getCruiseKeyLocations(shipName = "", rawText = "") {
    const info = detectCruiseLineAndShip(shipName, rawText);

    if (info.line === 'costa') {
      const s = (shipName || "").toLowerCase();
      if (s.includes('diadema') && typeof COSTA_DIADEMA_KEY_LOCATIONS !== 'undefined') return COSTA_DIADEMA_KEY_LOCATIONS;
      if (typeof COSTA_SMERALDA_KEY_LOCATIONS !== 'undefined') return COSTA_SMERALDA_KEY_LOCATIONS;
    }

    if (info.line === 'croisieurope' || info.isRiver) {
      return [
        { id: 'resto_fluvial', name: 'Restaurant Panoramique', deck: 2, deckName: 'Pont Supérieur', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Escalier Central', icon: 'utensils', iconEmoji: '🍽️', color: '#e11d48' },
        { id: 'reception_fluvial', name: 'Réception & Capitainerie', deck: 2, deckName: 'Pont Supérieur', side: 'Centre', zone: 'Milieu / Centre', elevator: 'Accès Direct', icon: 'bell-concierge', iconEmoji: '🛎️', color: '#059669' },
        { id: 'salon_bar_fluvial', name: 'Grand Salon-Bar & Piste de Danse', deck: 2, deckName: 'Pont Supérieur', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Escalier Avant', icon: 'martini-glass', iconEmoji: '🍸', color: '#9333ea' },
        { id: 'boutique_fluvial', name: 'Boutique Souvenirs du bord', deck: 2, deckName: 'Pont Supérieur', side: 'Tribord', zone: 'Milieu / Centre', elevator: 'Accès Direct', icon: 'bag-shopping', iconEmoji: '🛍️', color: '#d97706' },
        { id: 'debarquement_fluvial', name: 'Passerelle d\'Escale (Sortie Quai)', deck: 2, deckName: 'Pont Supérieur', side: 'Bâbord / Tribord', zone: 'Milieu / Centre', elevator: 'Accès Direct', icon: 'door-open', iconEmoji: '🚪', color: '#0891b2' },
        { id: 'solarium_fluvial', name: 'Terrasse Pont Soleil & Transats 360°', deck: 3, deckName: 'Pont Soleil', side: 'Centre', zone: 'Plein Air', elevator: 'Escalier Supérieur', icon: 'sun', iconEmoji: '🌅', color: '#f59e0b' },
        { id: 'cabines_principal', name: 'Cabines Pont Principal (Niveau Bas)', deck: 1, deckName: 'Pont Principal', side: 'Centre', zone: 'Proue à Poupe', elevator: 'Escalier Central', icon: 'bed', iconEmoji: '🛏️', color: '#0284c7' }
      ];
    }

    if (info.line === 'ponant') {
      return [
        { id: 'medical_ponant', name: 'Centre Médical & Médecin de bord', deck: 3, deckName: 'Pont 3', side: 'Bâbord', zone: 'Proue (Avant)', elevator: 'Ascenseur Avant', icon: 'shield-heart', iconEmoji: '🏥', color: '#2563eb' },
        { id: 'resto_gastro_ponant', name: 'Restaurant Gastronomique Ducasse', deck: 3, deckName: 'Pont 3', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Ascenseur Arrière', icon: 'utensils', iconEmoji: '🍽️', color: '#e11d48' },
        { id: 'reception_ponant', name: 'Réception & Bureau des Expéditions', deck: 3, deckName: 'Pont 3', side: 'Centre', zone: 'Milieu / Centre', elevator: 'Ascenseur Central', icon: 'bell-concierge', iconEmoji: '🛎️', color: '#059669' },
        { id: 'marina_ponant', name: 'Marina & Flotte de Zodiacs', deck: 3, deckName: 'Pont 3', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Escalier Marina', icon: 'anchor', iconEmoji: '⚓', color: '#0891b2' },
        { id: 'grand_salon_ponant', name: 'Grand Salon & Piano Bar', deck: 4, deckName: 'Pont 4', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Ascenseur Arrière', icon: 'music', iconEmoji: '🍸', color: '#9333ea' },
        { id: 'theatre_ponant', name: 'Théâtre & Conférences Naturalistes', deck: 4, deckName: 'Pont 4', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Ascenseur Avant', icon: 'masks-theater', iconEmoji: '🎭', color: '#7c3aed' },
        { id: 'observatoire_ponant', name: 'Salon Observatoire Panoramique 180°', deck: 6, deckName: 'Pont 6', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Ascenseur Avant', icon: 'binoculars', iconEmoji: '🔭', color: '#0891b2' },
        { id: 'spa_ponant', name: 'Spa Ponant & Espace Hammam', deck: 6, deckName: 'Pont 6', side: 'Bâbord', zone: 'Milieu / Centre', elevator: 'Ascenseur Central', icon: 'spa', iconEmoji: '🧘', color: '#059669' },
        { id: 'piscine_ponant', name: 'Piscine Chauffée & Bar Solarium', deck: 7, deckName: 'Pont 7', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Escalier Pont 7', icon: 'water-ladder', iconEmoji: '🏊', color: '#0284c7' }
      ];
    }

    if (info.line === 'grands_espaces') {
      return [
        { id: 'mudroom_polar', name: 'Vestiaire Mudroom (Bottes & Parkas)', deck: 2, deckName: 'Pont 2', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Escalier Pont 2', icon: 'socks', iconEmoji: '🥾', color: '#0284c7' },
        { id: 'medical_polar', name: 'Infirmerie Polaire & Urgences Grand Froid', deck: 2, deckName: 'Pont 2', side: 'Bâbord', zone: 'Milieu / Centre', elevator: 'Escalier Pont 2', icon: 'shield-heart', iconEmoji: '🏥', color: '#dc2626' },
        { id: 'zodiacs_polar', name: 'Embarquement Zodiacs d\'Expédition', deck: 2, deckName: 'Pont 2', side: 'Bâbord & Tribord', zone: 'Poupe (Arrière)', elevator: 'Porte de Coupée', icon: 'anchor', iconEmoji: '⚓', color: '#0891b2' },
        { id: 'resto_polar', name: 'Salle à Manger Polaire & Conviviale', deck: 3, deckName: 'Pont 3', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Accès Direct', icon: 'utensils', iconEmoji: '🍽️', color: '#e11d48' },
        { id: 'salon_obs_polar', name: 'Salon d\'Observation Faune & Icebergs', deck: 4, deckName: 'Pont 4', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Escalier Supérieur', icon: 'binoculars', iconEmoji: '🔭', color: '#0891b2' },
        { id: 'conf_polar', name: 'Salle de Conférences des Naturalistes', deck: 4, deckName: 'Pont 4', side: 'Centre', zone: 'Milieu / Centre', elevator: 'Accès Direct', icon: 'chalkboard-user', iconEmoji: '🎙️', color: '#7c3aed' },
        { id: 'passerelle_polar', name: 'Passerelle Ouverte 24h/24 (Open Bridge)', deck: 5, deckName: 'Pont 5', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Escalier Passerelle', icon: 'compass', iconEmoji: '🧭', color: '#1d4ed8' },
        { id: 'pont_photo_polar', name: 'Pont Supérieur d\'Observation Faune 360°', deck: 5, deckName: 'Pont 5', side: 'Centre', zone: 'Plein Air', elevator: 'Escalier Extérieur', icon: 'camera', iconEmoji: '📸', color: '#10b981' }
      ];
    }

    // MSC Croisières par défaut
    return [
      { id: 'medical_msc', name: 'Centre Médical & Urgences (Pont 4)', deck: 4, deckName: 'Pont 4', side: 'Bâbord', zone: 'Proue (Avant)', elevator: 'Avant', icon: 'shield-heart', iconEmoji: '🏥', color: '#2563eb' },
      { id: 'reception_msc', name: 'Réception Centrale 24h & Guest Service', deck: 5, deckName: 'Pont 5', side: 'Centre', zone: 'Milieu (Atrium)', elevator: 'Centraux', icon: 'bell-concierge', iconEmoji: '🛎️', color: '#059669' },
      { id: 'theatre_msc', name: 'Grand Théâtre de style Broadway', deck: 6, deckName: 'Pont 6', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Avant', icon: 'masks-theater', iconEmoji: '🎭', color: '#7c3aed' },
      { id: 'galleria_msc', name: 'Galleria Promenade & Dôme LED Géant', deck: 6, deckName: 'Pont 6', side: 'Centre', zone: 'Milieu / Centre', elevator: 'Centraux', icon: 'film', iconEmoji: '✨', color: '#f59e0b' },
      { id: 'pub_msc', name: 'Pub Anglais Masters of the Sea', deck: 7, deckName: 'Pont 7', side: 'Bâbord', zone: 'Milieu / Centre', elevator: 'Centraux', icon: 'beer-mug-empty', iconEmoji: '🍺', color: '#b45309' },
      { id: 'buffet_msc', name: 'Buffet Marketplace (Ouvert 20h/24)', deck: 15, deckName: 'Pont 15', side: 'Centre', zone: 'Poupe (Arrière)', elevator: 'Arrière', icon: 'bowl-food', iconEmoji: '🥗', color: '#e11d48' },
      { id: 'piscine_msc', name: 'Piscine Principale & Solarium Lido', deck: 15, deckName: 'Pont 15', side: 'Centre', zone: 'Milieu / Centre', elevator: 'Centraux', icon: 'water-ladder', iconEmoji: '🏊', color: '#0284c7' },
      { id: 'spa_msc', name: 'MSC Aurea Spa & Espace Balinais', deck: 16, deckName: 'Pont 16', side: 'Centre', zone: 'Proue (Avant)', elevator: 'Avant', icon: 'spa', iconEmoji: '🧘', color: '#059669' }
    ];
  }

  // ---------------------------------------------------------------------------
  // 5. DÉCODEUR DE CABINE UNIVERSEL (CABIN LOCATOR & WAYFINDING)
  // ---------------------------------------------------------------------------
  function decodeCruiseCabin(rawInput, shipName = "") {
    if (!rawInput) return null;
    const cleaned = rawInput.toString().trim().replace(/\D/g, '');
    if (!cleaned || cleaned.length < 2) return null;

    const info = detectCruiseLineAndShip(shipName);
    const num = parseInt(cleaned, 10);
    const decks = getCruiseShipDecks(shipName);

    let deck = 0;
    let roomNumber = 0;

    // A. CROISIEUROPE (Fluvial : 3 chiffres ex: 102, 215, 304)
    if (info.line === 'croisieurope' || info.isRiver) {
      if (cleaned.length === 3) {
        deck = Math.floor(num / 100);
        roomNumber = num % 100;
      } else {
        deck = Math.min(2, Math.max(1, num < 200 ? 1 : 2));
        roomNumber = num;
      }
      if (deck > 3) deck = 2; // Maximum pont supérieur
    }
    // B. PONANT (Yachts : 3 ou 4 chiffres ex: 302, 415, 608)
    else if (info.line === 'ponant') {
      if (cleaned.length === 3 || cleaned.length === 4) {
        deck = (cleaned.length === 3) ? Math.floor(num / 100) : Math.floor(num / 100);
        roomNumber = num % 100;
      } else {
        deck = 4;
        roomNumber = num;
      }
    }
    // C. GRANDS ESPACES (Expédition : 2 ou 3 chiffres ex: 204, 312)
    else if (info.line === 'grands_espaces') {
      if (cleaned.length === 3) {
        deck = Math.floor(num / 100);
        roomNumber = num % 100;
      } else {
        deck = 3;
        roomNumber = num;
      }
    }
    // D. COSTA & MSC (Grands Paquebots : 4 ou 5 chiffres ex: 5124, 9245, 11025)
    else {
      if (cleaned.length === 3) {
        deck = Math.floor(num / 100);
        roomNumber = num % 100;
      } else if (cleaned.length === 4) {
        deck = Math.floor(num / 1000);
        roomNumber = num % 1000;
      } else {
        deck = Math.floor(num / 1000);
        roomNumber = num % 1000;
      }
    }

    const deckObj = decks.find(d => d.deck === deck);
    const deckName = deckObj ? deckObj.name : `Pont ${deck}`;

    // Parité : Pair = Bâbord (gauche), Impair = Tribord (droite)
    const isPortSide = (num % 2 === 0);
    const sideName = isPortSide ? "Bâbord (Côté Gauche)" : "Tribord (Côté Droit)";
    const sideBadgeClass = isPortSide ? "side-badge-port" : "side-badge-starboard";
    const sideIcon = isPortSide ? "fa-circle-arrow-left" : "fa-circle-arrow-right";
    const navLight = isPortSide ? "Feu Rouge (Gauche)" : "Feu Vert (Droite)";

    // Zone longitudinale & orientation
    let zoneName = "Milieu / Centre";
    let elevatorName = "Ascenseurs Centraux";
    let elevatorCode = "centre";
    let xRatio = 0.50;

    if (info.isRiver) {
      if (roomNumber <= 15) {
        zoneName = "Proue (Vers le Salon-Bar)";
        elevatorName = "Escalier Avant (Salon)";
        elevatorCode = "avant";
        xRatio = 0.25;
      } else if (roomNumber <= 30) {
        zoneName = "Milieu (Proche Réception)";
        elevatorName = "Escalier Central (Hall & Accueil)";
        elevatorCode = "centre";
        xRatio = 0.50;
      } else {
        zoneName = "Poupe (Vers le Restaurant)";
        elevatorName = "Escalier Arrière (Restaurant)";
        elevatorCode = "arriere";
        xRatio = 0.75;
      }
    } else if (info.line === 'ponant' || info.line === 'grands_espaces') {
      if (roomNumber <= 12) {
        zoneName = "Proue (Avant du Yacht)";
        elevatorName = "Ascenseur Avant (Observatoire)";
        elevatorCode = "avant";
        xRatio = 0.25;
      } else if (roomNumber <= 25) {
        zoneName = "Milieu du Yacht";
        elevatorName = "Ascenseur Central (Hall Principal)";
        elevatorCode = "centre";
        xRatio = 0.50;
      } else {
        zoneName = "Poupe (Arrière / Vers Marina)";
        elevatorName = "Ascenseur Arrière (Restaurants)";
        elevatorCode = "arriere";
        xRatio = 0.75;
      }
    } else {
      // Paquebot
      const s = (shipName || "").toLowerCase();
      if (roomNumber <= 130) {
        zoneName = "Proue (Avant du navire)";
        elevatorName = s.includes('diadema') ? "Ascenseurs Avant (Théâtre Emerald)" : (s.includes('smeralda') ? "Ascenseurs Avant (Théâtre Sanremo)" : "Ascenseurs Avant (Théâtre)");
        elevatorCode = "avant";
        xRatio = 0.22;
      } else if (roomNumber <= 270) {
        zoneName = "Milieu / Centre (Atrium)";
        elevatorName = s.includes('diadema') ? "Ascenseurs Centraux (Atrium Eliodoro)" : (s.includes('smeralda') ? "Ascenseurs Centraux (Atrium Colosseo)" : "Ascenseurs Centraux (Atrium)");
        elevatorCode = "centre";
        xRatio = 0.50;
      } else {
        zoneName = "Poupe (Arrière du navire)";
        elevatorName = s.includes('diadema') ? "Ascenseurs Arrière (Corona Blu & Lido)" : (s.includes('smeralda') ? "Ascenseurs Arrière (Piazza di Spagna)" : "Ascenseurs Arrière (Buffet)");
        elevatorCode = "arriere";
        xRatio = 0.78;
      }
    }

    return {
      raw: rawInput,
      cleanNumber: cleaned,
      deck: deck,
      deckName: deckName,
      roomNumber: roomNumber,
      isPortSide: isPortSide,
      sideName: sideName,
      sideBadgeClass: sideBadgeClass,
      sideIcon: sideIcon,
      navLight: navLight,
      zoneName: zoneName,
      elevatorName: elevatorName,
      elevatorCode: elevatorCode,
      xRatio: xRatio,
      shipInfo: info
    };
  }

  // ---------------------------------------------------------------------------
  // 6. INFOS PRATIQUES & CONSEILS PAR COMPAGNIE (PRACTICAL TIPS)
  // ---------------------------------------------------------------------------
  function getCruisePracticalInfo(shipName = "", rawText = "") {
    const info = detectCruiseLineAndShip(shipName, rawText);

    if (info.line === 'croisieurope' || info.isRiver) {
      return {
        money: "Règlement des dépenses du bord (bar, boutique, excursions) en euros par carte bancaire ou espèces à la Réception en fin de croisière. Aucun change nécessaire en France ou zone euro.",
        electricity: "Voltage 220V standard européen (prises françaises identiques à votre domicile). Aucun adaptateur requis.",
        clothing: "Tenue décontractée et chaussures confortables pour les escales à pied. Prévoir une tenue soignée et élégante pour la soirée de Gala du Commandant.",
        tips: "Pourboires au personnel navigant CroisiEurope : laissés à votre entière discrétion (une boîte collective est disponible à la Réception le dernier soir, indicatif 5 à 7 € / jour / pers).",
        wifi: "Accès Wi-Fi gratuit disponible dans le grand salon-bar et les espaces de réception du navire."
      };
    }

    if (info.line === 'ponant') {
      return {
        money: "Compte de bord ouvert dès votre embarquement par carte bancaire. Monnaie officielle à bord : Euro. Facture finale éditée la veille du débarquement.",
        electricity: "Voltage en cabine : 220V (prises européennes) et 110V (prises américaines).",
        clothing: "Tenues confortables en journée. Tenue de cocktail / veste pour les soirées et le dîner du Commandant. En zone polaire : parkas d'expédition polaire offertes et bottes thermiques en prêt.",
        tips: "Chez Ponant, le service est inclus. Les pourboires au personnel de bord sont laissés à votre entière discrétion.",
        wifi: "Accès Wi-Fi satellite illimité et gratuit à bord pour tous les passagers."
      };
    }

    if (info.line === 'grands_espaces') {
      return {
        money: "Règlement des consommations du bord en fin d'expédition par carte bancaire ou espèces (Euros ou Francs Suisses selon navire).",
        electricity: "Voltage 220V standard européen en cabine.",
        clothing: "Système '3 couches' conseillé (sous-vêtements thermiques en mérinos, polaire, veste coupe-vent étanche). Bottes étanches de haute qualité Muck Boots prêtées pour tout le voyage.",
        tips: "Pourboires pour l'équipage marin et les guides-naturalistes : boîte collective en fin d'expédition (indicatif 10 à 15 € / jour / passager).",
        wifi: "Déconnexion sereine au cœur des glaces : le navire navigue hors couverture GSM. Téléphone et messagerie satellite d'urgence disponibles à la passerelle."
      };
    }

    // MSC / Costa / Maritime général
    return {
      money: "Aucune circulation d'argent liquide à bord. Votre carte cabine sert de moyen de paiement unique. Enregistrez votre carte bancaire dès les premiers jours aux bornes automatiques.",
      electricity: "Voltage en cabine : 220V et 110V (prises européennes et américaines disponibles).",
      clothing: "Tenue décontractée en journée, vêtements confortables pour les escales. Prévoir une tenue de gala / cocktail pour la soirée du Commandant.",
      tips: "Pourboires au personnel de bord (frais de service) inclus ou prépayés selon contrat Voyages Girardot. Pourboires libres pour les guides locaux lors des excursions.",
      wifi: "Wi-Fi gratuit du bord pour utiliser l'application mobile de la compagnie (programme du jour, menus, réservations). Forfaits Internet satellite payants pour naviguer sur le web en mer."
    };
  }

  function getCruisePracticalTips(shipName = "", rawText = "") {
    const info = detectCruiseLineAndShip(shipName, rawText);

    if (info.line === 'croisieurope' || info.isRiver) {
      return [
        {
          title: "Paiement & Compte de bord",
          icon: "credit-card",
          content: "À bord, aucune dépense n'est réglée immédiatement en espèces. Chaque consommation au bar ou achat boutique est reporté sur votre numéro de cabine. Vous réglez simplement la note globale le dernier soir à la Réception par carte bancaire ou espèces."
        },
        {
          title: "Navigation Fluviale & Absence de mal de mer",
          icon: "water",
          content: "La navigation sur les fleuves et canaux est exceptionnellement douce, paisible et sans aucune houle marine. Il n'y a aucun risque de mal de mer à bord d'un bateau fluvial !"
        },
        {
          title: "Formule Pension Complète & Boissons",
          icon: "wine-glass",
          content: "Votre croisière Girardot / CroisiEurope bénéficie de la formule 'Boissons incluses aux repas et au bar' (vins, bière, eau, jus de fruits, sodas et café, hors cartes spéciales de grands crus). Savourez vos repas sans vous soucier des suppléments !"
        },
        {
          title: "Soirée de Gala du Commandant",
          icon: "champagne-glasses",
          content: "L'une des soirées de votre croisière est dédiée au Dîner de Gala du Commandant avec défilé de l'équipage et menu d'exception. Prévoyez une tenue soignée et élégante pour cette soirée festive."
        },
        {
          title: "Escales au cœur des villes",
          icon: "landmark",
          content: "Le privilège de la croisière fluviale : le bateau accoste généralement à quelques pas seulement des centres historiques, vous permettant de descendre et remonter à bord à pied librement."
        },
        {
          title: "Clés de cabine & Sécurité",
          icon: "key",
          content: "Pour des raisons de sécurité nautique, vous êtes invités à déposer votre clé de cabine à la Réception à chaque descente à terre, et à la récupérer dès votre retour à bord."
        }
      ];
    }

    if (info.line === 'ponant') {
      return [
        {
          title: "L'Esprit Yachting & Gastronomie Ducasse",
          icon: "award",
          content: "Naviguer sur Ponant, c'est vivre l'art de vivre à la française : haute gastronomie élaborée avec Ducasse Conseil, open bar toute la journée (vins fins, champagnes, cocktails), et service majordome attentionné."
        },
        {
          title: "Sorties d'Exploration en Zodiacs",
          icon: "anchor",
          content: "Les débarquements en Zodiacs sont encadrés par des chefs d'expédition et naturalistes expérimentés. Des réunions d'information obligatoires vous expliqueront la méthode d'embarquement (saisie poignet à poignet des marins)."
        },
        {
          title: "Équipements & Prêt de Parkas",
          icon: "vest",
          content: "Pour les croisières polaires ou australes, Ponant vous offre une parka d'expédition polaire étanche et chaude conçue sur mesure, ainsi que le prêt gratuit de bottes d'expédition pour toute la durée du voyage."
        },
        {
          title: "Soirées & Code Vestimentaire",
          icon: "shirt",
          content: "Tenue décontractée-chic en journée. Pour le Dîner du Commandant, une tenue de gala / cocktail est recommandée (costume pour les messieurs, robe habillée pour les dames)."
        },
        {
          title: "Wi-Fi Satellite Illimité",
          icon: "wifi",
          content: "L'accès Internet satellite haut débit par Wi-Fi est inclus et gratuit dans tout le navire, y compris dans votre cabine."
        },
        {
          title: "Médecin & Santé à bord",
          icon: "shield-heart",
          content: "Un médecin urgentiste français et une infirmière sont à votre disposition 24h/24 dans le centre médical du yacht (Pont 3)."
        }
      ];
    }

    if (info.line === 'grands_espaces') {
      return [
        {
          title: "Vestiaire 'Mudroom' & Bottes Fournies",
          icon: "socks",
          content: "Pour tous vos débarquements sur la banquise ou les plages arctiques, des bottes montantes thermiques de haute performance Muck Boots vous sont prêtées. Elles restent dans le vestiaire chauffé Mudroom du Pont 2 entre chaque sortie."
        },
        {
          title: "Politique de Passerelle Ouverte (Open Bridge)",
          icon: "compass",
          content: "Fait exceptionnel, la passerelle de navigation est ouverte 24h/24 aux passagers. Vous pouvez y observer le travail des officiers, scruter la banquise et guetter la faune polaire aux jumelles."
        },
        {
          title: "Conférences Naturalistes Quotidiennes",
          icon: "chalkboard-user",
          content: "Chaque jour, les guides-conférenciers de Grands Espaces (glaciologues, historiens, ornithologues) animent des présentations passionnantes sur l'écosystème polaire et les pionniers des pôles."
        },
        {
          title: "Règle des 3 Couches pour le Grand Froid",
          icon: "snowflake",
          content: "Couche 1 respirante (laine mérinos), Couche 2 isolante (polaire épaisse ou doudoune plume), Couche 3 coupe-vent étanche (Gore-Tex). Bonnet couvrant les oreilles et gants étanches obligatoires."
        },
        {
          title: "Respect Strict de la Faune Polaire",
          icon: "paw",
          content: "Application rigoureuse des chartes de protection polaire AECO/IAATO : distance minimale avec les ours polaires et morses, interdiction totale de laisser le moindre déchet, consignes de silence."
        },
        {
          title: "Boissons Chaudes Permanentes 24h/24",
          icon: "mug-hot",
          content: "Café fraîchement moulu, thés parfumés, chocolat chaud et soupes revigorantes sont en libre-service permanent au salon d'observation pour vous réchauffer après les safaris Zodiacs."
        }
      ];
    }

    // MSC / Costa par défaut
    return [
      {
        title: "Paiement & Monnaie à bord",
        icon: "credit-card",
        content: "Aucune circulation d'argent liquide à bord. Votre carte de cabine sert de moyen de paiement unique pour tous vos achats (boutiques, bars, spa, excursions). Enregistrez votre carte bancaire dès les premiers jours aux bornes libre-service du navire."
      },
      {
        title: "Électricité & Voltage en cabine",
        icon: "plug",
        content: "Voltage en cabine : 220V et 110V (60 Hz). Prises européennes standard et américaines disponibles. Pensez à emporter vos chargeurs de smartphone et appareils photo."
      },
      {
        title: "Vêtements conseillés & Soirées",
        icon: "shirt",
        content: "Vêtements confortables et chaussures adaptées pour les visites d'escale. Pour les soirées à bord, prévoyez des tenues soignées, une tenue de gala / cocktail pour la soirée du Commandant, ainsi qu'une touche de blanc pour la traditionnelle Soirée Blanche."
      },
      {
        title: "Pourboires & Frais de séjour",
        icon: "hand-holding-dollar",
        content: "Pour votre confort, les pourboires au personnel de bord (frais de séjour) sont prépayés et inclus dans votre forfait Voyages Girardot. Les pourboires pour les guides et chauffeurs d'excursions restent à votre discrétion."
      },
      {
        title: "Wi-Fi & Application du Bord",
        icon: "wifi",
        content: "L'application mobile de la compagnie (MyCosta ou MSC for Me) est indispensable à bord (programme du jour, menus, réservation d'excursions, solde). Elle fonctionne gratuitement sur le réseau Wi-Fi local du navire. Pensez à mettre votre smartphone en mode avion en mer pour éviter les frais d'itinérance satellite."
      },
      {
        title: "Santé, Médicaments & Mal de mer",
        icon: "shield-heart",
        content: "Un service médical avec médecins et infirmières est disponible 24h/24 à bord (soins payants, couverts par votre assurance multirisque). Conservez vos ordonnances et médicaments en bagage à main. Des comprimés contre le mal de mer sont disponibles à la Réception."
      }
    ];
  }

  function getCruiseContacts(shipName = "", accompName = "Mireille") {
    const info = detectCruiseLineAndShip(shipName);
    const ship = info.shipName || "Navire de Croisière";

    if (info.line === 'croisieurope' || info.isRiver) {
      return [
        {
          category: "Accompagnatrice Voyages Girardot",
          name: accompName || "Mireille",
          phone: "",
          address: `À bord du ${ship} (Permanence quotidienne Voyages Girardot)`,
          isEmergency: false
        },
        {
          category: "Réception & Capitainerie du Bateau",
          name: `Réception ${ship} (Pont Supérieur)`,
          phone: "Poste Réception à bord (24h/24)",
          address: `À bord du ${ship} - Disponible 24h/24`,
          isEmergency: true
        },
        {
          category: "Assistance Girardot 24h/7j",
          name: "Permanence Urgences Voyages Girardot",
          phone: "03 85 42 82 50",
          address: "Chalon-sur-Saône, France",
          isEmergency: true
        }
      ];
    }

    if (info.line === 'ponant' || info.line === 'grands_espaces') {
      return [
        {
          category: "Accompagnateur Voyages Girardot",
          name: accompName || "Mireille",
          phone: "",
          address: `À bord du ${ship} (Permanence quotidienne Voyages Girardot)`,
          isEmergency: false
        },
        {
          category: "Bureau des Expéditions & Réception",
          name: `Réception & Conciergerie ${ship}`,
          phone: "Poste Réception à bord (24h/24)",
          address: `À bord du ${ship} - Disponible 24h/24`,
          isEmergency: true
        },
        {
          category: "Centre Médical & Médecin Urgentiste",
          name: `Infirmerie & Médecin de bord (${ship})`,
          phone: "Appel d'urgence depuis votre cabine",
          address: `À bord du ${ship} (24h/24)`,
          isEmergency: true
        },
        {
          category: "Assistance Girardot 24h/7j",
          name: "Permanence Urgences Voyages Girardot",
          phone: "03 85 42 82 50",
          address: "Chalon-sur-Saône, France",
          isEmergency: true
        }
      ];
    }

    // MSC / Costa
    return [
      {
        category: "Accompagnatrice Voyages Girardot",
        name: accompName || "Mireille",
        phone: "",
        address: `À bord du ${ship} (Permanence quotidienne Voyages Girardot)`,
        isEmergency: false
      },
      {
        category: "Réception & Guest Service Navire",
        name: `Réception ${ship}`,
        phone: "Poste Réception ou Urgence Cabine",
        address: `À bord du ${ship} - Disponible 24h/24`,
        isEmergency: true
      },
      {
        category: "Centre Médical & Infirmerie du Bord",
        name: `Infirmerie & Médecin de bord (${ship})`,
        phone: "Appel d'urgence depuis votre cabine",
        address: "Pont inférieur (Accès direct ascenseurs)",
        isEmergency: true
      },
      {
        category: "Assistance Girardot 24h/7j",
        name: "Permanence Urgences Voyages Girardot",
        phone: "03 85 42 82 50",
        address: "Chalon-sur-Saône, France",
        isEmergency: true
      }
    ];
  }

  // ---------------------------------------------------------------------------
  // 7. GÉNÉRATION DE LA CONCIERGERIE SPÉCIALISÉE PAR COMPAGNIE
  // ---------------------------------------------------------------------------
  function buildCruiseConciergerie(shipName = "", itinerary = [], rawText = "") {
    const info = detectCruiseLineAndShip(shipName, rawText);
    const ship = info.shipName || "Votre Navire de Croisière";

    // A. Escales dynamiques issues de l'itinéraire
    const excursionsPlaces = [];
    if (itinerary && Array.isArray(itinerary) && itinerary.length > 0) {
      itinerary.forEach(d => {
        const city = d.city || "";
        const isSeaDay = city.toLowerCase().includes('plaisirs en mer') || d.title.toLowerCase().includes('en mer') || d.title.toLowerCase().includes('navigation');
        let cat = info.isRiver ? "Escale Fluviale" : (info.isPolar ? "Sortie Zodiac Polaire" : "Escale Portuaire");
        let tag = city || "Escale";
        let tips = info.isRiver 
          ? "Débarquement direct à pied au centre-ville ou excursion guidée organisée. Respectez l'heure de reprise de navigation."
          : (info.isPolar 
            ? "Débarquement en Zodiac sur les glaces ou plages polaires. Port des bottes thermiques et du gilet de sauvetage obligatoire."
            : "Excursion vendue à bord ou temps libre à terre. Respectez impérativement le 'Tous à bord' (30 min avant appareillage).");

        if (isSeaDay) {
          cat = "Journée de Navigation";
          tag = info.isRiver ? "Croisière des Châteaux & Berges" : (info.isPolar ? "Observation Glaces & Cétacés" : "Détente & Loisirs à bord");
          tips = info.isRiver 
            ? "Profitez de la terrasse Pont Soleil pour admirer les vignobles et paysages commentés par votre accompagnatrice."
            : (info.isPolar 
              ? "Présence sur la passerelle ouverte ou au salon d'observation avec jumelles pour guetter les ours et baleines."
              : "Profitez des piscines, du spa, des boutiques détaxées et du programme d'animations du bord.");
        }

        excursionsPlaces.push({
          name: `Escale : ${city || d.title.replace(/^Jour\s*\d+\s*[•:\-–—]\s*/i, '')}`,
          category: cat,
          tag: tag,
          address: `Escale du ${d.title}`,
          metro: info.isRiver ? "Ponton fluvial central" : (info.isPolar ? "Mouillage en baie & Navette Zodiac" : "Terminal Croisières"),
          lat: d.lat || 0,
          lng: d.lng || 0,
          notes: tips
        });
      });
    }

    // B. Restaurants selon le profil
    let restoPlaces = [];
    if (info.line === 'croisieurope' || info.isRiver) {
      restoPlaces = [
        {
          name: "Restaurant Panoramique du bord",
          category: "Table Gastronomique Française (Inclus)",
          tag: "Pont Supérieur (Poupe)",
          address: "Pont Supérieur - Vue panoramique sur les berges",
          metro: "Escalier Central / Poupe",
          lat: 0, lng: 0,
          notes: "Cuisine française raffinée concoctée par les chefs CroisiEurope en hommage aux traditions culinaires françaises. Service unique à table pour tous les convives, vins, bières et boissons incluses aux repas."
        },
        {
          name: "Buffet du Petit-Déjeuner Fluvial",
          category: "Petit-Déjeuner Gourmand (Inclus)",
          tag: "Pont Supérieur (Poupe)",
          address: "Restaurant Panoramique",
          metro: "Accès Pont Supérieur",
          lat: 0, lng: 0,
          notes: "Généreux buffet continental sucré et salé : viennoiseries fraîches, pains croustillants, charcuteries régionales, fromages, fruits frais, œufs et boissons chaudes."
        },
        {
          name: "Dîner de Gala du Commandant",
          category: "Soirée de Gala Festive (Inclus)",
          tag: "Soirée d'Exception",
          address: "Restaurant Panoramique",
          metro: "Pont Supérieur",
          lat: 0, lng: 0,
          notes: "Point d'orgue gourmand de votre croisière avec présentation de l'équipage, menu de fête et défilé de la célèbre Omelette Norvégienne flambée."
        }
      ];
    } else if (info.line === 'ponant') {
      restoPlaces = [
        {
          name: "Restaurant Gastronomique (Ducasse Conseil)",
          category: "Haute Gastronomie Française (Inclus)",
          tag: "Pont 3 (Poupe)",
          address: "Pont 3 - Table étoilée sur l'océan",
          metro: "Ascenseurs Arrière",
          lat: 0, lng: 0,
          notes: "Haute gastronomie française d'excellence élaborée en collaboration avec Ducasse Conseil. Carte raffinée renouvelée quotidiennement, sélection de grands crus et service personnalisé 5 étoiles."
        },
        {
          name: "Restaurant Grill en Plein Air",
          category: "Buffet & Grillades Éphémères (Inclus)",
          tag: "Pont 6 (Poupe)",
          address: "Pont 6 - Terrasse extérieure",
          metro: "Ascenseurs Arrière / Pont 6",
          lat: 0, lng: 0,
          notes: "Déjeuners au grand air et dîners sous les étoiles dans une ambiance conviviale : poissons grillés, salades gourmandes et pâtisseries fines maison."
        },
        {
          name: "Room Service Privilège 24h/24",
          category: "Service en Suite / Cabine (Inclus)",
          tag: "Cabines & Suites",
          address: "Directement en cabine",
          metro: "Téléphone Cabine",
          lat: 0, lng: 0,
          notes: "Petit-déjeuner servi sur votre balcon privé ou repas léger disponible 24h/24 sur simple appel."
        }
      ];
    } else if (info.line === 'grands_espaces') {
      restoPlaces = [
        {
          name: "Salle à Manger Polaire Conviviale",
          category: "Cuisine Chaleureuse & Réconfortante (Inclus)",
          tag: "Pont 3 (Poupe)",
          address: "Pont 3 - Tables conviviales",
          metro: "Accès Pont 3",
          lat: 0, lng: 0,
          notes: "Repas généreux, savoureux et revigorants préparés par le chef de bord au retour du froid polaire. Tablées partagées avec les chefs d'expédition et les conférenciers scientifiques."
        },
        {
          name: "Collation & Boissons Chaudes 24h/24",
          category: "Station Libre-Service Permanente (Inclus)",
          tag: "Pont 4 (Salon Panoramique)",
          address: "Salon d'Observation Pont 4",
          metro: "Pont 4",
          lat: 0, lng: 0,
          notes: "Café, thés variés, chocolat chaud onctueux, soupes chaudes et biscuits à disposition permanente pour vous réchauffer après chaque sortie en Zodiac."
        }
      ];
    } else if (info.line === 'msc') {
      restoPlaces = [
        {
          name: "Grands Restaurants Principaux",
          category: "Service à Table Élégant (Inclus)",
          tag: "Ponts 5 & 6 (Poupe)",
          address: "Ponts 5 et 6",
          metro: "Ascenseurs Arrière & Centraux",
          lat: 0, lng: 0,
          notes: "Dîners raffinés en plusieurs services : gastronomie méditerranéenne, spécialités italiennes fraîches et saveurs internationales."
        },
        {
          name: "Buffet Marketplace 20h/24",
          category: "Buffet Géant Libre-Service (Inclus)",
          tag: "Pont 15 (Poupe)",
          address: "Pont 15 - Vue mer panoramique",
          metro: "Ascenseurs Arrière",
          lat: 0, lng: 0,
          notes: "Buffet immense avec cuisine ouverte : rôtisserie, bar à pâtes fraîches, authentiques pizzas italiennes au feu de bois, bar à salades et îlot à desserts."
        },
        {
          name: "Butcher's Cut Steakhouse",
          category: "Restaurant de Spécialités Grillades",
          tag: "Pont 7 (Centre)",
          address: "Pont 7 Galleria",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Steakhouse à l'américaine servant des viandes Black Angus maturées, grillées à la perfection et accompagnées de grands vins californiens."
        }
      ];
    } else {
      // Costa Diadema / Smeralda
      restoPlaces = [
        {
          name: "Restaurants Fiorentino & Adularia",
          category: "Restaurants Principaux (Inclus)",
          tag: "Ponts 3 & 4",
          address: "Ponts 3 et 4 - Proue et Poupe",
          metro: "Ascenseurs Avant et Arrière",
          lat: 0, lng: 0,
          notes: "Tables élégantes assignées pour le dîner. Menus créés par des chefs étoilés Michelin (Bruno Barbieri, Hélène Darroze, Ángel León)."
        },
        {
          name: "Buffet Corona Blu",
          category: "Buffet Gourmand Libre-Service (Inclus)",
          tag: "Pont 10",
          address: "Pont 10 Hortensia",
          metro: "Ascenseurs Arrière",
          lat: 0, lng: 0,
          notes: "Large sélection d'entrées, plats chauds, salades composées et desserts avec vue imprenable sur le sillage du navire."
        },
        {
          name: "Pizzeria Pummid'Oro & La Tavernetta",
          category: "Spécialités Italiennes Authentiques",
          tag: "Pont 5",
          address: "Pont 5 Eldorador",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Véritable pizza italienne à pâte levée naturellement et mozzarella fraîche étirée à bord."
        }
      ];
    }

    // C. Bars & Salons
    let detentePlaces = [];
    if (info.line === 'croisieurope' || info.isRiver) {
      detentePlaces = [
        {
          name: "Grand Salon-Bar Panoramique & Piste de Danse",
          category: "Salon Convivial & Soirées Festives",
          tag: "Pont Supérieur (Proue)",
          address: "Pont 2 - Avant du navire",
          metro: "Escalier Avant",
          lat: 0, lng: 0,
          notes: "Espace convivial central : jeux apéritifs animés par l'équipe du bord, conférences de votre accompagnatrice Girardot, thés dansants et soirées musicales."
        },
        {
          name: "Bar Solarium du Pont Soleil",
          category: "Bar de Plein Air Décontracté",
          tag: "Pont Soleil (Pont 3)",
          address: "Pont 3 - Terrasse plein air",
          metro: "Escalier Pont Soleil",
          lat: 0, lng: 0,
          notes: "Boissons fraîches, bières et rafraîchissements servis au grand air face au panorama des berges fleuries."
        }
      ];
    } else if (info.line === 'ponant') {
      detentePlaces = [
        {
          name: "Grand Salon & Piano Bar",
          category: "Lounge Élégant & Musique Live",
          tag: "Pont 4 (Poupe)",
          address: "Pont 4 - Terrasse extérieure",
          metro: "Ascenseurs Arrière",
          lat: 0, lng: 0,
          notes: "Ambiance feutrée au son du piano à queue, cave à champagnes d'exception et terrasse ouverte sur le large."
        },
        {
          name: "Salon Observatoire Panoramique 180°",
          category: "Observation & Sérénité",
          tag: "Pont 6 (Proue)",
          address: "Pont 6 - Salon frontal",
          metro: "Ascenseurs Avant",
          lat: 0, lng: 0,
          notes: "Vue spectaculaire sur l'horizon, bibliothèque maritime, télescopes de pointe et musique douce."
        }
      ];
    } else if (info.line === 'grands_espaces') {
      detentePlaces = [
        {
          name: "Salon d'Observation Faune & Icebergs",
          category: "Panorama Naturaliste 270°",
          tag: "Pont 4 (Proue)",
          address: "Pont 4 - Vue frontale",
          metro: "Accès Pont 4",
          lat: 0, lng: 0,
          notes: "Salon équipé de longues-vues et jumelles, thé et café permanent, carnet d'observation des cétacés et oiseaux polaires."
        },
        {
          name: "Passerelle Ouverte aux Passagers (Open Bridge)",
          category: "Navigation Partagée avec les Officiers",
          tag: "Pont 5 (Proue)",
          address: "Pont 5 - Poste de pilotage",
          metro: "Escalier Passerelle",
          lat: 0, lng: 0,
          notes: "Politique rare de passerelle ouverte 24h/24 : échangez avec les marins et scrutez la banquise aux côtés du Commandant."
        }
      ];
    } else {
      // Costa / MSC
      detentePlaces = [
        {
          name: "Grand Bar Central & Atrium",
          category: "Salon Musical Live & Cocktails",
          tag: "Ponts Centraux",
          address: "Atrium Central",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Le cœur vibrant du navire : orchestre live chaque soir, piste de danse, apéritifs spritz et cocktails du monde."
        },
        {
          name: "Bar Lido & Solarium Piscine",
          category: "Bar de Plein Air & Rafraîchissements",
          tag: "Ponts Supérieurs",
          address: "Espace Piscines",
          metro: "Ascenseurs Lido",
          lat: 0, lng: 0,
          notes: "Cocktails givrés, bières fraîches et smoothies dégustés sur votre transat au bord de l'eau."
        }
      ];
    }

    // D. Boutiques
    let shoppingPlaces = [];
    if (info.isRiver) {
      shoppingPlaces = [
        {
          name: "Boutique Officielle CroisiEurope",
          category: "Souvenirs, Terroirs & Cadeaux",
          tag: "Pont Supérieur",
          address: "Pont Supérieur - Hall de Réception",
          metro: "Accès Réception",
          lat: 0, lng: 0,
          notes: "Souvenirs de votre croisière, sélection de produits gastronomiques des régions traversées, textiles brodés CroisiEurope, cartes postales et timbres."
        }
      ];
    } else if (info.line === 'ponant') {
      shoppingPlaces = [
        {
          name: "Boutique de Prestige Ponant",
          category: "Prêt-à-porter de Luxe & Expédition",
          tag: "Pont 4",
          address: "Pont 4 - Proche Grand Salon",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Vêtements techniques de grand froid, maroquinerie haut de gamme, bijoux exclusifs, parfums français et livres d'art photographique."
        }
      ];
    } else if (info.line === 'grands_espaces') {
      shoppingPlaces = [
        {
          name: "Comptoir Polaire Grands Espaces",
          category: "Équipements & Livres Naturalistes",
          tag: "Pont 3",
          address: "Pont 3 - Hall d'accueil",
          metro: "Accès Pont 3",
          lat: 0, lng: 0,
          notes: "Guides d'identification de la faune polaire, cartes marines dédicacées, bonneterie polaire et souvenirs de l'expédition."
        }
      ];
    } else {
      shoppingPlaces = [
        {
          name: "Galerie Marchande & Boutiques Tax-Free",
          category: "Duty Free Démarqué (Parfums, Bijoux, Tabacs)",
          tag: "Ponts Centraux",
          address: "Promenade Boutiques",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Tarifs détaxés en mer sur les parfums de grandes marques, maroquinerie, cosmétiques, montres suisses et souvenirs officiels du navire."
        }
      ];
    }

    // E. Infirmerie & Santé
    let pratiquePlaces = [];
    if (info.isRiver) {
      pratiquePlaces = [
        {
          name: "Réception & Capitainerie de Bord (24h/24)",
          category: "Accueil & Assistance Permanente",
          tag: "Pont Supérieur",
          address: "Pont Supérieur - Hall Central",
          metro: "Escalier Central",
          lat: 0, lng: 0,
          notes: "Disponible 24h/24 pour tout renseignement. Gestion de vos clés de cabine, coffre-fort et compte de bord (règlement en fin de séjour)."
        },
        {
          name: "Trousse Médicale d'Urgence & Médecin d'Escale",
          category: "Santé & Premiers Soins",
          tag: "Pont Supérieur",
          address: "Réception de bord",
          metro: "S'adresser à la Réception",
          lat: 0, lng: 0,
          notes: "Le navire navigue à proximité immédiate des berges et des villes. En cas de malaise, premiers soins dispensés à bord et évacuation ou consultation médicale rapide au port le plus proche."
        }
      ];
    } else if (info.line === 'ponant' || info.line === 'grands_espaces') {
      pratiquePlaces = [
        {
          name: "Centre Médical & Médecin Urgentiste de Bord",
          category: "Santé, Urgences & Mal de Mer (24h/24)",
          tag: "Pont Bas (Proche Cabines)",
          address: "Centre Médical du Navire",
          metro: "Appel d'urgence depuis votre cabine",
          lat: 0, lng: 0,
          notes: "Cabinet médical complet avec médecin urgentiste francophone disponible 24h/24. Médicaments contre le mal de mer disponibles gracieusement sur demande."
        },
        {
          name: "Bureau d'Expédition & Relations Passagers",
          category: "Permanence Francophone & Briefings",
          tag: "Pont d'Accueil",
          address: "Hall de Réception",
          metro: "Accès Réception",
          lat: 0, lng: 0,
          notes: "Organisation des rotations en Zodiacs, consignes environnementales, météo et permanence quotidienne de votre accompagnatrice Voyages Girardot."
        }
      ];
    } else {
      pratiquePlaces = [
        {
          name: "Centre Médical & Hôpital de Bord",
          category: "Consultations Médicales & Urgences (24h/24)",
          tag: "Pont Inférieur",
          address: "Pont 1 ou 4 (Accès Ascenseurs)",
          metro: "Poste d'urgence cabine",
          lat: 0, lng: 0,
          notes: "Équipe de médecins et d'infirmiers disponible 24h/24 en mer. Traitement du mal de mer, soins et pharmacie du bord (couvert par assurance multirisque)."
        },
        {
          name: "Réception Principale & Guest Service (24h/24)",
          category: "Accueil, Facturation & Carte Cabine",
          tag: "Atrium Central",
          address: "Atrium Principal",
          metro: "Ascenseurs Centraux",
          lat: 0, lng: 0,
          notes: "Bornes automatiques d'enregistrement de carte bancaire, bureau d'information multilingue et assistance pour toutes vos démarches à bord."
        }
      ];
    }

    // F. Transports & Ponts
    const decks = getCruiseShipDecks(shipName, rawText);
    const transportPlaces = [
      {
        name: `Plan d'ensemble & Ponts du ${ship}`,
        category: "Orientation & Déplacements à bord",
        tag: `${decks.length} Ponts Passagers`,
        address: `À bord du ${ship}`,
        metro: "Consulter le module interactif ci-dessous",
        lat: 0, lng: 0,
        notes: `Découvrez la répartition des ponts, cabines et espaces publics à bord du ${ship}. Utilisez le module de navigation ci-dessous pour vous repérer et calculer vos itinéraires de cabine à lieu.`
      }
    ];

    return {
      welcomeMessage: `Bienvenue à bord du ${ship} ! Explorez les espaces du navire, vos escales et services dédiés :`,
      themes: [
        {
          id: "resto",
          label: info.isRiver ? "Restaurant & Gastronomie du bord" : "Restaurants du navire",
          icon: "utensils",
          color: "#e11d48",
          enabled: true,
          description: `Espaces de restauration à bord du ${ship} : tables incluses, buffets et spécialités gourmandes.`,
          places: restoPlaces
        },
        {
          id: "visites",
          label: info.isPolar ? "Sorties Zodiacs & Débarquements" : (info.isRiver ? "Synthèse des Escales Fluviales" : "Synthèse des Excursions & Escales"),
          icon: info.isPolar ? "snowflake" : (info.isRiver ? "water" : "compass"),
          color: "#059669",
          enabled: true,
          description: info.isPolar ? "Planning des débarquements sur les glaces et sorties d'observation en Zodiacs." : "Temps forts et excursions proposées à chaque escale de votre itinéraire.",
          places: excursionsPlaces
        },
        {
          id: "shopping",
          label: info.isRiver ? "Boutique Souvenirs du fleuve" : (info.isPolar ? "Comptoir Polaire & Livres" : "Boutiques & Shopping du bord"),
          icon: "bag-shopping",
          color: "#d97706",
          enabled: true,
          description: `Boutiques officielles et souvenirs à bord du ${ship}.`,
          places: shoppingPlaces
        },
        {
          id: "pratique",
          label: "Santé, Réception & Services",
          icon: "shield-heart",
          color: "#2563eb",
          enabled: true,
          description: "Médecin de bord, infirmerie, accueil 24h et modalités de paiement à bord.",
          places: pratiquePlaces
        },
        {
          id: "detente",
          label: info.isRiver ? "Salon Panoramique & Piste de Danse" : (info.isPolar ? "Salon d'Observation & Conférences" : "Bars & Salons du navire"),
          icon: info.isPolar ? "binoculars" : "martini-glass",
          color: "#9333ea",
          enabled: true,
          description: `Les salons et espaces de convivialité du ${ship}.`,
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

  // ---------------------------------------------------------------------------
  // 8. EXPOSITION GLOBALE
  // ---------------------------------------------------------------------------
  const fleetModule = {
    detectCruiseLineAndShip,
    getCruiseShipDecks,
    getCruiseKeyLocations,
    buildCruiseConciergerie,
    decodeCruiseCabin,
    getCruisePracticalInfo,
    getCruisePracticalTips,
    getCruiseContacts,
    CROISIEUROPE_DECKS,
    PONANT_DECKS,
    GRANDS_ESPACES_DECKS,
    MSC_GENERIC_DECKS
  };

  global.CRUISE_FLEET = fleetModule;
  global.detectCruiseLineAndShip = detectCruiseLineAndShip;
  global.getCruiseShipDecks = getCruiseShipDecks;
  global.getCruiseKeyLocations = getCruiseKeyLocations;
  global.buildCruiseConciergerie = buildCruiseConciergerie;
  global.decodeCruiseCabin = decodeCruiseCabin;
  global.getCruisePracticalInfo = getCruisePracticalInfo;
  global.getCruisePracticalTips = getCruisePracticalTips;
  global.getCruiseContacts = getCruiseContacts;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = fleetModule;
  }

})(typeof window !== 'undefined' ? window : global);
