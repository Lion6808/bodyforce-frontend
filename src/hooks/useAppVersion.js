import { useEffect, useState } from "react";

export default function useAppVersion() {
  const [version, setVersion] = useState(localStorage.getItem("app_version") || null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.version) {
          localStorage.setItem("app_version", data.version);
          setVersion(data.version);
        }
      } catch {}
    };

    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return version || "0.0.0";
}
