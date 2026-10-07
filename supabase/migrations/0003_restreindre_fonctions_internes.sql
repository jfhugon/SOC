-- Fonctions internes : le journal d'audit ne peut pas être alimenté directement par un client,
-- les fonctions de déclencheur ne sont pas exposées en RPC.
revoke execute on function public.journal(text, text, text, jsonb) from authenticated;
revoke execute on function public.creer_profil() from authenticated;
revoke execute on function public.initialiser_dossier() from authenticated;
revoke execute on function public.preparer_piece() from authenticated;
revoke execute on function public.apres_depot_piece() from authenticated;
