/* ===========================================================
   IA DIPLOMATIQUE — LANGAGE PARLÉ
   Les joueurs n'écrivent pas comme dans un traité : « slt »,
   « t nul », « ok », « nan », « dsl », « file moi 100 or ».
   Ces tournures sont ramenées à des jetons que le lexique
   connaît, AVANT la vectorisation. Les jetons finissent par un
   chiffre pour que radical() ne les ampute pas.
   =========================================================== */

Object.assign(LEX, {
  salut9:{salutation:1},
  accord9:{accord:1},
  refus9:{refus:1},
  excuse9:{excuse:1},
  merci9:{gratitude:.9, politesse:.6},
  adieu9:{adieu:1},
  insulte9:{insulte:1},
  bravo9:{politesse:1, confiance:.35},
  menace9:{menace:1, force:.3},
  poli9:{politesse:.3},
  pacte9:{union:.85, paix:.75},
  // « ça va » ne veut pas dire « j'accepte » : sans cela, « ça va ? » concluait un marché
  va:{},
});
CLES_LEX = Object.keys(LEX);

/* --- tournures communes à tous les interlocuteurs (dirigeants et Conseil) --- */
const EXPRESSIONS_ORAL = [
  // « t'es », « t nul » → « tu es »
  [/\bt (es|etais)\b/g, 'tu es'],
  [/\bt (?=(nul|nulle|bete|con|conne|debile|moche|naze|trop|vraiment|tellement|fort|forte|cool|sympa|genial|gentil|gentille|mechant|lourd|relou|chiant|le|la|un|une)\b)/g, 'tu es '],
  // politesse
  [/\bs il (te|vous) plait\b/g, 'poli9'], [/\b(stp|svp|stplait|plz|pls)\b/g, 'poli9'],
  // argent en argot
  [/\b(thunes?|tunes?|fric|pognon|moula|oseille|flouze|biff|argent)\b/g, 'or'],
  // salutations — « ça va ? » est une salutation, pas un accord
  [/\b(comment ca va|comment tu vas|ca va|cv|la forme)\s*\?/g, 'salut9 ?'],
  [/\b(slt|salu|salut|wesh|coucou|cc|hey|hello|bjr|bonjour|bonsoir)( (ca va|cv))?\b/g, 'salut9'],
  [/^\s*(yo|hi|cv)\s*!*\s*$/g, ' salut9 '],
  // accord
  [/\b(ca marche|ca me va|ca me convient|c est bon pour moi|marche conclu|tope la|pas de souci|pas de probleme|avec plaisir|j accepte|bien sur|evidemment|carrement|volontiers)\b/g, 'accord9'],
  [/\b(ok|okay|oki|okey|dac|dak|vas y|deal|ouais|ouai|yes|yep)\b/g, 'accord9'],
  [/^\s*go\s*!*\s*$/g, ' accord9 '],
  // refus
  [/\b(pas question|jamais de la vie|laisse tomber|tu reves|meme pas en reve|certainement pas|aucune chance|pas moyen|non merci|no way|sans facon)\b/g, 'refus9'],
  [/\b(nan|nope|niet)\b/g, 'refus9'],
  // excuses, remerciements, au revoir
  [/\b(dsl|desolee?|my bad|oups|mea culpa|pardonne moi|je m excuse)\b/g, 'excuse9'],
  [/\b(merci beaucoup|merci bcp|mrc|thx|thanks|cimer|mercii+)\b/g, 'merci9'],
  [/\b(bye( bye)?|ciao|tchao|a plus( tard)?|a la prochaine|a bientot|au revoir)\s*$/g, 'adieu9 '],
];

/* --- tournures qui ne concernent que les dirigeants étrangers --- */
const INSULTES = 'nul|nulle|bete|con|conne|debile|idiot|idiote|stupide|moche|naze|nase|noob|loser|clown|guignol|tocard|boloss|bouffon|abruti|cretin|minable|pathetique|nulos|nullos|mechant|mechante|relou|chiant|chiante|lourd';
const QUALITES = 'fort|forte|cool|sympa|genial|geniale|gentil|gentille|meilleur|meilleure|intelligent|intelligente|malin|maligne|incroyable|balaise|puissant|puissante|sage|drole';

/* --- QUI DONNE À QUI : le verbe « donner » ne suffit pas, ce sont les pronoms qui décident.
       « je te donne » → le joueur offre ; « donne-moi », « tu me donnes », « donne 25 or » → il demande. --- */
const VERBES_DON = 'donner|donnes?|filer|files?|verser|verses?|preter|pretes?|envoyer|envoies?|payer|payes?|paies?|offrir|offres?|refiler|refiles?';
EXPRESSIONS_DIPLO.unshift(
  // le joueur donne : on ramène toutes les tournures à « je te donne », que negociation.js reconnaît
  [/\bje (vais |peux |veux |compte )?(te |t |vous )?(donne|donner|offre|offrir|verse|verser|paie|paye|payer|envoie|envoyer|prete|preter|cede|ceder|file|filer)\b/g, 'je te donne'],
  // le joueur demande : « tu me donnes », « tu peux me donner », « tu me dois »
  [new RegExp(`\\b(tu (peux|pourrais|veux|voudrais|dois|vas) )?(me|m|nous) (${VERBES_DON}|dois)\\b`, 'g'), 'demand argent'],
  [new RegExp(`\\btu (me|m|nous) (${VERBES_DON})\\b`, 'g'), 'demand argent'],
  // « donnes-moi », « files-nous » (impératif mal orthographié)
  [new RegExp(`\\b(${VERBES_DON}) (moi|nous)\\b`, 'g'), 'demand argent'],
  // un ordre en tête de phrase, sans « je » : « donne 25 or », « paye 100 or »
  [/^\s*(donne|file|verse|envoie|paye|paie|aboule|balance|refile)\b/g, ' demand argent'],
);

EXPRESSIONS_DIPLO.unshift(
  // insultes
  [new RegExp(`\\btu es (vraiment |trop |tellement |qu )?(un |une )?(${INSULTES})\\b`, 'g'), 'insulte9'],
  [new RegExp(`\\b(espece de|sale|gros|grosse) (${INSULTES})\\b`, 'g'), 'insulte9'],
  [/\b(ta gueule|ferme la|ferme ta (bouche|gueule)|tg|tu pues|tu sens mauvais|va te faire \w+)\b/g, 'insulte9'],
  [/\b(noob|loser|nullos|nulos|boloss|tocard|guignol|debile|cretin|abruti|naze)\b/g, 'insulte9'],
  // compliments
  [new RegExp(`\\btu es (vraiment |trop |tellement |tres |le |la )*(${QUALITES})\\b`, 'g'), 'bravo9'],
  [/\b(bien joue|gg|bravo|trop fort|trop bien|chapeau|la classe)\b/g, 'bravo9'],
  // menaces : « je vais t'attaquer » annonce, « je t'attaque » déclare
  [/\bje (vais|veux|compte|peux|pourrais) (te |t )?(attaquer|envahir|ecraser|detruire|exploser|defoncer|eclater|raser|aneantir|bruler|massacrer|pulveriser)\b/g, 'menace9 je t attaque'],
  [/\bje (te |t )?(detrui[st]?|explose|defonce|eclate|pulverise)\b/g, 'menace9 je t attaque'],
  [/\b(fais gaffe|attention a toi|gare a toi|tu vas voir|tu vas (le )?payer|tu vas prendre cher|tu vas souffrir|tu vas mourir|tu vas perdre)\b/g, 'menace9'],
  // amitié : un pacte, pas une alliance militaire
  [/\b(on (est|soit|devient|deviens?)|soyons|etre|devenir) (des )?(potes|amis|amies|copains|copines|freres|soeurs)\b/g, 'pacte9'],
  // « rejoins-moi contre X » : une alliance de guerre
  [/\b(rejoins|aide|aidez|soutiens) moi contre\b/g, 'alliance aide contre'],
  // demandes d'or en argot
  [/\b(file|passe|envoie|balance|aboule|lache|refile) (moi|nous)\b/g, 'demand'],
  // fautes courantes
  [/\bla pe\b/g, 'la paix'],
  // « laisse-nous passer » comme « laisse-moi passer »
  [/\blaisse (moi|nous) (passer|traverser)\b/g, 'passage9'],
);

/* --- mots-outils : trop courts pour la correspondance floue.
       « en » était rapproché d'« even » (événement) : « que dois-je faire EN priorité ? »
       devenait une question sur le passé. Un mot connu, même vide, n'est plus « corrigé ». --- */
for(const m of ['en','le','la','les','de','du','des','un','une','et','a','au','aux','je','tu','il','elle',
                'on','nous','vous','ils','elles','me','te','se','mon','ma','mes','ton','ta','tes','son','sa',
                'ses','ce','cet','cette','y','ou','dans','par','pour','sur','avec','est','es','suis','ai','as'])
  if(!(m in LEX)) LEX[m] = {};
CLES_LEX = Object.keys(LEX);
