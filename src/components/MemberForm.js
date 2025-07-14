import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
import { FaCamera, FaFileUpload, FaTrash, FaDownload } from "react-icons/fa";
import { supabase } from "../supabaseClient"; // Import from supabaseClient.js

// Durées d’abonnement en mois
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
    onSave({
      ...form,
      files: form.files, // Pas besoin de JSON.stringify si la colonne est jsonb
    });
  };

  const capturePhoto = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setUploadStatus({ loading: true, error: null, success: null });
    const blob = await (await fetch(imageSrc)).blob();
    const fileName = `photo_${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(`photos/${fileName}`, blob, { upsert: true });

    if (error) {
      setUploadStatus({ loading: false, error: error.message, success: null });
    } else {
      const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(`photos/${fileName}`);
      setForm((f) => ({ ...f, photo: publicUrl.publicUrl }));
      setUploadStatus({ loading: false, error: null, success: "Photo enregistrée" });
      setWebcamOpen(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploadStatus({ loading: true, error: null, success: null });

    for (const file of files) {
      const filePath = `certificats/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (error) {
        setUploadStatus({ loading: false, error: error.message, success: null });
        return;
      }
      const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(filePath);
      setForm((f) => ({
        ...f,
        files: [...f.files, { name: file.name, url: publicUrl.publicUrl }],
      }));
    }
    setUploadStatus({ loading: false, error: null, success: "Fichiers ajoutés" });
  };

  const removeFile = async (fileToRemove) => {
    const key = fileToRemove.url.split("/documents/")[1];
    await supabase.storage.from("documents").remove([key]);
    const newFiles = form.files.filter((f) => f.name !== fileToRemove.name);
    setForm((f) => ({ ...f, files: newFiles }));
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onCancel}
      className="bg-white rounded-xl p-4 max-w-4xl w-full mx-auto mt-10 shadow-xl"
      overlayClassName="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Nom</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Prénom</label>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Date de naissance</label>
            <input
              type="date"
              name="birthdate"
              value={form.birthdate}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
            {age && <span className="text-sm text-gray-500">Âge: {age} ans</span>}
          </div>
          <div>
            <label className="block text-sm font-medium">Genre</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            >
              <option value="Homme">Homme</option>
              <option value="Femme">Femme</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Adresse</label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Téléphone</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Mobile</label>
            <input
              type="tel"
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Type d'abonnement</label>
            <select
              name="subscriptionType"
              value={form.subscriptionType}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            >
              {Object.keys(subscriptionDurations).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Date de début</label>
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Date de fin</label>
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              readOnly
              className="border px-3 py-2 rounded w-full bg-gray-100"
            />
            {isExpired && <span className="text-sm text-red-500">Expiré</span>}
          </div>
          <div>
            <label className="block text-sm font-medium">Badge ID</label>
            <input
              type="text"
              name="badgeId"
              value={form.badgeId}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Étudiant</label>
            <input
              type="checkbox"
              name="etudiant"
              checked={form.etudiant}
              onChange={handleChange}
              className="h-4 w-4"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Photo</label>
          {form.photo && (
            <img src={form.photo} alt="Photo" className="w-20 h-20 object-cover rounded mb-2" />
          )}
          <button
            type="button"
            onClick={() => setWebcamOpen(true)}
            className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
          >
            <FaCamera /> Prendre une photo
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium">Importer fichiers</label>
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="border px-3 py-2 rounded w-full"
          />
          {uploadStatus.loading && <p>Chargement...</p>}
          {uploadStatus.error && <p className="text-red-500">{uploadStatus.error}</p>}
          {uploadStatus.success && <p className="text-green-500">{uploadStatus.success}</p>}
          {form.files.map((file) => (
            <div key={file.name} className="flex items-center gap-2 mt-2">
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600"
              >
                {file.name}
              </a>
              <button
                type="button"
                onClick={() => removeFile(file)}
                className="text-red-600"
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-black px-4 py-2 rounded"
          >
            Annuler
          </button>
        </div>
      </form>

      {webcamOpen && (
        <Modal
          isOpen={true}
          onRequestClose={() => setWebcamOpen(false)}
          className="bg-white rounded-xl p-4 max-w-lg w-full mx-auto mt-10 shadow-xl"
          overlayClassName="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center"
        >
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={capturePhoto}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              📸 Capturer
            </button>
            <button
              onClick={() => setWebcamOpen(false)}
              className="bg-gray-300 text-black px-4 py-2 rounded"
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}