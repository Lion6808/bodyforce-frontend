import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
import { FaCamera, FaFileUpload, FaTrash, FaDownload } from "react-icons/fa";

const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 12,
};

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
  const webcamRef = useRef(null);

  useEffect(() => {
    if (member) {
      setForm({
        ...member,
        files: Array.isArray(member.files)
          ? member.files
          : typeof member.files === "string"
            ? JSON.parse(member.files)
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
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setForm((f) => ({ ...f, photo: imageSrc }));
      setWebcamOpen(false);
    }
  };

  const captureDocument = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const docName = `photo_doc_${Date.now()}.jpg`;
      setForm((f) => ({
        ...f,
        files: [...f.files, { name: docName, url: imageSrc }],
      }));
      setWebcamOpen(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) {
      setUploadStatus({ loading: false, error: "Aucun fichier sélectionné", success: null });
      return;
    }

    setUploadStatus({ loading: true, error: null, success: null });

    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
    for (let file of files) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setUploadStatus({ loading: false, error: `Type de fichier non supporté pour ${file.name}`, success: null });
        continue;
      }
      const data = new FormData();
      data.append("file", file);
      try {
        const res = await fetch(`${apiUrl}/upload/files`, {
          method: "POST",
          headers: {
            Authorization: localStorage.getItem("user") || "",
          },
          body: data,
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Erreur HTTP ${res.status}`);
        }
        const result = await res.json();
        if (!result.url) {
          throw new Error("L'URL du fichier n'est pas renvoyée par l'API");
        }
        setForm((f) => ({
          ...f,
          files: [...f.files, { name: result.name || file.name, url: result.url }],
        }));
        setUploadStatus({ loading: false, error: null, success: `Fichier ${file.name} téléversé avec succès` });
      } catch (err) {
        console.error("Erreur d'import:", err);
        setUploadStatus({ loading: false, error: `Erreur lors du téléversement de ${file.name}: ${err.message}`, success: null });
      }
    }
  };

  const removeFile = async (name) => {
    const fileToRemove = form.files.find((f) => f.name === name);
    if (!fileToRemove) return;

    setUploadStatus({ loading: true, error: null, success: null });

    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
    if (fileToRemove.url && fileToRemove.url.startsWith("/upload")) {
      try {
        const res = await fetch(`${apiUrl}/api/files`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("user") || "",
          },
          body: JSON.stringify({ path: fileToRemove.url }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (res.status === 404) {
            console.warn(`Fichier introuvable sur le serveur: ${fileToRemove.url}`);
            setUploadStatus({
              loading: false,
              error: `Le fichier ${name} n'existe pas sur le serveur, mais sera supprimé localement.`,
              success: null,
            });
          } else {
            throw new Error(errorData.error || `Erreur HTTP ${res.status}`);
          }
        } else {
          setUploadStatus({ loading: false, error: null, success: `Fichier ${name} supprimé avec succès` });
        }
      } catch (err) {
        console.error("Erreur lors de la suppression du fichier sur le serveur:", err);
        setUploadStatus({ loading: false, error: `Erreur lors de la suppression de ${name}: ${err.message}`, success: null });
      }
    }

    const newFiles = form.files.filter((file) => file.name !== name);
    setForm((f) => ({ ...f, files: newFiles }));

    if (member && member.id) {
      try {
        const res = await fetch(`${apiUrl}/api/members/${member.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("user") || "",
          },
          body: JSON.stringify({ ...form, files: newFiles }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Erreur HTTP ${res.status}`);
        }
        setUploadStatus((prev) => ({ ...prev, success: `Fichier ${name} supprimé et membre mis à jour` }));
      } catch (err) {
        console.error("Erreur lors de la mise à jour du membre:", err);
        setUploadStatus({ loading: false, error: `Erreur lors de la mise à jour du membre: ${err.message}`, success: null });
      }
    } else {
      setUploadStatus({ loading: false, error: null, success: `Fichier ${name} supprimé localement` });
    }
  };

  const age = form.birthdate
    ? Math.floor((new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onCancel}
      shouldCloseOnOverlayClick={false}
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
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Date de naissance</label>
                  <input
                    type="date"
                    name="birthdate"
                    value={form.birthdate}
                    onChange={handleChange}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Sexe</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full border p-2 rounded"
                  >
                    <option>Homme</option>
                    <option>Femme</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label htmlFor="etudiant" className="text-sm font-medium text-gray-700">
                    🎓 Étudiant :
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, etudiant: !f.etudiant }))}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${
                      form.etudiant ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${
                        form.etudiant ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>
                {age !== null && <div className="text-sm mt-1 text-gray-700">Âge : {age} ans</div>}
              </div>
              <div className="flex flex-col items-center justify-start">
                {form.photo ? (
                  <img
                    src={form.photo}
                    alt="Photo"
                    className="w-32 h-32 object-cover rounded border mb-2"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center border rounded text-gray-400 mb-2">
                    Pas de photo
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setWebcamOpen(true)}
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
              <div>
                <label className="block text-sm text-gray-700 mb-1">Adresse</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Téléphone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Portable</label>
                <input
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Abonnement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Type d'abonnement</label>
                <select
                  name="subscriptionType"
                  value={form.subscriptionType}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                >
                  <option>Mensuel</option>
                  <option>Trimestriel</option>
                  <option>Semestriel</option>
                  <option>Annuel</option>
                  <option>Année civile</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Date de début</label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  readOnly
                  className="w-full border p-2 rounded bg-gray-100"
                />
              </div>
              {isExpired && <p className="text-red-600 text-sm">⛔ Abonnement expiré</p>}
              <div>
                <label className="block text-sm text-gray-700 mb-1">ID Badge</label>
                <input
                  name="badgeId"
                  value={form.badgeId}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </div>

          <div className="bg-pink-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-4">Documents / Certificats</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <label
                htmlFor="fileUpload"
                className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                <FaFileUpload /> Importer un fichier
              </label>
              <input
                type="file"
                id="fileUpload"
                className="hidden"
                multiple
                accept="image/jpeg,image/png,image/gif,application/pdf"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => setWebcamOpen("doc")}
                className="bg-purple-600 text-white px-4 py-2 rounded inline-flex items-center gap-2"
              >
                <FaCamera /> Prendre une photo (doc)
              </button>
            </div>
            {uploadStatus.loading && <p className="text-blue-600 mt-2">Téléversement en cours...</p>}
            {uploadStatus.error && <p className="text-red-600 mt-2">{uploadStatus.error}</p>}
            {uploadStatus.success && <p className="text-green-600 mt-2">{uploadStatus.success}</p>}
            <ul className="mt-4 space-y-2">
              {form.files.map((file) => {
                const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.name);
                const isPdf = /\.pdf$/i.test(file.name);
                const icon = isImage ? "🖼️" : isPdf ? "🧾" : "📄";
                const base = process.env.REACT_APP_API_URL || "http://localhost:3001";
                const cleanPath = file.url?.startsWith("/") ? file.url : "/" + (file.url || "");
                const link = file.url?.startsWith("http") || file.url?.startsWith("data:") ? file.url : `${base}${cleanPath}`;

                return (
                  <li
                    key={file.name}
                    className="flex flex-col md:flex-row md:items-center justify-between bg-gray-100 rounded px-3 py-2 gap-2"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{icon}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800">{file.name}</span>
                        <div className="flex gap-2 mt-2">
                          {link && (
                            <>
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700"
                                aria-label={`Ouvrir le fichier ${file.name}`}
                              >
                                🔗 Ouvrir
                              </a>
                              <a
                                href={link}
                                download={file.name}
                                className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"
                                aria-label={`Télécharger le fichier ${file.name}`}
                              >
                                <FaDownload /> Télécharger
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name);
                      }}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
                      aria-label={`Supprimer le fichier ${file.name}`}
                    >
                      <FaTrash /> Supprimer
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {webcamOpen && (
            <Modal
              isOpen={true}
              onRequestClose={() => setWebcamOpen(false)}
              shouldCloseOnOverlayClick={false}
              contentLabel="Prendre une photo"
              className="bg-white rounded-xl shadow-lg p-6 w-[700px] mx-auto mt-20 max-h-[90vh] overflow-y-auto outline-none"
              overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
            >
              <div className="flex flex-col items-center">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                  className="rounded border shadow-lg"
                  style={{ width: 640, height: 480 }}
                />
                <div className="mt-4 space-x-4">
                  <button
                    onClick={webcamOpen === "doc" ? captureDocument : capture}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    📸 Capturer
                  </button>
                  <button
                    onClick={() => setWebcamOpen(false)}
                    className="text-red-500"
                  >
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