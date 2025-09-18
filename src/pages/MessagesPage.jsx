// 📄 src/pages/MessagesPage.jsx — Interface modernisée avec vraies données Supabase
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Send,
  Search,
  Users,
  Radio,
  UserPlus,
  MessageCircle,
  Clock,
  CheckCheck,
  X,
  ChevronLeft,
  Settings,
  Phone,
  Video,
  MoreVertical,
  Plus,
  Image,
  Paperclip,
  ArrowLeft,
} from "lucide-react";

// Services existants
import * as MsgSvc from "../services/messagesService";

const ADMIN_SENTINEL = -1;

// Avatar Component amélioré
const Avatar = ({
  member,
  size = "md",
  showOnline = false,
  className = "",
}) => {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const id = member?.id ?? member?.otherId ?? null;
  const isStaff = id === ADMIN_SENTINEL || !id;

  if (member?.photo && !isStaff) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={member.photo}
          alt="Avatar"
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm`}
        />
        {showOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
        )}
      </div>
    );
  }

  const initials = isStaff
    ? "BF"
    : `${member?.firstName?.[0] || member?.otherFirstName?.[0] || "?"}${
        member?.name?.[0] || member?.otherName?.[0] || "?"
      }`;

  const bgColor = isStaff
    ? "bg-gradient-to-br from-blue-600 to-purple-600"
    : "bg-gradient-to-br from-slate-500 to-slate-600";

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${sizes[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white dark:ring-gray-800 shadow-sm`}
      >
        {initials}
      </div>
      {showOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-800 animate-pulse" />
      )}
    </div>
  );
};

// Formatage intelligent du temps style Messenger
const formatMessageTime = (dateString) => {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: fr });
    }
    if (isYesterday(date)) {
      return "Hier";
    }
    const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) {
      return format(date, "EEEE", { locale: fr });
    }
    return format(date, "dd/MM", { locale: fr });
  } catch {
    return "";
  }
};

const formatChatTime = (dateString) => {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: fr });
    }
    if (isYesterday(date)) {
      return `Hier ${format(date, "HH:mm", { locale: fr })}`;
    }
    return format(date, "dd/MM/yyyy HH:mm", { locale: fr });
  } catch {
    return "";
  }
};

// Badge de statut en ligne
const OnlineIndicator = ({ isOnline }) => (
  <div
    className={`w-2 h-2 rounded-full ${
      isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
    }`}
  />
);

// Fonctions améliorées pour récupérer les vraies conversations avec derniers messages
const getEnhancedAdminConversations = async (adminMemberId) => {
  try {
    // 1. Récupérer tous les membres sauf l'admin
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, firstName, name, photo")
      .neq("id", adminMemberId)
      .order("name", { ascending: true });

    if (membersError) throw membersError;

    const conversations = [];

    // 2. Pour chaque membre, récupérer le dernier message et compter les non-lus
    for (const member of members || []) {
      // Dernier message reçu par ce membre
      const { data: lastReceived } = await supabase
        .from("message_recipients")
        .select(
          `
          created_at,
          messages:message_id (subject, body, created_at, author_member_id)
        `
        )
        .eq("recipient_member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Dernier message envoyé par ce membre
      const { data: lastSent } = await supabase
        .from("messages")
        .select("subject, body, created_at, author_member_id")
        .eq("author_member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Prendre le plus récent des deux
      let lastMessage = null;
      let lastMessageDate = null;

      if (lastReceived?.messages && lastSent) {
        const receivedDate = new Date(lastReceived.messages.created_at);
        const sentDate = new Date(lastSent.created_at);
        lastMessage =
          receivedDate > sentDate ? lastReceived.messages : lastSent;
        lastMessageDate = receivedDate > sentDate ? receivedDate : sentDate;
      } else if (lastReceived?.messages) {
        lastMessage = lastReceived.messages;
        lastMessageDate = new Date(lastReceived.messages.created_at);
      } else if (lastSent) {
        lastMessage = lastSent;
        lastMessageDate = new Date(lastSent.created_at);
      }

      // Compter les messages non lus pour ce membre
      const { count: unreadCount } = await supabase
        .from("message_recipients")
        .select("*", { count: "exact", head: true })
        .eq("recipient_member_id", member.id)
        .is("read_at", null);

      conversations.push({
        otherId: member.id,
        otherFirstName: member.firstName || "",
        otherName: member.name || "",
        photo: member.photo || null,
        lastMessagePreview: lastMessage
          ? lastMessage.body?.substring(0, 100) +
            (lastMessage.body?.length > 100 ? "..." : "")
          : "",
        lastMessageDate: lastMessageDate?.toISOString() || null,
        unread: unreadCount || 0,
      });
    }

    // Trier par dernière activité
    conversations.sort((a, b) => {
      if (!a.lastMessageDate && !b.lastMessageDate) return 0;
      if (!a.lastMessageDate) return 1;
      if (!b.lastMessageDate) return -1;
      return new Date(b.lastMessageDate) - new Date(a.lastMessageDate);
    });

    // Ajouter le fil staff en premier
    conversations.unshift({
      otherId: ADMIN_SENTINEL,
      otherFirstName: "Équipe",
      otherName: "BodyForce",
      photo: null,
      lastMessagePreview: "Messages de l'équipe",
      lastMessageDate: null,
      unread: 0,
    });

    return conversations;
  } catch (error) {
    console.error("Erreur getEnhancedAdminConversations:", error);
    return [];
  }
};

const getEnhancedMemberConversations = async (memberId) => {
  try {
    // Pour un membre, récupérer le fil avec l'équipe
    const { data: lastMessage } = await supabase
      .from("message_recipients")
      .select(
        `
        created_at,
        messages:message_id (subject, body, created_at)
      `
      )
      .eq("recipient_member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Compter les non-lus
    const { count: unreadCount } = await supabase
      .from("message_recipients")
      .select("*", { count: "exact", head: true })
      .eq("recipient_member_id", memberId)
      .is("read_at", null);

    return [
      {
        otherId: ADMIN_SENTINEL,
        otherFirstName: "Équipe",
        otherName: "BodyForce",
        photo: null,
        lastMessagePreview: lastMessage?.messages
          ? lastMessage.messages.body?.substring(0, 100) +
            (lastMessage.messages.body?.length > 100 ? "..." : "")
          : "Contactez l'équipe BodyForce",
        lastMessageDate: lastMessage?.messages?.created_at || null,
        unread: unreadCount || 0,
      },
    ];
  } catch (error) {
    console.error("Erreur getEnhancedMemberConversations:", error);
    return [
      {
        otherId: ADMIN_SENTINEL,
        otherFirstName: "Équipe",
        otherName: "BodyForce",
        photo: null,
        lastMessagePreview: "Contactez l'équipe BodyForce",
        lastMessageDate: null,
        unread: 0,
      },
    ];
  }
};

// Composant principal
export default function MessagesPage() {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // États principaux
  const [convs, setConvs] = useState([]);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  // UI states
  const [activeOtherId, setActiveOtherId] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Admin states
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [excludeAuthor, setExcludeAuthor] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  // Présences
  const [onlineMembers, setOnlineMembers] = useState(new Set());

  const endRef = useRef();
  const messagesContainerRef = useRef();
  const activeOtherIdRef = useRef(null);

  useEffect(() => {
    activeOtherIdRef.current = activeOtherId;
  }, [activeOtherId]);

  // Vérifier les présences (membres "en ligne" = présence dans les 5 dernières minutes)
  const checkMemberPresence = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const { data: recentPresences } = await supabase
        .from("presences")
        .select("badgeId")
        .gte("timestamp", fiveMinutesAgo.toISOString());

      if (recentPresences) {
        const { data: members } = await supabase
          .from("members")
          .select("id, badgeId")
          .in(
            "badgeId",
            recentPresences.map((p) => p.badgeId)
          );

        const onlineSet = new Set();
        members?.forEach((member) => onlineSet.add(member.id));
        setOnlineMembers(onlineSet);
      }
    } catch (error) {
      console.error("Erreur vérification présences:", error);
    }
  };

  const isMemberOnline = (memberId) => {
    if (memberId === ADMIN_SENTINEL) return true;
    return onlineMembers.has(memberId);
  };

  // ========= Services & Fetchers =========
  const {
    sendToAdmins,
    sendBroadcast,
    listMyThread,
    listThreadWithMember,
    subscribeInbox,
    markConversationRead,
  } = MsgSvc;

  const fetchConversations = async () => {
    if (!me?.id) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const adminData = await getEnhancedAdminConversations(me.id);
        setConvs(adminData || []);
      } else {
        const memberData = await getEnhancedMemberConversations(me.id);
        setConvs(memberData || []);
      }
    } catch (error) {
      console.error("Erreur fetchConversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchThread = async (otherId) => {
    if (!me?.id) return;
    setLoadingThread(true);
    try {
      let data = [];
      if (isAdmin) {
        if (otherId !== ADMIN_SENTINEL) {
          data = await listThreadWithMember(otherId);
        }
      } else {
        data = await listMyThread(me.id);
      }
      setThread(data || []);

      // Marquer comme lu
      try {
        if (
          typeof markConversationRead === "function" &&
          isAdmin &&
          otherId !== ADMIN_SENTINEL
        ) {
          await markConversationRead(otherId);
          setConvs((prev) =>
            prev.map((c) => (c.otherId === otherId ? { ...c, unread: 0 } : c))
          );
        }
      } catch {
        /* noop */
      }
    } catch (error) {
      console.error("Erreur fetchThread:", error);
    } finally {
      setLoadingThread(false);
    }
  };

  const scrollToEnd = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // ========= Envoi =========
  const onSend = async () => {
    if (sending) return;
    if (!body.trim()) return;
    if ((isBroadcast || showBroadcastModal) && !subject.trim()) return;
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
            p_subject: subject.trim() || "Message",
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
            p_subject: subject.trim() || "Message",
            p_body: body.trim(),
            p_recipient_member_ids: [activeOtherId],
            p_is_broadcast: false,
          });
          if (error) throw error;
        }
      } else {
        await sendToAdmins({
          subject: subject.trim() || "Message au staff",
          body: body.trim(),
          authorMemberId: me.id,
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
    } finally {
      setSending(false);
    }
  };

  // ========= Sélection multiple =========
  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) newSelected.delete(memberId);
    else newSelected.add(memberId);
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowMemberSelector(false);
  };

  // ========= Conversations filtrées =========
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return convs;
    const term = searchTerm.toLowerCase();
    return convs.filter((conv) => {
      const name = `${conv.otherFirstName || ""} ${
        conv.otherName || ""
      }`.toLowerCase();
      return name.includes(term);
    });
  }, [convs, searchTerm]);

  // ========= Realtime =========
  useEffect(() => {
    if (!me?.id) return;

    const sub = subscribeInbox(me.id, () => {
      fetchConversations();
      const current = activeOtherIdRef.current;
      if (current != null) fetchThread(current);
    });

    return () => {
      try {
        sub?.unsubscribe?.();
      } catch {}
    };
  }, [me?.id]);

  // ========= Effets =========
  useEffect(() => {
    if (me?.id) {
      fetchConversations();
      checkMemberPresence();
      const presenceInterval = setInterval(checkMemberPresence, 2 * 60 * 1000);
      return () => clearInterval(presenceInterval);
    }
  }, [me?.id, isAdmin]);

  useEffect(() => {
    if (activeOtherId != null) fetchThread(activeOtherId);
  }, [activeOtherId]);

  useEffect(() => scrollToEnd(), [thread]);

  // Détection mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Chargement des conversations...
          </p>
        </div>
      </div>
    );
  }

  // ========= Render Mobile =========
  if (isMobile) {
    if (showMobileChat && activeOtherId !== null) {
      const activeConv = convs.find((c) => c.otherId === activeOtherId);

      return (
        <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
          {/* Header Mobile */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
            <button
              onClick={() => setShowMobileChat(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <Avatar
              member={
                activeConv?.otherId === ADMIN_SENTINEL
                  ? { id: ADMIN_SENTINEL }
                  : activeConv
              }
              size="md"
              showOnline={isMemberOnline(activeConv?.otherId)}
            />

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {activeConv?.otherId === ADMIN_SENTINEL
                  ? "Équipe BodyForce"
                  : `${activeConv?.otherFirstName || ""} ${
                      activeConv?.otherName || ""
                    }`}
              </h3>
              <div className="flex items-center gap-1">
                <OnlineIndicator
                  isOnline={isMemberOnline(activeConv?.otherId)}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isMemberOnline(activeConv?.otherId)
                    ? "En ligne"
                    : "Hors ligne"}
                </span>
              </div>
            </div>

            <div className="flex gap-1">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <Video className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-2"
          >
            {loadingThread ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : thread.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">Aucun message</p>
              </div>
            ) : (
              <div className="space-y-3">
                {thread.map((msg, idx) => {
                  const isOwn = msg.authorUserId === user?.id;
                  const showAvatar =
                    !isOwn &&
                    (idx === 0 ||
                      thread[idx - 1]?.authorUserId !== msg.authorUserId);

                  return (
                    <div
                      key={idx}
                      className={`flex ${
                        isOwn ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex ${
                          isOwn ? "flex-row-reverse" : "flex-row"
                        } items-end gap-2 max-w-[85%]`}
                      >
                        {showAvatar && !isOwn && (
                          <Avatar
                            member={{
                              firstName: msg.authorFirstName,
                              name: msg.authorName,
                            }}
                            size="sm"
                          />
                        )}
                        {!showAvatar && !isOwn && <div className="w-8" />}

                        <div className="flex flex-col">
                          <div
                            className={`rounded-2xl px-4 py-2 max-w-full ${
                              isOwn
                                ? "bg-blue-500 text-white rounded-br-md"
                                : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-bl-md"
                            }`}
                          >
                            {msg.subject &&
                              msg.subject !== "Message" &&
                              msg.subject !== "Message au staff" && (
                                <div
                                  className={`text-sm font-medium mb-1 ${
                                    isOwn
                                      ? "text-blue-100"
                                      : "text-gray-600 dark:text-gray-400"
                                  }`}
                                >
                                  {msg.subject}
                                </div>
                              )}
                            <div
                              className={`text-sm break-words ${
                                isOwn
                                  ? "text-white"
                                  : "text-gray-900 dark:text-gray-100"
                              }`}
                            >
                              {msg.body}
                            </div>
                          </div>
                          <div
                            className={`text-xs text-gray-500 mt-1 px-2 ${
                              isOwn ? "text-right" : "text-left"
                            }`}
                          >
                            {formatChatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Input Mobile */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message..."
                  className="w-full max-h-20 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  rows={1}
                  style={{ minHeight: "48px" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
              </div>
              <button
                onClick={onSend}
                disabled={sending || !body.trim()}
                className="w-12 h-12 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Liste mobile
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Messages
            </h1>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <Radio className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.otherId}
              onClick={() => {
                setActiveOtherId(conv.otherId);
                setShowMobileChat(true);
              }}
              className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  member={
                    conv.otherId === ADMIN_SENTINEL
                      ? { id: ADMIN_SENTINEL }
                      : conv
                  }
                  size="md"
                  showOnline={isMemberOnline(conv.otherId)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {conv.otherId === ADMIN_SENTINEL
                        ? "Équipe BodyForce"
                        : `${conv.otherFirstName || ""} ${
                            conv.otherName || ""
                          }`}
                    </h4>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatMessageTime(conv.lastMessageDate)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {conv.lastMessagePreview || "Aucun message"}
                    </p>
                    {conv.unread > 0 && (
                      <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium ml-2 flex-shrink-0">
                        {conv.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===== Desktop View =====
  return (
    <div className="h-full flex bg-white dark:bg-gray-900">
      {/* Sidebar - Largeur fixe optimale */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Messages
            </h2>
            {isAdmin && (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Diffusion générale"
                >
                  <Radio className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Nouveau groupe"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Liste des conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-500">Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.otherId}
                onClick={() => setActiveOtherId(conv.otherId)}
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                  activeOtherId === conv.otherId
                    ? "bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    member={
                      conv.otherId === ADMIN_SENTINEL
                        ? { id: ADMIN_SENTINEL }
                        : conv
                    }
                    size="md"
                    showOnline={isMemberOnline(conv.otherId)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.otherId === ADMIN_SENTINEL
                          ? "Équipe BodyForce"
                          : `${conv.otherFirstName || ""} ${
                              conv.otherName || ""
                            }`}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {formatMessageTime(conv.lastMessageDate)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conv.lastMessagePreview || "Aucun message"}
                      </p>

                      {conv.unread > 0 && (
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium ml-2 flex-shrink-0">
                          {conv.unread > 99 ? "99+" : conv.unread}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Zone principale - Reste de l'écran */}
      <div className="flex-1 flex flex-col">
        {activeOtherId === null ? (
          // Écran d'accueil
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Messagerie BodyForce
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isAdmin
                  ? "Sélectionnez une conversation pour commencer à échanger avec un membre"
                  : "Contactez l'équipe BodyForce pour toute question ou information"}
              </p>
            </div>
          </div>
        ) : (
          // Zone de chat active
          <>
            {/* Header du chat */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar
                    member={
                      activeOtherId === ADMIN_SENTINEL
                        ? { id: ADMIN_SENTINEL }
                        : filteredConversations.find(
                            (c) => c.otherId === activeOtherId
                          )
                    }
                    size="lg"
                    showOnline={isMemberOnline(activeOtherId)}
                  />

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeOtherId === ADMIN_SENTINEL
                        ? "Équipe BodyForce"
                        : (() => {
                            const conv = filteredConversations.find(
                              (c) => c.otherId === activeOtherId
                            );
                            return `${conv?.otherFirstName || ""} ${
                              conv?.otherName || ""
                            }`;
                          })()}
                    </h3>
                    <div className="flex items-center gap-2">
                      <OnlineIndicator
                        isOnline={isMemberOnline(activeOtherId)}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {isMemberOnline(activeOtherId)
                          ? "En ligne"
                          : "Hors ligne"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Zone des messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-6 py-4"
            >
              {loadingThread ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : thread.length === 0 ? (
                <div className="text-center py-16">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Aucun message
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Commencez la conversation en envoyant un message
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {thread.map((msg, idx) => {
                    const isOwn = msg.authorUserId === user?.id;
                    const showAvatar =
                      !isOwn &&
                      (idx === 0 ||
                        thread[idx - 1]?.authorUserId !== msg.authorUserId);
                    const showTime =
                      idx === thread.length - 1 ||
                      (idx < thread.length - 1 &&
                        new Date(thread[idx + 1]?.createdAt) -
                          new Date(msg.createdAt) >
                          300000); // 5 minutes

                    return (
                      <div
                        key={idx}
                        className={`flex ${
                          isOwn ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`flex ${
                            isOwn ? "flex-row-reverse" : "flex-row"
                          } items-end gap-3 max-w-[70%]`}
                        >
                          {showAvatar && !isOwn && (
                            <Avatar
                              member={{
                                firstName: msg.authorFirstName,
                                name: msg.authorName,
                              }}
                              size="sm"
                            />
                          )}
                          {!showAvatar && !isOwn && <div className="w-8" />}

                          <div className="space-y-1">
                            <div
                              className={`rounded-2xl px-4 py-3 max-w-full break-words ${
                                isOwn
                                  ? "bg-blue-500 text-white rounded-br-md"
                                  : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-bl-md shadow-sm"
                              }`}
                            >
                              {msg.subject &&
                                msg.subject !== "Message" &&
                                msg.subject !== "Message au staff" && (
                                  <div
                                    className={`text-sm font-medium mb-2 pb-2 border-b ${
                                      isOwn
                                        ? "text-blue-100 border-blue-400 border-opacity-30"
                                        : "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                                    }`}
                                  >
                                    {msg.subject}
                                  </div>
                                )}
                              <div
                                className={`${
                                  isOwn
                                    ? "text-white"
                                    : "text-gray-900 dark:text-gray-100"
                                } leading-relaxed whitespace-pre-wrap`}
                              >
                                {msg.body}
                              </div>
                            </div>

                            {showTime && (
                              <div
                                className={`text-xs text-gray-500 px-1 ${
                                  isOwn ? "text-right" : "text-left"
                                }`}
                              >
                                {formatChatTime(msg.createdAt)}
                                {isOwn && (
                                  <CheckCheck className="w-3 h-3 inline ml-1" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Zone d'envoi */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              {selectMode && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Mode groupe - {selectedIds.size} membre(s) sélectionné(s)
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedIds).map((memberId) => {
                      const member = filteredConversations.find(
                        (c) => c.otherId === memberId
                      );
                      return (
                        <span
                          key={memberId}
                          className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs"
                        >
                          {member
                            ? `${member.otherFirstName} ${member.otherName}`
                            : `Membre ${memberId}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {(isBroadcast || showBroadcastModal) && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Sujet du message (requis pour diffusion)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              <div className="flex items-end gap-4">
                <div className="flex gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Image className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 relative">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      selectMode
                        ? "Message à envoyer au groupe..."
                        : isBroadcast || showBroadcastModal
                        ? "Message de diffusion..."
                        : "Tapez votre message..."
                    }
                    className="w-full max-h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={1}
                    style={{ minHeight: "48px" }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                </div>

                <button
                  onClick={onSend}
                  disabled={
                    sending ||
                    !body.trim() ||
                    ((isBroadcast || showBroadcastModal) && !subject.trim())
                  }
                  className="w-12 h-12 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modales - Diffusion */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-500" />
                Diffusion générale
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Sujet (requis)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />

              <textarea
                placeholder="Message de diffusion..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />

              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={excludeAuthor}
                  onChange={(e) => setExcludeAuthor(e.target.checked)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                Ne pas m'envoyer ce message
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setIsBroadcast(true);
                    onSend();
                  }}
                  disabled={!subject.trim() || !body.trim() || sending}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? "Envoi..." : "Diffuser"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale - Sélecteur de membres */}
      {showMemberSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Nouveau groupe
              </h3>
              <button
                onClick={() => setShowMemberSelector(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sélectionnez les membres à qui envoyer un message
              </p>

              <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl">
                {filteredConversations
                  .filter((c) => c.otherId !== ADMIN_SENTINEL)
                  .map((conv) => (
                    <label
                      key={conv.otherId}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(conv.otherId)}
                        onChange={() => toggleMemberSelection(conv.otherId)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <Avatar
                        member={conv}
                        size="sm"
                        showOnline={isMemberOnline(conv.otherId)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {conv.otherFirstName} {conv.otherName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <OnlineIndicator
                            isOnline={isMemberOnline(conv.otherId)}
                          />
                          {isMemberOnline(conv.otherId)
                            ? "En ligne"
                            : "Hors ligne"}
                        </div>
                      </div>
                    </label>
                  ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowMemberSelector(false);
                    clearSelection();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setSelectMode(true);
                    setShowMemberSelector(false);
                    setActiveOtherId(null);
                  }}
                  disabled={selectedIds.size === 0}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Créer le groupe ({selectedIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
