// 📄 src/pages/MessagesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { listInbox, markRead, sendMessage } from "../services/messagesService";
import { supabase } from "../supabaseClient";
import {
  FaPaperPlane, FaUsers, FaBullhorn, FaEnvelopeOpen, FaEnvelope
} from "react-icons/fa";

function MemberBadge({ member }) {
  const first = member?.firstName || member?.firstname || member?.prenom || "";
  const last = member?.name || member?.lastname || member?.nom || "";
  const initials = `${(first[0] || "").toUpperCase()}${(last[0] || "").toUpperCase()}` || "?";
  const photo = member?.photo;
  return (
    <div className="flex items-center gap-2">
      {photo ? (
        <img src={photo} alt="" className="w-6 h-6 rounded-full object-cover" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
          {initials}
        </div>
      )}
      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
        {first} {last}
      </span>
    </div>
  );
}

export default function MessagesPage() {
  const { user, role, userMemberData: member } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // INBOX
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [selected, setSelected] = useState(null);

  // COMPOSE (admin)
  const [tab, setTab] = useState("inbox"); // inbox | compose
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [members, setMembers] = useState([]);
  const [picked, setPicked] = useState([]); // ids
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const n = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const q = n(search);
    return members.filter((m) => {
      const a = [m.firstName, m.name, m.firstname, m.lastname, m.prenom, m.nom, m.badgeId, m.email]
        .map(n)
        .join(" ");
      return a.includes(q);
    });
  }, [members, search]);

  useEffect(() => {
    if (!user || !member?.id) return;
    (async () => {
      setLoadingInbox(true);
      try {
        const data = await listInbox(member.id);
        setInbox(data);
      } finally {
        setLoadingInbox(false);
      }
    })();
  }, [user, member?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, firstName, name, photo, badgeId, email");
      if (!error) setMembers(data || []);
    })();
  }, [isAdmin]);

  const openMessage = async (rec) => {
    setSelected(rec);
    if (!rec.read_at) {
      await markRead(rec.id);
      setInbox((prev) => prev.map((r) => (r.id === rec.id ? { ...r, read_at: new Date().toISOString() } : r)));
    }
  };

  const onTogglePick = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        subject,
        body,
        isBroadcast,
        recipientMemberIds: isBroadcast ? [] : picked,
        authorMemberId: member?.id ?? null,
      });
      setSubject(""); setBody(""); setPicked([]); setIsBroadcast(false);
      setTab("inbox");
      if (!isAdmin && member?.id) {
        const data = await listInbox(member.id);
        setInbox(data);
      }
      alert("Message envoyé ✅");
    } catch (e) {
      console.error(e);
      alert("Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  if (!user || !member?.id) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">Connectez-vous pour accéder aux messages.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === "inbox" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
            onClick={() => setTab("inbox")}
          >
            Boîte de réception
          </button>
          {isAdmin && (
            <button
              className={`px-3 py-1.5 rounded-lg text-sm ${tab === "compose" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
              onClick={() => setTab("compose")}
            >
              Nouveau message
            </button>
          )}
        </div>
      </div>

      {/* INBOX */}
      {tab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
              Messages
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {loadingInbox && <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Chargement…</div>}
              {!loadingInbox && inbox.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Aucun message</div>
              )}
              {inbox.map((rec) => {
                const m = rec.messages;
                const created = typeof m.created_at === "string" ? parseISO(m.created_at) : new Date(m.created_at);
                const isRead = !!rec.read_at;
                return (
                  <button
                    key={rec.id}
                    onClick={() => openMessage(rec)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex items-start gap-3"
                  >
                    <div className="mt-0.5">
                      {isRead ? <FaEnvelopeOpen className="w-5 h-5 text-gray-400" /> : <FaEnvelope className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {m.is_broadcast && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            <FaBullhorn className="w-3 h-3" /> Global
                          </span>
                        )}
                        <span className={`text-sm font-medium ${isRead ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}>
                          {m.subject}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.body}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{format(created, "dd/MM/yyyy HH:mm")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 min-h-[50vh]">
            {selected ? (
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.messages.subject}</h2>
                  {selected.messages.is_broadcast && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <FaBullhorn className="w-4 h-4" /> Diffusion globale
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(parseISO(selected.messages.created_at), "dd/MM/yyyy HH:mm")}
                </div>
                <div className="pt-4 text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{selected.messages.body}</div>
              </div>
            ) : (
              <div className="h-full grid place-items-center p-8 text-gray-500 dark:text-gray-400 text-sm">
                Sélectionnez un message
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPOSE (ADMIN) */}
      {isAdmin && tab === "compose" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
              <FaPaperPlane className="w-5 h-5" /> Nouveau message
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-blue-600" checked={isBroadcast} onChange={(e) => setIsBroadcast(e.target.checked)} />
              <span className="inline-flex items-center gap-1">
                <FaBullhorn className="w-4 h-4" /> Diffusion globale
              </span>
            </label>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sujet</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sujet du message"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Écris ton message ici…"
                />
              </div>
              <div>
                <button
                  onClick={onSend}
                  disabled={sending || (!isBroadcast && picked.length === 0) || !subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <FaPaperPlane className="w-4 h-4" />
                  Envoyer
                </button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className={`rounded-lg border ${isBroadcast ? "opacity-40 pointer-events-none" : ""} border-gray-200 dark:border-gray-700`}>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FaUsers className="w-4 h-4" /> Destinataires
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{picked.length} sélectionné(s)</span>
                </div>
                <div className="p-3">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none"
                    placeholder="Rechercher nom, badge, email…"
                  />
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {filteredMembers.map((m) => (
                      <label key={m.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-blue-600"
                          checked={picked.includes(m.id)}
                          onChange={() => onTogglePick(m.id)}
                        />
                        <MemberBadge member={m} />
                      </label>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">Aucun membre</div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Astuce : active “Diffusion globale” pour envoyer à tous les membres.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
