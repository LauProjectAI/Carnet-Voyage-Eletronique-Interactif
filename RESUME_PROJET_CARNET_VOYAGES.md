# Synthèse Structurée du Projet — Carnet de Voyages Électronique Interactif
**Client / Organisation :** Voyages Girardot  
**Application :** Web-App PWA Offline-First Responsive (Mobile / Tablette / Bureau)  
**Dépôt GitHub :** `https://github.com/LauProjectAI/Carnet-Voyage-Eletronique-Interactif.git` (Branche `main`)  
**Date de mise à jour :** 4 novembre 2026  

---

## 🧭 1. Vision Globale & Fondations Techniques

Le projet consiste en un **Carnet de Voyages Électronique Interactif et Intelligent**, destiné aux voyageurs et aux équipes d'accompagnement de **Voyages Girardot** (conducteurs, accompagnateurs, conseillers voyages).

### Piliers d'Architecture
- **100% Autonome & Offline-First (PWA)** : L'application fonctionne sans connexion Internet une fois chargée dans le navigateur du voyageur (Service Worker cache `carnet-girardot-v20`, base locale haute capacité).
- **Zéro Coût Voyageur (0 token)** : La consultation du carnet, des cartes, des documents et de la conciergerie par les clients ne génère aucun coût d'API ni de consommation de jetons.
- **Stockage Local Haute Capacité (`IndexedDB`)** : Remplacement de la barrière des 5 Mo du `localStorage` par le moteur `storage_service.js`, permettant d'accueillir des dizaines de Mégaoctets de documents (scans de passeports, visas, billets d'avion PDF, photos souvenirs).
- **Synchronisation Transparente (*Stale-While-Revalidate*)** : Ouverture instantanée hors-ligne depuis le cache local, puis vérification automatique en arrière-plan des mises à jour publiées sur GitHub avec notification discrète.
- **Identité Visuelle Forte** : Charte Voyages Girardot (vert profond `#184232`, or `#e5b869`, typographie soignée, badges et pictogrammes thématiques).
- **Écosystème à 3 Espaces** :
  1. **Voyageur** (`index.html` / `app.js`) : Carnet de bord personnalisé, étapes chronologiques avec timeline interactive, géolocalisation GPS piéton, coffre-fort documents avec QR Codes, carnet photo souvenir illimité, météo et conciergerie ciblée.
  2. **Conducteur / Autocariste** (`conducteur.html` / `conducteur.js`) : Schéma du car, liste des passagers, attribution des chambres (rooming list), feuille de route, plans de car PDF et contacts d'urgence.
  3. **Administration Back-Office** (`admin.html` / `admin.js`) : Création, importation PDF intelligente, personnalisation des étapes, gestion des vols/hôtels, assistant IA pour temps libres et publication directe vers GitHub Pages via l'API GitHub.

---

## 💾 2. Révolution du Stockage & Synchronisation Client (IndexedDB & Stale-While-Revalidate)

Face aux limitations techniques du stockage web traditionnel constatées lors des tests :

### A. Levée de la Limite des 5 Mo via `IndexedDB` (`storage_service.js`)
* **Problématique initiale** : Le `localStorage` standard plafonne strictement à 5 Mo par domaine. L'encodage Base64 des fichiers ajoutant 33% de volume, l'ajout d'un plan de car PDF ou de scans de passeports entraînait une erreur bloquante `QuotaExceededError`.
* **Solution pérenne** : Création du module autonome [`storage_service.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/storage_service.js) pilotant `IndexedDB`.
  - Capacité disponible : de **50 Mo à plusieurs Go** selon l'appareil.
  - **Coffre-fort voyageur étendu** : scans HD de passeports, cartes d'identité, visas et billets d'avion PDF stockés localement sans restriction.
  - **Carnet photo illimité** : suppression de l'alerte de mémoire pleine dans l'onglet Souvenirs.
  - **Dossiers conducteurs volumineux** : hébergement sans faille des plans de car et listes des chambres.
  - **Migration automatique** : transfert transparent des anciennes données du `localStorage` vers `IndexedDB` au démarrage.

### B. Synchronisation Transparente en Arrière-Plan (*Stale-While-Revalidate*)
* **Problématique initiale** : Le carnet client lisait en priorité le cache local et ignorait les mises à jour publiées ultérieurement sur GitHub, figeant le carnet sur la première version consultée.
* **Résolution** :
  1. Au chargement, affichage immédiat de la version locale (rapidité et accès 100% hors-ligne).
  2. En tâche de fond, requête discrète vers le serveur GitHub avec horodatage anti-cache (`?_t=timestamp`).
  3. Si une modification est détectée, mise à jour silencieuse d'`IndexedDB` et rafraîchissement fluide de l'affichage avec le toast :  
     *« 🔄 Carnet actualisé avec les dernières informations de l'agence. »*
* **Validation terrain** : Testé et validé avec succès sur smartphone.

### C. Fiabilisation de la Publication Directe GitHub (Résolution Définitive de l'Erreur 422)
* **Diagnostic de l'erreur 422 (`"sha" wasn't supplied`)** : L'API Contents de GitHub exige impérativement le hash SHA du fichier lors de la mise à jour d'un JSON déjà existant sur le dépôt. L'erreur survenait car le Service Worker PWA (`sw.js`) interceptait les requêtes GET vers `api.github.com` et avait mis en cache la réponse HTTP 404 initiale (avant la création du fichier). Lors des publications ultérieures, `caches.match` renvoyait ce faux 404 local sans contacter GitHub, provoquant l'envoi d'un `PUT` sans `sha`.
* **Dispositif de sécurité en 4 couches** :
  1. **Bypass réseau immédiat dans `sw.js`** : Toutes les requêtes vers `api.github.com` traversent le Service Worker sans jamais être interceptées ni mises en cache.
  2. **Interdiction de mise en cache des erreurs** : Le Service Worker ne stocke plus que les réponses avec code HTTP 200.
  3. **Fonction `getGitHubFileSha` haute fiabilité** : Requête systématique en mode `cache: 'no-store'` avec timestamp anti-cache, assortie d'un fallback sur l'API Commits en cas de latence GitHub.
  4. **Auto-rattrapage transparent (Retry 422)** : Si l'API GitHub répond 422, l'application réinterroge immédiatement le SHA réel à la source et relance le commit sans interruption pour l'utilisateur.
* **Publication en 1 clic** : L'administrateur met à jour ses voyages en ligne et actualise automatiquement `voyages/index_voyages.js` directement depuis l'interface web.

---

## 🚢 3. Spécialisation Croisières & Plans de Navires

Moteur dédié conçu dans [`cruise_fleet.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/cruise_fleet.js) pour les partenaires croisiéristes (*Costa, MSC, CroisiEurope, Ponant, Grands Espaces, Voyages d'Exception*) :

- **Plans Interactifs des Ponts** : Génération dynamique des ponts passagers, repérage des zones clés (Proue, Centre, Poupe, Bâbord, Tribord) et signalement des services critiques (Infirmerie Pont 4, Passerelles, Atrium, Restaurants, Piscines).
- **Décodeur de Cabine & Boussole Marine** : Recherche instantanée par numéro de cabine (indication du pont et du côté) et boussole intégrée pour l'orientation en mer.
- **Vie à Bord** : Consignes *Muster Station* (sécurité), Web Check-In, compte de bord et formalités maritimes.

---

## 💡 4. Modèle Économique & Intégration IA pour les Temps Libres

### Arbitrage d'Architecture IA
- **Constat métier** : Sur un circuit accompagné ou organisé, les clients sont pris en charge. Une conciergerie généraliste est superflue. En revanche, lorsqu'une **demi-journée ou soirée libre** est prévue, une recommandation ciblée apporte une vraie valeur ajoutée.
- **Solution (Google Gemini 3.5 Flash-Lite Free Tier)** :
  - Palier gratuit de Google AI Studio (jusqu'à 1 500 requêtes/jour gratuites).
  - Réservé au concepteur du voyage dans `admin.html` : génération en 2 secondes de 3 à 5 adresses réelles et coups de cœur pour une ville et un créneau précis.
  - Intégration directe dans le JSON du voyage (`freeTimeSuggestions`).
  - Consultation par le voyageur **100% hors-ligne et gratuite**.
  - Chaîne de secours automatique (*Fallback Chain*) et découverte dynamique des modèles actifs.

### Profils de Voyage & Conciergerie Adaptative
1. **🧭 Circuit Accompagné / Guidé (`guided`)** : Conciergerie générale masquée. L'onglet devient **« Temps Libre »** avec vos sélections ciblées. S'il n'y a aucun temps libre, l'onglet disparaît proprement.
2. **🚢 Croisière (`cruise`)** : L'onglet devient **« Navire »** (plans des ponts, cabines, vie de bord).
3. **🏙️ Séjour Libre / City-Break (`full`)** : Conciergerie complète de la ville (métro, sélection restaurants/bars).
4. **🚫 100% Guidé sans temps libre (`disabled`)** : Onglet conciergerie entièrement masqué.
5. **Alerte intelligente dans le fil du jour** : Bandeau vert dans la timeline active : *« 🧭 Temps Libre Prévu Aujourd'hui — Découvrir les adresses »*.

---

## 📄 5. Perfectionnement du Convertisseur PDF & Découpage Précis des Étapes

### A. Découpage Rigoureux Trajet / Descriptif / Thématique
- **Titre de l'étape (`title`)** : Ne conserve désormais **strictement que le trajet** (ex: *Votre région - Paris - Mexico*, *Mexico*, *Puebla - Oaxaca*).
- **Descriptif global (`description`)** : Reçoit l'intégralité du texte narratif et du programme de la journée.
- **Thématique / Point fort (`highlight`)** : Laissée **vide (`""`)** à l'import, prête à être complétée manuellement selon les souhaits de l'agence.

### B. Gestion Réaliste des Horaires
- **Suppression des faux horaires inventés** : Si le texte ne précise aucune heure, le champ reste vide (`time: ""`).
- **Affichage épuré** : Pastille visuelle élégante alignée avec le titre de chaque visite / étape.
- **Détection des horaires réels** : Extraction des heures explicites lorsqu'elles sont mentionnées dans le PDF (ex: *09h15*, *11h45*).

### C. Récupération des Vols et des 9 Hôtels GPS
- **Vols réels** : Extraction exacte des vols réguliers (ex: Air France *AF 178* et *AF 651* avec aéroports, terminaux et heures de convocation).
- **Hébergements** : Capture des noms d'hôtels, adresses complètes, téléphones et coordonnées GPS réelles (dont la correction de l'adresse piège *« Paris No. 9 »* à Mexico CDMX).
- **Infos pratiques terrestres** : Extraction des 9 rubriques indispensables (Monnaie, Électricité, Climat, Vêtements, Pourboires, Wi-Fi, etc.).

### D. Circuits Asie & Long-Courrier (Exemple : Inde du Nord)
- **Hébergement singulier sans dates explicites** : Reconnaissance du singulier *« Coordonnées de votre hôtel »* et fallback pour extraire les coordonnées même en l'absence de mentions *"Du ... au ..."* (*DEVENTURE HOTEL*, New Delhi).
- **Géocodage des villes indiennes** : Enrichissement de `DESTINATION_CITY_COORDINATES` avec New Delhi, Delhi, Mandawa, Bikaner, Jaisalmer, Dunes de Sam, Jodhpur, Luni, Jaipur, Abhaneri, Agra (Taj Mahal), Jhansi, Orchha, Khajuraho, Varanasi (Bénarès), Sarnath et Genève.
- **Contacts réceptifs sur place** : Prise en charge des libellés sans ponctuation (*Votre contact sur place ASI TRAVELS PVT LTD* avec adresse et téléphone de permanence 24h).
- **Formalités d'entrée & Déclaration sanitaire *Air Suvidha*** :
  - Extraction du bloc complet : *« Passeport valide 6 mois après la date de votre retour. Visa obligatoire. »*
  - Détection automatique de la déclaration de santé en ligne obligatoire *Air Suvidha* (avec timing strict de remplissage dans les 24h avant l'arrivée et génération du QR Code).
  - Création d'un bandeau d'alerte interactif et d'une fiche pratique dédiée pointant directement vers le portail officiel [`airsuvidha.civilaviation.gov.in`](https://airsuvidha.civilaviation.gov.in).

### E. Règle d'Or du Titrage des Visites / Étapes : Nom ou Groupe Nominal Strict (Règle n°4)
Face aux risques de fragmentation excessive et de titres verbeux constatés lors des imports PDF :
1. **Nature grammaticale stricte** :
   - Le titre d'une visite / étape (`title`) est **impérativement un nom propre ou un groupe nominal court** (1 à 5 mots, 40 caractères max), jamais une phrase complète, ni un début de phrase tronqué.
   - **Interdictions formelles** : pas de verbes conjugués (*« est »*, *« fut »*, *« sont »*, *« permet »*, *« abrite »*, *« découvrez »*, *« a voir »*), pas d'adverbes ni de prépositions orphelines en bout de titre (*« vers »*, *« pour »*, *« en »*, *« entre »*).
2. **Nominalisation automatique des actions et trajets** :
   - Tout intitulé verbal ou début de phrase narratif est converti automatiquement en entité nominale noble :
     - *« Départ par la route côtière en Gaspésie »* ➔ **Route côtière de Gaspésie**
     - *« Arrivée à Tadoussac pour déjeuner »* ➔ **Déjeuner**
     - *« Arrivée à Gaspé »* ➔ **Gaspé**
     - *« Arrivée à Rimouski »* ➔ **Rimouski**
     - *« Route vers Montréal »* ➔ **Montréal**
     - *« Route vers Niagara »* ➔ **Niagara**
     - *« Philadelphie en Pennsylvanie »* ➔ **Philadelphie**
     - *« Région de Harrisburg »* ➔ **Harrisburg**
     - *« Traversée en ferry vers la Statue de la Liberté »* ➔ **Statue de la Liberté**
     - *« Traversée en ferry vers Québec avec arrivée spectaculaire... »* ➔ **Ferry vers Québec** (évite la collision avec la visite de Québec)
     - *« Découverte des Chutes, mondialement célèbres... »* ➔ **Chutes du Niagara**
     - *« Journée consacrée au réacheminement »* ➔ **Réacheminement**
     - *« Croisière d'observation des baleines en bateau »* ➔ **Observation des baleines** (aucun « en » orphelin)
     - *« Trésor gastronomique québécois le sirop d'érable »* ➔ **Sirop d’érable**
     - *« Journée libre pour profiter des achats... »* ➔ **Journée libre**
3. **Absorption intégrale des sous-phrases explicatives** :
   - Toute phrase explicative, anecdotique ou descriptive située sous une étape principale est systématiquement greffée au champ description (`subtitle`) de l'étape parente au lieu d'engendrer une fausse étape (ex: *Un havre de nature...* dans *Parc Jacques Cartier*, *ce sanctuaire naturel* dans *Île de Bonaventure*, *Avec ses maisons traditionnelles...* dans *Île d’Orléans*, *Balade sur le pont...* dans *Chutes Montmorency*, *seule cité nord-américaine...* dans *Québec*, *Tour de ville* et *Rideau Hall* dans *Ottawa*, *Une multitude d'îles...* dans *Croisière des Mille-Îles*, *Toronto bénéficie...* dans *Toronto*, *Ce court trajet...* dans *Croisière Hornblower*, *A voir / Visite guidée* dans *Washington*).
4. **Déduplication consécutive des étapes de même nom** :
   - Si deux segments successifs partagent le même titre normalisé (ex: double *Parc Jacques Cartier*), leurs descriptifs sont fusionnés dans une unique étape.
5. **Isolation totale des Coups de Cœur et Conciergerie** :
   - Aucun lieu ni coup de cœur sud-africain ne peut subsister lors d'une page vierge ou de l'import d'un nouveau circuit (zéro pollution carte ou conciergerie).

---

## 📂 6. Cartographie des Fichiers Clés du Projet

| Fichier | Rôle & Évolutions majeures |
| :--- | :--- |
| [`storage_service.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/storage_service.js) | **Nouveau** : Moteur universel `IndexedDB` haute capacité, gestion des gros fichiers (PDF, scans, photos) et auto-migration. |
| [`admin.html`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/admin.html) | Interface d'administration, sélecteur de profil à l'import PDF, modale Gemini, bouton flottant de publication directe GitHub. |
| [`admin.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/admin.js) | Convertisseur PDF multi-pages, garantie de la totalité absolue des jours du voyage (déploiement multi-jours et comblement automatique des journées libres), encart de présentation détaillée pour les hôtels de séjour (chambres, restauration, formule tout inclus, sports & loisirs, plage), résolution des étapes et villes blindée par frontières de mots entiers et filtre pays strict, connecteur GitHub ultra-robuste. |
| [`app.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/app.js) | Moteur voyageur, synchronisation Stale-While-Revalidate, coffre-fort documents et souvenirs illimités sur IndexedDB, pastilles d'étapes sans faux horaires, filtrage strict des coups de cœur, bon d'échange/QR code contextualisé par visite dans le programme (suppression du cartouche générique haut). |
| [`gemini_service.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/gemini_service.js) | Assistant IA pour temps libres (Gemini 3.5 Flash-Lite), découverte dynamique des modèles autorisés et chaîne de repli. |
| [`cruise_fleet.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/cruise_fleet.js) | Flottes de navires de croisière, plans interactifs des ponts, décodeur de cabine et boussole marine. |
| [`conducteur.html`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/conducteur.html) / [`.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/conducteur.js) | Espace autocariste : schéma du car, passagers, rooming list, plans PDF grand format. |
| [`sw.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/sw.js) | Service Worker PWA (`carnet-girardot-v22`) avec bypass GitHub API et mise en cache offline stricte des réponses HTTP 200. |
| [`voyages/index_voyages.js`](file:///c:/Users/lbidet/Documents/Projet%20AI/Carnet%20de%20Voyages%20Electronique%20Interactif/voyages/index_voyages.js) | Catalogue des voyages enregistrés avec résolutions d'alias (`cocktail-mexicain`, `san-francisco-perso`, `afrique-du-sud-2026`, etc.). |

---

## 🎯 7. État de Déploiement & Prochaines Évolutions

* **Statut Technique** : L'écosystème est stable, autonome, testé sur mobile et desktop, et entièrement synchronisé sur la branche principale GitHub (`main`).
* **Expérience Voyageur** : Temps de chargement nul, réactivité complète hors-ligne, coffre-fort de documents sans limitation de volume et mise à jour automatique des carnets.
* **Axes d'extension possibles** :
  1. Continuer l'intégration de nouveaux circuits (Europe, Asie, Amériques) et croisières fluviales/maritimes.
  2. Enrichir le module conducteur avec la signature numérique des feuilles de route.
  3. Proposer le téléchargement groupé d'un carnet sous forme d'archive imprimable en cas de secours.
