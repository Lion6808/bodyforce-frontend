// 📄 src/pages/MessagesPage.jsx — BODYFORCE
// 🎯 Objectif : Messagerie propre sans récursion RLS côté DB, UI simple et logique claire
// - Annuaire des destinataires basé sur `members` (pas sur l'historique de messages)
// - Envoi accessible à TOUS les utilisateurs (admin & non-admin)
// - Envoi via RPC `send_message()` (atomique)
// - Lecture Inbox / Outbox via vues `v_inbox` / `v_outbox` (RLS fait le filtrage)
// - Dark mode respecté, style discret (adaptable à ton design existant)

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

function MessagesPage() {
  const { user, role, userMemberData: memberCtx } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // --- Annuaire des destinataires ---
  const [directory, setDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [search, setSearch] = useState("");

  // --- Sélection des destinataires ---
  const [selected, setSelected] = useState(() => new Set());

  // --- Composer ---
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // --- Inbox / Outbox ---
  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [loadingBoxes, setLoadingBoxes] = useState(false);

  // =========================
  // Charger l'annuaire membres
  // =========================
  useEffect(() => {
    let ignore = false;
    const loadDirectory = async () => {
      if (!user) return;
      setLoadingDirectory(true);
      try {
        // Base : tous les membres sauf soi-même
        let q = supabase
          .from("members")
          .select("id, name, firstName, photo, user_id")
          .neq("id", memberCtx?.id || -1)
          .order("firstName", { ascending: true });

        // Optionnel : si non-admin, ne montrer que les admins comme destinataires
        if (!isAdmin) {
          const { data: adminUsers, error: eAdmins } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin")
            .is("is_disabled", false);

          if (eAdmins) throw eAdmins;
          const adminIds = (adminUsers || []).map((u) => u.user_id);

          if (adminIds.length > 0) {
            q = q.in("user_id", adminIds);
          } else {
            // Si aucun admin, forcer 0 résultat
            q = q.in("user_id", ["00000000-0000-0000-0000-000000000000"]);
          }
        }

        const { data, error } = await q;
        if (error) throw error;

        if (!ignore) setDirectory(data || []);
      } catch (err) {
        console.error("loadDirectory error:", err);
        if (!ignore) setDirectory([]);
      } finally {
        if (!ignore) setLoadingDirectory(false);
      }
    };

    loadDirectory();
    return () => {
      ignore = true;
    };
  }, [user, isAdmin, memberCtx?.id]);

  // Filtre local (recherche)
  const filteredDirectory = useMemo(() => {
    if (!search.trim()) return directory;
    const s = search.trim().toLowerCase();
    return directory.filter((m) => {
      const fn = (m.firstName || "").toLowerCase();
      const ln = (m.name || "").toLowerCase();
      return fn.includes(s) || ln.includes(s) || `${fn} ${ln}`.includes(s);
    });
  }, [search, directory]);

  // ==================================
  // Charger Inbox / Outbox (vues RLS)
  // ==================================
  const refreshBoxes = async () => {
    setLoadingBoxes(true);
    try {
      const [inRes, outRes] = await Promise.all([
        supabase.from("v_inbox").select("*").order("created_at", { ascending: false }),
        supabase.from("v_outbox").select("*").order("created_at", { ascending: false }),
      ]);
      if (inRes.error) throw inRes.error;
      if (outRes.error) throw outRes.error;
      setInbox(inRes.data || []);
      setOutbox(outRes.data || []);
    } catch (err) {
      console.error("refreshBoxes error:", err);
      setInbox([]);
      setOutbox([]);
    } finally {
      setLoadingBoxes(false);
    }
  };

  useEffect(() => {
    if (user) refreshBoxes();
  }, [user]);

  // ============================
  // Sélection destinataires (UI)
  // ============================
  const toggleRecipient = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearCompose = () => {
    setSubject("");
    setBody("");
    setSelected(new Set());
  };

  const canSend = useMemo(() => {
    return subject.trim().length > 0 && body.trim().length > 0 && selected.size > 0;
  }, [subject, body, selected]);

  // ====================
  // Envoi via RPC (atom.)
  // ====================
  const handleSend = async () => {
    try {
      const recipients = Array.from(selected);
      const { data, error } = await supabase.rpc("send_message", {
        p_author_member_id: memberCtx?.id ?? null, // OK si null
        p_subject: subject.trim(),
        p_body: body.trim(),
        p_recipient_member_ids: recipients,
        p_is_broadcast: false,
      });
      if (error) throw error;

      // Reset + refresh
      setComposeOpen(false);
      clearCompose();
      await refreshBoxes();
    } catch (err) {
      console.error("send_message error:", err);
      alert("Erreur lors de l’envoi du message.");
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-semibold dark:text-white">Messagerie</h1>
        {/* Bouton composer visible pour TOUS les utilisateurs connectés */}
        <button
          onClick={() => setComposeOpen(true)}
          className="px-3 py-2 rounded-md bg-blue-600 text-white hover:opacity-90"
        >
          Nouveau message
        </button>
      </div>

      {/* Composer (modal simple) */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-3xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold dark:text-white">Composer un message</h2>
              <button
                onClick={() => {
                  setComposeOpen(false);
                  clearCompose();
                }}
                className="px-3 py-1 border rounded-md dark:border-gray-700"
              >
                Fermer
              </button>
            </div>

            {/* Annuaire des destinataires */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un membre…"
                  className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                />
                {isAdmin && directory.length > 0 && (
                  <>
                    <button
                      onClick={() => setSelected(new Set(directory.map((m) => m.id)))}
                      className="px-3 py-2 rounded-md border dark:border-gray-700"
                    >
                      Tout
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="px-3 py-2 rounded-md border dark:border-gray-700"
                    >
                      Aucun
                    </button>
                  </>
                )}
              </div>

              <div className="border rounded-md p-3 max-h-64 overflow-auto dark:border-gray-700">
                {loadingDirectory ? (
                  <div className="text-sm opacity-70 dark:text-gray-200">Chargement…</div>
                ) : filteredDirectory.length === 0 ? (
                  <div className="text-sm opacity-70 dark:text-gray-200">
                    Aucun destinataire disponible.
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredDirectory.map((m) => (
                      <li key={m.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggleRecipient(m.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex items-center gap-2">
                          {m.photo ? (
                            <img
                              src={m.photo}
                              alt="avatar"
                              className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                          )}
                          <span className="text-sm dark:text-gray-100">
                            {m.firstName || ""} {m.name || ""}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Sujet & Corps */}
            <div className="mb-2">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet"
                className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Votre message…"
                className="w-full border rounded-md px-3 py-2 h-40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-md border dark:border-gray-700"
                onClick={() => {
                  setComposeOpen(false);
                  clearCompose();
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`px-3 py-2 rounded-md ${
                  canSend
                    ? "bg-green-600 text-white hover:opacity-90"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                Envoyer {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inbox / Outbox */}
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <section className="border rounded-md p-3 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold dark:text-white">Réception</h3>
            <button
              onClick={refreshBoxes}
              className="px-2 py-1 text-sm rounded-md border dark:border-gray-700"
            >
              Actualiser
            </button>
          </div>
          {loadingBoxes ? (
            <div className="text-sm opacity-70 dark:text-gray-200">Chargement…</div>
          ) : inbox.length === 0 ? (
            <div className="text-sm opacity-70 dark:text-gray-200">Aucun message reçu.</div>
          ) : (
            <ul className="space-y-2">
              {inbox.map((m) => (
                <li key={`${m.message_id}:${m.message_recipient_id}`} className="border rounded-md p-3 dark:border-gray-700">
                  <div className="text-xs opacity-70 dark:text-gray-300">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="font-medium dark:text-white">{m.subject}</div>
                  <div className="text-sm dark:text-gray-200 whitespace-pre-wrap">{m.body}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border rounded-md p-3 dark:border-gray-700">
          <h3 className="font-semibold mb-2 dark:text-white">Envoyés</h3>
          {loadingBoxes ? (
            <div className="text-sm opacity-70 dark:text-gray-200">Chargement…</div>
          ) : outbox.length === 0 ? (
            <div className="text-sm opacity-70 dark:text-gray-200">Aucun message envoyé.</div>
          ) : (
            <ul className="space-y-2">
              {outbox.map((m) => (
                <li key={m.message_id} className="border rounded-md p-3 dark:border-gray-700">
                  <div className="text-xs opacity-70 dark:text-gray-300">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="font-medium dark:text-white">{m.subject}</div>
                  <div className="text-sm dark:text-gray-200 whitespace-pre-wrap">{m.body}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default MessagesPage;
