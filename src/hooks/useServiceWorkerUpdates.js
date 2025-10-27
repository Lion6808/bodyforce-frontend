import { useEffect, useState } from "react";

export default function useServiceWorkerUpdates({ checkOnLoad = true } = {}) {
  const [waitingReg, setWaitingReg] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      if (reg.waiting) setWaitingReg(reg);

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingReg(reg);
          }
        });
      });

      if (checkOnLoad) {
        try { await reg.update(); } catch {}
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkOnLoad]);

  const activateUpdate = () =>
    waitingReg?.waiting?.postMessage({ type: "SKIP_WAITING" });

  return { hasUpdate: !!waitingReg?.waiting, activateUpdate };
}
