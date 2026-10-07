-- Plusieurs propriétaires par lot (ex. couple marié à l'achat puis divorcé) et détention via une société.
-- Un propriétaire est soit un compte membre (membre_id), soit une personne sans compte (nom seul).

alter table public.lots add column societe text check (societe is null or btrim(societe) <> '');

create table public.lot_proprietaires (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots on delete cascade,
  membre_id uuid references public.profiles on delete cascade,
  nom text check (nom is null or btrim(nom) <> ''),
  created_at timestamptz not null default now(),
  constraint compte_ou_nom check ((membre_id is null) <> (nom is null)),
  unique (lot_id, membre_id)
);
create index on public.lot_proprietaires (membre_id);

insert into public.lot_proprietaires (lot_id, membre_id)
  select id, membre_id from public.lots where membre_id is not null;

-- Le membre connecté est-il propriétaire de ce lot ?
create function public.est_proprietaire_lot(p_lot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lot_proprietaires where lot_id = p_lot and membre_id = auth.uid())
$$;
revoke execute on function public.est_proprietaire_lot(uuid) from anon, public;
grant execute on function public.est_proprietaire_lot(uuid) to authenticated;

-- Règles d'accès qui reposaient sur lots.membre_id
drop policy "lecture" on public.lots;
create policy "lecture" on public.lots for select to authenticated
  using (public.est_proprietaire_lot(id) or public.est_ca() or public.est_admin_tech() or exists (
    select 1 from public.dossier_participants dp where dp.lot_id = lots.id and public.est_avocat_dossier(dp.dossier_id)));
drop policy "ajout" on public.lots;
create policy "ajout" on public.lots for insert to authenticated with check (public.est_ca() or public.est_admin_tech());
drop policy "modification" on public.lots;
create policy "modification" on public.lots for update to authenticated
  using (public.est_ca() or public.est_admin_tech()) with check (public.est_ca() or public.est_admin_tech());
drop policy "suppression" on public.lots;
create policy "suppression" on public.lots for delete to authenticated using (public.est_ca() or public.est_admin_tech());

alter table public.lot_proprietaires enable row level security;
create policy "lecture" on public.lot_proprietaires for select to authenticated
  using (public.est_proprietaire_lot(lot_id) or public.est_ca() or public.est_admin_tech());
create policy "gestion" on public.lot_proprietaires for all to authenticated
  using (public.est_ca() or public.est_admin_tech()) with check (public.est_ca() or public.est_admin_tech());

alter policy "depot" on public.pieces with check (
  membre_id = auth.uid() and (public.est_actif() or public.est_ca())
  and split_part(chemin, '/', 1) = auth.uid()::text
  and (lot_id is null or public.est_proprietaire_lot(lot_id))
  and (message_source is null or exists (
    select 1 from public.messages m where m.id = message_source and public.peut_acceder_conversation(m.conversation_id))));

alter policy "adhesion" on public.dossier_participants with check (
  (membre_id = auth.uid() and public.est_actif()
    and exists (select 1 from public.profiles where id = auth.uid() and acces_dossiers)
    and public.est_proprietaire_lot(lot_id)
    and public.dossier_ouvert_aux_adhesions(dossier_id) and mandat_signe_le is null)
  or public.est_ca());

-- Refus d'adhésion : le membre n'est plus rattaché à ses lots
create or replace function public.decider_adhesion(p_demande uuid, p_decision text, p_motif text default null)
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
    delete from public.lot_proprietaires where membre_id = d.membre_id;
  else
    raise exception 'Décision inconnue';
  end if;
  update public.demandes_adhesion
    set statut = p_decision, motif = p_motif, decide_par = auth.uid(), decide_le = now()
    where id = p_demande;
  perform public.journal('decision_adhesion', 'adhesion', p_demande::text,
    jsonb_build_object('decision', p_decision, 'motif', p_motif, 'membre', d.membre_id));
end $$;

create or replace function public.annuaire()
returns table (id uuid, prenom text, nom text, appartements text, role text,
               telephone text, email text, est_ca boolean, fonction public.fonction_bureau, est_avocat boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.prenom, p.nom,
    (select string_agg(l.appartement, ', ' order by l.appartement)
       from public.lots l join public.lot_proprietaires lp on lp.lot_id = l.id where lp.membre_id = p.id),
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
    and (not public.est_avocat() or p.est_ca or p.id = auth.uid() or exists (
      select 1 from public.dossier_participants dp join public.dossiers d on d.id = dp.dossier_id
      where dp.membre_id = p.id and d.avocat_id = auth.uid()))
  order by p.nom, p.prenom
$$;

-- Lots du membre connecté avec la société et les noms de tous les propriétaires
create function public.mes_lots()
returns table (id uuid, numero text, appartement text, societe text, proprietaires text[])
language sql stable security definer set search_path = '' as $$
  select l.id, l.numero, l.appartement, l.societe,
    array(select coalesce(nullif(btrim(pr.prenom || ' ' || pr.nom), ''), lp2.nom)
          from public.lot_proprietaires lp2 left join public.profiles pr on pr.id = lp2.membre_id
          where lp2.lot_id = l.id order by lp2.created_at)
  from public.lots l
  where public.est_proprietaire_lot(l.id)
  order by l.numero
$$;
revoke execute on function public.mes_lots() from anon, public;
grant execute on function public.mes_lots() to authenticated;

alter table public.lots drop column membre_id;
