// 📄 Avatar.jsx — COMPLET — Dossier : src/components — Date : 2025-09-26
// 🔧 Changements ciblés (BODYFORCE OK) :
// 1) Attente de l’auth (useAuth.loading) avant de résoudre l’URL de la photo (corrige le “premier chargement”).
// 2) Résolution intelligente de l’URL :
//    - Si `photo` est déjà une URL http(s) → utilisation directe
//    - Sinon déduction du bucket : `photo` (par défaut) ou `documents` si chemin commence par `certificats/`
//    - Tentative PUBLIC (getPublicUrl) → sinon fallback PRIVÉ (createSignedUrl)
// 3) Fallback graphique : initiales si URL non prête / en erreur, avec onError → revient aux initiales.
// 4) API identique à MembersPage/PlanningPage : { photo, firstName, name, size } (size numérique en px)

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

function isHttpUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

// Déduit le bucket en fonction du chemin.
// - Par défaut : 'photo' (bucket photos membres)
// - Si le chemin commence par 'certificats/' → bucket 'documents' (convention BODYFORCE)
function pickBucketFromPath(path) {
  if (!path || typeof path !== "string") return "photo";
  if (path.startsWith("certificats/")) return "documents";
  return "photo";
}

export default function Avatar({
  photo,          // string | undefined — URL http(s) ou chemin Storage (ex : 'photos/john_doe.jpg')
  firstName = "", // string
  name = "",      // string
  size = 40,      // number (px) — ex: 40 ~ w-10 h-10
  className = "", // string — classes utilitaires additionnelles (optionnel)
  title,          // string — attribut title (optionnel)
}) {
  const { loading: authLoading } = useAuth();
  const [url, setUrl] = useState(null);
  const [resolvedOnce, setResolvedOnce] = useState(false); // pour éviter des clignotements au 1er render

  // Initiales pour le fallback
  const initials = useMemo(() => {
    const a = (name || "").trim().charAt(0) || "";
    const b = (firstName || "").trim().charAt(0) || "";
    const ab = (a + b).toUpperCase();
    return ab || "?";
  }, [name, firstName]);

  // Résolution de l'URL — robuste au cold start
  useEffect(() => {
    let cancelled = false;

    async function resolvePhotoUrl() {
      // Si pas de photo → pas d’URL (fallback initiales)
      if (!photo) {
        if (!cancelled) {
          setUrl(null);
          setResolvedOnce(true);
        }
        return;
      }

      // Si la valeur est déjà une URL http(s) → on l’utilise telle quelle
      if (isHttpUrl(photo)) {
        if (!cancelled) {
          setUrl(photo);
          setResolvedOnce(true);
        }
        return;
      }

      // ⚠️ Cold start : attendre que l’auth finisse d’initialiser
      if (authLoading) return;

      // Bucket en fonction du chemin (convention BODYFORCE)
      const bucket = pickBucketFromPath(photo);

      // 1) Bucket PUBLIC : getPublicUrl (simple, immédiat)
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(photo);
      if (pub?.publicUrl) {
        if (!cancelled) {
          setUrl(pub.publicUrl);
          setResolvedOnce(true);
        }
        return;
      }

      // 2) Fallback PRIVÉ : createSignedUrl (si bucket privé)
      try {
        const { data: signed, error } = await supabase
          .storage
          .from(bucket)
          .createSignedUrl(photo, 60 * 60 * 24); // URL signée 24h
        if (!cancelled) {
          if (error || !signed?.signedUrl) {
            // Rien de valable → fallback initiales
            setUrl(null);
          } else {
            setUrl(signed.signedUrl);
          }
          setResolvedOnce(true);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
          setResolvedOnce(true);
        }
      }
    }

    resolvePhotoUrl();
    return () => {
      cancelled = true;
    };
    // Dépendances :
    // - photo : si le chemin change, on recalcule
    // - authLoading : on attend la fin du chargement auth au premier affichage
  }, [photo, authLoading]);

  const dimension = Number.isFinite(size) ? Number(size) : 40;
  const styleBox = { width: dimension, height: dimension };
  const fontSize = Math.max(12, Math.floor(dimension / 2.8));

  // Fallback initiales si :
  // - pas d’URL (encore) OU erreur image (onError) OU pas de `photo`
  const renderInitials = () => (
    <div
      title={title || `${name} ${firstName}`.trim()}
      style={styleBox}
      className={
        `rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ` +
        `text-white flex items-center justify-center font-semibold ` +
        `border border-blue-200 dark:border-blue-600 shadow-sm ` +
        `${className || ""}`
      }
    >
      <span style={{ fontSize }}>{initials}</span>
    </div>
  );

  // Pendant le tout premier resolve (authLoading true) on affiche directement les initiales
  if (!resolvedOnce && (authLoading || !photo)) {
    return renderInitials();
  }

  // Si pas d’URL résolue → fallback initiales
  if (!url) {
    return renderInitials();
  }

  // Image résolue
  return (
    <img
      title={title || `${name} ${firstName}`.trim()}
      src={url}
      alt={`${name} ${firstName}`.trim() || "Avatar"}
      style={styleBox}
      className={
        `rounded-full object-cover border border-blue-200 dark:border-blue-600 ` +
        `bg-gray-100 dark:bg-gray-700 ${className || ""}`
      }
      // Si l'image échoue à se charger (404/403), on retombe sur les initiales
      onError={() => setUrl(null)}
      // Astuce : au premier succès, on “locke” resolvedOnce
      onLoad={() => setResolvedOnce(true)}
      // Optionnel : cache-busting si vous rencontrez des soucis de SW (désactivé par défaut)
      // src={url + `#v=${resolvedOnce ? '1' : '0'}`}
    />
  );
}
