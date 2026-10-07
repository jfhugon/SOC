-- Base juridique : documents des procédures en cours avec l'avocat.
-- Les membres actifs et le CA consultent en ligne, sans jamais recevoir le fichier ni de lien :
-- seule la fonction Edge « juridique » lit les aperçus (une image par page) avec la clé de service.
-- Le Président (ou le Vice-Président suppléant) est le seul à déposer, télécharger et retirer un document.

create table public.documents_juridiques (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (length(trim(titre)) > 0),
  procedure text,
  categorie text not null default 'autre'
    check (categorie in ('acte', 'conclusions', 'decision', 'correspondance', 'note', 'autre')),
  date_document date,
  description text,
  chemin text not null unique,
  nom_fichier text not null,
  mime text,
  taille bigint,
  sha256 text not null,
  nb_pages int not null check (nb_pages between 1 and 300),
  depose_par uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.documents_juridiques (procedure, date_document desc);

alter table public.documents_juridiques enable row level security;

create policy "consultation" on public.documents_juridiques for select to authenticated
  using (public.est_actif() or public.est_ca());
create policy "depot" on public.documents_juridiques for insert to authenticated
  with check (public.est_president() and depose_par = auth.uid());
create policy "modification" on public.documents_juridiques for update to authenticated
  using (public.est_president()) with check (public.est_president());
create policy "retrait" on public.documents_juridiques for delete to authenticated
  using (public.est_president());

-- Le fichier lui-même ne change pas après le dépôt (seules les informations descriptives)
create function public.figer_document_juridique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.chemin := old.chemin; new.nom_fichier := old.nom_fichier; new.mime := old.mime;
  new.taille := old.taille; new.sha256 := old.sha256; new.nb_pages := old.nb_pages;
  new.depose_par := old.depose_par; new.created_at := old.created_at;
  return new;
end $$;
create trigger document_juridique_avant_maj before update on public.documents_juridiques
  for each row execute function public.figer_document_juridique();

create function public.journaliser_document_juridique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.journal('depot_document_juridique', 'document_juridique', new.id::text,
      jsonb_build_object('titre', new.titre, 'procedure', new.procedure, 'sha256', new.sha256));
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.journal('modification_document_juridique', 'document_juridique', new.id::text,
      jsonb_build_object('titre', new.titre, 'procedure', new.procedure));
    return new;
  else
    perform public.journal('retrait_document_juridique', 'document_juridique', old.id::text,
      jsonb_build_object('titre', old.titre, 'procedure', old.procedure, 'sha256', old.sha256));
    return old;
  end if;
end $$;
create trigger document_juridique_journal after insert or update or delete on public.documents_juridiques
  for each row execute function public.journaliser_document_juridique();

revoke execute on function public.figer_document_juridique() from public, anon, authenticated;
revoke execute on function public.journaliser_document_juridique() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : originaux et aperçus, accessibles au seul Président
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('juridique', 'juridique', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png']),
  ('juridique-apercus', 'juridique-apercus', false, 10485760, array['image/jpeg']);

create policy "juridique president lecture" on storage.objects for select to authenticated
  using (bucket_id in ('juridique', 'juridique-apercus') and public.est_president());
create policy "juridique president depot" on storage.objects for insert to authenticated
  with check (bucket_id in ('juridique', 'juridique-apercus') and public.est_president());
create policy "juridique president retrait" on storage.objects for delete to authenticated
  using (bucket_id in ('juridique', 'juridique-apercus') and public.est_president());
