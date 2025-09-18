// 📄 src/pages/MessagesPage.jsx — Interface modernisée avec vraies données
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO } from "date-fns";
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

// Services existants
import * as MsgSvc from "../services/messagesService";

const ADMIN_SENTINEL = -1;

// Avatar Component
const Avatar = ({ member, size = "md", showOnline = false }) => {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm", 
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg"
  };

  const isStaff = member?.id === ADMIN_SENTINEL || !member?.id;
  
  if (member?.photo && !isStaff) {
    return (
      <div className="relative">
        <img
          src={member.photo}
          alt="Avatar"
          className={`${sizes[size]} rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm`}
        />
        {showOnline && (
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
            showOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
        )}
      </div>
    );
  }
  
  // Avatar par défaut avec initiales
  const initials = isStaff 
    ? "BF" 
    : `${member?.firstName?.[0] || '?'}${member?.name?.[0] || '?'}`;
    
  const bgColor = isStaff 
    ? "bg-gradient-to-br from-blue-600 to-purple-600" 
    : "bg-gradient-to-br from-blue-500 to-purple-500";

  return (
    <div className="relative">
      <div className={`${sizes[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-bold shadow-sm border-2 border-white dark:border-gray-700`}>
        {initials}
      </div>
      {showOnline && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
          showOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`}></div>
      )}
    </div>
  );
};

// Formatage intelligent du temps
const formatTime = (dateString) => {
  if (!dateString) return "";
  
  try {
    const date = parseISO(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, "HH:mm");
    } else if (diffInHours < 24 * 7) {
      return format(date, "EEE");  
    } else {
      return format(date, "dd/MM");
    }
  } catch {
    return "";
  }
};

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

  // Vérifier les présences (membres "en ligne" = présence dans les 5 dernières minutes)
  const checkMemberPresence = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const { data: recentPresences } = await supabase
        .from("presences")
        .select("badgeId")
        .gte("timestamp", fiveMinutesAgo.toISOString());

      if (recentPresences) {
        // Mapper badgeId vers member.id
        const { data: members } = await supabase
          .from("members")
          .select("id, badgeId")
          .in("badgeId", recentPresences.map(p => p.badgeId));

        const onlineSet = new Set();
        members?.forEach(member => {
          onlineSet.add(member.id);
        });
        
        setOnlineMembers(onlineSet);
      }
    } catch (error) {
      console.error("Erreur vérification présences:", error);
    }
  };

  const isMemberOnline = (memberId) => {
    if (memberId === ADMIN_SENTINEL) return true; // Staff toujours "en ligne"
    return onlineMembers.has(memberId);
  };

  // ========= Services & Fetchers =========
  const { sendToAdmins, sendBroadcast, listMyThread, listThreadWithMember, subscribeInbox, markConversationRead } = MsgSvc;

  const fetchConversations = async () => {
    if (!me?.id) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const adminData = await MsgSvc.listAdminConversations(me.id);
        setConvs(adminData || []);
      } else {
        const memberData = await MsgSvc.listMemberConversations(me.id);
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
          data = await listThreadWithMember(me.id, otherId);
        }
      } else {
        data = await listMyThread(me.id);
      }
      setThread(data || []);

      // Marquer comme lu
      try {
        if (typeof markConversationRead === "function" && isAdmin) {
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
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // ========= Envoi =========
  const onSend = async () => {
    if (sending) return;
    
    // ✅ CORRECTION : Validation améliorée
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
            p_subject: subject.trim() || "Message", // Sujet par défaut
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
            p_subject: subject.trim() || "Message", // Sujet par défaut
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
    } finally {
      setSending(false);
    }
  };

  // ========= Sélection multiple =========
  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
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
    
    return convs.filter(conv => {
      const name = `${conv.otherFirstName || ""} ${conv.otherName || ""}`.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term);
    });
  }, [convs, searchTerm]);

  // ========= Realtime =========
  useEffect(() => {
    if (!me?.id) return;

    const unsubscribe = subscribeInbox(me.id, () => {
      fetchConversations();
      if (activeOtherId != null) {
        fetchThread(activeOtherId);
      }
    });

    return unsubscribe;
  }, [me?.id, activeOtherId]);

  // ========= Effets =========
  useEffect(() => {
    if (me?.id) {
      fetchConversations();
      checkMemberPresence();
      
      // Vérifier les présences toutes les 2 minutes
      const presenceInterval = setInterval(checkMemberPresence, 2 * 60 * 1000);
      return () => clearInterval(presenceInterval);
    }
  }, [me?.id, isAdmin]);

  useEffect(() => {
    if (activeOtherId != null) {
      fetchThread(activeOtherId);
    }
  }, [activeOtherId]);

  useEffect(() => scrollToEnd(), [thread]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ========= Render Mobile =========
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    if (showMobileChat && activeOtherId !== null) {
      const activeConv = convs.find(c => c.otherId === activeOtherId);
      
      return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
          {/* Header Mobile */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center gap-3 shadow-lg">
            <button
              onClick={() => setShowMobileChat(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <Avatar 
              member={activeConv?.otherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : activeConv}
              size="md"
              showOnline={isMemberOnline(activeConv?.otherId)}
            />
            
            <div className="flex-1">
              <h3 className="text-white font-bold">
                {activeConv?.otherId === ADMIN_SENTINEL 
                  ? "Équipe BodyForce" 
                  : `${activeConv?.otherFirstName || ""} ${activeConv?.otherName || ""}`}
              </h3>
              <p className="text-blue-100 text-sm">
                {isMemberOnline(activeConv?.otherId) ? "En ligne" : "Hors ligne"}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full">
                <Phone className="w-5 h-5" />
              </button>
              <button className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full">
                <Video className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingThread ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : thread.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun message dans cette conversation</p>
              </div>
            ) : (
              thread.map((msg, idx) => {
                const isOwn = msg.authorUserId === user?.id;
                
                return (
                  <div key={idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      isOwn 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                    }`}>
                      {msg.subject && msg.subject !== "Message" && msg.subject !== "Message au staff" && (
                        <div className={`text-sm font-semibold mb-1 ${isOwn ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                          {msg.subject}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.body}</div>
                      <div className={`text-xs mt-1 flex items-center gap-1 ${
                        isOwn ? 'text-blue-100 justify-end' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {formatTime(msg.createdAt)}
                        {isOwn && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input Mobile */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
            {!selectMode && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="w-full max-h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={onSend}
                  disabled={sending || !body.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-full hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Liste des conversations mobile
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Header Mobile */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Messages</h2>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition-colors"
                >
                  <Radio className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition-colors"
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
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white bg-opacity-20 text-white placeholder-blue-200 rounded-xl border border-white border-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.otherId}
                onClick={() => {
                  setActiveOtherId(conv.otherId);
                  setShowMobileChat(true);
                }}
                className="p-4 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar 
                    member={conv.otherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : conv}
                    size="md"
                    showOnline={isMemberOnline(conv.otherId)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.otherId === ADMIN_SENTINEL 
                          ? "Équipe BodyForce" 
                          : `${conv.otherFirstName || ""} ${conv.otherName || ""}`}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {formatTime(conv.lastMessageDate)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conv.lastMessagePreview || "Aucun message"}
                      </p>
                      
                      {conv.unread > 0 && (
                        <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ===== Desktop View =====
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Messages</h2>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-lg hover:bg-opacity-30 transition-colors"
                  title="Diffusion générale"
                >
                  <Radio className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-lg hover:bg-opacity-30 transition-colors"
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
              className="w-full pl-10 pr-4 py-2 bg-white bg-opacity-20 text-white placeholder-blue-200 rounded-lg border border-white border-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            />
          </div>
        </div>

        {/* Liste des conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.otherId}
                onClick={() => setActiveOtherId(conv.otherId)}
                className={`p-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer transition-colors ${
                  activeOtherId === conv.otherId
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-r-4 border-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar 
                    member={conv.otherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : conv}
                    size="md"
                    showOnline={isMemberOnline(conv.otherId)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.otherId === ADMIN_SENTINEL 
                          ? "Équipe BodyForce" 
                          : `${conv.otherFirstName || ""} ${conv.otherName || ""}`}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {formatTime(conv.lastMessageDate)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conv.lastMessagePreview || "Aucun message"}
                      </p>
                      
                      {conv.unread > 0 && (
                        <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse ml-2 flex-shrink-0">
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col">
        {activeOtherId === null ? (
          // Écran d'accueil
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Bienvenue dans la messagerie BodyForce
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md">
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
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar 
                    member={activeOtherId === ADMIN_SENTINEL ? { id: ADMIN_SENTINEL } : filteredConversations.find(c => c.otherId === activeOtherId)}
                    size="lg"
                    showOnline={isMemberOnline(activeOtherId)}
                  />
                  
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {activeOtherId === ADMIN_SENTINEL 
                        ? "Équipe BodyForce" 
                        : (() => {
                            const conv = filteredConversations.find(c => c.otherId === activeOtherId);
                            return `${conv?.otherFirstName || ""} ${conv?.otherName || ""}`;
                          })()}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        isMemberOnline(activeOtherId) ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`}></div>
                      {isMemberOnline(activeOtherId) ? "En ligne" : "Hors ligne"}
                    </p>
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
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingThread ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : thread.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Aucun message dans cette conversation</p>
                  <p className="text-sm">Commencez la conversation en envoyant un message ci-dessous</p>
                </div>
              ) : (
                thread.map((msg, idx) => {
                  const isOwn = msg.authorUserId === user?.id;
                  
                  return (
                    <div key={idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-lg px-4 py-3 rounded-2xl ${
                        isOwn 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 shadow-sm'
                      }`}>
                        {msg.subject && msg.subject !== "Message" && msg.subject !== "Message au staff" && (
                          <div className={`text-sm font-semibold mb-2 pb-2 border-b ${
                            isOwn 
                              ? 'text-blue-100 border-blue-300 border-opacity-30' 
                              : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                          }`}>
                            {msg.subject}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.body}</div>
                        <div className={`text-xs mt-2 flex items-center gap-1 ${
                          isOwn ? 'text-blue-100 justify-end' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatTime(msg.createdAt)}
                          {isOwn && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            {/* Zone d'envoi */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 p-4">
              {selectMode && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Mode groupe actif - {selectedIds.size} membre(s) sélectionné(s)
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedIds).map(memberId => {
                      const member = filteredConversations.find(c => c.otherId === memberId);
                      return (
                        <span key={memberId} className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs">
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
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1">
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
                    className="w-full max-h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={1}
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={onSend}
                  disabled={sending || !body.trim() || ((isBroadcast || showBroadcastModal) && !subject.trim())}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-xl hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      
      {/* Modal Diffusion */}
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
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              
              <textarea
                placeholder="Message de diffusion..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? "Envoi..." : "Diffuser"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sélection membres */}
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
                {filteredConversations.filter(c => c.otherId !== ADMIN_SENTINEL).map((conv) => (
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
                    <Avatar member={conv} size="sm" showOnline={isMemberOnline(conv.otherId)} />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {conv.otherFirstName} {conv.otherName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
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
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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