# Compte rendu LOT 3-APPLI — 03/11/2026

Version téléphone : **1.1.0**. Travail limité à `telephone/` et `essais/telephone/`. Aucun appel à git, aucune modification du contrat, des classeurs, de `google/`, de `excel/`, de `CODE/` ou de la passation. Aucun déploiement effectué.

## Fichiers changés

- `telephone/app.mjs` : raccordement des écrans, cache des connus et du lot, actions différées, visites dans la file des fiches, protection de la saisie pendant les mises à jour.
- `telephone/tournee.mjs` (nouveau) : index de recherche, lecture des connus, préparation d'une mise à jour, trajet et liens Maps, localisation, validation des visites, état local, annulations et avertissements cadenas. Logique indépendante du navigateur.
- `telephone/stockage.mjs` : possibilité de séparer deux carnets de démonstration ; stockage réel inchangé.
- `telephone/config.js` et `telephone/sw.js` : version 1.1.0 et mise en cache du nouveau module.
- `telephone/style.css` : résultats, liens et texte long ; boutons de 48 px. Pied bleu conservé, aucun changement du viewport ou du mode d'affichage.
- `essais/telephone/boite-factice.js` : connus, lot, prises, retraits, visites, annulations, cadenas et partage de la boîte entre onglets, uniquement avec des données inventées.
- `essais/telephone/lot3.test.mjs` (nouveau) : 21 essais supplémentaires.
- Le présent compte rendu.

## Écrans et fonctionnement

**Recherche** : une case cherche ensemble les recensés, les connus de TERRAIN et les recensements locaux non envoyés. Chaque mot est exigé ; accents, casse et espaces sont neutralisés, le téléphone est cherché par chiffres. Index préparé au chargement des données, 50 résultats au plus et nombre total. Source, rue et distance affichées lorsque les positions existent. Le détail ouvre Maps et permet « Mettre à jour » : nouvel identifiant, champs préremplis, GPS repris et jamais recopié. Les connus sont demandés au plus une fois par jour, avec leur version, et restent disponibles hors ligne.

**Lot du jour** : réservé à une équipe autorisée à faire la tournée. Adresse, RAR, attente, dernier résultat, prises des autres en gris. Cases et boutons « Je prends », « Lâcher », « Retirer de la liste ». Confirmation du retrait et avertissement avant de prendre un contribuable déjà pris. Les actions sont conservées hors ligne avec leur équipe d'origine puis envoyées dans l'ordre. Le dernier lot téléchargé reste disponible ; sa date est indiquée.

**Mon trajet** : seulement mes contribuables pris, non terminés et non retirés. GPS rapide limité à dix secondes, plus proche voisin puis 2-opt, liens Maps avec trois étapes intermédiaires au plus et continuité entre les parties. Sans GPS ou avec un GPS explicitement imprécis : liste « À vérifier ». Bouton Recalculer et veille GPS sans haute précision pour le bandeau d'arrivée.

**Visite** : choix du résultat, champs adaptés, GPS soigné et bouton « Garder ce point », question de localisation au-delà du seuil, avertissements cadenas tenant compte des poses locales. Réouverture cachée sauf réglage OUI. Enregistrement dans la même file et le même compteur que les recensements. Effet local immédiat, ordre par date, annulation par une nouvelle fiche. Une ancienne visite acquittée ne remplace pas le lot plus récent reçu du serveur. La saisie utilise toujours `#fiche[data-modifie]` et bloque l'activation automatique d'une nouvelle version.

## Essais

Commande exécutée depuis la racine, sans dépendance ajoutée :

```powershell
$essais = Get-ChildItem -LiteralPath 'APPLI TERRAIN\essais' -Recurse -File |
  Where-Object { $_.Name -match '\.test\.(mjs|cjs|js)$' } |
  ForEach-Object { $_.FullName }
node --test $essais
```

**95 essais réussis, aucun échec**, téléphone, Google et TERRAIN compris. Aucun échec hors zone à signaler. Syntaxe des modules modifiés vérifiée par Node.

Les essais supplémentaires couvrent notamment : 12 000 lignes de recherche, dix jeux de huit points comparés à la force brute (tolérance de 10 %), découpage et continuité Maps, localisation, champs par résultat, chaînes de poses/retraits de cadenas, annulation, ordre des actions différées, conservation de l'équipe d'origine, cache quotidien/version, état reçu du serveur et blocage de mise à jour pendant une visite.

## À vérifier par Claude ou sur téléphone

Pas de validation effectuée dans un navigateur réel : affichage à 375 px, interactions tactiles, deux onglets en fonctionnement complet, installation et mise à jour PWA restent à essayer. Le vrai GPS, la batterie, l'arrivée sur place, iPhone/Safari et l'ouverture effective de Maps n'ont pas été vérifiés. La performance sur un téléphone moyen reste à mesurer ; la mesure Node ne la garantit pas. Aucune demande envoyée à la vraie boîte ni aux services de carte.

Pour deux téléphones fictifs, lancer `node "APPLI TERRAIN/essais/telephone/servir.mjs"`, puis ouvrir :

- `http://127.0.0.1:8080/telephone/?factice=1&carnet=un`
- `http://127.0.0.1:8080/telephone/?factice=1&carnet=deux`

Choisir les deux agents fictifs présentés sur l'écran de connexion, puis l'équipe fictive mobile. Les carnets sont indépendants et la boîte factice est commune. Les prises des autres apparaissent après rafraîchissement ; une synchronisation est aussi lancée toutes les deux minutes et au retour du réseau.

## Question sur le contrat

La réponse `lot` de la section 9.3 ne fournit ni `gps` ni `precision`, alors que la section 9.4 demande d'écarter les points imprécis. L'application écarte les points explicitement marqués `IMPRECIS` et les GPS absents ; elle ne peut pas déduire une précision qui n'est pas transmise. Faut-il compléter le format de `lot` avec l'état GPS ou la précision ? Aucun changement de contrat ou de boîte n'a été fait pour résoudre cette question.
