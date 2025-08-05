// 📄 CameraModal.js — Composant pour la prise de photo

import React, { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, X, SwitchCamera } from "lucide-react";

export function CameraModal({ isOpen, onClose, onCapture, isDarkMode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [facingMode, setFacingMode] = useState("user");

  const cleanupStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const currentStream = videoRef.current.srcObject;
      currentStream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStream(null);
    }
  };

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
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        if (isMounted) setAvailableCameras(videoDevices);

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play();
          setStream(newStream);
        }
      } catch (err) {
        let errorMessage = "Impossible d'accéder à la caméra.";
        if (err.name === "NotReadableError") errorMessage = "La caméra est déjà utilisée.";
        else if (err.name === "NotAllowedError") errorMessage = "L'accès à la caméra a été refusé.";
        else if (err.name === "NotFoundError") errorMessage = `Aucune caméra en mode '${facingMode}' n'a été trouvée.`;
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
  }, [isOpen, facingMode]);

  const switchCamera = () => {
    if (availableCameras.length > 1 && !isLoading) {
      setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (facingMode === "user") {
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(imageData);
    cleanupStream();
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setIsLoading(true);
    const currentMode = facingMode;
    setFacingMode("");
    setTimeout(() => setFacingMode(currentMode), 0);
  };
  
  const getCurrentCameraLabel = () => {
    if (isLoading) return "Détection...";
    return facingMode === "user" ? "Caméra avant" : "Caméra arrière";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl overflow-hidden max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col`}>
        <div className={`p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"} flex items-center justify-between`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>📸 Prendre une photo</h3>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>{getCurrentCameraLabel()}</span>
            <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center max-w-md">
              <p className="font-medium mb-2">❌ Erreur caméra</p>
              <p className="text-sm">{error}</p>
              <button onClick={() => setFacingMode(fm => fm === 'user' ? 'environment' : 'user')} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                Essayer une autre caméra
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
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`} style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}/>
              )}
              {capturedPhoto && (<img src={capturedPhoto} alt="Photo capturée" className="w-full h-full object-cover"/>)}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
          {!error && (
            <div className="mt-6 flex items-center justify-center gap-4 h-16">
              {!isLoading && !capturedPhoto ? (
                <>
                  {availableCameras.length > 1 && (
                    <button onClick={switchCamera} className={`p-3 rounded-full border-2 ${isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-100"} transition-colors`} title="Basculer de caméra">
                      <SwitchCamera className="w-6 h-6" />
                    </button>
                  )}
                  <button onClick={capturePhoto} disabled={!stream} className="w-16 h-16 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full flex items-center justify-center transition-colors shadow-lg">
                    <Camera className="w-8 h-8" />
                  </button>
                  <button onClick={onClose} className={`p-3 rounded-full border-2 ${isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-100"} transition-colors`}>
                    <X className="w-6 h-6" />
                  </button>
                </>
              ) : null}
              {capturedPhoto && (
                <>
                  <button onClick={retakePhoto} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                    <RotateCcw className="w-5 h-5" /> Reprendre
                  </button>
                  <button onClick={confirmPhoto} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                    <Check className="w-5 h-5" /> Confirmer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
