import React, { useMemo, useState } from "react";
import { getPhotoUrl } from "../supabaseClient";

/**
 * Avatar robuste :
 * - accepte: data:..., blob:..., http(s)://..., ou chemin Supabase (ex: avatars/uid.jpg)
 * - fallback initiales si l'image échoue
 */
export default function Avatar({ photo, firstName, name, size = 48, className = "" }) {
  const url = useMemo(() => {
    if (!photo) return "";
    const p = String(photo);
    if (p.startsWith("data:") || p.startsWith("blob:") || /^https?:\/\//i.test(p)) {
      return p; // déjà une URL exploitable
    }
    return getPhotoUrl(p); // chemin de bucket -> URL publique
  }, [photo]);

  const [imgOk, setImgOk] = useState(Boolean(url));

  if (!url || !imgOk) {
    return (
      <div
        className={
          "rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-xl drop-shadow-lg " +
          className
        }
        style={{ width: size, height: size, fontSize: Math.max(12, size / 3.2) }}
      >
        {(firstName?.[0] || "N") + (name?.[0] || "N")}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="avatar"
      loading="lazy"
      width={size}
      height={size}
      className={"rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-xl drop-shadow-lg " + className}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setImgOk(false)}
    />
  );
}
