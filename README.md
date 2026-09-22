# Nation — gestion de pays

Un jeu de gestion de pays en JavaScript, sans dépendance ni outil de build :
ouvre `index.html` dans un navigateur et joue.

Tu commences avec ta seule capitale. Tout le reste — provinces, bâtiments,
technologies, alliances — se colonise, se construit ou se négocie.

## Ce qui rend ce projet particulier

L'IA ne s'appuie sur aucun modèle de langage : tout est calculé en local.

**Comprendre.** Le texte que tu écris n'est pas comparé à une liste de questions
pré-écrites. Chaque mot est racinisé, projeté dans un espace d'une trentaine de
concepts (`paix`, `menace`, `argent`, `échange`, `bonheur`…), puis la phrase est
classée par similarité cosinus avec des prototypes d'actes de langage. Les mots
inconnus sont rattachés par similarité de forme, ce qui absorbe les fautes de
frappe. Une phrase composée est découpée en clauses.

**Raisonner.** Aucun seuil écrit à la main : chaque dirigeant mesure l'état du
monde tel qu'il le voit, projette l'état qui résulterait de chaque option, et
choisit celle qui maximise son utilité. Le prix d'une contre-proposition est son
point d'indifférence, majoré de sa marge.

**Négocier.** Les ultimatums sont lus comme des propositions structurées
— `{exige, offre, sanction, délai}`. Une menace ne vaut pas par les mots : elle
est pesée au rapport de force, à la frontière commune, et à ce que tu as fait de
tes menaces passées. Menace sans suite = crédit perdu, et il te le dira.

**Parler.** Les réponses sont construites à partir de la trace du raisonnement,
pas choisies dans une liste : la justification qu'un dirigeant te donne est bien
son calcul réel, chiffré.

Un Conseil de la Couronne partage le même moteur et gère ton pays avec toi :
il diagnostique, projette, classe les actions par rendement et exécute tes ordres.

## Interface

Une seule interface, de la fenêtre d'un téléphone à un téléviseur : tout est
exprimé en unités relatives et l'échelle suit la fenêtre. En format portrait, le
panneau passe sous la carte au lieu d'être à droite — c'est le même jeu, plié
autrement.

## Raccourcis

`Espace` pause · `molette` zoom · `flèches` / `WASD` déplacer ·
`C` capitale · `F` vue d'ensemble · `H` règles

En pause, le temps est arrêté pour tout le monde : tu peux discuter et lever des
troupes, mais rien qui change la carte.

## Fichiers

| | |
|---|---|
| `game.js` | état du monde, économie, guerre, interface |
| `render.js`, `relief.js` | rendu de la carte et du relief |
| `ia.js` | compréhension, raisonnement, génération de parole |
| `ia-gestion.js` | lexique et intentions du Conseil |
| `negociation.js` | propositions structurées, ultimatums, crédibilité |
| `diplomatie.js` | caractères, mémoire, décisions, répliques |
| `conseil.js` | Conseil de la Couronne |
