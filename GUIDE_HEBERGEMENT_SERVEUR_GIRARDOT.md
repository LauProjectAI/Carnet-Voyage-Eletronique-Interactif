# Guide de Déploiement & Hébergement sur le Serveur Girardot
## Carnet de Voyage Électronique Interactif (PWA) — Voyages Girardot

Ce document rassemble l'ensemble des informations, prérequis techniques, recommandations d'architecture et modèles de messages pour héberger l'application directement sur les serveurs de **Voyages Girardot** (ex: `carnet.voyages-girardot.com` ou `voyages-girardot.com/carnet/`).

---

## 1. Architecture & Légèreté Technique

L'application est conçue selon le modèle **Jamstack / PWA (Progressive Web App)** :

* **Aucune base de données complexe requise côté serveur (ni MySQL, ni PostgreSQL)** :
  * Le stockage des gros volumes (scans de passeports, vouchers, cartes d'embarquement, carnets hors-ligne, galerie de souvenirs) est géré directement sur l'appareil du voyageur via **IndexedDB** (`storage_service.js`).
* **Aucun serveur d'application lourd requis** :
  * Pas besoin d'environnement persistant Node.js, Python ou Java sur l'hôte.
  * L'application est servie par n'importe quel serveur web HTTP standard (**Apache, Nginx, LiteSpeed, cPanel, Plesk, OVH, Infomaniak**, etc.).
* **Composition** :
  * Fichiers web statiques optimisés (`.html`, `.css`, `.js`, `.json`, images SVG/PNG, audio MP3).

---

## 2. Les 4 Exigences & Recommandations Techniques

| Exigence | Importance | Détails & Justification |
| :--- | :---: | :--- |
| **1. Certificat SSL (HTTPS Obligatoire)** | **Indispensable** | Sans HTTPS, les navigateurs modernes (Chrome, Safari iOS, Edge) **bloquent** l'enregistrement du Service Worker (`sw.js`), l'installation PWA (« Ajouter à l'écran d'accueil ») et la géolocalisation GPS sur les cartes. Un certificat gratuit type *Let's Encrypt* suffit parfaitement. |
| **2. Emplacement (Sous-domaine ou Dossier)** | **Recommandé** | Idéalement un sous-domaine dédié : `https://carnet.voyages-girardot.com`<br>Ou un sous-dossier propre : `https://www.voyages-girardot.com/carnet/`. |
| **3. Types MIME et En-têtes HTTP** | **Important** | Le serveur doit délivrer :<br>• `.json` : `Content-Type: application/json; charset=utf-8`<br>• `manifest.json` : `Content-Type: application/manifest+json`<br>• `sw.js` : en-tête `Service-Worker-Allowed: /` et sans mise en cache agressive. |
| **4. Compression HTTP (Gzip ou Brotli)** | **Recommandé** | Réduit par 4 le poids des transferts et accélère l'affichage initial sur smartphone en 4G/5G. |

---

## 3. Gestion de l'Enregistrement des Carnets depuis l'Admin

Deux options s'offrent à l'agence pour alimenter et mettre à jour les carnets en ligne :

### Option A — Enregistrement Direct Girardot (Recommandé avec PHP)
Puisque l'environnement web Girardot supporte PHP :
* Un script ultra-léger et sécurisé (`save_trip.php` ~30 lignes) peut être placé sur le serveur.
* Protégé par une clé d'API secrète ou mot de passe défini dans les réglages de l'administration.
* Dès qu'un collaborateur clique sur **« Publier »** ou **« Enregistrer »** dans `admin.html`, le fichier JSON est directement écrit dans le dossier `/voyages/` de votre serveur, **sans dépendre de GitHub**.

### Option B — Déploiement via SFTP ou Synchronisation Git
* L'administration continue d'enregistrer sur le dépôt GitHub privé/public (ou vous exportez le JSON depuis l'admin).
* Les fichiers sont déposés dans le dossier `/voyages/` du serveur via **SFTP (FileZilla)** ou synchronisés automatiquement via un **Webhook Git**.

---

## 4. Procédure Étape par Étape

1. **Création du sous-domaine / espace d'hébergement** :
   * Créer `carnet.voyages-girardot.com` sur l'espace d'hébergement (OVH, cPanel, etc.).
   * Activer le certificat SSL gratuit (Let's Encrypt) et forcer la redirection vers HTTPS.
2. **Transfert des fichiers du projet via SFTP** :
   * Se connecter avec un client SFTP (FileZilla, Cyberduck ou WinSCP).
   * Copier à la racine du sous-domaine (`www` ou `public_html`) :
     * Pages : `index.html`, `admin.html`, `conducteur.html`.
     * Scripts : `app.js`, `admin.js`, `conducteur.js`, `storage_service.js`, `data.js`, `gemini_service.js`, `cruise_fleet.js`.
     * Styles & PWA : `style.css`, `manifest.json`, `sw.js`.
     * Dossier `voyages/` : `index_voyages.js` et l'ensemble des carnets `.json`.
     * Dossier `assets/` : logos, icônes PWA, sons.
3. **Permissions de fichiers** :
   * Répertoires en `755` et fichiers en `644`.
   * Dossier `/voyages/` avec droits d'écriture (`775` ou propriétaire `www-data`) si utilisation du script d'enregistrement direct.
4. **Vérification & Validation** :
   * Tester l'ouverture de `https://carnet.voyages-girardot.com/index.html?id=cocktail-mexicain`.
   * Tester l'installation PWA sur mobile (bouton « Installer » ou « Ajouter sur l'écran d'accueil »).
   * Couper la connexion (mode avion) pour vérifier la persistance hors-ligne.

---

## 5. Modèle d'E-mail pour l'Hébergeur ou l'Équipe Informatique

```text
Objet : Déploiement de notre application "Carnet de Voyage Électronique" (PWA) sur notre hébergement

Bonjour,

Nous souhaitons mettre en ligne notre nouvelle application web interactive de carnets de voyages (PWA) pour les clients de Voyages Girardot.

Il s'agit d'une application web statique moderne (HTML5 / CSS3 / JavaScript ES6 / Service Worker / IndexedDB) qui ne nécessite pas de serveur applicatif lourd (pas de Node.js ni de base SQL serveur requise).

Pourriez-vous préparer l'environnement suivant :

1. Emplacement :
   Créer un sous-domaine dédié : carnet.voyages-girardot.com (ou à défaut le sous-dossier /carnet/ sur notre domaine principal).
   
2. Sécurité & HTTPS (Obligatoire) :
   Activer un certificat SSL (type Let's Encrypt) avec redirection systématique de HTTP vers HTTPS (indispensable pour l'installation sur smartphone PWA et le mode hors-ligne).

3. Configuration serveur :
   - Autoriser le Service Worker à la racine (en-tête Service-Worker-Allowed: /).
   - Servir les fichiers .json avec l'en-tête Content-Type: application/json; charset=utf-8.
   - Servir manifest.json avec Content-Type: application/manifest+json.
   - Activer la compression Gzip/Brotli pour les fichiers .js, .css, .html et .json.

4. Accès :
   Nous transmettre un compte d'accès SFTP (hôte, identifiant, mot de passe ou clé) pointant directement vers le répertoire racine de ce site afin que nous puissions y déposer les fichiers du projet.

Restant à votre disposition pour tout complément technique.

Cordialement,
L'équipe Voyages Girardot
```
