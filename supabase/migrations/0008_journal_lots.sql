-- Journal des modifications de lots et de propriétaires (administration)
create function public.journaliser_lot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name = 'lots' then
    perform public.journal('lot', 'lot', r.id::text, jsonb_build_object('operation', lower(tg_op),
      'numero', r.numero, 'appartement', r.appartement, 'societe', r.societe));
  else
    perform public.journal('lot', 'lot', r.lot_id::text, jsonb_build_object(
      case when tg_op = 'DELETE' then 'retrait_proprietaire' else 'ajout_proprietaire' end, coalesce(r.membre_id::text, r.nom)));
  end if;
  return r;
end $$;
revoke execute on function public.journaliser_lot() from public, anon, authenticated;

create trigger lot_journal after insert or update or delete on public.lots
  for each row execute function public.journaliser_lot();
create trigger lot_proprietaire_journal after insert or delete on public.lot_proprietaires
  for each row execute function public.journaliser_lot();
