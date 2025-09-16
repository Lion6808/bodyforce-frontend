// 📄 src/pages/MessagesPage.jsx — Inbox + Discussions (admin & membres)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";
import { format, parseISO } from "date-fns";
import {
  listInbox,
  markRead,
  listMyThread,
  listThreadWithMember,
  sendToAdmins,
  sendToMember,
  sendBroadcast, // ✅ diffusion globale (RPC)
} from "../services/messagesService";

export default function MessagesPage() {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // Onglets
  const [tab, setTab] = useState("discuss"); // "discuss" | "inbox"

  // Inbox
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [selected, setSelected] = useState(null);

  // Discussions (chat)
  const [targetMemberId, setTargetMemberId] = useState(null); // admin : membre sélectionné
  const [thread, setThread] = useState([]);
  const endRef = useRef(null);

  // Composer
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Options diffusion (admin)
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [excludeAuthor, setExcludeAuthor] = useState(true);

  // Liste des membres (admin)
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState("");

  const filteredMembers = useMemo(() => {
    if (!isAdmin) return [];
    const q = (filter || "").toLowerCase();
    return (members || []).filter((m) =>
      [m.firstName, m.name, m.email, m.badgeId]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, filter, isAdmin]);

  const scrollToEnd = () =>
    endRef.current?.scrollIntoView({ behavior: "smooth" });

  // ============ Inbox ============
  const loadInbox = async () => {
    if (!me?.id) return;
    setLoadingInbox(true);
    try {
      const data = await listInbox(me.id);
      setInbox(data);
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (!user || !me?.id) return;
    loadInbox();
  }, [user, me?.id]);

  // ============ Thread (fil) ============
  async function loadThread() {
    if (!me?.id) return;

    if (isAdmin) {
      if (!targetMemberId && !isBroadcast) {
        setThread([]);
        return;
      }
      if (isBroadcast) {
        // Fil pour diffusion : on n’affiche pas un “groupe”,
        // on garde le fil sélectionné si existant, sinon vide.
        // (Option : on pourrait afficher un fil agrégé des broadcasts)
        setThread((t) => t);
        return;
      }
      const data = await listThreadWithMember(targetMemberId);
      setThread(data);
      scrollToEnd();
    } else {
      const data = await listMyThread(me.id);
      setThread(data);
      scrollToEnd();
    }
  }

  useEffect(() => {
    loadThread(); // eslint-disable-next-line
  }, [user, me?.id, targetMemberId, isAdmin, isBroadcast]);

  // Liste des membres (admin)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, firstName, name, email, badgeId, photo")
        .order("name", { ascending: true });
      if (!error) setMembers(data || []);
    })();
  }, [isAdmin]);

  // ============ Realtime ============
  // 1) Tous : nouveaux messages me concernant (INSERT sur message_recipients où je suis destinataire)
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`inbox_${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_recipients",
          filter: `recipient_member_id=eq.${me.id}`,
        },
        async () => {
          // rafraîchit inbox + thread "moi <-> staff"
          await loadInbox();
          if (!isAdmin) await loadThread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_recipients",
          filter: `recipient_member_id=eq.${me.id}`,
        },
        async () => {
          // si quelqu’un marque lu → pas indispensable ici, mais on peut recharger l’inbox
          await loadInbox();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id]); // eslint-disable-line

  // 2) Admin : fil pour le membre sélectionné
  useEffect(() => {
    if (!isAdmin || !targetMemberId) return;
    const ch = supabase
      .channel(`thread_member_${targetMemberId}`)
      // a) un message destiné à ce membre (admin -> membre)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_recipients",
          filter: `recipient_member_id=eq.${targetMemberId}`,
        },
        async () => {
          await loadThread();
        }
      )
      // b) un message écrit par ce membre (membre -> admins)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `author_member_id=eq.${targetMemberId}`,
        },
        async () => {
          await loadThread();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [isAdmin, targetMemberId]); // eslint-disable-line

  // ============ Actions ============
  const openMessage = async (rec) => {
    setSelected(rec);
    if (!rec.read_at) {
      await markRead(rec.id);
      setInbox((prev) =>
        prev.map((r) =>
          r.id === rec.id ? { ...r, read_at: new Date().toISOString() } : r
        )
      );
    }
  };

  const onSend = async () => {
    if (!subject.trim() || !body.trim() || !me?.id) return;
    setSending(true);
    try {
      if (isAdmin) {
        if (isBroadcast) {
          await sendBroadcast({ subject, body, excludeAuthor });
        } else {
          if (!targetMemberId) return;
          await sendToMember({
            toMemberId: targetMemberId,
            subject,
            body,
            authorMemberId: me.id,
          });
        }
      } else {
        await sendToAdmins({ subject, body, authorMemberId: me.id });
      }

      setSubject("");
      setBody("");
      // Recharge le fil, reste sur place
      await loadThread();
      // Recharge l’inbox aussi (utile si je m’envoie une copie ou si staff répond)
      await loadInbox();
      // Scroll bas
      scrollToEnd();
    } finally {
      setSending(false);
    }
  };

  if (!user || !me?.id) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-300">
        Connectez-vous pour accéder aux messages.
      </div>
    );
  }

  // ====== UI ======
  const Bubble = ({ msg, isMine }) => {
    const created =
      typeof msg.created_at === "string"
        ? parseISO(msg.created_at)
        : new Date(msg.created_at);
    return (
      <div
        className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3`}
      >
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 shadow ${
            isMine
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          }`}
        >
          {msg.subject && (
            <div className="text-xs opacity-90 font-semibold mb-1">
              {msg.subject}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
          <div
            className={`mt-1 text-[10px] ${
              isMine ? "text-white/70" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {format(created, "dd/MM/yyyy HH:mm")}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Onglets */}
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "discuss"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => setTab("discuss")}
        >
          Discussions
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "inbox"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => setTab("inbox")}
        >
          Boîte de réception
        </button>
      </div>

      {/* ====== DISCUSSIONS (chat) ====== */}
      {tab === "discuss" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Colonne gauche : liste des membres (admin) */}
          <div
            className={`lg:col-span-1 ${
              isAdmin ? "" : "hidden"
            } ${isBroadcast ? "opacity-50 pointer-events-none select-none" : ""}`}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">
                Sélection membre
              </div>
              <div className="p-3">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 outline-none"
                  placeholder="Nom, email, badge…"
                />
                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setTargetMemberId(m.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg ${
                        targetMemberId === m.id
                          ? "bg-blue-50 dark:bg-blue-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(m.firstName || "") + " " + (m.name || "")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {m.email || m.badgeId}
                      </div>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Aucun membre
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite : fil + composer */}
          <div className={`${isAdmin ? "lg:col-span-2" : "lg:col-span-3"}`}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col h-[70vh]">
              {/* Fil */}
              <div className="flex-1 overflow-y-auto px-1">
                {/* Infos diffusion globale (admin) */}
                {isAdmin && isBroadcast && (
                  <div className="mb-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                    Mode <b>Diffusion globale</b> activé — le message sera envoyé
                    à <b>tous les membres</b>.
                  </div>
                )}

                {thread.length === 0 && !isBroadcast && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Aucune conversation pour le moment.
                  </div>
                )}

                {!isBroadcast &&
                  thread.map((msg) => {
                    const isMine = isAdmin
                      ? msg.author_member_id !== (targetMemberId || -1) // côté admin : tout ce qui n’est pas l’autre membre = moi/staff
                      : msg.author_member_id === me.id; // côté membre : moi si author = me.id
                    return <Bubble key={msg.id} msg={msg} isMine={isMine} />;
                  })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="mt-3 grid grid-cols-1 gap-2">
                {isAdmin && (
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={isBroadcast}
                        onChange={(e) => setIsBroadcast(e.target.checked)}
                      />
                      <span>Diffusion globale (à tous les membres)</span>
                    </label>
                    {isBroadcast && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-blue-600"
                          checked={excludeAuthor}
                          onChange={(e) => setExcludeAuthor(e.target.checked)}
                        />
                        <span>Ne pas m’envoyer une copie</span>
                      </label>
                    )}
                  </div>
                )}

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    isAdmin
                      ? "Sujet"
                      : "Sujet (visible par le staff)"
                  }
                />
                <textarea
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    isAdmin
                      ? isBroadcast
                        ? "Votre message à tous les membres…"
                        : "Votre message au membre…"
                      : "Votre message au staff…"
                  }
                />
                <div className="flex justify-end">
                  <button
                    onClick={onSend}
                    disabled={
                      sending ||
                      !subject.trim() ||
                      !body.trim() ||
                      (isAdmin && !isBroadcast && !targetMemberId)
                    }
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {sending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== INBOX (liste + lecture) ====== */}
      {tab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Liste */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">
              Messages
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {loadingInbox && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Chargement…
                </div>
              )}
              {!loadingInbox && inbox.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Aucun message
                </div>
              )}
              {inbox.map((rec) => {
                const m = rec.messages;
                const created =
                  typeof m.created_at === "string"
                    ? parseISO(m.created_at)
                    : new Date(m.created_at);
                const isRead = !!rec.read_at;
                return (
                  <button
                    key={rec.id}
                    onClick={() => openMessage(rec)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <div className="text-sm font-medium">{m.subject}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {m.body}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {format(created, "dd/MM/yyyy HH:mm")} •{" "}
                      {isRead ? "lu" : "non lu"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lecture */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[50vh] p-5">
            {selected ? (
              <>
                <div className="text-lg font-semibold">
                  {selected.messages.subject}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {format(
                    parseISO(selected.messages.created_at),
                    "dd/MM/yyyy HH:mm"
                  )}
                </div>
                <div className="whitespace-pre-wrap">
                  {selected.messages.body}
                </div>
              </>
            ) : (
              <div className="h-full grid place-items-center text-gray-500 dark:text-gray-400 text-sm">
                Sélectionnez un message
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
