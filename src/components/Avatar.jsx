// components/Avatar.jsx
import React, { useMemo, useState } from "react";
import { getPhotoUrl } from "../supabaseClient";

export default function Avatar({ photo, firstName, name, size = 48 }) {
  const url = useMemo(() => {
    if (!photo) return "";
    const p = String(photo);
    return (p.startsWith("data:") || p.startsWith("blob:") || /^https?:\/\//i.test(p))
      ? p
      : getPhotoUrl(p);
  }, [photo]);

  const [imgOk, setImgOk] = useState(Boolean(url));

  // Conteneur circulaire + crop
  return (
    <div
      className="rounded-full overflow-hidden shadow"
      style={{ width: size, height: size, aspectRatio: "1 / 1" }}  // carré garanti
    >
      {url && imgOk ? (
        <img
          src={url}
          alt="avatar"
          className="w-full h-full object-cover block"  // remplit le cercle
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
          {(firstName?.[0] || "N") + (name?.[0] || "N")}
        </div>
      )}
    </div>
  );
}
