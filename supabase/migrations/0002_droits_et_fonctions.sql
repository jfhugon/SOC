-- Spirit of Centaure — fonctions d'accès, déclencheurs, droits par ligne (RLS)
-- Les droits sont vérifiés côté base : l'interface ne fait que refléter ces règles.

-- ---------------------------------------------------------------------------
-- Fonctions d'accès
-- ---------------------------------------------------------------------------
create function public.aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Membre actif : copropriétaire à jour, l'avocat n'en est pas un
create function public.est_actif() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and statut = 'actif' and not est_avocat)
$$;

-- CA : double authentification obligatoire (US1)
create function public.est_ca() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aal2() and exists (select 1 from public.profiles
    where id = auth.uid() and statut = 'actif' and est_ca)
$$;

-- Président, ou Vice-Président quand la suppléance est activée (art. 10)
create function public.est_president() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_ca() and exists (select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.fonction = 'president'
        or (p.fonction = 'vice_president' and (select vp_suppleance from public.parametres where id = 1))))
$$;

create function public.est_admin_tech() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aal2() and exists (select 1 from public.profiles
    where id = auth.uid() and statut = 'actif' and est_admin_tech)
$$;

create function public.est_avocat() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aal2() and exists (select 1 from public.profiles
    where id = auth.uid() and statut = 'actif' and est_avocat)
$$;

create function public.est_avocat_dossier(d uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_avocat() and exists (select 1 from public.dossiers
    where id = d and avocat_id = auth.uid())
$$;

-- Dossiers visibles du CA, de l'avocat invité et des seuls participants
create function public.peut_voir_dossier(d uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_ca()
    or public.est_avocat_dossier(d)
    or (public.est_actif()
        and exists (select 1 from public.profiles where id = auth.uid() and acces_dossiers)
        and exists (select 1 from public.dossier_participants where dossier_id = d and membre_id = auth.uid()))
$$;

create function public.peut_acceder_conversation(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations cv
    where cv.id = c and (
         (cv.type in ('tous', 'annonces') and public.est_actif())
      or (cv.type = 'ca' and public.est_ca())
      or (cv.type in ('prive', 'groupe') and public.est_actif()
          and exists (select 1 from public.conversation_membres m
                      where m.conversation_id = cv.id and m.membre_id = auth.uid()))
      or (cv.type = 'dossier' and not public.est_avocat() and public.peut_voir_dossier(cv.dossier_id))
      or (cv.type = 'avocat' and (public.est_ca() or public.est_avocat_dossier(cv.dossier_id)))
    ))
$$;

create function public.peut_poster(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.peut_acceder_conversation(c)
    and exists (select 1 from public.profiles p where p.id = auth.uid()
                and (p.suspendu_jusqu_a is null or p.suspendu_jusqu_a < now()))
    and ((select type from public.conversations where id = c) <> 'annonces' or public.est_ca())
$$;

create function public.uuid_ou_null(t text) returns uuid
language sql immutable set search_path = '' as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end
$$;

-- Canaux Realtime privés « conv:<uuid> » (indicateur « en train d'écrire »)
create function public.peut_acceder_topic(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select t like 'conv:%' and coalesce(public.peut_acceder_conversation(public.uuid_ou_null(substr(t, 6))), false)
$$;

-- ---------------------------------------------------------------------------
-- Journal d'audit
-- ---------------------------------------------------------------------------
create function public.journal(p_action text, p_entite text, p_entite_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.journal_audit (acteur_id, action, entite, entite_id, details)
  values (auth.uid(), p_action, p_entite, p_entite_id, coalesce(p_details, '{}'))
$$;

-- Appelée par le client : connexion, téléchargement, export
create function public.journaliser(p_action text, p_entite text default null, p_entite_id text default null, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if p_action not in ('connexion', 'telechargement', 'export', 'deconnexion') then
    raise exception 'Action non journalisable par le client';
  end if;
  perform public.journal(p_action, p_entite, p_entite_id, p_details);
end $$;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, prenom, nom)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'prenom', ''),
          coalesce(new.raw_user_meta_data ->> 'nom', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.creer_profil();

-- Ouverture d'un dossier : conversation dédiée, conversation confidentielle avocat,
-- étapes et pièces requises par défaut (reprises du dossier parent le cas échéant)
create function public.initialiser_dossier() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  acte text := case new.type
    when 'sommation' then 'Signification de la sommation'
    when 'rupture' then 'Notification de la rupture du bail'
    else 'Délivrance de l''assignation' end;
begin
  insert into public.conversations (type, titre, dossier_id, cree_par)
  values ('dossier', new.titre, new.id, new.cree_par),
         ('avocat', new.titre || ' · CA et avocat', new.id, new.cree_par);

  insert into public.dossier_etapes (dossier_id, ordre, titre, statut) values
    (new.id, 1, 'Constat des griefs', 'en_cours'),
    (new.id, 2, 'Vote d''autorisation (art. 2 A)', 'a_venir'),
    (new.id, 3, 'Constitution des dossiers des bailleurs', 'a_venir'),
    (new.id, 4, 'Remise à l''avocat', 'a_venir'),
    (new.id, 5, acte, 'a_venir'),
    (new.id, 6, case when new.type = 'assignation' then 'Audience' else 'Fin du délai accordé au gestionnaire' end, 'a_venir');

  if new.parent_id is not null then
    insert into public.pieces_requises (dossier_id, type_piece, libelle, obligatoire, ordre)
    select new.id, type_piece, libelle, obligatoire, ordre from public.pieces_requises where dossier_id = new.parent_id;
    -- les participants du dossier précédent sont repris, leurs pièces vérifiées suivent
    insert into public.dossier_participants (dossier_id, lot_id, membre_id)
    select new.id, lot_id, membre_id from public.dossier_participants where dossier_id = new.parent_id;
  else
    insert into public.pieces_requises (dossier_id, type_piece, libelle, obligatoire, ordre) values
      (new.id, 'bail', 'Bail commercial signé', true, 1),
      (new.id, 'avenant', 'Avenants au bail', false, 2),
      (new.id, 'releve_loyers', 'Relevés de loyers ou redevances (3 dernières années)', true, 3),
      (new.id, 'compte_rendu_gestion', 'Comptes rendus de gestion', true, 4),
      (new.id, 'courrier', 'Courriers et e-mails avec le gestionnaire', false, 5),
      (new.id, 'etat_des_lieux', 'État des lieux', false, 6),
      (new.id, 'photo', 'Photos des manquements', false, 7),
      (new.id, 'mandat', 'Mandat à l''avocat', true, 8);
  end if;

  perform public.journal('ouverture_dossier', 'dossier', new.id::text, jsonb_build_object('type', new.type, 'titre', new.titre));
  return new;
end $$;
create trigger dossier_cree after insert on public.dossiers
  for each row execute function public.initialiser_dossier();

-- Dépôt : statut forcé à « Déposée », numéro de version calculé
create function public.preparer_piece() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prec public.pieces;
begin
  new.statut := 'deposee';
  new.motif := null;
  new.verifie_par := null;
  new.verifie_le := null;
  new.remise_a_avocat := false;
  new.remplacee := false;
  new.created_at := now();
  if new.version_precedente is not null then
    select * into prec from public.pieces where id = new.version_precedente;
    if prec.id is null or prec.membre_id <> new.membre_id then
      raise exception 'Version précédente introuvable';
    end if;
    if prec.remplacee then raise exception 'Cette pièce a déjà une version plus récente'; end if;
    if prec.remise_a_avocat then raise exception 'Une pièce remise à l''avocat ne peut plus être remplacée'; end if;
    new.version := prec.version + 1;
  else
    new.version := 1;
  end if;
  return new;
end $$;
create trigger piece_avant_insert before insert on public.pieces
  for each row execute function public.preparer_piece();

create function public.apres_depot_piece() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.version_precedente is not null then
    update public.pieces set remplacee = true where id = new.version_precedente;
  end if;
  perform public.journal('depot_piece', 'piece', new.id::text,
    jsonb_build_object('type', new.type_piece, 'sha256', new.sha256, 'version', new.version, 'message_source', new.message_source));
  return new;
end $$;
create trigger piece_apres_insert after insert on public.pieces
  for each row execute function public.apres_depot_piece();

-- ---------------------------------------------------------------------------
-- Fonctions métier (RPC)
-- ---------------------------------------------------------------------------

-- US1 : premier accès par code d'activation à usage unique
create function public.utiliser_code(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare c public.codes_activation; mail text;
begin
  select email into mail from public.profiles where id = auth.uid();
  select * into c from public.codes_activation
    where code = upper(trim(p_code)) and utilise_par is null and expire_le > now() for update;
  if c.code is null then raise exception 'Code invalide ou expiré'; end if;
  if lower(c.email) <> lower(mail) then raise exception 'Ce code a été émis pour une autre adresse e-mail'; end if;
  update public.codes_activation set utilise_par = auth.uid(), utilise_le = now() where code = c.code;
  update public.profiles set statut = 'actif' where id = auth.uid() and statut = 'en_attente';
  perform public.journal('activation_code', 'profil', auth.uid()::text, '{}');
  return true;
end $$;

create function public.creer_code_activation(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  v := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  insert into public.codes_activation (code, email) values (v, lower(trim(p_email)));
  perform public.journal('creation_code', 'code_activation', v, jsonb_build_object('email', lower(trim(p_email))));
  return v;
end $$;

-- US2 : décision sur une adhésion ; refus motivé, envoyé par le Président (art. 6)
create function public.decider_adhesion(p_demande uuid, p_decision text, p_motif text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.demandes_adhesion;
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  select * into d from public.demandes_adhesion where id = p_demande for update;
  if d.id is null then raise exception 'Demande introuvable'; end if;
  if p_decision = 'validee' then
    update public.profiles set statut = 'actif' where id = d.membre_id;
  elsif p_decision = 'refusee' then
    if not public.est_president() then raise exception 'Le refus est notifié par le Président (art. 6)'; end if;
    if coalesce(trim(p_motif), '') = '' then raise exception 'Un refus exige un avis motivé'; end if;
    update public.profiles set statut = 'refuse' where id = d.membre_id;
    update public.lots set membre_id = null where membre_id = d.membre_id;
  else
    raise exception 'Décision inconnue';
  end if;
  update public.demandes_adhesion
    set statut = p_decision, motif = p_motif, decide_par = auth.uid(), decide_le = now()
    where id = p_demande;
  perform public.journal('decision_adhesion', 'adhesion', p_demande::text,
    jsonb_build_object('decision', p_decision, 'motif', p_motif, 'membre', d.membre_id));
end $$;

-- Rôles et statut d'un compte (administrateur technique ou Président)
create function public.definir_roles(p_membre uuid, p_statut public.statut_membre, p_est_ca boolean,
  p_fonction public.fonction_bureau, p_est_avocat boolean, p_est_admin_tech boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.est_admin_tech() or public.est_president()) then
    raise exception 'Réservé à l''administrateur technique ou au Président';
  end if;
  if p_fonction is not null and exists (select 1 from public.profiles where fonction = p_fonction and id <> p_membre) then
    raise exception 'Cette fonction du bureau est déjà occupée';
  end if;
  update public.profiles set
    statut = p_statut, est_ca = p_est_ca or p_fonction is not null, fonction = p_fonction,
    est_avocat = p_est_avocat, est_admin_tech = p_est_admin_tech
  where id = p_membre;
  perform public.journal('roles', 'profil', p_membre::text, jsonb_build_object('statut', p_statut,
    'est_ca', p_est_ca, 'fonction', p_fonction, 'est_avocat', p_est_avocat, 'est_admin_tech', p_est_admin_tech));
end $$;

-- Conflit d'intérêts (§6)
create function public.signaler_conflit(p_membre uuid, p_conflit boolean, p_note text, p_acces_dossiers boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  update public.profiles set conflit_interet = p_conflit, conflit_note = p_note, acces_dossiers = p_acces_dossiers
    where id = p_membre;
  perform public.journal('conflit_interet', 'profil', p_membre::text,
    jsonb_build_object('conflit', p_conflit, 'acces_dossiers', p_acces_dossiers));
end $$;

-- US4 : annuaire ; coordonnées visibles seulement si le membre l'accepte
create function public.annuaire()
returns table (id uuid, prenom text, nom text, appartements text, role text,
               telephone text, email text, est_ca boolean, fonction public.fonction_bureau, est_avocat boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.prenom, p.nom,
    (select string_agg(l.appartement, ', ' order by l.appartement) from public.lots l where l.membre_id = p.id),
    case
      when p.est_avocat then 'Avocat'
      when p.fonction = 'president' then 'Président'
      when p.fonction = 'vice_president' then 'Vice-Président'
      when p.fonction = 'secretaire' then 'Secrétaire'
      when p.fonction = 'tresorier' then 'Trésorier'
      when p.est_ca then 'Administrateur'
      else 'Membre' end,
    case when p.afficher_telephone or public.est_ca() then p.telephone end,
    case when p.afficher_email or public.est_ca() then p.email end,
    p.est_ca, p.fonction, p.est_avocat
  from public.profiles p
  where (public.est_actif() or public.est_ca() or public.est_avocat())
    and p.statut = 'actif'
    -- l'avocat ne voit que le CA et les participants de ses dossiers
    and (not public.est_avocat() or p.est_ca or p.id = auth.uid() or exists (
      select 1 from public.dossier_participants dp join public.dossiers d on d.id = dp.dossier_id
      where dp.membre_id = p.id and d.avocat_id = auth.uid()))
  order by p.nom, p.prenom
$$;

-- US5 : conversations
create function public.ouvrir_conversation_privee(p_autre uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if not public.est_actif() then raise exception 'Réservé aux membres actifs'; end if;
  if p_autre = auth.uid() then raise exception 'Choisissez un autre membre'; end if;
  if not exists (select 1 from public.profiles where id = p_autre and statut = 'actif' and not est_avocat) then
    raise exception 'Ce membre n''est pas actif';
  end if;
  select cv.id into c from public.conversations cv
    where cv.type = 'prive'
      and exists (select 1 from public.conversation_membres where conversation_id = cv.id and membre_id = auth.uid())
      and exists (select 1 from public.conversation_membres where conversation_id = cv.id and membre_id = p_autre)
    limit 1;
  if c is null then
    insert into public.conversations (type) values ('prive') returning id into c;
    insert into public.conversation_membres (conversation_id, membre_id) values (c, auth.uid()), (c, p_autre);
  end if;
  return c;
end $$;

create function public.creer_groupe(p_titre text, p_membres uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if not public.est_actif() then raise exception 'Réservé aux membres actifs'; end if;
  if coalesce(trim(p_titre), '') = '' then raise exception 'Donnez un nom au groupe'; end if;
  insert into public.conversations (type, titre) values ('groupe', trim(p_titre)) returning id into c;
  insert into public.conversation_membres (conversation_id, membre_id)
    select c, p.id from public.profiles p
    where p.statut = 'actif' and not p.est_avocat and (p.id = any(p_membres) or p.id = auth.uid());
  return c;
end $$;

create function public.mes_conversations()
returns table (id uuid, type public.type_conversation, titre text, dossier_id uuid, cle text,
               dernier_message text, dernier_auteur uuid, dernier_le timestamptz,
               non_lus int, mentions_non_lues int, notifications text, interlocuteur uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.type,
    coalesce(c.titre, (select trim(p.prenom || ' ' || p.nom) from public.conversation_membres cm
                       join public.profiles p on p.id = cm.membre_id
                       where cm.conversation_id = c.id and cm.membre_id <> auth.uid() limit 1)),
    c.dossier_id, c.cle,
    case
      when lm.masque_le is not null then 'Message masqué par le CA'
      when lm.supprime_le is not null then 'Message supprimé'
      when lm.contenu is not null then lm.contenu
      when lm.piece_jointe is not null then '📎 ' || (lm.piece_jointe ->> 'nom')
    end,
    lm.auteur_id, lm.created_at,
    (select count(*)::int from public.messages m where m.conversation_id = c.id
       and m.auteur_id <> auth.uid() and m.supprime_le is null
       and m.created_at > coalesce(e.lu_jusqu_a, '-infinity')),
    (select count(*)::int from public.messages m where m.conversation_id = c.id
       and auth.uid() = any(m.mentions) and m.created_at > coalesce(e.lu_jusqu_a, '-infinity')),
    coalesce(e.notifications, 'tous'),
    (select cm.membre_id from public.conversation_membres cm
      where c.type = 'prive' and cm.conversation_id = c.id and cm.membre_id <> auth.uid() limit 1)
  from public.conversations c
  left join public.conversation_etats e on e.conversation_id = c.id and e.membre_id = auth.uid()
  left join lateral (
    select m.contenu, m.auteur_id, m.created_at, m.piece_jointe, m.supprime_le, m.masque_le
    from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  where public.peut_acceder_conversation(c.id)
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- Accusé de réception : appelé à l'ouverture de l'application et à chaque message reçu
create function public.marquer_recu() returns void
language sql security definer set search_path = '' as $$
  insert into public.conversation_etats (conversation_id, membre_id, recu_jusqu_a)
  select c.id, auth.uid(), now() from public.conversations c where public.peut_acceder_conversation(c.id)
  on conflict (conversation_id, membre_id) do update set recu_jusqu_a = excluded.recu_jusqu_a
$$;

create function public.marquer_lu(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.peut_acceder_conversation(p_conversation) then raise exception 'Accès refusé'; end if;
  insert into public.conversation_etats (conversation_id, membre_id, recu_jusqu_a, lu_jusqu_a)
  values (p_conversation, auth.uid(), now(), now())
  on conflict (conversation_id, membre_id) do update set recu_jusqu_a = now(), lu_jusqu_a = now();
end $$;

create function public.regler_notifications(p_conversation uuid, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.peut_acceder_conversation(p_conversation) then raise exception 'Accès refusé'; end if;
  insert into public.conversation_etats (conversation_id, membre_id, notifications)
  values (p_conversation, auth.uid(), p_mode)
  on conflict (conversation_id, membre_id) do update set notifications = excluded.notifications;
end $$;

create function public.modifier_message(p_message uuid, p_contenu text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_contenu), '') = '' then raise exception 'Message vide'; end if;
  update public.messages set contenu = p_contenu, modifie_le = now()
    where id = p_message and auteur_id = auth.uid() and supprime_le is null and masque_le is null
      and public.peut_poster(conversation_id);
  if not found then raise exception 'Modification impossible'; end if;
end $$;

create function public.supprimer_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set contenu = null, piece_jointe = null, supprime_le = now(), epingle = false
    where id = p_message and auteur_id = auth.uid() and supprime_le is null;
  if not found then raise exception 'Suppression impossible'; end if;
end $$;

create function public.epingler_message(p_message uuid, p_epingle boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversations;
begin
  select cv.* into c from public.conversations cv join public.messages m on m.conversation_id = cv.id where m.id = p_message;
  if not (public.est_ca() and public.peut_acceder_conversation(c.id))
     and not (c.type in ('prive', 'groupe') and public.peut_poster(c.id)) then
    raise exception 'Seul le CA épingle dans les groupes de l''association';
  end if;
  update public.messages set epingle = p_epingle where id = p_message;
end $$;

-- US7 : modération, motif journalisé
create function public.masquer_message(p_message uuid, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.messages;
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Le motif est obligatoire'; end if;
  select * into m from public.messages where id = p_message;
  if m.id is null then raise exception 'Message introuvable'; end if;
  insert into public.moderations (message_id, membre_id, action, motif, contenu_original)
    values (m.id, m.auteur_id, 'masquer', p_motif, m.contenu);
  update public.messages set contenu = null, piece_jointe = null, masque_le = now(), masque_par = auth.uid(), epingle = false
    where id = p_message;
  perform public.journal('moderation', 'message', p_message::text, jsonb_build_object('motif', p_motif));
end $$;

create function public.suspendre_membre(p_membre uuid, p_jusqu_a timestamptz, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Le motif est obligatoire'; end if;
  update public.profiles set suspendu_jusqu_a = p_jusqu_a where id = p_membre;
  insert into public.moderations (membre_id, action, motif)
    values (p_membre, case when p_jusqu_a is null then 'lever_suspension' else 'suspendre' end, p_motif);
  perform public.journal('moderation', 'profil', p_membre::text, jsonb_build_object('jusqu_a', p_jusqu_a, 'motif', p_motif));
end $$;

-- US11 : vérification ; personne ne vérifie sa propre pièce
create function public.verifier_piece(p_piece uuid, p_statut public.statut_piece, p_motif text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pieces;
begin
  if not public.est_ca() then raise exception 'Réservé au CA'; end if;
  select * into p from public.pieces where id = p_piece for update;
  if p.id is null then raise exception 'Pièce introuvable'; end if;
  if p.membre_id = auth.uid() then raise exception 'Personne ne vérifie sa propre pièce'; end if;
  if p.remise_a_avocat then raise exception 'Pièce déjà remise à l''avocat : statut figé'; end if;
  if p.remplacee then raise exception 'Une version plus récente existe'; end if;
  if p_statut in ('a_completer', 'rejetee') and coalesce(trim(p_motif), '') = '' then
    raise exception 'Le motif est obligatoire';
  end if;
  update public.pieces set statut = p_statut, motif = nullif(trim(p_motif), ''),
    verifie_par = auth.uid(), verifie_le = now() where id = p_piece;
  perform public.journal('verification_piece', 'piece', p_piece::text,
    jsonb_build_object('statut', p_statut, 'motif', p_motif));
end $$;

-- US12 : remise datée et figée ; une remise complémentaire reprend la numérotation
create function public.creer_remise(p_dossier uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r uuid; n int; dernier int; nb int;
begin
  if not public.est_president() then raise exception 'Réservé au Président'; end if;
  select coalesce(max(numero), 0) + 1 into n from public.remises where dossier_id = p_dossier;
  select coalesce(max(numero_piece), 0) into dernier from public.remise_pieces where dossier_id = p_dossier;
  insert into public.remises (dossier_id, numero) values (p_dossier, n) returning id into r;

  with candidates as (
    select p.id, p.membre_id,
      -- pièces communes du dossier d'abord, puis par bailleur
      case when p.dossier_id = p_dossier and p.type_piece in ('autorisation_agir') then 0 else 1 end as rang,
      pr.nom, pr.prenom, coalesce(rq.ordre, 99) as ordre_type, p.date_document, p.created_at
    from public.pieces p
    join public.profiles pr on pr.id = p.membre_id
    left join public.pieces_requises rq on rq.dossier_id = p_dossier and rq.type_piece = p.type_piece
    where p.statut = 'verifiee' and not p.remplacee
      and (p.dossier_id = p_dossier
           or exists (select 1 from public.dossier_participants dp where dp.dossier_id = p_dossier and dp.membre_id = p.membre_id))
      and not exists (select 1 from public.remise_pieces rp where rp.dossier_id = p_dossier and rp.piece_id = p.id)
  )
  insert into public.remise_pieces (remise_id, piece_id, dossier_id, numero_piece, membre_id)
  select r, id, p_dossier, dernier + row_number() over (order by rang, nom, prenom, membre_id, ordre_type, date_document nulls last, created_at), membre_id
  from candidates;

  get diagnostics nb = row_count;
  if nb = 0 then raise exception 'Aucune nouvelle pièce vérifiée à remettre'; end if;

  update public.pieces set remise_a_avocat = true
    where id in (select piece_id from public.remise_pieces where remise_id = r);
  update public.dossiers set statut = 'remise' where id = p_dossier and statut in ('constat', 'autorisation', 'constitution');
  perform public.journal('remise_avocat', 'dossier', p_dossier::text, jsonb_build_object('remise', r, 'numero', n, 'pieces', nb));
  return r;
end $$;

-- Dossiers ouverts que le membre peut rejoindre (titre et type seulement)
create function public.dossiers_ouverts()
returns table (id uuid, type public.type_dossier, titre text, statut public.statut_dossier, date_remise_prevue date)
language sql stable security definer set search_path = '' as $$
  select d.id, d.type, d.titre, d.statut, d.date_remise_prevue from public.dossiers d
  where d.statut <> 'clos' and public.est_actif()
    and exists (select 1 from public.profiles where id = auth.uid() and acces_dossiers)
  order by d.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Droits par ligne
-- ---------------------------------------------------------------------------
alter table public.parametres enable row level security;
alter table public.profiles enable row level security;
alter table public.lots enable row level security;
alter table public.demandes_adhesion enable row level security;
alter table public.codes_activation enable row level security;
alter table public.journal_audit enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_etapes enable row level security;
alter table public.dossier_participants enable row level security;
alter table public.pieces_requises enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_membres enable row level security;
alter table public.conversation_etats enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.moderations enable row level security;
alter table public.pieces enable row level security;
alter table public.remises enable row level security;
alter table public.remise_pieces enable row level security;

-- Aucun accès anonyme
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

create policy "lecture" on public.parametres for select to authenticated using (true);
create policy "modification" on public.parametres for update to authenticated
  using (public.est_admin_tech() or public.est_president());

-- Profils : chacun modifie ses coordonnées, jamais ses rôles
create policy "lecture" on public.profiles for select to authenticated
  using (id = auth.uid() or public.est_ca() or public.est_admin_tech());
create policy "modification" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (prenom, nom, telephone, adresse, pays, afficher_telephone, afficher_email, langue, statuts_acceptes_le)
  on public.profiles to authenticated;

create policy "lecture" on public.lots for select to authenticated
  using (membre_id = auth.uid() or public.est_ca() or exists (
    select 1 from public.dossier_participants dp where dp.lot_id = lots.id and public.est_avocat_dossier(dp.dossier_id)));
create policy "ajout" on public.lots for insert to authenticated
  with check (membre_id = auth.uid() or public.est_ca());
create policy "modification" on public.lots for update to authenticated
  using (public.est_ca() or (membre_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and statut = 'en_attente')))
  with check (public.est_ca() or membre_id = auth.uid());
create policy "suppression" on public.lots for delete to authenticated
  using (public.est_ca() or (membre_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and statut = 'en_attente')));

create policy "lecture" on public.demandes_adhesion for select to authenticated
  using (membre_id = auth.uid() or public.est_ca());
create policy "depot" on public.demandes_adhesion for insert to authenticated
  with check (membre_id = auth.uid() and statut = 'en_attente');
create policy "complement" on public.demandes_adhesion for update to authenticated
  using (membre_id = auth.uid() and statut = 'en_attente') with check (membre_id = auth.uid() and statut = 'en_attente');
revoke update on public.demandes_adhesion from authenticated;
grant update (justificatif_chemin, justificatif_nom) on public.demandes_adhesion to authenticated;

create policy "lecture" on public.codes_activation for select to authenticated using (public.est_ca());
create policy "suppression" on public.codes_activation for delete to authenticated using (public.est_ca() and utilise_par is null);

create policy "lecture" on public.journal_audit for select to authenticated
  using (public.est_admin_tech() or public.est_president());

create policy "lecture" on public.dossiers for select to authenticated using (public.peut_voir_dossier(id));
create policy "ouverture" on public.dossiers for insert to authenticated with check (public.est_president());
create policy "pilotage" on public.dossiers for update to authenticated using (public.est_ca()) with check (public.est_ca());

create policy "lecture" on public.dossier_etapes for select to authenticated using (public.peut_voir_dossier(dossier_id));
create policy "pilotage" on public.dossier_etapes for all to authenticated using (public.est_ca()) with check (public.est_ca());

create policy "lecture" on public.dossier_participants for select to authenticated
  using (membre_id = auth.uid() or public.peut_voir_dossier(dossier_id));
create policy "adhesion" on public.dossier_participants for insert to authenticated
  with check (
    (membre_id = auth.uid() and public.est_actif()
      and exists (select 1 from public.profiles where id = auth.uid() and acces_dossiers)
      and exists (select 1 from public.lots where id = lot_id and lots.membre_id = auth.uid())
      and exists (select 1 from public.dossiers where id = dossier_id and statut not in ('actes', 'clos'))
      and mandat_signe_le is null)
    or public.est_ca());
create policy "retrait" on public.dossier_participants for delete to authenticated
  using (public.est_ca() or (membre_id = auth.uid() and mandat_signe_le is null));
create policy "mandat" on public.dossier_participants for update to authenticated
  using (public.est_ca()) with check (public.est_ca());

create policy "lecture" on public.pieces_requises for select to authenticated using (public.peut_voir_dossier(dossier_id));
create policy "pilotage" on public.pieces_requises for all to authenticated using (public.est_ca()) with check (public.est_ca());

create policy "lecture" on public.conversations for select to authenticated using (public.peut_acceder_conversation(id));
create policy "lecture" on public.conversation_membres for select to authenticated
  using (public.peut_acceder_conversation(conversation_id));

-- Accusés de lecture nominatifs des annonces : visibles du seul CA (US6)
create policy "lecture" on public.conversation_etats for select to authenticated
  using (membre_id = auth.uid() or (public.peut_acceder_conversation(conversation_id)
    and ((select type from public.conversations where id = conversation_id) <> 'annonces' or public.est_ca())));

create policy "lecture" on public.messages for select to authenticated
  using (public.peut_acceder_conversation(conversation_id));
create policy "envoi" on public.messages for insert to authenticated
  with check (auteur_id = auth.uid() and public.peut_poster(conversation_id)
    and not epingle and supprime_le is null and masque_le is null and modifie_le is null
    and (reponse_a is null or exists (select 1 from public.messages r where r.id = reponse_a and r.conversation_id = messages.conversation_id)));

create policy "lecture" on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.peut_acceder_conversation(m.conversation_id)));
create policy "ajout" on public.message_reactions for insert to authenticated
  with check (membre_id = auth.uid() and exists (select 1 from public.messages m
    where m.id = message_id and public.peut_acceder_conversation(m.conversation_id)
      and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.suspendu_jusqu_a is null or p.suspendu_jusqu_a < now()))));
create policy "retrait" on public.message_reactions for delete to authenticated using (membre_id = auth.uid());

create policy "lecture" on public.moderations for select to authenticated using (public.est_ca());

-- Pièces : le membre voit les siennes, le CA toutes, l'avocat les pièces vérifiées de ses dossiers
create policy "lecture" on public.pieces for select to authenticated
  using (membre_id = auth.uid() or public.est_ca()
    or (statut = 'verifiee' and public.est_avocat() and (
      (dossier_id is not null and public.est_avocat_dossier(dossier_id))
      or exists (select 1 from public.dossier_participants dp
                 where dp.membre_id = pieces.membre_id and public.est_avocat_dossier(dp.dossier_id)))));
create policy "depot" on public.pieces for insert to authenticated
  with check (membre_id = auth.uid() and (public.est_actif() or public.est_ca())
    and split_part(chemin, '/', 1) = auth.uid()::text
    and (lot_id is null or exists (select 1 from public.lots where id = lot_id and lots.membre_id = auth.uid()))
    and (message_source is null or exists (select 1 from public.messages m
         where m.id = message_source and public.peut_acceder_conversation(m.conversation_id))));
-- aucune politique de modification ni de suppression : statut via verifier_piece(), pièces jamais effacées

create policy "lecture" on public.remises for select to authenticated
  using (public.est_ca() or public.est_avocat_dossier(dossier_id));
create policy "lecture" on public.remise_pieces for select to authenticated
  using (public.est_ca() or public.est_avocat_dossier(dossier_id));

-- ---------------------------------------------------------------------------
-- Groupes créés d'office (US5, US6)
-- ---------------------------------------------------------------------------
insert into public.conversations (type, titre, cle, cree_par) values
  ('annonces', 'Annonces', 'annonces', null),
  ('tous', 'Tous les membres', 'tous', null),
  ('ca', 'Conseil d''administration', 'ca', null);

-- ---------------------------------------------------------------------------
-- Temps réel
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.message_reactions, public.conversation_etats;

create policy "conv privee lecture" on realtime.messages for select to authenticated
  using (public.peut_acceder_topic(realtime.topic()));
create policy "conv privee ecriture" on realtime.messages for insert to authenticated
  with check (public.peut_acceder_topic(realtime.topic()));

-- ---------------------------------------------------------------------------
-- Stockage (privé, 50 Mo par fichier)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit) values
  ('pieces', 'pieces', false, 52428800),
  ('messagerie', 'messagerie', false, 52428800),
  ('justificatifs', 'justificatifs', false, 20971520);

create policy "pieces depot" on storage.objects for insert to authenticated
  with check (bucket_id = 'pieces' and (storage.foldername(name))[1] = auth.uid()::text
    and (public.est_actif() or public.est_ca()));
-- la lecture suit les droits de la table pieces (sous-requête soumise à la RLS)
create policy "pieces lecture" on storage.objects for select to authenticated
  using (bucket_id = 'pieces' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.pieces p where p.chemin = storage.objects.name)));

create policy "messagerie depot" on storage.objects for insert to authenticated
  with check (bucket_id = 'messagerie'
    and coalesce(public.peut_poster(public.uuid_ou_null((storage.foldername(name))[1])), false));
create policy "messagerie lecture" on storage.objects for select to authenticated
  using (bucket_id = 'messagerie'
    and coalesce(public.peut_acceder_conversation(public.uuid_ou_null((storage.foldername(name))[1])), false));

create policy "justificatifs depot" on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "justificatifs lecture" on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs' and ((storage.foldername(name))[1] = auth.uid()::text or public.est_ca()));
