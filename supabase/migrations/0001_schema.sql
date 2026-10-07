-- Spirit of Centaure — schéma MVP (PRD v1, 6 oct. 2026)
-- US1, US2, US4, US5, US6, US7 (modération), US8, US9, US10, US11, US12, US14

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.statut_membre as enum ('en_attente', 'actif', 'inactif', 'refuse');
create type public.fonction_bureau as enum ('president', 'vice_president', 'secretaire', 'tresorier');
create type public.type_conversation as enum ('prive', 'groupe', 'tous', 'annonces', 'ca', 'dossier', 'avocat');
create type public.statut_piece as enum ('deposee', 'verifiee', 'a_completer', 'rejetee');
create type public.type_dossier as enum ('sommation', 'rupture', 'assignation');
create type public.statut_dossier as enum ('constat', 'autorisation', 'constitution', 'remise', 'actes', 'clos');
create type public.statut_etape as enum ('a_venir', 'en_cours', 'fait');

-- ---------------------------------------------------------------------------
-- Paramètres (une seule ligne)
-- ---------------------------------------------------------------------------
create table public.parametres (
  id int primary key default 1 check (id = 1),
  vp_suppleance boolean not null default false, -- art. 10 : le VP remplace le Président empêché
  cotisation_montant numeric(8,2) not null default 50,
  conservation_messages_annees int not null default 3,
  conservation_pieces_annees int not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.parametres default values;

-- ---------------------------------------------------------------------------
-- Profils et rôles (art. 5 à 11)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  prenom text not null default '',
  nom text not null default '',
  telephone text,
  adresse text,
  pays text,
  afficher_telephone boolean not null default false,
  afficher_email boolean not null default false,
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  statut public.statut_membre not null default 'en_attente',
  est_ca boolean not null default false,
  -- une seule colonne : une même personne ne cumule pas deux fonctions (art. 10) ;
  -- unique : une seule personne par fonction
  fonction public.fonction_bureau unique,
  est_avocat boolean not null default false,
  est_admin_tech boolean not null default false,
  conflit_interet boolean not null default false,
  conflit_note text,
  acces_dossiers boolean not null default true,
  suspendu_jusqu_a timestamptz,
  statuts_acceptes_le timestamptz,
  created_at timestamptz not null default now(),
  constraint fonction_reservee_au_ca check (fonction is null or est_ca)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique, -- un lot ne peut être rattaché qu'à un seul membre
  appartement text not null,
  membre_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index on public.lots (membre_id);

create table public.demandes_adhesion (
  id uuid primary key default gen_random_uuid(),
  membre_id uuid not null unique references public.profiles on delete cascade,
  justificatif_chemin text,
  justificatif_nom text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  motif text,
  decide_par uuid references public.profiles,
  decide_le timestamptz,
  created_at timestamptz not null default now()
);

create table public.codes_activation (
  code text primary key,
  email text not null,
  cree_par uuid references public.profiles default auth.uid(),
  utilise_par uuid references public.profiles,
  utilise_le timestamptz,
  expire_le timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal d'audit
-- ---------------------------------------------------------------------------
create table public.journal_audit (
  id bigint generated always as identity primary key,
  acteur_id uuid default auth.uid(),
  action text not null,
  entite text,
  entite_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.journal_audit (created_at desc);

-- ---------------------------------------------------------------------------
-- Dossiers juridiques (US14)
-- ---------------------------------------------------------------------------
create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  type public.type_dossier not null,
  titre text not null,
  griefs text not null default '',
  statut public.statut_dossier not null default 'constat',
  parent_id uuid references public.dossiers,
  avocat_id uuid references public.profiles,
  date_vote date,
  date_remise_prevue date,
  date_signification date,
  delai_jours int check (delai_jours is null or delai_jours > 0),
  fin_delai date generated always as (date_signification + delai_jours) stored,
  date_audience date,
  cree_par uuid references public.profiles default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.dossier_etapes (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers on delete cascade,
  ordre int not null,
  titre text not null,
  statut public.statut_etape not null default 'a_venir',
  echeance date,
  unique (dossier_id, ordre)
);

create table public.dossier_participants (
  dossier_id uuid not null references public.dossiers on delete cascade,
  lot_id uuid not null references public.lots on delete cascade,
  membre_id uuid not null references public.profiles on delete cascade,
  mandat_signe_le timestamptz,
  created_at timestamptz not null default now(),
  primary key (dossier_id, lot_id)
);
create index on public.dossier_participants (membre_id);

create table public.pieces_requises (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers on delete cascade,
  type_piece text not null,
  libelle text not null,
  obligatoire boolean not null default true,
  ordre int not null default 0
);
create index on public.pieces_requises (dossier_id);

-- ---------------------------------------------------------------------------
-- Messagerie (US5, US6, US7)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.type_conversation not null,
  titre text,
  cle text unique, -- 'tous', 'annonces', 'ca' pour les groupes créés d'office
  dossier_id uuid references public.dossiers on delete cascade,
  cree_par uuid references public.profiles default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.conversation_membres (
  conversation_id uuid not null references public.conversations on delete cascade,
  membre_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, membre_id)
);
create index on public.conversation_membres (membre_id);

create table public.conversation_etats (
  conversation_id uuid not null references public.conversations on delete cascade,
  membre_id uuid not null references public.profiles on delete cascade default auth.uid(),
  recu_jusqu_a timestamptz,
  lu_jusqu_a timestamptz,
  notifications text not null default 'tous' check (notifications in ('tous', 'mentions', 'muet')),
  primary key (conversation_id, membre_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  auteur_id uuid not null references public.profiles default auth.uid(),
  contenu text,
  reponse_a uuid references public.messages on delete set null,
  piece_jointe jsonb, -- {chemin, nom, mime, taille, duree?}
  mentions uuid[] not null default '{}',
  epingle boolean not null default false,
  modifie_le timestamptz,
  supprime_le timestamptz,
  masque_le timestamptz,
  masque_par uuid references public.profiles,
  created_at timestamptz not null default now(),
  constraint message_non_vide check (contenu is not null or piece_jointe is not null or supprime_le is not null or masque_le is not null)
);
create index on public.messages (conversation_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages on delete cascade,
  membre_id uuid not null references public.profiles on delete cascade default auth.uid(),
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, membre_id, emoji)
);

create table public.moderations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages on delete set null,
  membre_id uuid references public.profiles,
  action text not null check (action in ('masquer', 'suspendre', 'lever_suspension')),
  motif text not null,
  contenu_original text,
  moderateur_id uuid references public.profiles default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Coffre de pièces (US8 à US12)
-- ---------------------------------------------------------------------------
create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  membre_id uuid not null references public.profiles default auth.uid(),
  lot_id uuid references public.lots on delete set null,
  dossier_id uuid references public.dossiers on delete set null,
  type_piece text not null,
  date_document date,
  description text,
  statut public.statut_piece not null default 'deposee',
  motif text,
  chemin text not null unique,
  nom_fichier text not null,
  mime text,
  taille bigint,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  version int not null default 1,
  version_precedente uuid references public.pieces,
  remplacee boolean not null default false,
  message_source uuid references public.messages on delete set null,
  verifie_par uuid references public.profiles,
  verifie_le timestamptz,
  remise_a_avocat boolean not null default false,
  created_at timestamptz not null default now(),
  constraint taille_max check (taille is null or taille <= 52428800)
);
create index on public.pieces (membre_id);
create index on public.pieces (statut);

create table public.remises (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers on delete restrict,
  numero int not null,
  cree_par uuid references public.profiles default auth.uid(),
  created_at timestamptz not null default now(),
  unique (dossier_id, numero)
);

create table public.remise_pieces (
  remise_id uuid not null references public.remises on delete restrict,
  piece_id uuid not null references public.pieces on delete restrict,
  dossier_id uuid not null references public.dossiers on delete restrict,
  numero_piece int not null,
  membre_id uuid references public.profiles,
  primary key (remise_id, piece_id),
  unique (dossier_id, numero_piece),
  unique (dossier_id, piece_id)
);
