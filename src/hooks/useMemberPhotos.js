// ===================================================================
// useMemberPhotos — photos des membres affichés, chargées à la demande
// -------------------------------------------------------------------
// Les photos sont des dataURL (≈ 50 Ko en moyenne) : on ne les met
// jamais dans les listes, on les charge à part pour les seuls membres
// visibles, une seule fois par session (cache commun au module).
// Même principe que MembersPage / HomePage.
// ===================================================================

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const cache = {}; // id -> dataURL | null
const inflight = new Map(); // id -> Promise (évite les doubles requêtes)

export default function useMemberPhotos(ids) {
  const key = [...new Set((ids || []).filter(Boolean))].sort((a, b) => a - b).join(",");
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!key) return undefined;
    const wanted = key.split(",").map(Number).filter((id) => !(id in cache));
    if (wanted.length === 0) return undefined;
    let cancelled = false;

    const missing = wanted.filter((id) => !inflight.has(id));
    if (missing.length) {
      const req = supabase
        .from("members")
        .select("id,photo")
        .in("id", missing)
        .then(({ data, error }) => {
          if (!error) {
            missing.forEach((id) => {
              cache[id] = null;
            });
            (data || []).forEach((m) => {
              cache[m.id] = m.photo || null;
            });
          }
          missing.forEach((id) => inflight.delete(id));
        });
      missing.forEach((id) => inflight.set(id, req));
    }

    Promise.all(wanted.map((id) => inflight.get(id)).filter(Boolean)).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return cache;
}
