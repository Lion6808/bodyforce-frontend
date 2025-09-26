// 📄 components/Avatar.jsx — COMPLET — Date : 2025-09-26
// ✅ Correctif majeur : fallback initiales fiable si l'image échoue (plus besoin de F5)
// ✅ API identique : { photo, photo_path, photo_url, name, firstName, size, className, rounded }

import React, { useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Helpers
function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
function isDataUrl(value) {
  return typeof value === "string" && /^data:/i.test(value);
}
function pickBucketFromPath(path) {
  if (!path || typeof path !== "string") return "photo";
  // Si tu stockes des certifs dans un autre bucket :
  if (path.startsWith("certificats/")) return "documents";
  return "photo";
}

function resolveAvatarSrc(value) {
  if (!value || typeof value !== "string") return null;

  // 1) data-URL -> direct
  if (isDataUrl(value)) return value;

  // 2) URL absolue -> direct
  if (isHttpUrl(value)) return value;

  // 3) Path Storage -> publicUrl
  const bucket = pickBucketFromPath(value);
  const { data } = supabase.storage.from(bucket).getPublicUrl(value);
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
  photo_path,     // path Storage recommandé
  photo_url,      // URL externe, si utilisée
  name,
  firstName,
  size = 48,
  className = "",
  rounded = true,
  title,
}) {
  // priorité: path -> url -> legacy photo
  const raw = photo_path || photo_url || photo || null;
  const src = useMemo(() => resolveAvatarSrc(raw), [raw]);
  const fallback = initialsOf(name, firstName);
  const [imgError, setImgError] = useState(false);

  const dim = { width: size, height: size };
  const shape = rounded ? "rounded-full" : "rounded-lg";
  const alt = `${firstName || ""} ${name || ""}`.trim() || "Avatar";

  // Si pas de source ou déjà en erreur -> Initiales
  if (!src || imgError) {
    return (
      <div
        title={title || alt}
        style={dim}
        className={`${shape} flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold select-none border border-gray-300 dark:border-gray-600 ${className}`}
      >
        {fallback}
      </div>
    );
  }

  // Image (avec fallback fiable via état)
  return (
    <img
      src={src}
      alt={alt}
      title={title || alt}
      style={dim}
      loading="eager"                 // évite certains décalages/lazy placeholders
      crossOrigin="anonymous"         // limite des warnings CORS/SW
      className={`${shape} object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 ${className}`}
      onError={() => setImgError(true)} // -> bascule définitive vers initiales
    />
  );
}
