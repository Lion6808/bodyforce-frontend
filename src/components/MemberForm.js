import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
import { FaCamera, FaFileUpload, FaTrash, FaDownload } from "react-icons/fa";
import { supabase } from "../supabaseClient";

const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 12,
};

function sanitizeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

function InputField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input {...props} className="w-full border p-2 rounded" />
    </div>
  );
}

function SelectField({ label, options, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <select {...props} className="w-full border p-2 rounded">
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function MemberForm({ member, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    firstName: "",
    birthdate: "",
    gender: "Homme",
    address: "",
    phone: "",
    mobile: "",
    email: "",
    subscriptionType: "Mensuel",
    startDate: "",
    endDate: "",
    badgeId: "",
    files: [],
    photo: null,
    etudiant: false,
  });

  const [webcamOpen, setWebcamOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ loading: false, error: null, success: null });
  const [webcamReady, setWebcamReady] = useState(false); // Suivi de l'état de la webcam
  const webcamRef = useRef(null);

  useEffect(() => {
    if (member) {
      setForm({
        ...member,
        files: Array.isArray(member.files)
          ? member.files
          : typeof member.files === "string"
          ? JSON.parse(member.files || "[]")
          : [],
        etudiant: !!member.etudiant,
      });
    }
  }, [member]);

  useEffect(() => {
    if (!form.startDate) return;
    if (form.subscriptionType === "Année civile") {
      const year = new Date(form.startDate).getFullYear();
      setForm((f) => ({
        ...f,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      }));
    } else {
      const start = new Date(form.startDate);
      const months = subscriptionDurations[form.subscriptionType] || 1;
      const end = new Date(start);
      end.setMonth(start.getMonth() + months);
      end.setDate(end.getDate() - 1);
      setForm((f) => ({ ...f, endDate: end.toISOString().slice(0, 10) }));
    }
  }, [form.subscriptionType, form.startDate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const age = form.birthdate
    ? Math.floor((new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("handleSubmit appelé avec :", { ...form, files: JSON.stringify(form.files) });
    onSave({ ...form, files: JSON.stringify(form.files) }, true); // Fermer le modal
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    setUploadStatus({ loading: true, error: null, success: null });

    try {
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const filePath = `certificats/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from("documents").upload(filePath, file);
        if (error) {
          throw new Error(`Erreur lors du téléversement : ${error.message}`);
        }
        const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
        setForm((f) => ({
          ...f,
          files: [...f.files, { name: safeName, url: data.publicUrl }],
        }));
      }
      setUploadStatus({ loading: false, error: null, success: "Fichiers ajoutés" });
    } catch (err) {
      console.error("Erreur lors du téléversement :", err);
      setUploadStatus({ loading: false, error: err.message, success: null });
    }
  };

  const capturePhoto = async () => {
  try {
    console.log("capturePhoto appelé, webcamRef:", webcamRef.current, "webcamReady:", webcamReady);
    if (!webcamRef.current || !webcamReady) {
      console.error("Webcam non disponible ou non prête");
      setUploadStatus({ loading: false, error: "Webcam non disponible ou non prête", success: null });
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      throw new Error("Aucune image capturée. Vérifiez que la webcam fonctionne.");
    }

    setUploadStatus({ loading: true, error: null, success: null });
    const blob = await (await fetch(imageSrc)).blob();
    const fileName = sanitizeFileName(`photo_${Date.now()}.jpg`);

    const { error } = await supabase.storage.from("photo").upload(fileName, blob, { upsert: true });
    if (error) {
      throw new Error(`Erreur lors de l'envoi : ${error.message}`);
    }

    const { data } = supabase.storage.from("photo").getPublicUrl(fileName);
    console.log("✅ URL publique de la photo :", data.publicUrl);
    setForm((f) => ({ ...f, photo: data.publicUrl }));
    setUploadStatus({ loading: false, error: null, success: "Photo enregistrée" });
    setWebcamOpen(false);
  } catch (err) {
    console.error("Erreur capture photo :", err);
    setUploadStatus({ loading: false, error: err.message, success: null });
  }
};



  const captureDocument = async () => {
    console.log("captureDocument appelé, webcamRef:", webcamRef.current, "webcamReady:", webcamReady);
    if (!webcamRef.current || !webcamReady) {
      console.error("Webcam non disponible ou non prête");
      setUploadStatus({ loading: false, error: "Webcam non disponible ou non prête", success: null });
      return;
    }
    const imageSrc = webcamRef.current.getScreenshot();
    console.log("imageSrc:", imageSrc);
    if (!imageSrc) {
      console.error("Impossible de capturer le document");
      setUploadStatus({ loading: false, error: "Impossible de capturer le document", success: null });
      return;
    }

    setUploadStatus({ loading: true, error: null, success: null });
    try {
      const blob = await (await fetch(imageSrc)).blob();
      console.log("Blob créé:", blob);
      const fileName = sanitizeFileName(`doc_${Date.now()}.jpg`);
      const filePath = `certificats/${fileName}`;
      const { error } = await supabase.storage.from("documents").upload(filePath, blob);
      if (error) {
        throw new Error(`Erreur lors du téléversement du document : ${error.message}`);
      }
      const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
      console.log("URL publique du document:", data.publicUrl);
      setForm((f) => ({
        ...f,
        files: [...f.files, { name: fileName, url: data.publicUrl }],
      }));
      setUploadStatus({ loading: false, error: null, success: "Fichier ajouté" });
      setWebcamOpen(false);
      await onSave({ ...form, files: JSON.stringify([...form.files, { name: fileName, url: data.publicUrl }]) }, false); // Mettre à jour sans fermer le modal
    } catch (err) {
      console.error("Erreur lors de la capture du document :", err, err.stack);
      setUploadStatus({ loading: false, error: `Erreur lors de la capture du document : ${err.message}`, success: null });
    }
  };

  const removeFile = async (fileToRemove, event) => {
    event?.stopPropagation();
    event?.preventDefault();
    try {
      console.log("Début de la suppression du fichier :", fileToRemove);

      const url = fileToRemove.url;
      console.log("URL du fichier :", url);
      const fullPrefix = "/storage/v1/object/public/";
      const bucketIndex = url.indexOf(fullPrefix);
      if (bucketIndex === -1) {
        throw new Error("URL invalide");
      }

      const afterPrefix = url.substring(bucketIndex + fullPrefix.length);
      console.log("Partie après préfixe :", afterPrefix);
      const [bucket, ...pathParts] = afterPrefix.split("/");
      const path = pathParts.join("/");
      console.log("Bucket :", bucket, "Chemin :", path);

      const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
      if (storageError) {
        throw new Error(`Erreur lors de la suppression du fichier dans le stockage : ${storageError.message}`);
      }
      console.log("✅ Fichier supprimé de Supabase Storage");

      const newFiles = form.files.filter((f) => f.url !== fileToRemove.url);
      console.log("Nouveau tableau files :", newFiles);
      setForm((f) => ({ ...f, files: newFiles }));

      try {
        console.log("Appel de onSave avec :", { ...form, files: JSON.stringify(newFiles) });
        await onSave({ ...form, files: JSON.stringify(newFiles) }, false); // Ne pas fermer le modal
        console.log("✅ Mise à jour effectuée via onSave");
        setUploadStatus({
          loading: false,
          error: null,
          success: "Fichier supprimé et profil mis à jour",
        });
      } catch (saveError) {
        console.error("Erreur lors de l'appel à onSave :", saveError);
        setUploadStatus({
          loading: false,
          error: "Le fichier a été supprimé du stockage, mais pas du profil.",
          success: null,
        });
      }
    } catch (err) {
      console.error("❌ Erreur complète lors de la suppression :", err, err.stack);
      setUploadStatus({
        loading: false,
        error: `Erreur lors de la suppression du fichier : ${err.message}`,
        success: null,
      });
    }
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onCancel}
      shouldCloseOnOverlayClick={false}
      shouldCloseOnEsc={false}
      contentLabel="Fiche Membre"
      className="bg-white rounded-xl shadow-lg w-full max-w-5xl mx-auto mt-10 outline-none relative flex flex-col"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
    >
      <div className="absolute top-4 right-6 flex gap-4 z-10">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400 transition"
        >
          ❌ Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 transition inline-flex items-center gap-2"
        >
          ✅ Enregistrer
        </button>
      </div>

      <div className="p-6 pt-20 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Identité</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 grid grid-cols-1 gap-4">
                <InputField label="Nom" name="name" value={form.name} onChange={handleChange} />
                <InputField label="Prénom" name="firstName" value={form.firstName} onChange={handleChange} />
                <InputField type="date" label="Date de naissance" name="birthdate" value={form.birthdate} onChange={handleChange} />
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Sexe</label>
                  <select name="gender" value={form.gender} onChange={handleChange} className="w-full border p-2 rounded">
                    <option>Homme</option>
                    <option>Femme</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label htmlFor="etudiant" className="text-sm font-medium text-gray-700">🎓 Étudiant :</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, etudiant: !f.etudiant }))}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${form.etudiant ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${form.etudiant ? "translate-x-6" : ""}`} />
                  </button>
                </div>
                {age !== null && <div className="text-sm mt-1 text-gray-700">Âge : {age} ans</div>}
              </div>
              <div className="flex flex-col items-center justify-start">
                {form.photo ? (
                  <img src={form.photo} alt="Photo" className="w-32 h-32 object-cover rounded border mb-2" />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center border rounded text-gray-400 mb-2">Pas de photo</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setWebcamReady(false); // Réinitialiser l'état de la webcam
                    setWebcamOpen("photo");
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  <FaCamera /> Photo
                </button>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Coordonnées</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Adresse" name="address" value={form.address} onChange={handleChange} />
              <InputField label="Email" name="email" value={form.email} onChange={handleChange} />
              <InputField label="Téléphone" name="phone" value={form.phone} onChange={handleChange} />
              <InputField label="Portable" name="mobile" value={form.mobile} onChange={handleChange} />
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Abonnement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField label="Type d'abonnement" name="subscriptionType" value={form.subscriptionType} onChange={handleChange} options={Object.keys(subscriptionDurations)} />
              <InputField type="date" label="Date de début" name="startDate" value={form.startDate} onChange={handleChange} />
              <InputField type="date" label="Date de fin" name="endDate" value={form.endDate} readOnly />
              {isExpired && <p className="text-red-600 text-sm">⛔ Abonnement expiré</p>}
              <InputField label="ID Badge" name="badgeId" value={form.badgeId} onChange={handleChange} />
            </div>
          </div>

          <div className="bg-pink-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Documents / Certificats</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <label htmlFor="fileUpload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
                <FaFileUpload /> Importer un fichier
              </label>
              <input type="file" id="fileUpload" className="hidden" multiple onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => {
                  setWebcamReady(false); // Réinitialiser l'état de la webcam
                  setWebcamOpen("doc");
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded inline-flex items-center gap-2"
              >
                <FaCamera /> Prendre une photo (doc)
              </button>
            </div>

            {uploadStatus.loading && <p className="text-blue-600 mt-2">Téléversement en cours...</p>}
            {uploadStatus.error && <p className="text-red-600 mt-2">{uploadStatus.error}</p>}
            {uploadStatus.success && <p className="text-green-600 mt-2">{uploadStatus.success}</p>}

            <ul className="mt-4 space-y-2">
              {form.files.map((file) => (
                <li key={file.name} className="flex flex-col md:flex-row md:items-center justify-between bg-gray-100 rounded px-3 py-2 gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">📄</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-800">{file.name}</span>
                      <div className="flex gap-2 mt-2">
                        {file.url && (
                          <>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700">🔗 Ouvrir</a>
                            <a href={file.url} download={file.name} className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"><FaDownload /> Télécharger</a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => removeFile(file, e)}
                    className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
                  >
                    <FaTrash /> Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {webcamOpen && (
            <Modal
              isOpen={true}
              onRequestClose={() => setWebcamOpen(false)}
              shouldCloseOnOverlayClick={false}
              shouldCloseOnEsc={false}
              className="bg-white rounded-xl shadow-lg p-6 w-[700px] mx-auto mt-20 max-h-[90vh] overflow-y-auto outline-none"
              overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
            >
              <div className="flex flex-col items-center">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }}
                  className="rounded border shadow-lg"
                  onUserMedia={() => {
                    console.log("Webcam activée avec succès");
                    setWebcamReady(true);
                  }}
                  onUserMediaError={(error) => {
                    console.error("Erreur d'accès à la webcam :", error);
                    setUploadStatus({ loading: false, error: `Erreur d'accès à la webcam : ${error}`, success: null });
                    setWebcamReady(false);
                  }}
                />
                <div className="mt-4 space-x-4">
                  <button
                    onClick={webcamOpen === "doc" ? captureDocument : capturePhoto}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
                    disabled={!webcamReady}
                  >
                    📸 Capturer
                  </button>
                  <button onClick={() => setWebcamOpen(false)} className="text-red-500">
                    Annuler
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </form>
      </div>
    </Modal>
  );
}