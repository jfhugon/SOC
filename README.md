# Centaure — application de l'association Spirit Of Centaure

Messagerie des membres, coffre de pièces, dossiers juridiques (sommation → rupture → assignation) et bordereaux pour l'avocat.
React 18 + Vite (PWA) · Supabase (PostgreSQL + RLS, Auth + MFA, Storage, Realtime) · projet `SOC`, région eu-west-1.

## Lancer en local

Prérequis : Node.js 20 ou plus récent (https://nodejs.org).

```bash
npm install
npm run dev
```

L'application s'ouvre sur http://localhost:5173. `.env.local` pointe déjà vers le projet Supabase de développement (clé publiable, sans risque côté client).

## Premier administrateur

Les rôles ne se donnent pas depuis l'interface tant qu'aucun administrateur n'existe. Après avoir créé votre compte (Inscription), exécutez dans l'éditeur SQL de Supabase :

```sql
update public.profiles
set statut = 'actif', est_ca = true, fonction = 'president', est_admin_tech = true
where email = 'votre@adresse.fr';
```

À la connexion suivante, la double authentification (TOTP) est demandée. Ensuite, tout se gère depuis **Membres** (adhésions, codes d'activation) et **Administration** (rôles, paramètres, journal d'audit).

## Réglages Supabase à vérifier (tableau de bord → Authentication)

- **URL Configuration** : ajouter `http://localhost:5173` et l'URL de production aux *Redirect URLs* (confirmation d'e-mail, mot de passe oublié).
- **Multi-Factor** : TOTP activé (c'est le cas par défaut).
- **Emails** : configurer un SMTP européen avant la mise en service (le SMTP intégré est limité à quelques envois par heure).

## Base de données

Les migrations sont dans `supabase/migrations/` et sont déjà appliquées au projet de développement :

| Fichier | Contenu |
| --- | --- |
| `0001_schema.sql` | Tables : profils, lots, adhésions, conversations, messages, pièces, dossiers, remises, journal d'audit |
| `0002_droits_et_fonctions.sql` | Fonctions d'accès, déclencheurs, droits par ligne, fonctions métier, stockage privé, Realtime |
| `0003_restreindre_fonctions_internes.sql` | Journal d'audit non falsifiable par un client |
| `0004_rejoindre_dossier.sql` | Correctif : un membre peut rejoindre un dossier qu'il ne voit pas encore |
| `0006_base_juridique.sql` | Base juridique : documents des procédures, originaux et aperçus réservés au Président |

Toutes les règles sont vérifiées **côté base** : CA et avocat uniquement en double authentification, personne ne vérifie sa propre pièce, statut d'une pièce remise figé, pièces jamais supprimées, annonces en lecture seule, avocat limité aux pièces vérifiées de ses dossiers, conversation CA · avocat confidentielle.

## Périmètre livré (MVP du PRD)

| US | Fonction | État |
| --- | --- | --- |
| US1 | Connexion, mot de passe oublié, 2FA CA/avocat, code d'activation, FR/EN, mention RGPD | ✅ (traduction anglaise partielle : navigation et connexion) |
| US2 | Demande d'adhésion, lots, justificatif, validation CA, refus motivé par le Président | ✅ |
| US4 | Annuaire, coordonnées selon consentement, registre réservé au CA | ✅ |
| US5 | Messagerie temps réel, privé et groupes, « en train d'écrire », accusés de réception et de lecture, réponses, réactions, @mentions, modification/suppression, pièces jointes, vocaux 5 min, recherche, épingles, réglage des notifications | ✅ (notifications navigateur ; Web Push serveur à brancher) |
| US6 | Canal Annonces en lecture seule, lecteurs nominatifs visibles du CA | ✅ |
| US7 | Masquer un message (motif journalisé), suspension, rappel art. 2 | ✅ |
| US8 | « Ajouter au coffre » depuis une pièce jointe, lien vers le message d'origine | ✅ |
| US9 | Dépôt (formats, 50 Mo), photo multipage → PDF, SHA-256, horodatage | ✅ |
| US10 | Pièces requises par dossier, complétude par membre, relance en un clic | ✅ (relance par message privé) |
| US11 | Vérification, motif obligatoire, nouvelles versions | ✅ |
| US12 | Remises figées, numérotation continue, bordereau PDF, tableur, ZIP des originaux | ✅ |
| US14 | Dossiers, étapes, échéances, avocat, participants, dossier dérivé | ✅ |

Prévu en V1/V2 selon le PRD : cotisations (US3), vote d'autorisation en ligne (US13 — la date du vote se saisit à la main), mandats signés électroniquement (US15 — le CA enregistre aujourd'hui le mandat reçu), dépôt de projets d'actes par l'avocat (US16), AG et CA en ligne (US18), chronologie des griefs avec IA (US17), rappels d'échéances par e-mail, Web Push.

## Base juridique

Écran **Juridique** : documents des procédures en cours avec l'avocat (actes, conclusions, décisions, correspondances), regroupés par procédure.

- **Président** (ou Vice-Président suppléant) : seul à déposer, télécharger l'original et retirer un document. Au dépôt (PDF, JPG, PNG), son navigateur génère une image par page (pdf.js).
- **Membres actifs et CA** : consultation en ligne uniquement. Ils n'ont aucun accès au stockage ; la fonction Edge `juridique` vérifie leur droit (RLS) et renvoie une page à la fois, en mémoire, sans lien réutilisable. Les pages sont affichées dans un canevas avec un filigrane nominatif (nom, date, heure) ; clic droit, glisser, Ctrl/⌘+S, Ctrl/⌘+P et l'impression sont neutralisés.
- **Avocat** : pas d'accès (il est l'auteur de ces documents).
- **Journal** : dépôt, modification, retrait, téléchargement et chaque consultation sont enregistrés.

Limite assumée : ce qui s'affiche à l'écran peut toujours être photographié ou capturé. Le filigrane rend toute fuite attribuable à son auteur.

