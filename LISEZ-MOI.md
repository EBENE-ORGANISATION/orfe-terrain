# LOT 1A — ORFE Terrain

Application sans compilation ni dépendance à installer. Réalisée le 03/11/2026.
Écritures limitées à `telephone/` et `essais/telephone/`. Aucun classeur, fichier du Drive, fichier de `google/`, ni git modifié.

## Fichiers livrés

Dans `telephone/` :

| Fichier | Rôle |
|---|---|
| `index.html` | Page française, balises Apple, compteur permanent, fenêtre du code nouveau. |
| `style.css` | Présentation marine, contraste fort, taille de base 17 px et boutons de 48 px au minimum. |
| `app.mjs` | Connexion, équipe quotidienne, onglets, recensement, corrections, suggestions, gestion et déclenchement des envois. |
| `config.js` | Uniquement `BOITE_URL` (vide) et `VERSION`. Aucun code réel. |
| `metier.mjs` | Normalisation, UUID, validation, distance, meilleur point GPS, voisins et accusés d’envoi. |
| `gps.mjs` | Écoute GPS, meilleur point, délai et arrêt au seuil. |
| `transport.mjs` | POST JSON en `text/plain` ; recherche cartographique limitée et mémorisée. |
| `stockage.mjs` | IndexedDB : identité, droits, équipes, réglages, recensés et fiches. |
| `sw.js` | Cache applicatif et activation d’une mise à jour lors d’une ouverture suivante. Worker classique pour la compatibilité Safari 15. |
| `manifest.webmanifest` | Installation en application autonome, chemins relatifs. |
| `icone-192.png`, `icone-512.png` | Icônes simples de carnet, générées localement. |
| `LISEZ-MOI.md` | Ce compte rendu et la procédure d’essai. |

Dans `essais/telephone/` :

| Fichier | Rôle |
|---|---|
| `boite-factice.js` | Boîte d’essai persistante, cent recensés inventés, droits et gestion simulés, GPS fictif. |
| `metier.test.mjs` | Essais de normalisation, NIF, distance, GPS, voisins, saisies et file d’envoi. |
| `integration.test.mjs` | Essais du POST, de la carte, de l’écoute GPS et de la boîte factice. |
| `pwa.test.mjs` | Essais du UUID de repli, des fichiers, icônes, versions et événements du worker dans un environnement Node simulé. |
| `serveur.test.mjs` | Vérifie le serveur local et le refus de servir les autres dossiers. |
| `servir.mjs` | Petit serveur HTTP Node, sans installation, limité aux deux dossiers autorisés. |

## Lancer les essais automatiques

Depuis `C:\Users\LENOVO\Desktop\ORFE` avec Node récent (ici : 24.19.0) :

```powershell
node --test "APPLI TERRAIN/essais/telephone/*.test.mjs"
```

Résultat du 03/11/2026 : **16 essais réussis, 0 échec**. Les essais HTTP démarrent puis arrêtent leur propre serveur. Ils ne contactent aucun service externe.

## Ouvrir le mode factice

Depuis le même dossier :

```powershell
node "APPLI TERRAIN/essais/telephone/servir.mjs"
```

Ouvrir `http://127.0.0.1:8080/telephone/?factice=1`.

- Code fictif gestionnaire : **DEMO22**.
- Code fictif agent sans droits de gestion ni d’extraction : **DEMO33**.
- Le groupe fictif mobile fait apparaître Tournée ; le groupe bleu la masque.
- Le GPS factice produit des mesures de 60 m, 25 m, puis 9 m autour de 6,13 / 1,22. Il ne demande aucune position réelle.
- La carte est également simulée dans ce mode : aucun appel à OpenStreetMap.
- Le navigateur garde une base IndexedDB distincte pour l’essai et l’état de la boîte factice dans son stockage local. Après un retrait ou un changement de code fictif, son ancien code cesse donc aussi de fonctionner dans les essais suivants.
- Ouvrir une première fois avec réseau et attendre l’installation du cache avant d’essayer hors ligne. Pour simuler une coupure de la boîte factice, utiliser le mode hors ligne du navigateur : le serveur fictif étant local, arrêter seulement le serveur HTTP ne change pas `navigator.onLine`.
- Arrêter le serveur avec Ctrl+C.

Le serveur écoute uniquement sur cet ordinateur. Un essai sur un vrai téléphone exigera un hébergement HTTPS ; le GPS et le service worker ne fonctionnent pas sur une simple adresse HTTP du réseau local. Aucun hébergement n’a été publié.

## Comportements à vérifier dans un navigateur

1. Se connecter, choisir l’équipe, fermer puis rouvrir : le code reste connu ; une autre journée redemande l’équipe.
2. Enregistrer sans NIF pour un non-immatriculé ; essayer un NIF court avec OUI : avertissement, sans blocage si le champ contient des chiffres.
3. Vérifier le GPS vert à 9 m et la rue proposée par les voisins. Une rue déjà tapée reste conservée.
4. Après enregistrement, vérifier la nouvelle fiche : rue et immeuble sont conservés.
5. Passer hors ligne, enregistrer et corriger une fiche en attente. Revenir en ligne : accusé, compteur réduit, correction impossible après envoi. La fiche en cours de correction est exclue de l’envoi automatique jusqu’à son enregistrement ou à l’abandon de la correction.
6. Recharger hors ligne après le premier chargement complet et vérifier les suggestions mémorisées.
7. Dans Gestion, ajouter un agent, modifier ses droits, renouveler son code, puis le retirer. Le code nouveau apparaît une fois et disparaît à la fermeture de sa fenêtre. Tester aussi ajout, renommage et retrait d’équipe.
8. Retirer le réseau dans Gestion : « Il faut du réseau pour la gestion ».
9. Installer sur iPhone et Android, vérifier le plein soleil, le clavier, le défilement et les tailles de texte.
10. Pour vérifier une mise à jour, augmenter ensemble `VERSION` dans `config.js` et `sw.js`, charger la version disponible, puis rouvrir. Aucun rechargement n’est imposé lorsqu’une nouvelle version arrive pendant une saisie.

## Limites de vérification et questions pour le raccordement au LOT 1B

- Le navigateur automatisé de cette session est indisponible (« browser access host is unavailable »). Le rendu, IndexedDB dans Safari/Chrome, l’installation PWA, le GPS réel, la coupure réelle du réseau et la mise à jour entre deux versions restent à vérifier dans un navigateur. Les essais Node du worker simulent ses événements et son cache ; ils ne constituent pas un essai sur téléphone.
- `BOITE_URL` reste vide comme demandé. Le raccordement réel à Apps Script, ses redirections et l’accès interorigine restent à essayer avec le LOT 1B. Les dossiers `google/` et leurs fichiers n’ont pas été consultés ni modifiés.
- Le contrat ne définit pas les clés JSON exactes des éléments de la réponse `agents`. L’écran attend des objets `{nom, actif, peut_extraire, peut_gerer, code_fin}` ; les droits et l’état acceptent des booléens ou OUI/NON. La liste peut être un tableau direct ou être contenue dans `agents`. **Le LOT 1B peut-il confirmer cette forme, notamment `code_fin` pour les quatre derniers caractères ?** La boîte factice utilise cette convention d’essai ; il ne s’agit pas d’un ajout au contrat.
- L’application attend `reglages` sous forme d’objet indexé par les noms du contrat, par exemple `GPS_SEUIL_M`. Elle n’invente aucun seuil absent. **Cette forme est-elle celle du LOT 1B ?**
- La règle « Niveau = AUTRE : texte » est matérialisée par un champ de précision ; le texte saisi devient la valeur de `niveau`, sans ajouter de clé au message envoyé.
- Recherche, Tournée et Extraire restent des pages « Bientôt disponible », conformément à ce lot. Aucun envoi de tournée, export ou traitement Excel n’est implémenté ici.

Aucune installation dans les trois classeurs, export VBA, modification de l’historique général ou opération git : ces écritures sont hors de la zone autorisée pour ce lot.
