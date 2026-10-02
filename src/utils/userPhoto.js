// Photo de profil d'un utilisateur (par email) — utilisée par App et LoginPage

import { supabase } from "../supabaseClient";

/** Recupere la photo de profil d'un utilisateur par son email */
export const fetchUserPhoto = async (userId) => {
  const { data, error } = await supabase
    .from("members")
    .select("photo")
    .eq("email", userId)
    .single();
  return error ? null : data?.photo || null;
};
