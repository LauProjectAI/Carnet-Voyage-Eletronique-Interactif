---
name: import-carnet-voyage
description: >-
  Guide et règles d'extraction pour analyser, extraire et structurer un carnet ou programme de voyage (PDF, texte, brochure) en un plan détaillé par jour et par étapes. À utiliser pour convertir un descriptif de voyage en structure de données prête pour l'import.
---

# Skill : Import et Structuration de Carnet de Voyage

Cette compétence fournit la méthode standardisée pour lire, analyser et convertir un document ou carnet de voyage (PDF, brochure, descriptif) en une structure claire découpée en **Jours** et **Étapes**.

---

## 1. Format Cible Obligatoire

Chaque journée doit respecter le formalisme suivant :

```markdown
### Jour [Numéro] : [Titre de la journée / Villes étapes]
* **Étape 1 : [Titre court de l'étape]** : [Explication exacte]
* **Étape 2 : [Titre court de l'étape]** : [Explication exacte]
* **Étape 3 : Déjeuner** : [Explication exacte ou "Déjeuner."]
...
* **Étape N : Dîner logement** : [Explication exacte ou "Dîner logement."]
```

---

## 2. Règles d'Extraction et Contraintes

1. **Intégration systématique des repas :**
   - Inclure obligatoirement une étape **« Déjeuner »** et une étape **« Dîner logement »** dans le déroulé de chaque journée.
   - **Exception unique** : Ne pas les insérer uniquement s'il est expressément indiqué dans le texte d'origine *« déjeuner libre »*, *« dîner libre »* ou *« repas libres »* (dans ce cas, mentionner l'étape correspondante comme quartier libre ou selon la mention exacte du document).
   - Si le repas est mentionné avec un contexte particulier dans le texte (ex: *« Déjeuner en cours de route »*, *« Arrêt déjeuner au fort de Pokharan »*, *« Déjeuner dans une ancienne haveli avec petit spectacle de marionnettes »*, *« Dîner et nuit à bord »*), reprendre ce texte exact dans l'explication.
   - Si le repas est simplement mentionné sans détail supplémentaire (ou implicite par la pension complète), indiquer l'intitulé standard (ex: *« Déjeuner. »* ou *« Dîner logement. »*).

2. **Fidélité textuelle stricte (Zéro résumé) :**
   - **Ne jamais résumer, tronquer, réécrire ou paraphraser** les explications d'étapes.
   - La partie explication doit correspondre **exactement à l'information et au texte du document source** pour permettre une importation fiable dans l'application ou la base de données.

3. **Découpage chronologique fin :**
   - Isoler chaque moment clé en une étape distincte :
     - Acheminement, vols, transferts majeurs, trains.
     - Visite de monuments, temples, forteresses, musées.
     - Activités spécifiques (safari, balade en rickshaw, promenade en bateau, atelier/démonstration, spectacle).
     - Repas (Déjeuner, Dîner).
     - Hébergement et temps libres.

4. **Titrage des étapes :**
   - Donner à chaque étape un titre court, clair et représentatif de l'action ou du lieu (ex: *« Qutub Minar et India Gate »*, *« Visite des Havelis »*, *« Déjeuner »*, *« Dîner logement »*).

---

## 3. Exemple de Référence (Gold Standard)

```markdown
### Jour 3 : Delhi - Mandawa
* **Étape 1 : Route pour Mandawa** : Route pour Mandawa. Arrêt dans un village Dhani.
* **Étape 2 : Déjeuner** : Déjeuner.
* **Étape 3 : Visite de Mandawa** : Visite de Mandawa, principale ville du Shekhawati, cernée par les sables du désert, connu pour ses maisons et havelis ornées de fresques qui sont parmi les plus anciennes de cette région du Rajasthan.
* **Étape 4 : Cuisine indienne** : Cocktail de bienvenue et démonstration de cuisine indienne.
* **Étape 5 : Dîner logement** : Dîner logement.

### Jour 5 : Bikaner - Jaisalmer
* **Étape 1 : Trajet vers Jaisalmer** : Direction Jaisalmer.
* **Étape 2 : Déjeuner** : Arrêt déjeuner au fort de Pokharan.
* **Étape 3 : Fin de journée libre** : Installation à l'hôtel. Fin de journée libre dans cette cité magique, profondément romantique et totalement préservée, surnommée la Cité Dorée en raison de la couleur que prend la pierre des remparts au coucher du soleil.
* **Étape 4 : Dîner logement** : Dîner logement.
```
