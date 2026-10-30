/**
 * storage_service.js - Moteur de stockage universel haute capacité Girardot (IndexedDB)
 * -----------------------------------------------------------------------------------
 * Remplace la limitation des 5 Mo du localStorage par la capacité quasi-illimitée
 * d'IndexedDB (50 Mo à plusieurs Go) pour le stockage des :
 *  - Documents volumineux (scans de passeports, visas, billets d'avion PDF)
 *  - Plans de car et dossiers conducteurs
 *  - Photos souvenirs en haute définition
 *  - Carnets de voyages complets
 *
 * Fonctionne 100% hors-ligne (PWA) sur tous les navigateurs récents (iOS, Android, PC, Mac)
 * avec rétrocompatibilité et migration automatique transparente depuis le localStorage.
 */

(function(window) {
  'use strict';

  const DB_NAME = 'girardot_carnet_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'app_storage';

  let dbPromise = null;
  let isIndexedDBAvailable = true;

  // Détection du support IndexedDB
  try {
    if (!('indexedDB' in window)) {
      isIndexedDBAvailable = false;
    }
  } catch (e) {
    isIndexedDBAvailable = false;
  }

  // Initialisation ou ouverture de la base
  function getDb() {
    if (!isIndexedDBAvailable) {
      return Promise.reject(new Error("IndexedDB non disponible dans ce navigateur"));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = function(event) {
          resolve(event.target.result);
        };

        request.onerror = function(event) {
          console.warn("Échec d'ouverture IndexedDB, repli sur localStorage:", event.target.error);
          isIndexedDBAvailable = false;
          reject(event.target.error);
        };
      } catch (err) {
        console.warn("Exception ouverture IndexedDB:", err);
        isIndexedDBAvailable = false;
        reject(err);
      }
    });

    return dbPromise;
  }

  // Interface universelle GirardotStorage
  const GirardotStorage = {
    /**
     * Récupère une valeur par sa clé (asynchrone)
     * @param {string} key
     * @param {*} defaultValue
     * @returns {Promise<*>}
     */
    async get(key, defaultValue = null) {
      if (isIndexedDBAvailable) {
        try {
          const db = await getDb();
          return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
              if (req.result && req.result.value !== undefined) {
                resolve(req.result.value);
              } else {
                // Vérifier si présent dans localStorage pour migration paresseuse
                try {
                  const fallback = localStorage.getItem(key);
                  if (fallback !== null) {
                    try {
                      const parsed = JSON.parse(fallback);
                      // Migrer silencieusement vers IndexedDB
                      GirardotStorage.set(key, parsed).catch(() => {});
                      resolve(parsed);
                      return;
                    } catch (e) {
                      resolve(fallback);
                      return;
                    }
                  }
                } catch (e) {}
                resolve(defaultValue);
              }
            };
            req.onerror = () => resolve(defaultValue);
          });
        } catch (e) {
          // Repli sur localStorage
        }
      }

      // Repli localStorage
      try {
        const val = localStorage.getItem(key);
        if (val === null) return defaultValue;
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
        }
      } catch (e) {
        return defaultValue;
      }
    },

    /**
     * Enregistre une valeur volumineuse ou structurée
     * @param {string} key
     * @param {*} value
     * @returns {Promise<boolean>}
     */
    async set(key, value) {
      let savedInIdb = false;

      if (isIndexedDBAvailable) {
        try {
          const db = await getDb();
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key: key, value: value, updatedAt: Date.now() });
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
          });
          savedInIdb = true;
        } catch (err) {
          console.warn(`Erreur écriture IndexedDB [${key}], repli localStorage:`, err);
        }
      }

      // Pour les petites clés ou si IndexedDB indisponible, synchroniser aussi avec localStorage
      // mais en attrapant les QuotaExceededError sans planter l'appli
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        // Si le contenu fait moins de 400 Ko, le mémoriser aussi dans localStorage pour l'accès synchrone
        if (serialized.length < 400000) {
          localStorage.setItem(key, serialized);
        } else if (savedInIdb) {
          // Si le contenu est gros et bien sauvé en IndexedDB, libérer l'espace dans localStorage !
          localStorage.removeItem(key);
        }
      } catch (storageErr) {
        // Quota dépassé dans localStorage : ce n'est pas grave car sauvegardé dans IndexedDB !
        if (!savedInIdb) {
          console.error("Échec critique de stockage (localStorage plein et IndexedDB non disponible):", storageErr);
          return false;
        }
      }

      return true;
    },

    /**
     * Supprime une clé
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async remove(key) {
      if (isIndexedDBAvailable) {
        try {
          const db = await getDb();
          await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
          });
        } catch (e) {}
      }

      try {
        localStorage.removeItem(key);
      } catch (e) {}
      return true;
    },

    /**
     * Liste toutes les clés
     * @returns {Promise<string[]>}
     */
    async keys() {
      if (isIndexedDBAvailable) {
        try {
          const db = await getDb();
          return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
        } catch (e) {}
      }

      try {
        return Object.keys(localStorage);
      } catch (e) {
        return [];
      }
    },

    /**
     * Migration automatique de toutes les clés Girardot existantes dans localStorage vers IndexedDB
     */
    async autoMigrateLegacyStorage() {
      if (!isIndexedDBAvailable) return;
      try {
        const keysToMigrate = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('girardot_')) {
            keysToMigrate.push(k);
          }
        }

        for (const k of keysToMigrate) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              let val = raw;
              try { val = JSON.parse(raw); } catch (e) {}
              await this.set(k, val);
              // Si la valeur est volumineuse (> 100 Ko), libérer l'espace localStorage
              if (raw.length > 100000) {
                localStorage.removeItem(k);
              }
            }
          } catch (itemErr) {
            console.warn(`Erreur migration clé ${k}:`, itemErr);
          }
        }
      } catch (err) {
        console.warn("Auto-migration IndexedDB terminée avec avertissement:", err);
      }
    }
  };

  // Exposer globalement
  window.GirardotStorage = GirardotStorage;

  // Déclencher la migration en tâche de fond dès le chargement du script
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => GirardotStorage.autoMigrateLegacyStorage());
  } else {
    setTimeout(() => GirardotStorage.autoMigrateLegacyStorage(), 1200);
  }

})(window);
