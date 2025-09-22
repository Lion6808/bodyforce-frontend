// 📄 src/components/Avatar.jsx — Optimisé
// ✅ Ajout de loading="lazy" pour limiter l'egress
// ✅ Centralise l'utilisation de getPhotoUrl (déjà mémoïsé dans supabaseClient)

import React, { useState } from "react";
import { getPhotoUrl } from "../supabaseClient";

function Avatar({ member, size = "w-12 h-12", className = "" }) {
  const [imgOk, setImgOk] = useState(true);

  // URL photo via helper supabase (cache + URL publique)
  const url = member?.photo ? getPhotoUrl(member.photo) : null;

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${size} ${className}`}
    >
      {url && imgOk ? (
        <img
          src={url}
          alt={`${member?.firstName || ""} ${member?.name || ""}`}
          loading="lazy"
          className="w-full h-full object-cover block"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="text-gray-600 dark:text-gray-300 text-sm font-semibold">
          {member?.firstName?.[0] || "?"}
          {member?.name?.[0] || ""}
        </span>
      )}
    </div>
  );
}

export default Avatar;
