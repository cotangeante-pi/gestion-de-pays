# Nation — gestion de pays

Un jeu de gestion de pays en JavaScript, sans dépendance ni outil de build :
ouvre `index.html` dans un navigateur et joue.

Tu commences avec ta seule capitale. Tout le reste — provinces, bâtiments,
technologies, alliances — se colonise, se construit ou se négocie.

Avant de jouer, tu choisis ton monde : le nombre d'adversaires (1 à 11), le
nombre d'îles (1 à 8) et leur taille. La carte se dimensionne d'elle-même pour
que tout le monde tienne — une seule île minuscule avec onze adversaires sera
agrandie d'office, et l'écran de départ te le dit. Les îles ne se soudent
jamais : franchir un bras de mer demande une marine.

## Les provinces

Une province porte **plusieurs ouvrages**, dans la limite de ce que sa population
et son terrain supportent — d'un seul sur une montagne peu peuplée à cinq sur une
plaine populeuse. La capacité grandit avec les habitants.

Et plus une province est **dédiée** à un même ouvrage, plus elle y est efficace :
au-delà de la moitié, le rendement de la spécialité monte, jusqu'à +45 % pour une
province entièrement consacrée à un seul métier. Trois mines groupées valent plus
que trois mines éparpillées. Le Conseil en tient compte quand il choisit où bâtir.

## La mer

Sans flotte, un archipel est une prison. Une expédition outre-mer exige trois
choses : la technologie **Navigation**, une province côtière d'où appareiller, et
des **navires** — chacun porte trois unités terrestres. La portée, comptée en
cases d'océan, part de 3 et s'étend avec l'Industrie, l'Électricité et un port.

On peut alors fonder un comptoir sur une île voisine (200 or, contre 120 par la
terre) ou débarquer chez un ennemi. Une tête de pont se paie : les troupes
débarquées frappent à 70 % de leur force, et l'expédition est plafonnée par ce
que la flotte sait porter. L'IA prend la mer aux mêmes conditions, et le Conseil
planifie les débarquements comme les offensives terrestres.

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

**Écrire de soi-même.** Chaque dirigeant tient une veille du monde — tes
provinces, ton armée, tes guerres, les siennes — et t'écrit quand quelque chose
change : tu as déclaré la guerre à son allié, il perd du terrain, tu armes trop
vite, son offre expire, tu ne réponds jamais. Une quinzaine de sujets, tirés au
sort en pondérant par l'urgence, avec une mémoire qui évite les redites. Il te
pose aussi des questions, te donne des conseils non sollicités et te rapporte ce
que font les autres nations.

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

Quatre vitesses (0,5× à 4×). En pause, le temps est arrêté pour tout le monde :
tu peux discuter et lever des troupes, mais rien qui change la carte — ni par
l'interface, ni en donnant l'ordre au Conseil.

## Fichiers

| | |
|---|---|
| `game.js` | état du monde, économie, guerre, interface |
| `render.js`, `relief.js` | rendu de la carte et du relief |
| `ia.js` | compréhension, raisonnement, génération de parole |
| `ia-gestion.js` | lexique et intentions du Conseil |
| `marine.js` | portée navale, débarquements, colonisation outre-mer |
| `negociation.js` | propositions structurées, ultimatums, crédibilité |
| `diplomatie.js` | caractères, mémoire, décisions, répliques |
| `courrier.js` | veille du monde et correspondance spontanée |
| `conseil.js` | Conseil de la Couronne |
