-- Connexion par identifiant et mot de passe : les comptes sont créés par l'administrateur global
-- (fonction Edge « comptes »), il n'y a plus d'inscription publique ni de justificatif de propriété.
-- Le compte Supabase d'un membre porte une adresse technique <identifiant>@membres.centaure.invalid,
-- jamais utilisée pour envoyer d'e-mail ; l'adresse réelle du membre, facultative, reste dans profiles.email.

alter table public.profiles
  add column identifiant text unique check (identifiant ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  add column mdp_provisoire boolean not null default false,
  alter column email drop not null;

-- Profil créé à partir des métadonnées posées par la fonction Edge
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, identifiant, prenom, nom, telephone)
  values (new.id,
          case when new.email like '%@membres.centaure.invalid'
            then nullif(new.raw_user_meta_data ->> 'email_contact', '') else new.email end,
          nullif(new.raw_user_meta_data ->> 'identifiant', ''),
          coalesce(new.raw_user_meta_data ->> 'prenom', ''),
          coalesce(new.raw_user_meta_data ->> 'nom', ''),
          nullif(new.raw_user_meta_data ->> 'telephone', ''));
  return new;
end $$;
revoke execute on function public.creer_profil() from authenticated;

-- Le membre a remplacé son mot de passe provisoire
create function public.confirmer_mot_de_passe() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set mdp_provisoire = false where id = auth.uid()
$$;
revoke execute on function public.confirmer_mot_de_passe() from anon, public;
grant execute on function public.confirmer_mot_de_passe() to authenticated;

-- L'administrateur global voit les lots des comptes qu'il gère
drop policy "lecture" on public.lots;
create policy "lecture" on public.lots for select to authenticated
  using (membre_id = auth.uid() or public.est_ca() or public.est_admin_tech() or exists (
    select 1 from public.dossier_participants dp where dp.lot_id = lots.id and public.est_avocat_dossier(dp.dossier_id)));

-- Le membre ne modifie plus ses lots lui-même : c'est l'administrateur ou le CA
drop policy "ajout" on public.lots;
create policy "ajout" on public.lots for insert to authenticated with check (public.est_ca());
drop policy "modification" on public.lots;
create policy "modification" on public.lots for update to authenticated
  using (public.est_ca()) with check (public.est_ca());
drop policy "suppression" on public.lots;
create policy "suppression" on public.lots for delete to authenticated using (public.est_ca());

-- Plus de demande d'adhésion ni de code d'activation côté client
drop policy "depot" on public.demandes_adhesion;
drop policy "complement" on public.demandes_adhesion;
revoke execute on function public.utiliser_code(text) from authenticated;
revoke execute on function public.creer_code_activation(text) from authenticated;
