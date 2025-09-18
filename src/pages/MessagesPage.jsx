// 📄 src/pages/MessagesPage.jsx — Interface modernisée avec vraies données
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { 
  MessageCircle, 
  Search, 
  Send, 
  MoreVertical, 
  Users,
  Check,
  CheckCheck,
  Clock,
  X,
  Plus,
  ArrowLeft,
  Settings,
  Radio
} from "lucide-react";

import {
  sendToAdmins,
  sendToMember,
  sendBroadcast,
  listMyThread,
} from "../services/messagesService";
import * as MsgSvc from "../services/messagesService";

const ADMIN_SENTINEL = -1; // ID virtuel pour la conversation "Équipe BodyForce" côté membre

function fmt(dt) {
  const d = typeof dt === "string" ? parseISO(dt) : new Date(dt);
  return format(d, "dd/MM/yyyy HH:mm");
}

function initials(firstName, name) {
  const a = (firstName || "").trim().charAt(0);
  const b = (name || "").trim().charAt(0);
  return ((a + b) || "?").toUpperCase();
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 86400000) { // Less than 24 hours
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 604800000) { // Less than a week
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
}

export default function MessagesPage() {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ===== Conversations
  const [convs, setConvs] = useState([]);
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

  // ===== UI States
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  
  // ===== Présences en ligne
  const [onlineMembers, setOnlineMembers] = useState(new Set());

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

  // Responsive handling
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ========= Conversations builder =========
  async function fetchConversations() {
    if (!me?.id) return;
    setLoadingConvs(true);
    try {
      // Inbox via vue
      const { data: inboxData, error: eIn } = await supabase
        .from("v_inbox")
        .select("*")
        .order("created_at", { ascending: false });
      if (eIn) throw eIn;
      const inbox = inboxData || [];

      // Outbox:
      let outbox = [];
      if (!isAdmin) {
        const { data: outboxData, error: eOut } = await supabase
          .from("v_outbox")
          .select("*")
          .order("created_at", { ascending: false });
        if (eOut) throw eOut;
        outbox = outboxData || [];
      }

      // ===== MODE MEMBRE : fil unique Équipe BodyForce
      if (!isAdmin) {
        let conv = {
          otherId: ADMIN_SENTINEL,
          name: "Équipe BodyForce",
          photo: "",
          lastBody: "",
          lastAt: null,
          unread: 0,
          isStaff: true,
        };

        (inbox || []).forEach((m) => {
          if (!conv.lastAt || new Date(m.created_at) > new Date(conv.lastAt)) {
            conv.lastAt = m.created_at;
            conv.lastBody = m.body || m.subject || "";
          }
          if (!m.read_at) conv.unread += 1;
        });

        (outbox || []).forEach((m) => {
          if (!conv.lastAt || new Date(m.created_at) > new Date(conv.lastAt)) {
            conv.lastAt = m.created_at;
            conv.lastBody = m.body || m.subject || "";
          }
        });

        const list = conv.lastAt ? [conv] : [];
        setConvs(list);
        if (!activeOtherId) {
          setActiveOtherId(list[0]?.otherId ?? ADMIN_SENTINEL);
        }
        return;
      }

      // ===== MODE ADMIN : multi conversations
      const map = new Map();

      // reçus: autre = auteur
      (inbox || []).forEach((m) => {
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
        if (!m.read_at) prev.unread += 1;
        map.set(otherId, prev);
      });

      // envoyés: autre = destinataire
      const { data: sent, error: e2 } = await supabase
        .from("messages")
        .select(`
          id, subject, body, created_at, author_member_id, author_user_id,
          message_recipients:message_recipients (recipient_member_id)
        `)
        .eq("author_user_id", user.id);
      if (e2) throw e2;

      (sent || []).forEach((m) => {
        (m.message_recipients || []).forEach((rid) => {
          const otherId = rid.recipient_member_id;
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
      if (items.length === 0) {
        setConvs([]);
        return;
      }

      const otherIds = items.map((x) => x.otherId);
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
        // Fil unique membre ↔ staff
        const all = await listMyThread(me.id);
        const mapped = (all || []).map((m) => ({
          kind: m.direction === "out" ? "out" : "in",
          id: m.id,
          message_id: m.message_id,
          subject: m.subject,
          body: m.body,
          created_at: m.created_at,
          author_member_id: m.direction === "out" ? me.id : m.author_member_id,
        }));
        setThread(
          mapped.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        );
        setConvs((prev) =>
          prev.map((c) =>
            c.otherId === ADMIN_SENTINEL ? { ...c, unread: 0 } : c
          )
        );
        scrollToEnd();
        return;
      }

      // Inbound
      const { data: inboxData, error: eIn } = await supabase
        .from("v_inbox")
        .select("*")
        .eq("recipient_member_id", me.id)
        .order("created_at", { ascending: true });
      if (eIn) throw eIn;

      const inboundFiltered = (inboxData || [])
        .filter((m) => m.author_member_id === otherId)
        .map((m) => ({
          kind: "in",
          id: `in_${m.message_id}`,
          message_id: m.message_id,
          subject: m.subject,
          body: m.body,
          created_at: m.created_at,
          author_member_id: m.author_member_id,
        }));

      // Outbound
      const { data: sent2, error: eOut } = await supabase
        .from("messages")
        .select(`
          id, subject, body, created_at, author_member_id, author_user_id,
          message_recipients:message_recipients (recipient_member_id)
        `)
        .eq("author_user_id", user.id)
        .order("created_at", { ascending: true });
      if (eOut) throw eOut;

      const outboundFiltered = [];
      (sent2 || []).forEach((m) => {
        (m.message_recipients || []).forEach((rcpt) => {
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

      // Marquer comme lu si RPC dispo
      try {
        if (typeof MsgSvc.markConversationRead === "function" && isAdmin) {
          await MsgSvc.markConversationRead(otherId);
          setConvs((prev) =>
            prev.map((c) => (c.otherId === otherId ? { ...c, unread: 0 } : c))
          );
        }
      } catch {
        /* noop */
      }

      scrollToEnd();
    } finally {
      setLoadingThread(false);
    }
  }

  // ========= Présences loader =========
  async function checkMemberPresence() {
    try {
      // Considérer qu'un membre est en ligne s'il a eu une présence dans les 5 dernières minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const { data: recentPresences, error } = await supabase
        .from("presences")
        .select("badgeId")
        .gte("timestamp", fiveMinutesAgo.toISOString());
      
      if (error) {
        console.error("Erreur lors de la vérification des présences:", error);
        return;
      }

      // Récupérer les IDs des membres correspondant aux badges actifs
      if (recentPresences && recentPresences.length > 0) {
        const badgeIds = recentPresences.map(p => p.badgeId);
        
        const { data: onlineMembers, error: membersError } = await supabase
          .from("members")
          .select("id")
          .in("badgeId", badgeIds);
          
        if (!membersError && onlineMembers) {
          const onlineMemberIds = new Set(onlineMembers.map(m => m.id));
          setOnlineMembers(onlineMemberIds);
        }
      } else {
        setOnlineMembers(new Set());
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des présences:", error);
      setOnlineMembers(new Set());
    }
  }

  // Fonction helper pour vérifier si un membre est en ligne
  const isMemberOnline = (memberId) => {
    if (memberId === ADMIN_SENTINEL) return true; // Staff toujours "en ligne"
    return onlineMembers.has(memberId);
  };
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
    checkMemberPresence(); // Charger les présences initiales
  }, [user, me?.id, isAdmin]);

  useEffect(() => {
    if (activeOtherId == null || selectMode || isBroadcast) return;
    fetchThread(activeOtherId);
  }, [activeOtherId, selectMode, isBroadcast]);

  // Realtime Inbox
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_inbox_${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_recipients",
          filter: `recipient_member_id=eq.${me.id}`,
        },
        async () => {
          await fetchConversations();
          if (activeOtherId != null && !selectMode && !isBroadcast) {
            await fetchThread(activeOtherId);
          }
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
          await fetchConversations();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id, activeOtherId, selectMode, isBroadcast]);

  // Realtime Outbox
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`msg_out_${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `author_user_id=eq.${user?.id || "00000000-0000-0000-0000-000000000000"}`,
        },
        async () => {
          await fetchConversations();
          if (activeOtherId != null && !selectMode && !isBroadcast) {
            await fetchThread(activeOtherId);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me?.id, user?.id, activeOtherId, selectMode, isBroadcast]);

  // Vérification périodique des présences (toutes les 2 minutes)
  useEffect(() => {
    if (!user || !me?.id) return;
    
    const interval = setInterval(checkMemberPresence, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(interval);
  }, [user, me?.id]);

  useEffect(() => {
    if (isAdmin && (selectMode || showMemberSelector)) fetchAllMembers();
  }, [isAdmin, selectMode, showMemberSelector]);

  // ========= Handlers =========
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

  // ========= Envoi =========
  const onSend = async () => {
    if (sending) return;
    
    // ✅ CORRECTION 1: Validation améliorée
    if (!body.trim()) return; // Message requis
    if ((isBroadcast || showBroadcastModal) && !subject.trim()) return; // Sujet requis seulement pour diffusion
    
    if (!me?.id) return;

    setSending(true);
    try {
      if (isAdmin) {
        if (isBroadcast || showBroadcastModal) {
          await sendBroadcast({ subject, body, excludeAuthor });
          setShowBroadcastModal(false);
        } else if (selectMode) {
          const recips = Array.from(selectedIds);
          if (recips.length === 0) return;

          const { error } = await supabase.rpc("send_message", {
            p_author_member_id: me.id,
            p_subject: subject.trim() || "Message", // Sujet par défaut si vide
            p_body: body.trim(),
            p_recipient_member_ids: recips,
            p_is_broadcast: false,
          });
          if (error) throw error;
          clearSelection();
        } else {
          if (!activeOtherId || activeOtherId === ADMIN_SENTINEL) return;
          const { error } = await supabase.rpc("send_message", {
            p_author_member_id: me.id,
            p_subject: subject.trim() || "Message", // Sujet par défaut si vide
            p_body: body.trim(),
            p_recipient_member_ids: [activeOtherId],
            p_is_broadcast: false,
          });
          if (error) throw error;
        }
      } else {
        await sendToAdmins({ 
          subject: subject.trim() || "Message au staff", // Sujet par défaut
          body: body.trim(), 
          authorMemberId: me.id 
        });
        setActiveOtherId(ADMIN_SENTINEL);
      }

      setSubject("");
      setBody("");
      setIsBroadcast(false);

      await fetchConversations();
      if (activeOtherId != null && !selectMode && !isBroadcast) {
        await fetchThread(activeOtherId);
      }
      scrollToEnd();
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error);
      // Optionnel: afficher un toast d'erreur
    } finally {
      setSending(false);
    }
  };

  if (!user || !me?.id) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Accès requis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connectez-vous pour accéder aux messages.
          </p>
        </div>
      </div>
    );
  }

  // ===== Components =====
  
  const Avatar = ({ user, size = "w-10 h-10", showOnline = false }) => {
    const sizeClasses = {
      "w-6 h-6": "text-xs",
      "w-8 h-8": "text-xs", 
      "w-10 h-10": "text-sm",
      "w-12 h-12": "text-base",
    };

    if (user.otherId === ADMIN_SENTINEL || user.isStaff) {
      return (
        <div className={`${size} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold ${sizeClasses[size]} shadow border-2 border-white dark:border-gray-800 relative`}>
          BF
          {showOnline && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
          )}
        </div>
      );
    }

    if (user.photo) {
      return (
        <div className="relative">
          <img
            src={user.photo}
            alt={user.name}
            className={`${size} rounded-full object-cover border-2 border-white dark:border-gray-800 shadow`}
          />
          {showOnline && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
          )}
        </div>
      );
    }

    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold ${sizeClasses[size]} shadow border-2 border-white dark:border-gray-800 relative`}>
        {initials(user.firstName, user.lastName) || user.name?.slice(0, 2)?.toUpperCase() || "?"}
        {showOnline && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
        )}
      </div>
    );
  };

  const ConversationRow = ({ c, active, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 transition-all duration-200 flex items-center gap-3 ${
        active
          ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-r-4 border-blue-500"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <Avatar user={c} showOnline={isMemberOnline(c.otherId)} />
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className={`font-semibold truncate ${
            active ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"
          }`}>
            {c.otherId === ADMIN_SENTINEL ? "Équipe BodyForce" : c.name}
          </div>
          <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {c.lastAt ? formatTime(c.lastAt) : ""}
            {c.unread > 0 && (
              <span className="inline-flex items-center justify-center text-xs min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-600 text-white font-bold animate-pulse">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {c.lastBody || "Aucun message"}
        </div>
      </div>
    </button>
  );

  const MessageBubble = ({ msg, meId, otherName, iAmAdmin }) => {
    const mine = msg.author_member_id === meId;
    const label = mine ? "Moi" : iAmAdmin ? `Membre · ${otherName}` : "Staff";
    return (
      <div className={`mb-4 flex ${mine ? "justify-end" : "justify-start"}`}>
        {!mine && (
          <Avatar 
            user={{ 
              firstName: otherName.split(" ")[0],
              lastName: otherName.split(" ")[1],
              isStaff: !iAmAdmin
            }} 
            size="w-8 h-8" 
          />
        )}
        <div className={`max-w-[75%] mx-3 ${mine ? "order-1" : "order-2"}`}>
          <div className={`rounded-2xl px-4 py-3 shadow-sm ${
            mine
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600"
          }`}>
            <div className={`mb-1 text-xs ${
              mine ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
            }`}>
              {label} · {formatTime(msg.created_at)}
            </div>
            {msg.subject && (
              <div className={`text-sm font-semibold mb-2 ${
                mine ? "text-blue-100" : "text-gray-800 dark:text-gray-100"
              }`}>
                {msg.subject}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.body}
            </div>
            {mine && (
              <div className="flex justify-end mt-1">
                <CheckCheck className="w-4 h-4 text-blue-200" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ===== Mobile View =====
  if (isMobile) {
    // Mobile conversation view
    if (activeOtherId !== null) {
      const activeConv = convs.find(c => c.otherId === activeOtherId);
      
      return (
        <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
          {/* Mobile Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveOtherId(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {activeConv && <Avatar user={activeConv} size="w-10 h-10" />}
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {activeConv?.otherId === ADMIN_SENTINEL ? "Équipe BodyForce" : activeConv?.name}
                </h2>
                <p className="text-sm text-green-500 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  En ligne
                </p>
              </div>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-blue-50/20 to-purple-50/20 dark:from-blue-900/5 dark:to-purple-900/5">
            {loadingThread ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : thread.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">Aucun message</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Commencez la conversation !</p>
              </div>
            ) : (
              thread.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  meId={me.id}
                  otherName={activeConv?.name || "Utilisateur"}
                  iAmAdmin={isAdmin}
                />
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Mobile Input */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            {subject && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full mb-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sujet..."
              />
            )}
            <div className="flex items-end space-x-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tapez votre message..."
                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
              />
              <button
                onClick={onSend}
                disabled={!body.trim() || sending}
                className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {sending ? (
                  <div className="w-5 h-5 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Mobile conversation list
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <MessageCircle className="w-6 h-6" />
              <h1 className="text-xl font-bold">Messages</h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowMemberSelector(true)}
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            />
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-gray-800 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500 dark:text-gray-400">Chargement...</p>
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune conversation</p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationRow
                key={conv.otherId}
                c={conv}
                active={false}
                onClick={() => setActiveOtherId(conv.otherId)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // ===== Desktop View =====
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between text-white mb-4">
            <div className="flex items-center space-x-3">
              <MessageCircle className="w-6 h-6" />
              <h1 className="text-xl font-bold">Messages</h1>
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    isBroadcast ? "bg-white/30" : "bg-white/10 hover:bg-white/20"
                  }`}
                  title="Mode diffusion"
                >
                  <Radio className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Nouveau message"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500 dark:text-gray-400">Chargement...</p>
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune conversation trouvée</p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationRow
                key={conv.otherId}
                c={conv}
                active={activeOtherId === conv.otherId}
                onClick={() => setActiveOtherId(conv.otherId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeOtherId !== null ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {(() => {
                    const activeConv = convs.find(c => c.otherId === activeOtherId);
                    return (
                      <>
                        {activeConv && <Avatar user={activeConv} size="w-12 h-12" showOnline={isMemberOnline(activeConv.otherId)} />}
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {activeConv?.otherId === ADMIN_SENTINEL ? "Équipe BodyForce" : activeConv?.name}
                          </h2>
                          <p className="text-sm flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              isMemberOnline(activeConv?.otherId) 
                                ? "bg-green-500 animate-pulse" 
                                : "bg-gray-400"
                            }`}></div>
                            {isMemberOnline(activeConv?.otherId) ? "En ligne" : "Hors ligne"}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <Search className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-blue-50/30 to-purple-50/30 dark:from-blue-900/10 dark:to-purple-900/10">
              {loadingThread ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : thread.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Aucun message
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Commencez une conversation en envoyant un message !
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {thread.map((msg) => {
                    const activeConv = convs.find(c => c.otherId === activeOtherId);
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        meId={me.id}
                        otherName={activeConv?.name || "Utilisateur"}
                        iAmAdmin={isAdmin}
                      />
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 shadow-lg">
              <div className="space-y-3">
                {(subject || !thread.length) && (
                  <input
                    type="text"
                    placeholder="Sujet du message..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                )}
                <div className="flex items-end space-x-3">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 transition-all"
                    rows={1}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                  <button
                    onClick={onSend}
                    disabled={!body.trim() || sending}
                    className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {sending ? (
                      <div className="w-5 h-5 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                <MessageCircle className="w-12 h-12 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Sélectionnez une conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                Choisissez une conversation existante ou créez-en une nouvelle pour commencer à échanger.
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <Plus className="w-5 h-5 inline mr-2" />
                  Nouveau message
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Member Selector Modal */}
      {showMemberSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Nouveau message</h3>
                <button
                  onClick={() => setShowMemberSelector(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un membre..."
                  value={selFilter}
                  onChange={(e) => setSelFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {membersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Chargement...
                </div>
              ) : filteredMembersAll.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucun membre trouvé
                </div>
              ) : (
                filteredMembersAll.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setActiveOtherId(member.id);
                      setShowMemberSelector(false);
                    }}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center space-x-3"
                  >
                    <Avatar user={member} size="w-10 h-10" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {member.firstName} {member.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.email}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Message de diffusion</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer un message à tous les membres
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBroadcastModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
                  <Radio className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Ce message sera envoyé à tous les membres de BodyForce
                  </span>
                </div>
              </div>

              <input
                type="text"
                placeholder="Sujet du message..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Votre message à tous les membres..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={excludeAuthor}
                    onChange={(e) => setExcludeAuthor(e.target.checked)}
                  />
                  <span>Ne pas m'envoyer une copie</span>
                </label>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowBroadcastModal(false);
                      setSubject("");
                      setBody("");
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setIsBroadcast(true);
                      onSend();
                    }}
                    disabled={!body.trim() || !subject.trim() || sending}
                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {sending ? (
                      <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full inline mr-2"></div>
                    ) : (
                      <Radio className="w-4 h-4 inline mr-2" />
                    )}
                    Diffuser
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}