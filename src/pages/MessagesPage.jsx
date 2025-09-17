// 📄 src/pages/MessagesPage.jsx — App de messagerie (conversations + fil)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import {
  sendToAdmins,
  sendToMember,
  sendBroadcast,
} from "../services/messagesService";

// (facultatif) si tu as ajouté ces RPC, on les utilise pour marquer lu :
import { markConversationRead } from "../services/messagesService"; // ok si présent ; sinon noop en catch

function fmt(dt) {
  const d = typeof dt === "string" ? parseISO(dt) : new Date(dt);
  return format(d, "dd/MM/yyyy HH:mm");
}

function initials(firstName, name) {
  const a = (firstName || "").trim().charAt(0);
  const b = (name || "").trim().charAt(0);
  return (a + b || "?").toUpperCase();
}

export default function MessagesPage() {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // Conversations
  const [convs, setConvs] = useState([]); // {otherId, name, photo, lastBody, lastAt, unread, email, badgeId}
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [filter, setFilter] = useState("");
  const [activeOtherId, setActiveOtherId] = useState(null);

  // Fil
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const endRef = useRef(null);

  // Composer
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [excludeAuthor, setExcludeAuthor] = useState(true);

  const filteredConvs = useMemo(() => {
    const q = (filter || "").toLowerCase();
    return (convs || []).filter((c) =>
      [c.name, c.email, c.badgeId, c.lastBody].join(" ").toLowerCase().includes(q)
    );
  }, [convs, filter]);

  const activeDisplay = useMemo(
    () => (isAdmin ? "Membre" : "Admin"),
    [isAdmin]
  );

  // ========= Conversations builder =========
  async function fetchConversations() {
    if (!me?.id) return;
    setLoadingConvs(true);

    try {
      // 1) Messages où JE SUIS destinataire (non lus + derniers) -> autre = auteur
      const { data: inbox, error: e1 } = await supabase
        .from("message_recipients")
        .select(
          `
          id, read_at, created_at,
          messages:message_id (id, subject, body, created_at, author_member_id)
        `
        )
        .eq("recipient_member_id", me.id);

      if (e1) throw e1;

      // 2) Messages que J'AI ÉCRITS -> autre = destinataire
      const { data: sent, error: e2 } = await supabase
        .from("messages")
        .select(
          `
          id, subject, body, created_at, author_member_id,
          recipients:message_recipients (recipient_member_id)
        `
        )
        .eq("author_member_id", me.id);

      if (e2) throw e2;

      // Agrégat
      const map = new Map();

      // Inbox -> group by author (autre)
      (inbox || []).forEach((rec) => {
        const m = rec.messages;
        if (!m) return;
        const otherId = m.author_member_id;
        if (!otherId) return;
        const prev = map.get(otherId) || {
          otherId,
          lastAt: "1970-01-01T00:00:00.000Z",
          lastBody: "",
          unread: 0,
        };
        // last
        if (!prev.lastAt || new Date(m.created_at) > new Date(prev.lastAt)) {
          prev.lastAt = m.created_at;
          prev.lastBody = m.body || m.subject || "";
        }
        // unread (uniquement les messages destinés à moi, donc via inbox)
        if (!rec.read_at) prev.unread += 1;

        map.set(otherId, prev);
      });

      // Sent -> group by recipient (autre)
      (sent || []).forEach((m) => {
        const recips = m.recipients || [];
        recips.forEach((r) => {
          const otherId = r.recipient_member_id;
          if (!otherId) return;
          const prev = map.get(otherId) || {
            otherId,
            lastAt: "1970-01-01T00:00:00.000Z",
            lastBody: "",
            unread: 0,
          };
          if (!prev.lastAt || new Date(m.created_at) > new Date(prev.lastAt)) {
            prev.lastAt = m.created_at;
            prev.lastBody = m.body || m.subject || "";
          }
          map.set(otherId, prev);
        });
      });

      const items = Array.from(map.values());
      const otherIds = items.map((x) => x.otherId);

      if (otherIds.length === 0) {
        setConvs([]);
        if (!isAdmin) setActiveOtherId(null); // membre sans convs
      } else {
        // 3) Charger profils des "autres"
        const { data: others, error: e3 } = await supabase
          .from("members")
          .select("id, firstName, name, email, photo, badgeId")
          .in("id", otherIds);
        if (e3) throw e3;

        const byId = {};
        (others || []).forEach((m) => (byId[m.id] = m));

        const withMeta = items
          .map((it) => {
            const m = byId[it.otherId] || {};
            const name = `${m.firstName || ""} ${m.name || ""}`.trim() || m.email || `#${it.otherId}`;
            return {
              ...it,
              name,
              email: m.email || "",
              badgeId: m.badgeId || "",
              photo: m.photo || "",
            };
          })
          .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

        setConvs(withMeta);
        if (!activeOtherId) {
          setActiveOtherId(withMeta[0]?.otherId ?? null);
        }
      }
    } finally {
      setLoadingConvs(false);
    }
  }

  // ========= Thread loader =========
  async function fetchThread(otherId) {
    if (!me?.id || !otherId) {
      setThread([]);
      return;
    }
    setLoadingThread(true);

    try {
      // Deux sens, filtrés sur le "contact" (otherId)
      // a) Messages que j'ai REÇUS de otherId
      const { data: inbound, error: eIn } = await supabase
        .from("message_recipients")
        .select(
          `
          id, read_at, created_at,
          messages:message_id (id, subject, body, created_at, author_member_id)
        `
        )
        .eq("recipient_member_id", me.id);
      if (eIn) throw eIn;

      const inboundFiltered = (inbound || [])
        .map((r) => ({
          kind: "in",
          id: `in_${r.id}`,
          message_id: r.messages?.id,
          subject: r.messages?.subject,
          body: r.messages?.body,
          created_at: r.messages?.created_at || r.created_at,
          author_member_id: r.messages?.author_member_id,
        }))
        .filter((x) => x.author_member_id === otherId);

      // b) Messages que j'ai ENVOYÉS vers otherId
      const { data: sent, error: eOut } = await supabase
        .from("messages")
        .select(
          `
          id, subject, body, created_at, author_member_id,
          recipients:message_recipients (recipient_member_id)
        `
        )
        .eq("author_member_id", me.id);
      if (eOut) throw eOut;

      const outboundFiltered = [];
      (sent || []).forEach((m) => {
        (m.recipients || []).forEach((rcpt) => {
          if (rcpt.recipient_member_id === otherId) {
            outboundFiltered.push({
              kind: "out",
              id: `out_${m.id}_${otherId}`,
              message_id: m.id,
              subject: m.subject,
              body: m.body,
              created_at: m.created_at,
              author_member_id: m.author_member_id, // = me.id
            });
          }
        });
      });

      const all = [...inboundFiltered, ...outboundFiltered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      setThread(all);

      // Marquer la conv comme lue (si RPC dispo)
      try {
        if (typeof markConversationRead === "function") {
          await markConversationRead(otherId);
          // baisse le badge localement
          setConvs((prev) =>
            prev.map((c) =>
              c.otherId === otherId ? { ...c, unread: 0 } : c
            )
          );
        }
      } catch {
        /* noop si la RPC n'est pas installée */
      }

      // Scroll bas
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setLoadingThread(false);
    }
  }

  // ========= Effects =========
  useEffect(() => {
    if (!user || !me?.id) return;
    fetchConversations();
    // eslint-disable-next-line
  }, [user, me?.id, isAdmin]);

  useEffect(() => {
    if (!activeOtherId) return;
    fetchThread(activeOtherId);
    // eslint-disable-next-line
  }, [activeOtherId]);

  // Realtime: nouveaux messages pour MOI (INSERT sur mr pour me.id) + updates (lu)
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_inbox_${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_recipients", filter: `recipient_member_id=eq.${me.id}` },
        async () => {
          await fetchConversations();
          if (activeOtherId) await fetchThread(activeOtherId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "message_recipients", filter: `recipient_member_id=eq.${me.id}` },
        async () => {
          await fetchConversations();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id, activeOtherId]); // eslint-disable-line

  // Realtime: messages que J'ENVOIE (utile pour voir mon message réapparaître)
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_out_${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `author_member_id=eq.${me.id}` },
        async () => {
          await fetchConversations();
          if (activeOtherId) await fetchThread(activeOtherId);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id, activeOtherId]); // eslint-disable-line

  // ========= Actions =========
  const onSend = async () => {
    if (sending) return;
    if (!subject.trim() || !body.trim()) return;
    if (!me?.id) return;

    setSending(true);
    try {
      if (isAdmin) {
        if (isBroadcast) {
          await sendBroadcast({ subject, body, excludeAuthor });
        } else {
          if (!activeOtherId) return;
          await sendToMember({
            toMemberId: activeOtherId,
            subject,
            body,
            authorMemberId: me.id,
          });
        }
      } else {
        // membre -> staff (tous les admins)
        await sendToAdmins({ subject, body, authorMemberId: me.id });
      }

      setSubject("");
      setBody("");

      // refresh
      await fetchConversations();
      if (activeOtherId) await fetchThread(activeOtherId);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // ========= UI =========
  const ConversationRow = ({ c, active, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl transition flex items-center gap-3 ${
        active ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
      }`}
    >
      {c.photo ? (
        <img
          src={c.photo}
          alt={c.name}
          className="w-10 h-10 rounded-full object-cover border border-white dark:border-gray-700 shadow"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
          {initials(c.firstName, c.name) || c.name?.slice(0, 2)?.toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {c.name}
          </div>
          <div className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
            {c.lastAt ? format(new Date(c.lastAt), "dd/MM HH:mm") : ""}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {c.lastBody || "\u00A0"}
        </div>
      </div>

      {c.unread > 0 && (
        <span className="ml-2 inline-flex items-center justify-center text-[11px] min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-600 text-white">
          {c.unread > 99 ? "99+" : c.unread}
        </span>
      )}
    </button>
  );

  const Bubble = ({ msg, meId, otherName, iAmAdmin }) => {
    const mine = msg.author_member_id === meId;
    const label = mine ? "Moi" : (iAmAdmin ? otherName : `Admin · ${otherName}`);
    return (
      <div className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 shadow ${
            mine
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          }`}
        >
          {/* entête : qui + heure */}
          <div className={`mb-1 text-[11px] ${mine ? "text-white/80" : "text-gray-600 dark:text-gray-300"}`}>
            {label} · {fmt(msg.created_at)}
          </div>
          {msg.subject && (
            <div className={`text-xs font-semibold ${mine ? "text-white" : "text-gray-800 dark:text-gray-100"} mb-1`}>
              {msg.subject}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ====== Colonne Conversations ====== */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="font-semibold">Conversations</div>
            {isAdmin && (
              <label className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={isBroadcast}
                  onChange={(e) => setIsBroadcast(e.target.checked)}
                />
                <span>Diffusion</span>
              </label>
            )}
          </div>

          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Rechercher un ${activeDisplay.toLowerCase()}…`}
            />
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
            {loadingConvs && (
              <div className="text-sm text-gray-500 dark:text-gray-400">Chargement…</div>
            )}
            {!loadingConvs && filteredConvs.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">Aucune conversation</div>
            )}
            {filteredConvs.map((c) => (
              <ConversationRow
                key={c.otherId}
                c={c}
                active={activeOtherId === c.otherId}
                onClick={() => {
                  setIsBroadcast(false); // sortir du mode diffusion si on sélectionne un contact
                  setActiveOtherId(c.otherId);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ====== Colonne Fil ====== */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col h-[78vh]">
          {/* En-tête du fil */}
          <div className="px-1 pb-3 border-b border-gray-200 dark:border-gray-700 mb-3 flex items-center justify-between">
            <div className="font-semibold">
              {isBroadcast
                ? "Diffusion globale"
                : (() => {
                    const c = convs.find((x) => x.otherId === activeOtherId);
                    return c ? `${activeDisplay}: ${c.name}` : "Conversation";
                  })()}
            </div>
            {!isBroadcast && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {thread.length} message{thread.length > 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Fil */}
          <div className="flex-1 overflow-y-auto px-1">
            {isBroadcast ? (
              <div className="mb-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                Mode <b>Diffusion</b> activé — le message sera envoyé à <b>tous les membres</b>.
              </div>
            ) : loadingThread ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Chargement du fil…</div>
            ) : thread.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Aucun message dans cette conversation.</div>
            ) : (
              thread.map((m) => {
                const other = convs.find((x) => x.otherId === activeOtherId);
                const otherName = other?.name || "";
                return (
                  <Bubble
                    key={m.id}
                    msg={m}
                    meId={me.id}
                    otherName={otherName}
                    iAmAdmin={isAdmin}
                  />
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="mt-3 grid grid-cols-1 gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isAdmin ? (isBroadcast ? "Sujet (diffusion globale)" : "Sujet") : "Sujet (visible par le staff)"}
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
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              {isAdmin && isBroadcast && (
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
              <div className="ml-auto">
                <button
                  onClick={onSend}
                  disabled={
                    sending ||
                    !subject.trim() ||
                    !body.trim() ||
                    (isAdmin && !isBroadcast && !activeOtherId)
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
    </div>
  );
}
