-- Un membre doit pouvoir rejoindre un dossier qu'il ne voit pas encore (il n'en est pas participant) :
-- la vérification « dossier ouvert » passe par une fonction qui ne dépend pas de la RLS des dossiers.
create function public.dossier_ouvert_aux_adhesions(d uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dossiers where id = d and statut not in ('actes', 'clos'))
$$;
revoke execute on function public.dossier_ouvert_aux_adhesions(uuid) from anon, public;
grant execute on function public.dossier_ouvert_aux_adhesions(uuid) to authenticated;

drop policy "adhesion" on public.dossier_participants;
create policy "adhesion" on public.dossier_participants for insert to authenticated
  with check (
    (membre_id = auth.uid() and public.est_actif()
      and exists (select 1 from public.profiles where id = auth.uid() and acces_dossiers)
      and exists (select 1 from public.lots where id = lot_id and lots.membre_id = auth.uid())
      and public.dossier_ouvert_aux_adhesions(dossier_id)
      and mandat_signe_le is null)
    or public.est_ca());
