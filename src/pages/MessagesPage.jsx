// 📄 src/pages/MessagesPage.jsx — Conversations + Fil + Diffusion + Envoi à un groupe
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import {
  sendToAdmins,
  sendToMember,
  sendBroadcast, // RPC diffusion globale
  listMyThread,  // ✅ clé pour le fil membre↔staff
} from "../services/messagesService";
import * as MsgSvc from "../services/messagesService";

const ADMIN_SENTINEL = -1; // ✅ ID virtuel pour la conversation “Équipe BodyForce” côté membre

function fmt(dt) {
  const d = typeof dt === "string" ? parseISO(dt) : new Date(dt);
  return format(d, "dd/MM/yyyy HH:mm");
}
function initials(firstName, name) {
  const a = (firstName || "").trim().charAt(0);
  const b = (name || "").trim().charAt(0);
  return ((a + b) || "?").toUpperCase();
}

export default function MessagesPage() {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // ===== Conversations
  const [convs, setConvs] = useState([]); // {otherId, name, photo, lastBody, lastAt, unread}
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [filter, setFilter] = useState("");
  const [activeOtherId, setActiveOtherId] = useState(null);

  // ===== Fil
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const endRef = useRef(null);

  // ===== Composer
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // ===== Modes admin
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [excludeAuthor, setExcludeAuthor] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [membersAll, setMembersAll] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selFilter, setSelFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const filteredConvs = useMemo(() => {
    const q = (filter || "").toLowerCase();
    return (convs || []).filter((c) =>
      [c.name, c.lastBody].join(" ").toLowerCase().includes(q)
    );
  }, [convs, filter]);

  const filteredMembersAll = useMemo(() => {
    const q = (selFilter || "").toLowerCase();
    return (membersAll || []).filter((m) =>
      [m.firstName, m.name, m.email, m.badgeId].join(" ").toLowerCase().includes(q)
    );
  }, [membersAll, selFilter]);

  const scrollToEnd = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  // ========= Conversations builder =========
  async function fetchConversations() {
    if (!me?.id) return;
    setLoadingConvs(true);
    try {
      // 1) Inbox (je reçois)
      const { data: inbox, error: e1 } = await supabase
        .from("message_recipients")
        .select(`
          id, read_at, created_at,
          messages:message_id (id, subject, body, created_at, author_member_id)
        `)
        .eq("recipient_member_id", me.id);
      if (e1) throw e1;

      if (!isAdmin) {
        // ====== MODE MEMBRE ======
        // Une seule conversation “Équipe BodyForce” (ADMIN_SENTINEL)
        let conv = {
          otherId: ADMIN_SENTINEL,
          name: "Équipe BodyForce",
          photo: "",
          lastBody: "",
          lastAt: null,
          unread: 0,
        };

        // Maj avec ce que j’ai reçu (admins -> moi)
        (inbox || []).forEach((rec) => {
          const m = rec.messages;
          if (!m) return;
          if (!conv.lastAt || new Date(m.created_at) > new Date(conv.lastAt)) {
            conv.lastAt = m.created_at;
            conv.lastBody = m.body || m.subject || "";
          }
          if (!rec.read_at) conv.unread += 1;
        });

        // Maj avec ce que j’ai envoyé (moi -> admins), sans lire message_recipients (interdit par RLS)
        const { data: sent, error: e2 } = await supabase
          .from("messages")
          .select("id, subject, body, created_at")
          .eq("author_user_id", user.id);
        if (e2) throw e2;

        (sent || []).forEach((m) => {
          if (!conv.lastAt || new Date(m.created_at) > new Date(conv.lastAt)) {
            conv.lastAt = m.created_at;
            conv.lastBody = m.body || m.subject || "";
          }
        });

        const list = conv.lastAt ? [conv] : []; // rien si aucun échange
        setConvs(list);

        // Conversation active par défaut
        if (!activeOtherId) {
          setActiveOtherId(list[0]?.otherId ?? ADMIN_SENTINEL);
        }
        return;
      }

      // ====== MODE ADMIN ======
      // 2) J’ai écrit -> autre = destinataire (l’admin peut lire message_recipients)
      const { data: sent, error: e2 } = await supabase
        .from("messages")
        .select(`
          id, subject, body, created_at, author_member_id, author_user_id,
          recipients:message_recipients (recipient_member_id)
        `)
        .eq("author_user_id", user.id);
      if (e2) throw e2;

      const map = new Map();

      // Reçus (autre = auteur)
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
        if (!prev.lastAt || new Date(m.created_at) > new Date(prev.lastAt)) {
          prev.lastAt = m.created_at;
          prev.lastBody = m.body || m.subject || "";
        }
        if (!rec.read_at) prev.unread += 1;
        map.set(otherId, prev);
      });

      // Envoyés (autre = destinataire)
      (sent || []).forEach((m) => {
        (m.recipients || []).forEach((rcpt) => {
          const otherId = rcpt.recipient_member_id;
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
        return;
      }

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
          const name =
            `${m.firstName || ""} ${m.name || ""}`.trim() ||
            m.email ||
            `#${it.otherId}`;
          return {
            ...it,
            name,
            email: m.email || "",
            badgeId: m.badgeId || "",
            photo: m.photo || "",
            firstName: m.firstName || "",
            lastName: m.name || "",
          };
        })
        .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

      setConvs(withMeta);
      if (!activeOtherId) {
        setActiveOtherId(withMeta[0]?.otherId ?? null);
      }
    } finally {
      setLoadingConvs(false);
    }
  }

  // ========= Thread loader =========
  async function fetchThread(otherId) {
    if (!me?.id || otherId == null) {
      setThread([]);
      return;
    }
    setLoadingThread(true);

    try {
      if (!isAdmin && otherId === ADMIN_SENTINEL) {
        // ===== Fil unique membre ↔ staff (sans lire message_recipients des admins)
        const all = await listMyThread(me.id);
        // Normaliser pour les bulles (author_member_id = me.id pour mes messages)
        const mapped = (all || []).map((m) => ({
          kind: m.direction === "out" ? "out" : "in",
          id: m.id,
          message_id: m.message_id,
          subject: m.subject,
          body: m.body,
          created_at: m.created_at,
          author_member_id: m.direction === "out" ? me.id : m.author_member_id,
        }));
        setThread(mapped.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
        // Pas d’appel RPC “mark_conversation_read” côté membre (RPC absente chez toi)
        setConvs((prev) =>
          prev.map((c) =>
            c.otherId === ADMIN_SENTINEL ? { ...c, unread: 0 } : c
          )
        );
        scrollToEnd();
        return;
      }

      // ===== Admin : fil 1 ↔ 1 classique
      const { data: inbound, error: eIn } = await supabase
        .from("message_recipients")
        .select(`
          id, read_at, created_at,
          messages:message_id (id, subject, body, created_at, author_member_id)
        `)
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

      const { data: sent, error: eOut } = await supabase
        .from("messages")
        .select(`
          id, subject, body, created_at, author_member_id, author_user_id,
          recipients:message_recipients (recipient_member_id)
        `)
        .eq("author_user_id", user.id);
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
              author_member_id: m.author_member_id,
            });
          }
        });
      });

      const all = [...inboundFiltered, ...outboundFiltered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      setThread(all);

      // Marquer comme lu (si RPC dispo, côté admin seulement)
      try {
        if (typeof MsgSvc.markConversationRead === "function" && isAdmin) {
          await MsgSvc.markConversationRead(otherId);
          setConvs((prev) =>
            prev.map((c) => (c.otherId === otherId ? { ...c, unread: 0 } : c))
          );
        }
      } catch { /* noop */ }

      scrollToEnd();
    } finally {
      setLoadingThread(false);
    }
  }

  // ========= Members list (sélection admin)
  async function fetchAllMembers() {
    if (!isAdmin) return;
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id, firstName, name, email, badgeId, photo")
        .order("name", { ascending: true });
      if (!error) setMembersAll(data || []);
    } finally {
      setMembersLoading(false);
    }
  }

  // ========= Effects =========
  useEffect(() => {
    if (!user || !me?.id) return;
    fetchConversations();
  }, [user, me?.id, isAdmin]); // eslint-disable-line

  useEffect(() => {
    if (activeOtherId == null || selectMode || isBroadcast) return;
    fetchThread(activeOtherId);
  }, [activeOtherId, selectMode, isBroadcast]); // eslint-disable-line

  // ✅ Realtime pour TOUS (membre et admin) sur ma boîte de réception
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_inbox_${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_recipients", filter: `recipient_member_id=eq.${me.id}` },
        async () => {
          await fetchConversations();
          if (activeOtherId != null && !selectMode && !isBroadcast) {
            await fetchThread(activeOtherId);
          }
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
  }, [me?.id, activeOtherId, selectMode, isBroadcast]); // eslint-disable-line

  // ✅ Realtime sur mes envois (quand j’écris un message)
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_out_${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `author_user_id=eq.${user?.id || "00000000-0000-0000-0000-000000000000"}` },
        async () => {
          await fetchConversations();
          if (activeOtherId != null && !selectMode && !isBroadcast) {
            await fetchThread(activeOtherId);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id, user?.id, activeOtherId, selectMode, isBroadcast]); // eslint-disable-line

  // Charger la liste complète quand on passe en mode sélection (admin)
  useEffect(() => {
    if (isAdmin && selectMode) fetchAllMembers();
  }, [isAdmin, selectMode]);

  // ========= Sélection (admin)
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allChecked =
    filteredMembersAll.length > 0 &&
    filteredMembersAll.every((m) => selectedIds.has(m.id));
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) filteredMembersAll.forEach((m) => next.delete(m.id));
      else filteredMembersAll.forEach((m) => next.add(m.id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ========= Envoi
  const onSend = async () => {
    if (sending) return;
    if (!subject.trim() || !body.trim()) return;
    if (!me?.id) return;

    setSending(true);
    try {
      if (isAdmin) {
        if (isBroadcast) {
          await sendBroadcast({ subject, body, excludeAuthor });
        } else if (selectMode) {
          // 1 message + N destinataires
          const recips = Array.from(selectedIds);
          if (recips.length === 0) return;

          const { data: msg, error: e1 } = await supabase
            .from("messages")
            .insert({
              subject,
              body,
              author_user_id: user?.id || null,
              author_member_id: me.id,
              is_broadcast: false,
            })
            .select("id")
            .single();
          if (e1) throw e1;

          const rows = recips.map((rid) => ({
            message_id: msg.id,
            recipient_member_id: rid,
          }));
          const { error: e2 } = await supabase.from("message_recipients").insert(rows);
          if (e2) throw e2;

          clearSelection();
        } else {
          if (!activeOtherId || activeOtherId === ADMIN_SENTINEL) return;
          await sendToMember({
            toMemberId: activeOtherId,
            subject,
            body,
            authorMemberId: me.id,
          });
        }
      } else {
        // Membre → staff (tous les admins)
        await sendToAdmins({ subject, body, authorMemberId: me.id });
        // S’assurer que la conversation active est bien le staff
        setActiveOtherId(ADMIN_SENTINEL);
      }

      setSubject("");
      setBody("");

      await fetchConversations();
      if (activeOtherId != null && !selectMode && !isBroadcast) {
        await fetchThread(activeOtherId);
      }
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

  // ========= UI =========
  const ConversationRow = ({ c, active, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl transition flex items-center gap-3 ${
        active ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
      }`}
    >
      {c.otherId === ADMIN_SENTINEL ? (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
          BF
        </div>
      ) : c.photo ? (
        <img
          src={c.photo}
          alt={c.name}
          className="w-10 h-10 rounded-full object-cover border border-white dark:border-gray-700 shadow"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
          {initials(c.firstName, c.lastName) || c.name?.slice(0, 2)?.toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {c.otherId === ADMIN_SENTINEL ? "Équipe BodyForce" : c.name}
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
    const label = mine ? "Moi" : (iAmAdmin ? `Membre · ${otherName}` : `Admin · ${otherName}`);
    return (
      <div className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 shadow ${
            mine
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          }`}
        >
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
      {/* ====== Colonne Conversations / Sélection ====== */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="font-semibold">
              {selectMode ? "Sélection de membres" : "Conversations"}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3">
                <label className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={isBroadcast}
                    onChange={(e) => {
                      setIsBroadcast(e.target.checked);
                      if (e.target.checked) setSelectMode(false);
                    }}
                  />
                  <span>Diffusion</span>
                </label>
                <label className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={selectMode}
                    onChange={(e) => {
                      setSelectMode(e.target.checked);
                      if (e.target.checked) setIsBroadcast(false);
                    }}
                  />
                  <span>Sélection</span>
                </label>
              </div>
            )}
          </div>

          {/* Barre de recherche */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            {!selectMode ? (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Rechercher…`}
                disabled={isBroadcast}
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={selFilter}
                  onChange={(e) => setSelFilter(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher un membre…"
                />
                <button
                  onClick={() => {
                    const allChecked =
                      filteredMembersAll.length > 0 &&
                      filteredMembersAll.every((m) => selectedIds.has(m.id));
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (allChecked) {
                        filteredMembersAll.forEach((m) => next.delete(m.id));
                      } else {
                        filteredMembersAll.forEach((m) => next.add(m.id));
                      }
                      return next;
                    });
                  }}
                  className="px-2 py-2 rounded-lg text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Toggle
                </button>
              </div>
            )}
          </div>

          {/* Liste */}
          {!selectMode ? (
            <div className={`max-h-[70vh] overflow-y-auto p-3 space-y-2 ${isBroadcast ? "opacity-50 pointer-events-none select-none" : ""}`}>
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
                    setIsBroadcast(false);
                    setSelectMode(false);
                    setActiveOtherId(c.otherId);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
              {membersLoading && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Chargement…</div>
              )}
              {!membersLoading && filteredMembersAll.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Aucun membre</div>
              )}
              {!membersLoading &&
                filteredMembersAll.map((m) => {
                  const name = `${m.firstName || ""} ${m.name || ""}`.trim() || m.email || `#${m.id}`;
                  const checked = selectedIds.has(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                        checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={checked}
                        onChange={() => toggleSelect(m.id)}
                      />
                      {m.photo ? (
                        <img
                          src={m.photo}
                          alt={name}
                          className="w-8 h-8 rounded-full object-cover border border-white dark:border-gray-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[11px] font-semibold">
                          {initials(m.firstName, m.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {m.email || m.badgeId}
                        </div>
                      </div>
                    </label>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ====== Colonne Fil ====== */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col h-[78vh]">
          {/* En-tête */}
          <div className="px-1 pb-3 border-b border-gray-200 dark:border-gray-700 mb-3 flex items-center justify-between">
            <div className="font-semibold">
              {isBroadcast
                ? "Diffusion globale"
                : selectMode
                ? `Envoi à ${selectedIds.size} membre(s)`
                : activeOtherId === ADMIN_SENTINEL
                ? "Équipe BodyForce"
                : "Conversation"}
            </div>
            {!isBroadcast && !selectMode && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {thread.length} message{thread.length > 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Fil */}
          <div className="flex-1 overflow-y-auto px-1">
            {isBroadcast ? (
              <div className="mb-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                Mode <b>Diffusion</b> — le message sera envoyé à <b>tous les membres</b>.
              </div>
            ) : selectMode ? (
              <div className="mb-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Mode <b>Groupe</b> — sélectionnez un ou plusieurs membres dans la colonne de gauche.
              </div>
            ) : loadingThread ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Chargement du fil…</div>
            ) : thread.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Aucun message dans cette conversation.</div>
            ) : (
              thread.map((m) => {
                const otherName = activeOtherId === ADMIN_SENTINEL ? "Équipe BodyForce" : "";
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
              placeholder={
                isAdmin
                  ? isBroadcast
                    ? "Sujet (diffusion globale)"
                    : selectMode
                    ? "Sujet (groupe)"
                    : "Sujet"
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
                    : selectMode
                    ? "Votre message au groupe sélectionné…"
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
              <div className="ml-auto flex items-center gap-2">
                {isAdmin && selectMode && selectedIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Vider la sélection
                  </button>
                )}
                <button
                  onClick={onSend}
                  disabled={
                    sending ||
                    !subject.trim() ||
                    !body.trim() ||
                    (isAdmin &&
                      !isBroadcast &&
                      ((!selectMode && activeOtherId === null) ||
                        (selectMode && selectedIds.size === 0)))
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
