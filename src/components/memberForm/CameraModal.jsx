// Fenêtre caméra plein écran (photo membre / document) — extraite de MemberFormPage

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  RotateCcw,
  Check,
  X,
  SwitchCamera,
} from "lucide-react";

/**
 * Full-screen camera modal for capturing photos or documents.
 * Handles camera stream lifecycle, front/back switching, preview, and confirmation.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Called when the modal should close.
 * @param {Function} props.onCapture - Called with the captured image data URL.
 * @param {boolean} props.isDarkMode - Current dark mode state.
 */
export function CameraModal({ isOpen, onClose, onCapture, isDarkMode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [facingMode, setFacingMode] = useState("user");
  // Incrémenté pour relancer la caméra (Reprendre / Réessayer)
  const [restartKey, setRestartKey] = useState(0);

  /** Stop all tracks on the current video stream. */
  // Flux gardé hors de la balise vidéo : à la fermeture, React détache la vidéo
  // avant le nettoyage, et la caméra restait allumée ("déjà utilisée" ensuite).
  const streamRef = useRef(null);
  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Initialize or tear down the camera when modal opens/closes or facing mode changes
  useEffect(() => {
    if (!isOpen) {
      cleanupStream();
      return;
    }

    let isMounted = true;

    const initializeCamera = async () => {
      cleanupStream();
      if (!isMounted) return;

      setIsLoading(true);
      setError(null);
      setCapturedPhoto(null);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
        }

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        let newStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr) {
          if (firstErr.name === "NotAllowedError" || firstErr.name === "NotFoundError") {
            throw firstErr;
          }
          // Réglages refusés par l'appareil ou caméra pas encore libérée
          // (bascule avant/arrière sur Android) : une seule relance, réglages minimaux.
          await new Promise((r) => setTimeout(r, 400));
          if (!isMounted) return;
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
        }
        // Fenêtre fermée ou caméra changée pendant l'attente : couper ce flux,
        // sinon il reste ouvert et bloque la caméra ("déjà utilisée") ensuite.
        if (!isMounted || !videoRef.current) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = newStream;
        videoRef.current.srcObject = newStream;
        // play() peut être interrompu (iOS) alors que autoPlay prend le relais : non bloquant
        await videoRef.current.play().catch(() => {});
        if (!isMounted) return;
        setStream(newStream); // active le déclencheur une fois l'image arrivée

        // Liste des caméras après autorisation (avant, certains navigateurs n'en donnent qu'une)
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (isMounted) {
          setAvailableCameras(devices.filter((d) => d.kind === "videoinput"));
        }
      } catch (err) {
        let errorMessage = "Impossible d'accéder à la caméra.";
        if (err.name === "NotReadableError") {
          errorMessage = "La caméra est déjà utilisée par une autre application.";
        } else if (err.name === "NotAllowedError") {
          errorMessage =
            "L'accès à la caméra a été refusé. Autorise-la dans les réglages du navigateur.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "Aucune caméra détectée. Utilise « Choisir un fichier ».";
        } else if (err.name === "NotSupportedError") {
          errorMessage =
            "Caméra non disponible sur cet appareil. Utilise « Choisir un fichier ».";
        }
        if (isMounted) setError(errorMessage);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeCamera();
    return () => {
      isMounted = false;
      cleanupStream();
    };
  }, [isOpen, facingMode, restartKey]);

  /** Toggle between front and back camera. */
  const switchCamera = () => {
    if (availableCameras.length > 1 && !isLoading) {
      setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    }
  };

  /** Capture a still frame from the video stream, respecting aspect ratio. */
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Image pas encore reçue : une capture donnerait une photo vide
    if (!video.videoWidth || !video.videoHeight) return;
    const context = canvas.getContext("2d");
    const maxSize = 256;

    let width = video.videoWidth;
    let height = video.videoHeight;

    // Scale down while keeping aspect ratio
    if (width > height) {
      if (width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // Mirror horizontally for front-facing camera
    if (facingMode === "user") {
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -width, 0, width, height);
      context.restore();
    } else {
      context.drawImage(video, 0, 0, width, height);
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.6);
    setCapturedPhoto(imageData);
    cleanupStream();
  };

  /** Confirm the captured photo and pass it to the parent. */
  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  /** Discard the captured photo and restart the camera stream. */
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setIsLoading(true);
    setRestartKey((k) => k + 1);
  };

  /** Retry after a camera error. */
  const retryCamera = () => {
    setError(null);
    setRestartKey((k) => k + 1);
  };

  if (!isOpen) return null;

  // Portail : la page est animée (transform), un "fixed" y serait calé sur la page et non sur l'écran
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-white"
        } rounded-xl overflow-hidden max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col`}
      >
        {/* Modal header */}
        <div
          className={`p-4 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          } flex items-center justify-between`}
        >
          <h3
            className={`text-lg font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Prendre une photo
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center max-w-md">
              <p className="font-medium mb-2">Erreur caméra</p>
              <p className="text-sm">{error}</p>
              <button
                type="button"
                onClick={retryCamera}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Réessayer
              </button>
            </div>
          )}

          {!error && (
            <div className="relative bg-black rounded-xl overflow-hidden max-w-md w-full aspect-[4/3]">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Démarrage de la caméra...</p>
                  </div>
                </div>
              )}

              {!capturedPhoto && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isLoading ? "opacity-0" : "opacity-100"
                  }`}
                  style={{
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                  }}
                />
              )}

              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Photo capturée"
                  className="w-full h-full object-cover"
                />
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Camera controls */}
          {!error && (
            <div className="mt-6 flex items-center gap-4 h-16">
              {!isLoading && !capturedPhoto ? (
                <>
                  {availableCameras.length > 1 && (
                    <button
                      onClick={switchCamera}
                      className={`p-3 rounded-full border-2 ${
                        isDarkMode
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      } transition-colors`}
                    >
                      <SwitchCamera className="w-6 h-6" />
                    </button>
                  )}
                  <button
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="w-16 h-16 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  >
                    <Camera className="w-8 h-8" />
                  </button>
                  <button
                    onClick={onClose}
                    className={`p-3 rounded-full border-2 ${
                      isDarkMode
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    } transition-colors`}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </>
              ) : (
                capturedPhoto && (
                  <>
                    <button
                      onClick={retakePhoto}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Reprendre
                    </button>
                    <button
                      onClick={confirmPhoto}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Check className="w-5 h-5" />
                      Confirmer
                    </button>
                  </>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
