// 📄 components/Avatar.jsx — CORRIGÉ — Date : 2025-10-02
// ✅ Ne fait plus d'appel à Supabase Storage pour les photos de membres
// ✅ Supporte dataURL (base64), http(s) et chemins éventuels de documents
// ✅ Fallback initiales fiable si l'image échoue
// ✅ API identique : { photo, photo_path, photo_url, name, firstName, size, className, rounded }

import React, { useMemo, useState } from "react";

// Helpers
function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
function isDataUrl(value) {
  return typeof value === "string" && /^data:/i.test(value);
}

function resolveAvatarSrc(value) {
  if (!value || typeof value !== "string") return null;

  // 1) data-URL -> direct
  if (isDataUrl(value)) return value;

  // 2) URL absolue -> direct
  if (isHttpUrl(value)) return value;

  // 3) Legacy path (documents/certificats) : on n'essaie plus pour 'photo'
  if (value.startsWith("certificats/") || value.startsWith("documents/")) {
    // Dans ce cas tu peux brancher un helper si besoin, sinon null
    return null;
  }

  return null;
}

function initialsOf(name = "", firstName = "") {
  const a = (firstName || "").trim();
  const b = (name || "").trim();
  const i1 = a ? a[0] : "";
  const i2 = b ? b[0] : "";
  return (i1 + i2 || "?").toUpperCase();
}

export default function Avatar({
  photo, // peut être data-URL ou http(s)
  photo_path, // (legacy, inutile pour les membres désormais)
  photo_url, // URL externe, si utilisée
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
      loading="eager"
      crossOrigin="anonymous"
      className={`${shape} object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 ${className}`}
      onError={() => setImgError(true)}
    />
  );
}
