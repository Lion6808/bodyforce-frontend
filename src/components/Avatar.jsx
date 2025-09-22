// components/Avatar.jsx
import React, { useMemo } from "react";
import { supabase } from "../supabaseClient";

// Petit helper local
function resolveAvatarSrc(value) {
  if (!value || typeof value !== "string") return null;

  // 1) data-URL -> direct
  if (value.startsWith("data:")) return value;

  // 2) URL absolue -> direct
  if (/^https?:\/\//i.test(value)) return value;

  // 3) Sinon on suppose un path Storage (ex: "avatars/xxx.jpg") dans le bucket "photo"
  const { data } = supabase.storage.from("photo").getPublicUrl(value);
  return data?.publicUrl || null;
}

function initialsOf(name = "", firstName = "") {
  const a = (firstName || "").trim();
  const b = (name || "").trim();
  const i1 = a ? a[0] : "";
  const i2 = b ? b[0] : "";
  return (i1 + i2 || "?").toUpperCase();
}

export default function Avatar({
  photo,          // peut être data-URL, http(s) ou path Storage
  photo_path,     // nouveau champ recommandé (path Storage)
  photo_url,      // si tu acceptes des URL externes
  name,
  firstName,
  size = 48,
  className = "",
  rounded = true,
}) {
  // priorité: path -> url -> legacy photo
  const raw = photo_path || photo_url || photo || null;

  const src = useMemo(() => resolveAvatarSrc(raw), [raw]);
  const fallback = initialsOf(name, firstName);

  const dim = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName || ""} ${name || ""}`.trim() || "Avatar"}
        style={dim}
        className={`${rounded ? "rounded-full" : "rounded-lg"} object-cover border border-gray-200 dark:border-gray-700 ${className}`}
        onError={(e) => {
          // si l’URL publique tombe en 404, repli propre sur initiales
          e.currentTarget.style.display = "none";
          const sib = e.currentTarget.nextElementSibling;
          if (sib) sib.style.display = "flex";
        }}
      />
    );
  }

  // fallback initials
  return (
    <div
      style={dim}
      className={`${rounded ? "rounded-full" : "rounded-lg"} flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold select-none border border-gray-300 dark:border-gray-600 ${className}`}
    >
      {fallback}
    </div>
  );
}
