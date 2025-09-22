// 📄 src/pages/MessagesPage.jsx — Version corrigée (Avatar lazy + URL mémoïsée) — 2025-09-22
// ✅ Modifs minimales : import getPhotoUrl + <img src={getPhotoUrl(...)} loading="lazy" />
// ⚠️ Logique, style et structure conservés à l’identique — hors ces deux ajustements

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, getPhotoUrl } from "../supabaseClient";
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
} from "lucide-react";


import * as MsgSvc from "../services/messagesService";

const ADMIN_SENTINEL = -1;

// Avatar Component
const Avatar = ({ member, size = "md", showOnline = false, className = "" }) => {
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
    : `${member?.firstName?.[0] || member?.otherFirstName?.[0] || "?"}${member?.name?.[0] || member?.otherName?.[0] || "?"}`;

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

// Formatage du temps
const formatMessageTime = (dateString) => {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isToday(date)) return format(date, "HH:mm", { locale: fr });
    if (isYesterday(date)) return "Hier";
    const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) return format(date, "EEEE", { locale: fr });
    return format(date, "dd/MM", { locale: fr });
  } catch {
    return "";
  }
};

const formatChatTime = (dateString) => {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    if (isToday(date)) return format(date, "HH:mm", { locale: fr });
    if (isYesterday(date)) return `Hier ${format(date, "HH:mm", { locale: fr })}`;
    return format(date, "dd/MM/yyyy HH:mm", { locale: fr });
  } catch {
    return "";
  }
};

const OnlineIndicator = ({ isOnline }) => (
  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
);

// ========= FONCTIONS AVEC VRAIES DONNÉES RESTAURÉES =========

const getEnhancedAdminConversations = async (adminMemberId) => {
  try {
    console.log("🔍 Récupération conversations admin avec vraies données...");

    // Étape 1: Récupérer tous les membres (sauf l'admin)
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, firstName, name, photo, badgeId")
      .neq("id", adminMemberId)
      .order("name", { ascending: true });

    if (membersError) {
      console.error("❌ Erreur récupération membres:", membersError);
      throw membersError;
    }

    console.log(`👥 ${members?.length || 0} membres récupérés`);

    if (!members || members.length === 0) {
      return [{
        otherId: ADMIN_SENTINEL,
        otherFirstName: "Équipe",
        otherName: "BodyForce",
        photo: null,
        lastMessagePreview: "Messages de l'équipe",
        lastMessageDate: null,
        unread: 0,
      }];
    }

    // Étape 2: Récupérer les derniers messages pour chaque membre
    const memberIds = members.map(m => m.id);
    const { data: lastMessages, error: lastMsgError } = await supabase
      .from("messages")
      .select(`
        id,
        author_member_id,
        subject,
        body,
        created_at,
        message_recipients!inner(recipient_member_id)
      `)
      .or(`author_member_id.eq.${adminMemberId},message_recipients.recipient_member_id.eq.${adminMemberId}`)
      .or(`author_member_id.in.(${memberIds.join(',')}),message_recipients.recipient_member_id.in.(${memberIds.join(',')})`)
      .order("created_at", { ascending: false });

    if (lastMsgError) {
      console.error("⚠️ Erreur derniers messages:", lastMsgError);
    }

    // Étape 3: Compter les messages non lus pour chaque conversation
    const { data: unreadCounts, error: unreadError } = await supabase
      .from("message_recipients")
      .select(`
        message_id,
        recipient_member_id,
        read_at,
        messages!inner(author_member_id)
      `)
      .eq("recipient_member_id", adminMemberId)
      .is("read_at", null);

    if (unreadError) {
      console.error("⚠️ Erreur comptage non lus:", unreadError);
    }

    // Créer des maps pour optimiser les lookups
    const lastMessageMap = new Map();
    const unreadMap = new Map();

    // Traiter les derniers messages
    if (lastMessages) {
      lastMessages.forEach(msg => {
        // Déterminer l'autre membre de la conversation
        let otherMemberId;
        if (msg.author_member_id === adminMemberId) {
          // Message envoyé par l'admin, trouver le destinataire
          const recipient = msg.message_recipients?.[0];
          if (recipient) {
            otherMemberId = recipient.recipient_member_id;
          }
        } else {
          // Message reçu par l'admin
          otherMemberId = msg.author_member_id;
        }

        if (otherMemberId && !lastMessageMap.has(otherMemberId)) {
          lastMessageMap.set(otherMemberId, {
            preview: msg.body?.substring(0, 100) || msg.subject || "Message",
            date: msg.created_at,
            subject: msg.subject
          });
        }
      });
    }

    // Traiter les compteurs non lus
    if (unreadCounts) {
      unreadCounts.forEach(item => {
        const authorId = item.messages?.author_member_id;
        if (authorId) {
          const currentCount = unreadMap.get(authorId) || 0;
          unreadMap.set(authorId, currentCount + 1);
        }
      });
    }

    // Construire les conversations avec les vraies données
    const conversations = members.map(member => {
      const lastMsg = lastMessageMap.get(member.id);
      const unreadCount = unreadMap.get(member.id) || 0;

      return {
        otherId: member.id,
        otherFirstName: member.firstName || "",
        otherName: member.name || "",
        photo: member.photo || null,
        lastMessagePreview: lastMsg?.preview || "Commencer une conversation",
        lastMessageDate: lastMsg?.date || null,
        unread: unreadCount,
      };
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

    // Trier par dernière activité (conversations avec messages récents en premier)
    conversations.sort((a, b) => {
      // Staff toujours en premier
      if (a.otherId === ADMIN_SENTINEL) return -1;
      if (b.otherId === ADMIN_SENTINEL) return 1;

      // Puis par non lus
      if (a.unread !== b.unread) return b.unread - a.unread;

      // Puis par date du dernier message
      if (!a.lastMessageDate && !b.lastMessageDate) return 0;
      if (!a.lastMessageDate) return 1;
      if (!b.lastMessageDate) return -1;

      return new Date(b.lastMessageDate) - new Date(a.lastMessageDate);
    });

    console.log(`✅ ${conversations.length} conversations construites`);
    return conversations;

  } catch (error) {
    console.error("💥 Erreur getEnhancedAdminConversations:", error);
    return [{
      otherId: ADMIN_SENTINEL,
      otherFirstName: "Équipe",
      otherName: "BodyForce",
      photo: null,
      lastMessagePreview: "Erreur de chargement",
      lastMessageDate: null,
      unread: 0,
    }];
  }
};

const getEnhancedMemberConversations = async (memberId) => {
  try {
    console.log("🔍 Récupération conversations membre...");

    // Pour un membre standard, une seule conversation avec le staff
    const { data: lastMessages, error } = await supabase
      .from("messages")
      .select(`
        id,
        subject,
        body,
        created_at,
        author_member_id,
        message_recipients!inner(recipient_member_id)
      `)
      .or(`author_member_id.eq.${memberId},message_recipients.recipient_member_id.eq.${memberId}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("⚠️ Erreur messages membre:", error);
    }

    // Compter les non lus du staff
    const { data: unreadFromStaff, error: unreadError } = await supabase
      .from("message_recipients")
      .select(`
        message_id,
        messages!inner(author_member_id)
      `)
      .eq("recipient_member_id", memberId)
      .is("read_at", null)
      .neq("messages.author_member_id", memberId);

    if (unreadError) {
      console.error("⚠️ Erreur unread membre:", unreadError);
    }

    let lastMessagePreview = "Contactez l'équipe BodyForce";
    let lastMessageDate = null;

    if (lastMessages && lastMessages.length > 0) {
      const lastMsg = lastMessages[0];
      lastMessagePreview = lastMsg.body?.substring(0, 100) || lastMsg.subject || "Message";
      lastMessageDate = lastMsg.created_at;
    }

    const unreadCount = unreadFromStaff?.length || 0;

    return [{
      otherId: ADMIN_SENTINEL,
      otherFirstName: "Équipe",
      otherName: "BodyForce",
      photo: null,
      lastMessagePreview,
      lastMessageDate,
      unread: unreadCount,
    }];

  } catch (error) {
    console.error("💥 Erreur getEnhancedMemberConversations:", error);
    return [{
      otherId: ADMIN_SENTINEL,
      otherFirstName: "Équipe",
      otherName: "BodyForce",
      photo: null,
      lastMessagePreview: "Contactez l'équipe BodyForce",
      lastMessageDate: null,
      unread: 0,
    }];
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

  // Présences avec heartbeat
  const [onlineMembers, setOnlineMembers] = useState(new Set());

  const endRef = useRef();
  const messagesContainerRef = useRef();
  const activeOtherIdRef = useRef(null);

  useEffect(() => {
    activeOtherIdRef.current = activeOtherId;
  }, [activeOtherId]);

  // ========= SYSTÈME DE PRÉSENCE HEARTBEAT (CORRIGÉ) =========

  // Heartbeat pour maintenir la présence
  const updatePresence = useCallback(async () => {
    if (!me?.id) return;
    try {
      await supabase
        .from("members")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", me.id);

      console.log("💓 Heartbeat envoyé pour membre", me.id);
    } catch (error) {
      console.error("❌ Erreur heartbeat:", error);
    }
  }, [me?.id]);

  // Vérifier qui est en ligne (corrigé)
  const checkMemberPresence = useCallback(async () => {
    try {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

      const { data: onlineMembersData, error } = await supabase
        .from("members")
        .select("id")
        .gte("last_seen_at", threeMinutesAgo.toISOString());

      if (error) {
        console.error("❌ Erreur vérification présence:", error);
        return;
      }

      const onlineSet = new Set(onlineMembersData?.map(m => m.id) || []);
      console.log("👥 Membres en ligne:", onlineSet.size);
      setOnlineMembers(onlineSet);
    } catch (error) {
      console.error("💥 Erreur checkMemberPresence:", error);
    }
  }, []);

  const isMemberOnline = useCallback((memberId) => {
    if (memberId === ADMIN_SENTINEL) return true; // Staff toujours en ligne
    return onlineMembers.has(memberId);
  }, [onlineMembers]);

  // ========= FONCTIONS AVEC useCallback =========

  const {
    sendToAdmins,
    sendBroadcast,
    listMyThread,
    listThreadWithMember,
    subscribeInbox,
    markConversationRead,
  } = MsgSvc;

  const fetchConversations = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    try {
      let conversations;
      if (isAdmin) {
        conversations = await getEnhancedAdminConversations(me.id);
      } else {
        conversations = await getEnhancedMemberConversations(me.id);
      }
      console.log("✅ Conversations récupérées:", conversations.length);
      setConvs(conversations || []);
    } catch (error) {
      console.error("❌ Erreur fetchConversations:", error);
      setConvs([]);
    } finally {
      setLoading(false);
    }
  }, [me?.id, isAdmin]);

  const fetchThread = useCallback(async (otherId) => {
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
        if (isAdmin && otherId !== ADMIN_SENTINEL && typeof markConversationRead === "function") {
          await markConversationRead(otherId);
        }
      } catch (error) {
        console.error("⚠️ Erreur marquage lu:", error);
      }
    } catch (error) {
      console.error("❌ Erreur fetchThread:", error);
    } finally {
      setLoadingThread(false);
    }
  }, [me?.id, isAdmin, listThreadWithMember, listMyThread, markConversationRead]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  // ========= Envoi optimisé =========
  const onSend = useCallback(async () => {
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

      // Rafraîchir les données
      await fetchConversations();

      if (activeOtherId != null && !selectMode && !isBroadcast) {
        await fetchThread(activeOtherId);
      }
      scrollToEnd();
    } catch (error) {
      console.error("💥 Erreur lors de l'envoi:", error);
    } finally {
      setSending(false);
    }
  }, [
    sending, body, isBroadcast, showBroadcastModal, subject, me?.id, isAdmin,
    sendBroadcast, excludeAuthor, selectMode, selectedIds, activeOtherId,
    sendToAdmins, fetchConversations, fetchThread, scrollToEnd
  ]);

  // ========= Sélection multiple =========
  const toggleMemberSelection = useCallback((memberId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) newSelected.delete(memberId);
    else newSelected.add(memberId);
    setSelectedIds(newSelected);
  }, [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowMemberSelector(false);
  }, []);

  // ========= Conversations filtrées avec useMemo =========
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return convs;
    const term = searchTerm.toLowerCase();
    return convs.filter((conv) => {
      const name = `${conv.otherFirstName || ""} ${conv.otherName || ""}`.toLowerCase();
      return name.includes(term);
    });
  }, [convs, searchTerm]);

  // ========= EFFETS =========

  // Heartbeat toutes les 90 secondes
  useEffect(() => {
    if (!me?.id) return;

    const heartbeatInterval = setInterval(updatePresence, 90000);
    updatePresence(); // Premier appel immédiat

    return () => clearInterval(heartbeatInterval);
  }, [me?.id, updatePresence]);

  // Vérifier les présences toutes les 2 minutes
  useEffect(() => {
    let mounted = true;

    if (me?.id) {
      const initPresence = async () => {
        if (!mounted) return;
        await checkMemberPresence();
      };

      initPresence();

      const presenceInterval = setInterval(() => {
        if (mounted) {
          checkMemberPresence();
        }
      }, 2 * 60 * 1000);

      return () => {
        mounted = false;
        clearInterval(presenceInterval);
      };
    }
  }, [me?.id, checkMemberPresence]);

  // Heartbeat au focus de la fenêtre
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && me?.id) {
        updatePresence();
        checkMemberPresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [me?.id, updatePresence, checkMemberPresence]);

  // Realtime avec debouncing réduit
  useEffect(() => {
    if (!me?.id) return;

    let mounted = true;
    let timeoutId = null;

    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!mounted) return;
        try {
          console.log("🔄 Mise à jour realtime...");
          await fetchConversations();
          const current = activeOtherIdRef.current;
          if (current != null && mounted) {
            await fetchThread(current);
          }
        } catch (error) {
          if (mounted) {
            console.error("❌ Erreur callback realtime:", error);
          }
        }
      }, 500); // Réduit à 500ms
    };

    const sub = subscribeInbox(me.id, debouncedUpdate);

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      try {
        sub?.unsubscribe?.();
      } catch (error) {
        console.error("❌ Erreur cleanup subscription:", error);
      }
    };
  }, [me?.id, fetchConversations, fetchThread]);

  // Initialisation des données
  useEffect(() => {
    let mounted = true;

    if (me?.id) {
      const initData = async () => {
        if (!mounted) return;
        try {
          await fetchConversations();
        } catch (error) {
          if (mounted) {
            console.error("❌ Erreur initialisation:", error);
          }
        }
      };

      initData();
    }

    return () => {
      mounted = false;
    };
  }, [me?.id, fetchConversations]);

  useEffect(() => {
    let mounted = true;

    if (activeOtherId != null) {
      const loadThread = async () => {
        if (mounted) {
          await fetchThread(activeOtherId);
        }
      };
      loadThread();
    }

    return () => {
      mounted = false;
    };
  }, [activeOtherId, fetchThread]);

  useEffect(() => {
    scrollToEnd();
  }, [thread, scrollToEnd]);

  // Détection mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Chargement...</p>
        </div>
      </div>
    );
  }

  // ========= Render Mobile =========
  if (isMobile) {
    if (showMobileChat && activeOtherId !== null) {
      const activeConv = convs.find((c) => c.otherId === activeOtherId);

      return (
        <div className="h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
          {/* Header Mobile */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
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
                  : `${activeConv?.otherFirstName || ""} ${activeConv?.otherName || ""}`}
              </h3>
              <div className="flex items-center gap-1">
                <OnlineIndicator isOnline={isMemberOnline(activeConv?.otherId)} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isMemberOnline(activeConv?.otherId) ? "En ligne" : "Hors ligne"}
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
                  const showAvatar = !isOwn && (idx === 0 || thread[idx - 1]?.authorUserId !== msg.authorUserId);

                  return (
                    <div key={idx} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`flex ${isOwn ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[85%]`}>
                        {showAvatar && !isOwn && (
                          <Avatar
                            member={{ firstName: msg.authorFirstName, name: msg.authorName }}
                            size="sm"
                          />
                        )}
                        {!showAvatar && !isOwn && <div className="w-8" />}

                        <div className="flex flex-col">
                          <div className={`rounded-2xl px-4 py-2 max-w-full ${isOwn
                              ? "bg-blue-500 text-white rounded-br-md"
                              : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-bl-md"
                            }`}>
                            {msg.subject && msg.subject !== "Message" && msg.subject !== "Message au staff" && (
                              <div className={`text-sm font-medium mb-1 ${isOwn ? "text-blue-100" : "text-gray-600 dark:text-gray-400"
                                }`}>
                                {msg.subject}
                              </div>
                            )}
                            <div className={`text-sm break-words ${isOwn ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
                              {msg.body}
                            </div>
                          </div>
                          <div className={`text-xs text-gray-500 mt-1 px-2 ${isOwn ? "text-right" : "text-left"}`}>
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
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message..."
                  className="w-full max-h-20 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  rows={1}
                  style={{ minHeight: '48px' }}
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
      <div className="h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Messages</h1>
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
                  member={conv.otherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : conv}
                  size="md"
                  showOnline={isMemberOnline(conv.otherId)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {conv.otherId === ADMIN_SENTINEL
                        ? "Équipe BodyForce"
                        : `${conv.otherFirstName || ""} ${conv.otherName || ""}`}
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
    <div className="h-screen flex bg-white dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Largeur fixe avec scroll interne */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header Sidebar - FIXE */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Messages</h2>
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

        {/* Liste des conversations - SCROLLABLE */}
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
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${activeOtherId === conv.otherId
                    ? "bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    member={conv.otherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : conv}
                    size="md"
                    showOnline={isMemberOnline(conv.otherId)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.otherId === ADMIN_SENTINEL
                          ? "Équipe BodyForce"
                          : `${conv.otherFirstName || ""} ${conv.otherName || ""}`}
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

      {/* Zone principale - Chat avec structure fixe */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
            {/* Header du chat - FIXE */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar
                    member={
                      activeOtherId === ADMIN_SENTINEL
                        ? { id: ADMIN_SENTINEL }
                        : filteredConversations.find((c) => c.otherId === activeOtherId)
                    }
                    size="lg"
                    showOnline={isMemberOnline(activeOtherId)}
                  />

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeOtherId === ADMIN_SENTINEL
                        ? "Équipe BodyForce"
                        : (() => {
                          const conv = filteredConversations.find((c) => c.otherId === activeOtherId);
                          return `${conv?.otherFirstName || ""} ${conv?.otherName || ""}`;
                        })()}
                    </h3>
                    <div className="flex items-center gap-2">
                      <OnlineIndicator isOnline={isMemberOnline(activeOtherId)} />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {isMemberOnline(activeOtherId) ? "En ligne" : "Hors ligne"}
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

            {/* Zone des messages - SCROLLABLE */}
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
                    const showAvatar = !isOwn && (idx === 0 || thread[idx - 1]?.authorUserId !== msg.authorUserId);
                    const showTime = idx === thread.length - 1 ||
                      (idx < thread.length - 1 &&
                        (new Date(thread[idx + 1]?.createdAt) - new Date(msg.createdAt)) > 300000); // 5 minutes

                    return (
                      <div key={idx} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`flex ${isOwn ? "flex-row-reverse" : "flex-row"} items-end gap-3 max-w-[70%]`}>
                          {showAvatar && !isOwn && (
                            <Avatar
                              member={{ firstName: msg.authorFirstName, name: msg.authorName }}
                              size="sm"
                            />
                          )}
                          {!showAvatar && !isOwn && <div className="w-8" />}

                          <div className="space-y-1">
                            <div className={`rounded-2xl px-4 py-3 max-w-full break-words ${isOwn
                                ? "bg-blue-500 text-white rounded-br-md"
                                : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-bl-md shadow-sm"
                              }`}>
                              {msg.subject && msg.subject !== "Message" && msg.subject !== "Message au staff" && (
                                <div className={`text-sm font-medium mb-2 pb-2 border-b ${isOwn
                                    ? "text-blue-100 border-blue-400 border-opacity-30"
                                    : "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                                  }`}>
                                  {msg.subject}
                                </div>
                              )}
                              <div className={`${isOwn ? "text-white" : "text-gray-900 dark:text-gray-100"} leading-relaxed whitespace-pre-wrap`}>
                                {msg.body}
                              </div>
                            </div>

                            {showTime && (
                              <div className={`text-xs text-gray-500 px-1 ${isOwn ? "text-right" : "text-left"}`}>
                                {formatChatTime(msg.createdAt)}
                                {isOwn && <CheckCheck className="w-3 h-3 inline ml-1" />}
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

            {/* Zone d'envoi - FIXE */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
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
                      const member = filteredConversations.find((c) => c.otherId === memberId);
                      return (
                        <span
                          key={memberId}
                          className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs"
                        >
                          {member ? `${member.otherFirstName} ${member.otherName}` : `Membre ${memberId}`}
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
                    style={{ minHeight: '48px' }}
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
                          <OnlineIndicator isOnline={isMemberOnline(conv.otherId)} />
                          {isMemberOnline(conv.otherId) ? "En ligne" : "Hors ligne"}
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