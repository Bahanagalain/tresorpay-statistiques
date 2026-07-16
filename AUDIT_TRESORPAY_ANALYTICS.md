# AUDIT COMPLET -- TresorPay Analytics (statstp)

**Date :** 13 juillet 2026
**Version :** 1.0
**Application :** TresorPay Analytics -- Plateforme de Statistiques & Analytiques
**URL :** `statstp.devinst.tresorpublic.cm`
**Domaine metier :** Recettes non fiscales du Tresor Public du Cameroun

---

## TABLE DES MATIERES

1. [Resume executif](#1-resume-executif)
2. [Contexte et problematique](#2-contexte-et-problematique)
3. [Audit page par page](#3-audit-page-par-page)
4. [Profils utilisateurs proposes](#4-profils-utilisateurs-proposes)
5. [Analyse des donnees disponibles](#5-analyse-des-donnees-disponibles)
6. [Problemes transversaux](#6-problemes-transversaux)
7. [Vision cible -- Architecture proposee](#7-vision-cible--architecture-proposee)
8. [Indicateurs metier proposes](#8-indicateurs-metier-proposes)
9. [Plan d'implementation](#9-plan-dimplementation)

---

## 1. RESUME EXECUTIF

L'application TresorPay Analytics a ete initialement construite en s'inspirant fortement d'un tableau de bord existant de la DGI (Direction Generale des Impots). Cette approche a engendre plusieurs problemes fondamentaux :

- **Decontextualisation** : les libelles, les structures de pages et les indicateurs sont herites du contexte fiscal (impots), alors que TresorPay gere des **recettes non fiscales** (amendes, frais de dossier, mutations, taxes specifiques par ministere).
- **Absence de vision utilisateur** : toutes les pages montrent les memes donnees a tous les profils, sans adaptation au role ou au perimetre de l'utilisateur.
- **Design generique** : les "cartes KPI avec encoches" et les graphiques standard donnent un aspect "template IA" sans valeur ajoutee decisionnelle.
- **Donnees sans contexte** : les chiffres affiches ne repondent a aucune question metier precise. L'utilisateur ne sait pas ce qu'il regarde ni ce qu'il peut en tirer.
- **Pages vides ou inutiles** : certaines pages (Monitoring, Cartographie) sont soit vides, soit affichent des donnees sans utilite claire.
- **Rapports inadaptes** : les modeles de rapports restent ceux de la DGI (CDI, contribuables, conformite RIB) et n'ont aucun sens dans le contexte TresorPay.

**Verdict global** : L'application necessite une refonte profonde de son contenu, de son organisation et de sa logique metier, tout en conservant l'infrastructure technique existante (backend Fastify, frontend React, base Prisma/PostgreSQL) qui est solide.

---

## 2. CONTEXTE ET PROBLEMATIQUE

### 2.1 Ce qu'est TresorPay

TresorPay est une plateforme de collecte de recettes non fiscales pour le Tresor Public du Cameroun. Elle permet :

- A des **ministeres** de publier des **services** (types de recettes) avec des formulaires associes
- A des **citoyens** de soumettre des demandes et de payer en ligne via Corebank
- A des **plateformes partenaires** (MINMDT, eGuichet, etc.) d'integrer le paiement via API
- A des **administrateurs** de gerer le referentiel, les services, les approbations
- Au **Tresor Public** de suivre les encaissements par ministere, region, service

### 2.2 Ce que l'analytics devrait fournir

L'analytics doit etre un **outil d'aide a la decision** qui repond a des questions concretes :

| Qui demande ? | Quelle question ? |
|---|---|
| **Directeur du Tresor** | Combien a-t-on encaisse ce mois ? Quelle progression vs objectif ? Quels ministeres performent ? |
| **Ministre** | Mon ministere collecte combien ? Quels services generent le plus ? Quels departements sont actifs ? |
| **Chef de service** | Combien de soumissions en attente ? Quel taux de recouvrement ? Quels paiements ont echoue ? |
| **Agent comptable** | Quelles quittances verifier ? Quels paiements sont en anomalie ? |
| **DSI / Equipe technique** | La synchronisation fonctionne-t-elle ? Les plateformes partenaires repondent-elles ? |
| **Auditeur** | Qui a fait quoi ? Quand ? Y a-t-il des actions suspectes ? |

### 2.3 Ce que l'analytics fournit aujourd'hui

Un melange incoherent de graphiques generiques qui ne repondent a aucune de ces questions de maniere exploitable.

---

## 3. AUDIT PAGE PAR PAGE

### 3.1 TABLEAU DE BORD (page principale)

**URL :** `/tableau-de-bord`

**Etat actuel :**
- 6 cartes KPI en haut : Total Revenus, Total Soumissions, Soumissions Payees, En Attente, Echouees, Taux de Paiement
- Graphique d'evolution mensuelle (courbes En attente / Paye / Echoue)
- Jauge circulaire "Taux de paiement" avec objectif 90%
- Bar chart Top 10 Ministeres
- Donut "Repartition par statut"
- Bar chart Top 10 Services
- Grille "Apercu Regional" (10 regions avec montants et statut)
- Section "Alertes Actives"

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Libelles flous** | HAUTE | "Total Revenus" -- revenus de quoi ? Preciser "Montant total encaisse" ou "Montant total des soumissions" |
| 2 | **"Montant total" sans precision** | HAUTE | 189 755 FCFA affiche sous "Total Revenus" -- est-ce le montant paye, soumis, ou attendu ? |
| 3 | **Progression non contextualisee** | MOYENNE | Le badge "+96.79%" ne dit pas par rapport a quoi (mois precedent ? objectif ?) |
| 4 | **Sparklines decoratifs** | MOYENNE | Les mini-courbes sur chaque carte KPI utilisent des donnees seed fixes, pas les vraies donnees |
| 5 | **Top 10 insuffisant pour services** | HAUTE | Seuls les 10 premiers services sont montres. Les autres sont invisibles. Pas de "voir plus" |
| 6 | **Apercu Regional sans filtre** | MOYENNE | Affiche toutes les regions mais sans filtre par ministere, service, ou periode granulaire |
| 7 | **Alertes mal placees** | MOYENNE | Les alertes sont en bas de page, noyees. Un decideur ne les verra jamais |
| 8 | **Pas de vue par profil** | HAUTE | Un super admin et un utilisateur regional voient la meme chose |
| 9 | **Objectif taux paiement = 90% fixe** | MOYENNE | L'objectif est hardcode a 90%. Il devrait etre configurable par ministere/service |
| 10 | **Aucun drill-down depuis les KPI** | MOYENNE | Cliquer sur un KPI ne mene nulle part. Il devrait ouvrir un detail |

**Ce que cette page devrait etre :**
- Un tableau de bord contextualise au profil de l'utilisateur connecte
- Des KPI clairs avec libelles precis et tendances comparatives
- Un systeme d'alertes proactif en position visible (en haut ou via notification)
- Des raccourcis vers les actions les plus frequentes du profil

---

### 3.2 PERFORMANCE MINISTERES

**URL :** `/performance-ministeres`

**Etat actuel :**
- Liste tableau des 16 ministeres avec : Nom, Montant Total, Soumissions, Taux, Performance (barre)
- Barre de recherche "Rechercher un ministere"
- Drill-down vers detail ministere (4 onglets : Vue d'ensemble, Services, Soumissions, Tendances)
- Export Excel/PDF

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Libelle tronque dans sidebar** | BASSE | "Performance M..." -- tronque, pas lisible |
| 2 | **"Montant Total" = quoi ?** | HAUTE | Le montant affiche (ex: 1 237 642 890 FCFA pour MINCOMMERCE) est-il le montant soumis ou paye ? Car le taux est 0% alors que le montant est enorme |
| 3 | **Taux a 0% avec montant eleve** | CRITIQUE | MINCOMMERCE : 1.2 Mrd FCFA de montant mais 0% de taux. C'est le montant soumis, pas paye. Le libelle est trompeur |
| 4 | **Barre de performance sans echelle** | MOYENNE | La barre verte du MINCOMMERCE est pleine mais taux = 0%. Incoherence visuelle |
| 5 | **Onglet Soumissions vide** | HAUTE | L'onglet "Soumissions" dans le detail ministere affiche "Le detail des soumissions par soumetteur sera disponible prochainement" -- fonctionnalite non implementee |
| 6 | **Pas de comparaison inter-periodes** | MOYENNE | Impossible de comparer la performance d'un ministere entre 2 periodes |
| 7 | **Pas de liste des services inactifs** | HAUTE | On ne voit que les services ayant genere des recettes, pas ceux qui n'ont rien collecte |

**Ce que cette page devrait etre :**
- Un classement clair des ministeres par montant **paye** (pas soumis)
- Colonnes distinctes : Montant soumis / Montant paye / Taux de recouvrement
- Tous les services listes (y compris ceux a 0 FCFA)
- Tendance comparative (ce mois vs mois precedent)
- Alerte visuelle sur les ministeres en sous-performance

---

### 3.3 REPARTITION DES RECETTES

**URL :** `/repartition-recettes`

**Etat actuel :**
- Deux onglets : Services (46) et Domaines (11)
- Tableau avec colonnes : #, Service, Ministere, Soumissions, Montant, Part %, Performance
- Total affiche : 1 447 519 514 FCFA
- Tri et recherche fonctionnels
- Drill-down vers detail service (evolution, statuts, soumissions)

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **"Repartition Fiscale" dans le code** | MOYENNE | Le composant s'appelle `RepartitionFiscale.jsx` -- heritage DGI. Les recettes TresorPay sont NON fiscales |
| 2 | **Part % sans explication** | BASSE | La colonne "Part" montre 85.3% pour "Amendes et sanctions pecuniaires" mais part de quoi ? Du total global |
| 3 | **Pas de filtre par ministere** | HAUTE | Impossible de filtrer la liste des services pour un seul ministere |
| 4 | **Pas de filtre par region** | HAUTE | Impossible de voir la repartition pour une region donnee |
| 5 | **Services avec 0 soumissions non affiches** | HAUTE | Les services sans soumission n'apparaissent pas -- il devrait y avoir 300+ services, pas 46 |
| 6 | **Barre de performance = montant relatif** | BASSE | La barre represente le montant relatif au plus gros, pas un taux de performance reel |

**Ce que cette page devrait etre :**
- Filtres cascadants : Ministere > Domaine > Region > Periode
- Distinction montant soumis vs montant encaisse
- Tous les services visibles (y compris inactifs, avec 0)
- Export avec filtres appliques
- Vue comparative entre periodes

---

### 3.4 CARTOGRAPHIE REGIONALE

**URL :** `/cartographie`

**Etat actuel :**
- Carte du Cameroun avec bulles positionnees sur chaque region
- Couleur des bulles : vert (>50% objectif), jaune (25-50%), rouge (<25%)
- Montant affiche sous chaque region
- Drill-down vers detail region (departements, classement, services)

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Carte rudimentaire** | HAUTE | Simple positionnement de cercles, pas une vraie carte SVG interactive |
| 2 | **Objectifs non definis** | HAUTE | Toutes les regions sont en "DANGER" (rouge) car aucun objectif n'est configure |
| 3 | **Pas de filtre par ministere/service** | HAUTE | La carte montre tout en vrac, impossible de filtrer |
| 4 | **Pas de heatmap** | MOYENNE | Une heatmap par densite de paiements serait plus utile |
| 5 | **Donnees geographiques limitees** | MOYENNE | Seul le niveau regional est sur la carte. Les departements sont dans le drill-down uniquement |
| 6 | **Utilite non definie** | HAUTE | L'utilisateur ne sait pas ce que cette carte lui apporte concretement pour la prise de decision |

**Ce que cette page devrait etre :**
- Une carte SVG interactive du Cameroun avec heatmap des recettes
- Filtres : Ministere, Service, Periode
- Drill-down Region > Departement > Arrondissement
- Comparaison entre regions (tableaux de classement)
- Indicateur de couverture : % des departements actifs par region
- Utilite : identifier les zones geographiques sous-exploitees

---

### 3.5 ACTIVITE CITOYENS

**URL :** `/activite-citoyens`

**Etat actuel :**
- 4 cartes KPI : Total inscrits (10), Verifies (3, 30%), Actifs (10), Jauge 30%
- Graphique "Evolution des inscriptions et verifications" (quasi vide, 2 points)
- Pas de tableau de citoyens
- Pas de recherche

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Page quasi vide** | CRITIQUE | Avec 10 citoyens et 2 points de donnees, la page n'a aucun interet |
| 2 | **Pas de liste de citoyens** | CRITIQUE | On ne peut pas voir qui sont les citoyens, ce qu'ils ont paye, avec quels codes |
| 3 | **Pas de recherche** | CRITIQUE | Impossible de rechercher un citoyen par email, telephone, ou code de soumission |
| 4 | **Design "cartes avec encoches"** | HAUTE | Exactement le design generique que l'on veut eliminer |
| 5 | **Aucune valeur operationnelle** | CRITIQUE | Un agent ne peut rien faire avec cette page. Pas de code unique, pas de detail de paiement |
| 6 | **Aucun lien vers les soumissions** | HAUTE | Pas de correlation entre citoyen et ses soumissions/paiements |

**Ce que cette page devrait DEVENIR :**

Cette page ne devrait PAS etre un dashboard de statistiques mais un **registre operationnel** :
- **Tableau paginable et recherchable** de tous les citoyens inscrits
- Colonnes : Nom, Email, Telephone, Statut (verifie/non), Nombre de soumissions, Montant total paye, Derniere activite
- **Recherche avancee** : par email, telephone, nom, code de soumission unique
- **Drill-down citoyen** : toutes ses soumissions, ses paiements, ses quittances
- **Export** : liste filtree en Excel/PDF
- En haut : quelques KPI contextuels (total inscrits, total actifs, nouveaux ce mois)

---

### 3.6 EXPLORATEUR DE DONNEES

**URL :** `/explorateur`

**Etat actuel :**
- Panneau gauche : filtres (Ministere, Service, Statut, Mode de vue, Mesure, Dimensions)
- Panneau droit : resultats (chart barres horizontales, table, ou pivot)
- 3 modes : Graphique, Tableau, Tableau croise

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Concept bon mais execution incomplete** | MOYENNE | L'explorateur fonctionne mais manque de guide pour l'utilisateur |
| 2 | **Pas de sauvegarde de requete** | MOYENNE | L'utilisateur ne peut pas sauvegarder ses analyses favorites |
| 3 | **Limite a 3 dimensions** | BASSE | Suffisant pour la plupart des cas mais devrait etre extensible |
| 4 | **Pas de pre-configurations** | HAUTE | L'utilisateur doit tout configurer de zero a chaque visite. Des templates d'analyse seraient utiles |

**Verdict :** Page correcte, a enrichir avec des templates et la sauvegarde.

---

### 3.7 MES DASHBOARDS (Module BI)

**URL :** `/bi/dashboards`

**Etat actuel :**
- Liste de dashboards avec recherche et tri
- 2 dashboards de test : "Test" et "Test (copie)"
- Bouton "+ Nouveau dashboard"

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **BUG [object Object]** | CRITIQUE | Les cartes affichent "Modifie --- : [object Object]" au lieu de la date |
| 2 | **Aucun dashboard utile pre-configure** | HAUTE | Un utilisateur qui arrive ne trouve que des tests vides |
| 3 | **Pas de templates** | HAUTE | Pas de dashboards pre-faits a cloner pour demarrer rapidement |
| 4 | **Pas de partage visible** | MOYENNE | Le systeme de partage existe dans le schema (BiDashboardPartage) mais n'est pas expose |

**Ce que cette page devrait etre :**
- Des dashboards pre-configures par profil (Decideur, Ministere, Regional, etc.)
- Possibilite de cloner un template et le personnaliser
- Partage entre utilisateurs
- Favoris fonctionnels

---

### 3.8 INDICATEURS

**URL :** `/bi/indicateurs`

**Etat actuel :**
- Liste d'indicateurs avec code, libelle, dataset, mesure, format
- Formulaire de creation/edition
- Bouton de test (calcul en direct)

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Trop technique** | HAUTE | L'interface demande de saisir du JSON pour les filtres -- inaccessible pour un non-developpeur |
| 2 | **Pas d'indicateurs pre-configures utiles** | HAUTE | Aucun indicateur metier n'est pre-charge |
| 3 | **Pas de validation des filtres JSON** | MOYENNE | Si le JSON est invalide, pas de message d'erreur clair |

**Ce que cette page devrait etre :**
- Des indicateurs metier pre-configures (taux de recouvrement, evolution mensuelle, etc.)
- Un constructeur visuel (pas de JSON brut)
- Categorisation par domaine metier

---

### 3.9 PLATEFORMES PARTENAIRES

**URL :** `/plateformes-partenaires`

**Etat actuel :**
- Grille de cartes par plateforme (code, statut, ministere)
- Drill-down avec metriques, pie chart statuts, evolution, demandes recentes

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Libelle sidebar tronque** | BASSE | "Plateformes Pa..." -- illisible |
| 2 | **Pas de comparaison entre plateformes** | MOYENNE | Impossible de voir laquelle performe le mieux |
| 3 | **Pas de SLA/objectifs** | HAUTE | Aucun indicateur de niveau de service (temps de reponse, taux de succes minimal) |

**Verdict :** Page fonctionnelle, a enrichir avec des metriques SLA et de la comparaison.

---

### 3.10 MONITORING PAIEMENTS

**URL :** `/monitoring-paiements`

**Etat actuel :**
- KPI : transactions totales, payees, en attente, echouees (sur 24h)
- Donut statuts
- Timeline horaire
- Tableau des transactions recentes
- Statut de synchronisation

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Page vide dans les captures** | CRITIQUE | La page semble ne rien afficher quand il n'y a pas de transactions recentes |
| 2 | **Fenetre fixe de 24h** | MOYENNE | Impossible de voir au-dela de 24h |
| 3 | **Pas d'alertes en temps reel** | HAUTE | Devrait notifier proactivement en cas de pic d'echecs |
| 4 | **Utilite floue** | HAUTE | Pour qui est cette page ? DSI ? Agent comptable ? Le public cible n'est pas defini |

**Ce que cette page devrait etre :**
- Un outil pour l'equipe technique et la supervision
- Indicateurs de sante : taux de succes en temps reel, latence Corebank, erreurs recurrentes
- Alertes configurables (seuils de taux d'echec)
- Historique sur 7 jours minimum

---

### 3.11 ALERTES & ANOMALIES

**URL :** `/alertes`

**Etat actuel :**
- 3 cartes : Alertes critiques (1), Avertissements (1), Total (2)
- Liste des alertes par categorie avec description

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Mal positionne** | HAUTE | Les alertes devraient etre en position haute sur le dashboard principal, pas sur une page separee |
| 2 | **Pas d'actions associees** | HAUTE | L'alerte dit "299 services inactifs" mais ne propose aucune action |
| 3 | **Pas de configuration de seuils** | HAUTE | Les seuils d'alerte sont hardcodes, non configurables |
| 4 | **Pas d'historique** | MOYENNE | Pas de journal des alertes passees et de leur resolution |
| 5 | **Pas de notification push/email** | HAUTE | Les alertes ne sont visibles que quand on visite la page |
| 6 | **Chiffres sans contexte** | HAUTE | "299 services inactifs" -- sur combien au total ? C'est normal ou anormal ? |

**Ce que cette page devrait etre :**
- Un centre de notifications intelligent
- Alertes classees par priorite avec actions proposees
- Historique avec statut (nouveau, en cours, resolu)
- Configuration des seuils par l'administrateur
- Notification email/push pour les alertes critiques

---

### 3.12 GENERATION DE RAPPORTS

**URL :** `/rapports`

**Etat actuel :**
- 3 onglets : Rapports Standards, Creer un Rapport, Historique
- 6 rapports pre-configures sous forme de cartes :
  1. Rapport de Performance des CDIs
  2. Synthese Regionale
  3. Rapport de Repartition Fiscale
  4. Rapport des Contribuables
  5. Registre des Avis d'Imposition
  6. Etat de Recouvrement

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **100% DGI, 0% TresorPay** | CRITIQUE | TOUS les rapports sont des modeles de la DGI : CDI, Contribuables, Avis d'Imposition, Recouvrement fiscal. AUCUN n'a de sens pour les recettes non fiscales |
| 2 | **"Performance des CDIs"** | CRITIQUE | CDI = Centre Divisionnaire des Impots. TresorPay n'a pas de CDI. C'est un ministere/service |
| 3 | **"Avis d'Imposition"** | CRITIQUE | Il n'y a pas d'imposition dans TresorPay. Ce sont des soumissions de paiement |
| 4 | **"Contribuables"** | HAUTE | TresorPay n'a pas de contribuables mais des citoyens / soumetteurs |
| 5 | **"Repartition Fiscale"** | HAUTE | Les recettes sont NON fiscales |
| 6 | **Design des cartes** | MOYENNE | 6 cartes identiques avec des icones generiques, pas d'apercu du contenu |
| 7 | **Pas de planification** | HAUTE | Impossible de programmer un rapport automatique |

**Rapports qui devraient exister :**
1. **Etat des encaissements par ministere** -- Montants soumis/payes/en attente par ministere et service
2. **Rapport de performance par region** -- Activite et recettes par region/departement
3. **Etat des soumissions** -- Liste detaillee des soumissions avec statuts et codes uniques
4. **Rapport des plateformes partenaires** -- Volume, taux de succes, montants par plateforme
5. **Bulletin d'emission** -- Document officiel de synthese des recettes emises
6. **Rapport d'activite des services** -- Services actifs/inactifs, volume, evolution
7. **Rapport citoyen** -- Activite des comptes citoyens, verifications, paiements
8. **Rapport d'audit** -- Actions administratives sur une periode

---

### 3.13 SYNCHRONISATION

**URL :** `/synchronisation` (Super Admin uniquement)

**Etat actuel :**
- Statut de sync (actif/inactif) avec compteurs d'entites
- Boutons : Lancer sync / Purger
- Configuration : intervalle (minutes), activation
- Journal de synchronisation (endpoint, statut, duree)

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Erreur sync visible** | CRITIQUE | `/audit-logs?limit=0` echoue avec "Impossible de s'authentifier aupres du payment-platform" |
| 2 | **Compteurs tous a 0** | HAUTE | Ministeres, Domaines, Org Units, Services, Soumissions, Plateformes, Citoyens, Audit Logs = 0. Pourtant les autres pages affichent des donnees |
| 3 | **Journal d'erreurs sans action** | MOYENNE | Les echecs sont listes mais aucune action corrective n'est proposee |

**Verdict :** Page fonctionnelle mais avec un probleme d'authentification a resoudre en priorite.

---

### 3.14 AUDIT & ACTIVITE

**URL :** `/audit` (Super Admin uniquement)

**Etat actuel :**
- KPI : 748 actions, 9 acteurs, 8 types d'entite
- Bar chart "Actions par type" (LOGIN, UPDATE, CREATE, SUBMIT, APPROVE, PUBLISH, DEACTIVATE)
- Pie chart "Par type d'entite" (AdminUser 378, Service 230, FormDefinition 89, etc.)
- Tableau "Top acteurs" avec emails et nombre d'actions
- Tableau des 30 dernieres actions

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Pas de filtre par acteur** | HAUTE | Impossible de filtrer pour voir les actions d'un seul utilisateur |
| 2 | **Pas de filtre par type d'action** | HAUTE | Impossible de voir uniquement les LOGIN ou les DELETE |
| 3 | **Pas de recherche** | HAUTE | Impossible de rechercher par email, entite, ou route |
| 4 | **30 dernieres actions seulement** | HAUTE | Pas de pagination, pas d'historique complet |
| 5 | **Pas d'export** | MOYENNE | Les donnees d'audit ne sont pas exportables |
| 6 | **Duplication avec Alertes** | BASSE | Certaines informations se chevauchent avec la page Alertes |

**Ce que cette page devrait etre :**
- Un journal complet avec filtres avances (acteur, action, entite, date)
- Pagination complete
- Export pour conformite
- Detection d'anomalies (connexions inhabituelles, actions de masse)

---

### 3.15 PARAMETRES

**URL :** `/parametres`

**Etat actuel :**
- Profil utilisateur (photo, identite, email, telephone)
- Notifications (rapport quotidien email)
- Apparence (effets visuels, themes)
- Mode presentation (inactivite, duree slides)
- Administration (si super admin)

**Problemes identifies :**

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **"Vert DGI" dans les presets couleur** | BASSE | Reference DGI a supprimer |
| 2 | **700 lignes en un seul composant** | MOYENNE | Difficilement maintenable |
| 3 | **Pas de gestion des preferences de dashboard** | HAUTE | L'utilisateur ne peut pas choisir quels widgets voir sur son dashboard principal |

---

## 4. PROFILS UTILISATEURS PROPOSES

En se basant sur le modele de donnees du `payment-platform` (AdminUser.profileType) et les besoins identifies :

### 4.1 Matrice des profils

| Profil | Description | Perimetre | Dashboard principal |
|--------|-------------|-----------|-------------------|
| **DIRECTEUR_GENERAL** | Direction du Tresor, vision strategique nationale | National (toutes les donnees) | KPI globaux, tendances nationales, top ministeres, alertes critiques |
| **SUPERVISEUR** | Superviseur specialiste, validation et controle | National ou multi-ministeres | Performance ministeres, approbations en attente, audit d'activite |
| **MINISTRE / DG** | Responsable ministeriel | Son ministere uniquement | Performance de son ministere, ses services, ses soumissions, ses regions |
| **CHEF_SERVICE** | Chef de service dans un ministere | Son service / sa region | Ses soumissions, taux de recouvrement, paiements en attente |
| **AGENT_COMPTABLE** | Agent de recouvrement / verificateur | Son perimetre comptable | Soumissions a verifier, quittances, anomalies de paiement |
| **RESPONSABLE_REGIONAL** | Responsable de region ou departement | Sa region/departement | Activite de sa zone, services actifs, comparaison departements |
| **DSI / TECHNIQUE** | Equipe technique | National | Monitoring, sync, plateformes, sante systeme |
| **AUDITEUR** | Auditeur interne/externe | National (lecture seule) | Journal d'audit, rapports de conformite |
| **PARTENAIRE** | Gestionnaire de plateforme partenaire | Sa plateforme | Performance de sa plateforme, transactions, taux de succes |

### 4.2 Mapping avec le systeme existant

Le `payment-platform` a deja 4 `profileType` :
- `SUPER_ADMIN` --> DIRECTEUR_GENERAL + DSI
- `SUPERVISEUR_SPECIALIST` --> SUPERVISEUR
- `SPECIALIST` --> MINISTRE / CHEF_SERVICE
- `METIER_ADMIN` --> AGENT_COMPTABLE

Il faut ajouter au niveau de l'analytics :
- Le perimetre geographique (niveau CENTRAL/REGIONAL/DEPARTEMENTAL -- deja present)
- Le perimetre ministeriel (ministereId -- deja present)
- Le perimetre de donnees visibles (filtrage cote backend)

### 4.3 Vue dashboard par profil

**DIRECTEUR_GENERAL :**
```
+---------------------------------------------------+
| KPI Hero: Encaissements du mois    +45% vs N-1    |
+---------------------------------------------------+
| Recettes totales  | Soumissions  | Taux recouvr.  |
| 1.4 Mrd FCFA      | 321          | 18%            |
+---------------------------------------------------+
| Graphe evolution mensuelle (6 mois)               |
+---------------------------------------------------+
| Top 5 Ministeres     | Repartition regionale      |
| (bar chart horizontal)| (mini carte heatmap)       |
+---------------------------------------------------+
| Alertes critiques (widget compact)                |
+---------------------------------------------------+
```

**MINISTRE :**
```
+---------------------------------------------------+
| [Ministere du Commerce] - Code MR014              |
+---------------------------------------------------+
| Encaisse    | En attente  | Echoue    | Taux      |
| 0 FCFA      | 11          | 0         | 0%        |
+---------------------------------------------------+
| Mes services (tableau complet, tous listes)       |
+---------------------------------------------------+
| Evolution mensuelle    | Repartition par service  |
+---------------------------------------------------+
| Soumissions recentes (avec code unique, montant)  |
+---------------------------------------------------+
```

**RESPONSABLE_REGIONAL :**
```
+---------------------------------------------------+
| [Region Centre] - Performance                      |
+---------------------------------------------------+
| Encaisse    | Soumissions | Departements actifs    |
| 1.4 Mrd     | 59          | 3/10                   |
+---------------------------------------------------+
| Classement departements (barre comparative)       |
+---------------------------------------------------+
| Services les plus utilises dans la region         |
+---------------------------------------------------+
| Soumissions recentes de la region                 |
+---------------------------------------------------+
```

---

## 5. ANALYSE DES DONNEES DISPONIBLES

### 5.1 Donnees du payment-platform exploitables

| Source | Donnees | Utilisation analytics |
|--------|---------|----------------------|
| **FormSubmission** | soumissions, montants, statuts, dates, orgUnit, service, ministere | KPI principaux, evolution, repartition |
| **ServiceGouv** | catalogue des services, tarifs, formulaires, statut publication | Couverture, services actifs/inactifs |
| **Ministry** | liste des ministeres, codes, noms | Repartition par ministere |
| **OrgUnit** | regions, departements, arrondissements (arbre hierarchique) | Cartographie, repartition geographique |
| **Domain** | domaines de recettes | Categorisation des recettes |
| **CitizenUser** | comptes citoyens, verification, activite | Registre citoyens |
| **PartnerPlatform** | plateformes, API keys, statut | Monitoring partenaires |
| **PartnerPaymentRequest** | demandes de paiement partenaires, montants, statuts | Volume partenaires, taux de succes |
| **AuditLog** | toutes les actions admin | Journal d'audit, conformite |
| **Payment** | paiements effectifs, references Corebank | Suivi des encaissements reels |
| **Beneficiary + ServiceBeneficiary** | repartition des recettes aux beneficiaires | Suivi de la repartition |
| **RevenueGroup** | groupes de revenus par ministere | Categorisation avancee |
| **RevenueAuthority** | regies de recettes | Structure comptable |

### 5.2 Donnees NON exploitees actuellement

| Donnee | Potentiel |
|--------|-----------|
| **Beneficiaires** | Suivi de la repartition des recettes (qui recoit combien) |
| **Payment (Corebank)** | Suivi des paiements reellement encaisses vs soumis |
| **QuittanceTemplate** | Statistiques de generation de quittances |
| **RevenueAuthority** | Analyse par regie de recettes |
| **PartnerPaymentTransaction** | Historique detaille des transactions partenaires |
| **PartnerServiceAccess** | Matrice d'autorisation plateforme x service |
| **Soumissions archivees** | Tendances historiques longue duree |

### 5.3 Indicateurs manquants critiques

| Indicateur | Formule | Utilite |
|------------|---------|--------|
| **Taux de recouvrement reel** | Montant paye / Montant soumis | KPI central de performance |
| **Delai moyen de paiement** | Moyenne(datePaiement - dateSoumission) | Efficacite du processus |
| **Taux d'abandon** | Soumissions sans paiement apres X jours / Total | Friction dans le parcours |
| **Couverture des services** | Services avec >= 1 soumission / Total services publies | Adoption de la plateforme |
| **Concentration des recettes** | % du revenu genere par le top 5 services | Risque de dependance |
| **Croissance mensuelle** | (Mois N - Mois N-1) / Mois N-1 | Tendance d'adoption |
| **Volume par canal** | Soumissions directes vs partenaires | Part de chaque canal |
| **Taux de verification citoyen** | Citoyens verifies / Total inscrits | Qualite de la base |
| **Repartition effective** | Montants distribues aux beneficiaires / Encaissements | Suivi de la repartition |

---

## 6. PROBLEMES TRANSVERSAUX

### 6.1 Problemes de design

| # | Probleme | Impact |
|---|----------|--------|
| 1 | **Cartes KPI generiques "avec encoches"** | Aspect template IA, pas professionnel |
| 2 | **Sparklines avec donnees fictives** | Les mini-graphiques sur les cartes KPI du dashboard utilisent des donnees seed hardcodees, pas les vraies tendances |
| 3 | **Trop de graphiques, pas assez de tableaux exploitables** | Un decideur veut des chiffres precis, pas des courbes approximatives |
| 4 | **Pas de mode sombre coherent** | Le toggle existe mais l'ensemble n'est pas teste en mode sombre |
| 5 | **Sidebar tronquee** | Plusieurs libelles coupes ("Performance M...", "Plateformes Pa...", "Alertes & Anom...") |
| 6 | **Pas de breadcrumb** | L'utilisateur se perd dans les drill-down |

### 6.2 Problemes de donnees

| # | Probleme | Impact |
|---|----------|--------|
| 1 | **Confusion montant soumis / paye** | Les KPI sont trompeurs car ils ne distinguent pas |
| 2 | **Erreur sync audit-logs** | La synchronisation echoue pour `/audit-logs` -- impact sur les donnees d'audit |
| 3 | **299 services inactifs** | Sur ~300 services, 299 n'ont aucune soumission depuis 7 jours. Alerte permanente inutile |
| 4 | **Compteurs sync a 0** | Les compteurs de la page Synchronisation ne refletent pas les donnees reelles |
| 5 | **Pas de distinction directe vs partenaire** | On ne sait pas si une soumission vient du portail citoyen ou d'une plateforme partenaire |

### 6.3 Problemes de nomenclature (heritage DGI)

| Terme actuel (DGI) | Terme correct (TresorPay) |
|---------------------|---------------------------|
| CDI (Centre Divisionnaire des Impots) | Ministere / Service |
| Contribuable | Citoyen / Soumetteur |
| Repartition Fiscale | Repartition des Recettes |
| Avis d'Imposition | Soumission de paiement |
| Conformite RIB | Plateformes Partenaires |
| Taux de Recouvrement (fiscal) | Taux de paiement |
| Registre d'imposition | Registre des soumissions |

### 6.4 Problemes d'architecture

| # | Probleme | Impact |
|---|----------|--------|
| 1 | **Pas de filtrage backend par profil** | Toutes les donnees sont envoyees a tous les utilisateurs, le filtrage est fait cote frontend (ou pas fait du tout) |
| 2 | **Cache fixe sans invalidation intelligente** | 10 min de cache, meme quand de nouvelles donnees arrivent |
| 3 | **Pas de WebSocket** | Pas de mise a jour en temps reel des KPI |
| 4 | **Composant Parametres monolithique** | 700 lignes dans un seul fichier |

---

## 7. VISION CIBLE -- ARCHITECTURE PROPOSEE

### 7.1 Nouvelle structure de navigation

```
TABLEAU DE BORD (contextualise par profil)
|
+-- PILOTAGE
|   +-- Performance Ministeres
|   +-- Repartition des Recettes
|   +-- Cartographie
|   +-- Beneficiaires & Repartition
|
+-- OPERATIONNEL
|   +-- Registre des Soumissions (ex Activite Citoyens, repense)
|   +-- Suivi des Paiements (ex Monitoring)
|   +-- Plateformes Partenaires
|
+-- ANALYSE
|   +-- Explorateur de Donnees
|   +-- Mes Dashboards (BI)
|   +-- Indicateurs
|
+-- SUPERVISION
|   +-- Centre d'Alertes (redesign)
|   +-- Journal d'Audit (filtrable)
|   +-- Rapports (redesign complet)
|
+-- ADMINISTRATION (super admin)
|   +-- Synchronisation
|   +-- Gestion des Utilisateurs
|   +-- Parametres
```

### 7.2 Principes de la refonte

1. **Chaque page repond a une question metier claire** -- pas de graphique decoratif
2. **Dashboard adaptatif par profil** -- l'utilisateur voit ce qui le concerne
3. **Drill-down systematique** -- chaque chiffre est cliquable pour voir le detail
4. **Distinction soumis / paye / echoue** -- partout, toujours
5. **Tous les elements visibles** -- les services a 0, les regions a 0, les citoyens inactifs
6. **Filtres cascadants** -- Periode > Ministere > Service > Region > Statut
7. **Actions concretes** -- chaque constat propose une action
8. **Rapports contextualises** -- les modeles de rapports correspondent a TresorPay
9. **Recherche globale operationnelle** -- trouver un citoyen, une soumission, un code unique
10. **Notifications proactives** -- les alertes vont vers l'utilisateur, pas l'inverse

### 7.3 Dashboard principal -- multi-pages horizontales

Comme propose, le dashboard principal pourrait avoir **plusieurs onglets horizontaux** :

| Onglet | Contenu | Public |
|--------|---------|--------|
| **Vue d'ensemble** | KPI globaux, tendances, top 5 | Tous |
| **Mon perimetre** | KPI du ministere/region de l'utilisateur | Profiles scopes |
| **Soumissions** | Flux de soumissions en direct avec recherche | Operations |
| **Alertes** | Centre d'alertes compact | Superviseurs |
| **Favoris** | Widgets/dashboards BI epingles | Personnalise |

---

## 8. INDICATEURS METIER PROPOSES

### 8.1 Indicateurs strategiques (Direction)

| Indicateur | Description | Visualisation |
|------------|-------------|---------------|
| Encaissements totaux | Montant total effectivement paye (statut PAID + PARTIAL) | KPI Hero + sparkline |
| Progression mensuelle | Evolution vs mois precedent et vs mois N-1 annee precedente | Indicateur fleche + % |
| Taux de recouvrement | Montant paye / Montant soumis | Jauge avec objectif |
| Top 10 ministeres par encaissement | Classement des ministeres par montant paye | Bar chart horizontal |
| Couverture nationale | Nombre de regions/departements avec activite | Carte heatmap |
| Volume par canal | Portail citoyen vs plateformes partenaires | Donut |
| Nombre de services actifs | Services ayant eu >= 1 soumission dans les 30 derniers jours | KPI + evolution |

### 8.2 Indicateurs operationnels (Ministeres / Services)

| Indicateur | Description | Visualisation |
|------------|-------------|---------------|
| Soumissions en attente | Nombre de soumissions non encore payees | KPI + alerte si > seuil |
| Soumissions echouees | Nombre de paiements en echec | KPI rouge + detail |
| Delai moyen de traitement | Temps entre soumission et paiement | KPI + tendance |
| Services les plus sollicites | Top services par nombre de soumissions | Tableau trie |
| Services jamais utilises | Services publies sans aucune soumission | Tableau d'alerte |
| Taux d'abandon | % de soumissions sans paiement apres 7 jours | KPI + alerte |

### 8.3 Indicateurs de supervision (DSI / Audit)

| Indicateur | Description | Visualisation |
|------------|-------------|---------------|
| Sante synchronisation | Derniere sync, taux de succes, entites synchronisees | Dashboard compact |
| Uptime plateformes partenaires | Disponibilite de chaque plateforme | Grille de statut |
| Actions d'audit anormales | Pics d'activite, connexions inhabituelles | Timeline + alertes |
| Taux de verification citoyen | Comptes verifies / total | Jauge |
| Volume API partenaires | Nombre de requetes par plateforme | Time series |

---

## 9. PLAN D'IMPLEMENTATION

### Phase 1 -- Fondations (Priorite CRITIQUE)

**Objectif :** Corriger les erreurs factuelles et les bugs bloquants

| Tache | Pages | Effort |
|-------|-------|--------|
| Corriger le bug `[object Object]` dans DashboardList | Mes Dashboards | 0.5h |
| Corriger les libelles DGI -> TresorPay (CDI, contribuable, fiscal, etc.) | Rapports, Repartition, global | 2h |
| Distinguer montant soumis vs montant paye dans tous les KPI | Dashboard, Performance, Repartition | 3h |
| Corriger les sparklines pour utiliser les vraies donnees | Dashboard | 1h |
| Corriger l'erreur de sync audit-logs | Synchronisation | 1h |
| Renommer les rapports standards (supprimer CDI, Imposition, etc.) | Rapports | 2h |

### Phase 2 -- Dashboard par profil

**Objectif :** Adapter le dashboard principal au profil connecte

| Tache | Effort |
|-------|--------|
| Implementer la logique de vue par profil dans TableauDeBord | 4h |
| Creer les layouts specifiques par profil (Directeur, Ministre, Regional, Agent) | 8h |
| Ajouter le filtrage backend par perimetre utilisateur (ministere, region) | 4h |
| Implementer les onglets horizontaux sur le dashboard | 3h |

### Phase 3 -- Refonte des pages operationnelles

**Objectif :** Transformer les pages "statistiques generiques" en outils operationnels

| Tache | Effort |
|-------|--------|
| Refondre "Activite Citoyens" en "Registre des Soumissions" (tableau, recherche, detail) | 6h |
| Ajouter tous les services (y compris inactifs) dans Performance Ministeres | 2h |
| Ajouter les filtres cascadants dans Repartition des Recettes | 3h |
| Refondre la Cartographie avec carte SVG interactive + heatmap | 6h |
| Refondre Alertes & Anomalies en centre de notifications avec actions | 4h |
| Ajouter filtres et pagination a Audit & Activite | 3h |

### Phase 4 -- Rapports et exports

**Objectif :** Creer des rapports adaptes au contexte TresorPay

| Tache | Effort |
|-------|--------|
| Designer 6-8 nouveaux modeles de rapports contextualises | 6h |
| Implementer la generation PDF/Excel pour chaque modele | 8h |
| Ajouter la planification automatique de rapports | 4h |

### Phase 5 -- Module BI et indicateurs

**Objectif :** Rendre le module BI accessible et utile

| Tache | Effort |
|-------|--------|
| Creer 10-15 dashboards pre-configures par profil | 6h |
| Creer des indicateurs metier pre-charges | 4h |
| Remplacer la saisie JSON par un constructeur visuel | 8h |
| Implementer le partage de dashboards | 3h |

### Phase 6 -- Integration et polish

**Objectif :** Integrer les dashboards dans le frontend principal

| Tache | Effort |
|-------|--------|
| Exposer les widgets BI selectionnes sur le dashboard du frontend principal | 6h |
| Implementer la recherche globale (citoyen, soumission, code unique) | 4h |
| Notifications push/email pour alertes critiques | 4h |
| Tests de regression et stabilisation | 4h |

---

## ANNEXES

### A. Fichiers cles du projet

| Fichier | Role |
|---------|------|
| `frontend/src/App.jsx` | Routes et navigation |
| `frontend/src/components/layout/Sidebar.jsx` | Barre laterale |
| `frontend/src/pages/TableauDeBord.jsx` | Dashboard principal |
| `frontend/src/pages/GenerationRapports.jsx` | Page rapports |
| `frontend/src/api/analyticsApi.js` | Client API (30+ fonctions) |
| `frontend/src/utils/reportTemplates.js` | Modeles de rapports DGI |
| `backend/src/routes/analytics.routes.js` | Endpoints analytics (50+) |
| `backend/src/services/computation.service.js` | Calculs analytiques |
| `backend/prisma/schema.prisma` | Modele de donnees |

### B. Stack technique

- **Frontend :** React 19, Recharts, React Router 7, Lucide icons, Framer Motion
- **Backend :** Fastify 5, Prisma ORM, PostgreSQL
- **Export :** jsPDF, xlsx, html2canvas
- **Auth :** JWT + refresh token
- **i18n :** Francais/Anglais (partiel)

### C. APIs du payment-platform non encore exploitees

- `GET /dashboard/ministry-breakdown` -- repartition par ministere cote admin
- `GET /dashboard/public-stats` -- statistiques publiques (5min cache)
- `GET /beneficiaries/distribution-summary` -- repartition aux beneficiaires
- `GET /revenue-authorities` -- regies de recettes
- `GET /approvals` -- approbations en attente
- `POST /payments/initiate/bank-transfer` -- statut des virements Corebank

---

*Document genere le 13 juillet 2026. Cet audit couvre l'integralite des 15 pages de l'application TresorPay Analytics et propose une feuille de route structuree pour la refonte.*
