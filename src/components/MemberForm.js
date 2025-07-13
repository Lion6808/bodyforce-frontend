// src/components/MemberForm.js
import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
import { createClient } from "@supabase/supabase-js";
import { FaCamera, FaFileUpload, FaTrash, FaDownload } from "react-icons/fa";

// Initialise Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

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
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const age = form.birthdate
    ? Math.floor((new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const capturePhoto = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const blob = await (await fetch(imageSrc)).blob();
    const fileName = `photo_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
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
      const { data, error } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (error) {
        setUploadStatus({ loading: false, error: error.message, success: null });
      } else {
        const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(filePath);
        setForm((f) => ({
          ...f,
          files: [...f.files, { name: file.name, url: publicUrl.publicUrl }],
        }));
        setUploadStatus({ loading: false, error: null, success: "Fichier ajouté" });
      }
    }
  };

  const removeFile = async (fileToRemove) => {
    const key = fileToRemove.url.split("/documents/")[1];
    await supabase.storage.from("documents").remove([key]);
    const newFiles = form.files.filter((f) => f.name !== fileToRemove.name);
    setForm((f) => ({ ...f, files: newFiles }));
  };

  return (
    <Modal isOpen={true} onRequestClose={onCancel} className="..." overlayClassName="...">
      {/* Formulaire abrégé ici pour clarté */}
      <form onSubmit={handleSubmit}>
        {/* Champs du formulaire */}
        <div>
          <label>Photo</label>
          {form.photo && <img src={form.photo} alt="Photo" />}
          <button type="button" onClick={() => setWebcamOpen(true)}><FaCamera /> Prendre une photo</button>
        </div>

        <div>
          <label>Importer fichiers</label>
          <input type="file" multiple onChange={handleFileUpload} />
          {form.files.map(file => (
            <div key={file.name}>
              <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
              <button type="button" onClick={() => removeFile(file)}><FaTrash /></button>
            </div>
          ))}
        </div>

        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </form>

      {/* Webcam modal */}
      {webcamOpen && (
        <Modal isOpen={true} onRequestClose={() => setWebcamOpen(false)} className="..." overlayClassName="...">
          <Webcam ref={webcamRef} screenshotFormat="image/jpeg" />
          <button onClick={capturePhoto}>📸 Capturer</button>
          <button onClick={() => setWebcamOpen(false)}>Annuler</button>
        </Modal>
      )}
    </Modal>
  );
}
