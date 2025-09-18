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
  ChevronDown,
  X,
  Plus,
  ArrowLeft,
  Settings,
  Filter,
  Radio
} from "lucide-react";

import {
  sendToAdmins,
  sendToMember,
  sendBroadcast,
  listMyThread,
  listThreadWithMember,
  sendMessage,
  subscribeInbox,
  markConversationRead,
  fetchAdminMemberIds
} from "../services/messagesService";

const ADMIN_SENTINEL = -1; // ID virtuel pour "Équipe BodyForce"

const MessagesPage = () => {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  // ===== States principaux =====
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  
  // ===== Thread/Messages =====
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  // ===== Composer =====
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [sending, setSending] = useState(false);

  // ===== UI States =====
  const [searchQuery, setSearchQuery] = useState("");
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ===== Admin states =====
  const [allMembers, setAllMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // ===== Utility functions =====
  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const formatTime = (dateString) => {
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
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ===== Responsive handling =====
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== Fetch conversations =====
  const fetchConversations = async () => {
    if (!me?.id) return;
    setLoadingConversations(true);
    
    try {
      // ===== MODE MEMBRE : fil unique avec staff =====
      if (!isAdmin) {
        const threadData = await listMyThread(me.id);
        
        let conversation = {
          otherId: ADMIN_SENTINEL,
          name: "Équipe BodyForce",
          firstName: "Équipe",
          lastName: "BodyForce",
          photo: null,
          lastBody: "",
          lastAt: null,
          unread: 0,
          isStaff: true
        };

        if (threadData && threadData.length > 0) {
          const lastMessage = threadData[threadData.length - 1];
          conversation.lastAt = lastMessage.created_at;
          conversation.lastBody = lastMessage.body || lastMessage.subject || "";
          
          // Compter non lus (messages reçus sans read_at)
          const unreadCount = threadData.filter(msg => 
            msg.direction === 'in' && !msg.read_at
          ).length;
          conversation.unread = unreadCount;
        }

        setConversations(conversation.lastAt ? [conversation] : []);
        if (!activeConversation && conversation.lastAt) {
          setActiveConversation(conversation);
        }
        return;
      }

      // ===== MODE ADMIN : conversations multiples =====
      const conversationMap = new Map();

      // 1) Messages reçus (membres -> moi)
      const { data: inbox, error: inboxError } = await supabase
        .from("message_recipients")
        .select(`
          id, read_at, created_at,
          messages:message_id (
            id, subject, body, created_at, author_member_id,
            members:author_member_id (id, firstName, name, email, photo)
          )
        `)
        .eq("recipient_member_id", me.id)
        .order("created_at", { ascending: false });

      if (inboxError) throw inboxError;

      (inbox || []).forEach((msg) => {
        const authorId = msg.messages?.author_member_id;
        if (!authorId) return;

        const member = msg.messages?.members;
        if (!member) return;

        const existing = conversationMap.get(authorId) || {
          otherId: authorId,
          name: `${member.firstName || ''} ${member.name || ''}`.trim() || member.email || `#${authorId}`,
          firstName: member.firstName,
          lastName: member.name,
          photo: member.photo,
          email: member.email,
          lastBody: "",
          lastAt: "1970-01-01T00:00:00.000Z",
          unread: 0,
          isStaff: false
        };

        if (new Date(msg.created_at) > new Date(existing.lastAt)) {
          existing.lastAt = msg.created_at;
          existing.lastBody = msg.messages?.body || msg.messages?.subject || "";
        }

        if (!msg.read_at) {
          existing.unread += 1;
        }

        conversationMap.set(authorId, existing);
      });

      // 2) Messages envoyés (moi -> membres)
      const { data: sent, error: sentError } = await supabase
        .from("messages")
        .select(`
          id, subject, body, created_at,
          message_recipients:message_recipients (
            recipient_member_id,
            members:recipient_member_id (id, firstName, name, email, photo)
          )
        `)
        .eq("author_user_id", user.id);

      if (sentError) throw sentError;

      (sent || []).forEach((msg) => {
        (msg.message_recipients || []).forEach((recipient) => {
          const memberId = recipient.recipient_member_id;
          if (!memberId) return;

          const member = recipient.members;
          if (!member) return;

          const existing = conversationMap.get(memberId) || {
            otherId: memberId,
            name: `${member.firstName || ''} ${member.name || ''}`.trim() || member.email || `#${memberId}`,
            firstName: member.firstName,
            lastName: member.name,
            photo: member.photo,
            email: member.email,
            lastBody: "",
            lastAt: "1970-01-01T00:00:00.000Z",
            unread: 0,
            isStaff: false
          };

          if (new Date(msg.created_at) > new Date(existing.lastAt)) {
            existing.lastAt = msg.created_at;
            existing.lastBody = msg.body || msg.subject || "";
          }

          conversationMap.set(memberId, existing);
        });
      });

      const sortedConversations = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

      setConversations(sortedConversations);
      
      if (!activeConversation && sortedConversations.length > 0) {
        setActiveConversation(sortedConversations[0]);
      }

    } catch (error) {
      console.error("Erreur lors du chargement des conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // ===== Fetch thread messages =====
  const fetchMessages = async (conversationId) => {
    if (!me?.id || conversationId === null) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      let threadData = [];

      if (!isAdmin && conversationId === ADMIN_SENTINEL) {
        // Membre : fil avec staff
        threadData = await listMyThread(me.id);
      } else if (isAdmin && conversationId !== ADMIN_SENTINEL) {
        // Admin : fil avec membre spécifique
        threadData = await listThreadWithMember(conversationId);
      }

      const mappedMessages = (threadData || []).map((msg) => ({
        id: msg.id,
        message_id: msg.message_id,
        subject: msg.subject,
        body: msg.body,
        created_at: msg.created_at,
        author_member_id: msg.author_member_id,
        isOwn: (!isAdmin && conversationId === ADMIN_SENTINEL) 
          ? msg.direction === 'out'
          : msg.author_member_id === me.id
      }));

      setMessages(mappedMessages);

      // Marquer comme lu si admin
      if (isAdmin && conversationId !== ADMIN_SENTINEL) {
        try {
          await markConversationRead(conversationId);
          setConversations(prev => 
            prev.map(conv => 
              conv.otherId === conversationId 
                ? { ...conv, unread: 0 }
                : conv
            )
          );
        } catch (error) {
          console.warn("Impossible de marquer comme lu:", error);
        }
      }

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Erreur lors du chargement des messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // ===== Fetch all members for selector =====
  const fetchAllMembers = async () => {
    if (!isAdmin) return;
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id, firstName, name, email, badgeId, photo")
        .order("name", { ascending: true });
      
      if (!error) {
        setAllMembers((data || []).filter(member => member.id !== me.id));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des membres:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // ===== Send message =====
  const handleSendMessage = async () => {
    if (sending || !newMessage.trim()) return;
    if (!me?.id) return;

    setSending(true);
    try {
      if (isAdmin) {
        if (isBroadcast) {
          await sendBroadcast({ 
            subject: newSubject.trim() || "Message de diffusion", 
            body: newMessage.trim(), 
            excludeAuthor: true 
          });
        } else if (showMemberSelector && selectedMembers.size > 0) {
          const recipientIds = Array.from(selectedMembers);
          await sendMessage({
            subject: newSubject.trim() || "Nouveau message",
            body: newMessage.trim(),
            recipientMemberIds: recipientIds,
            authorMemberId: me.id,
            isBroadcast: false
          });
          setSelectedMembers(new Set());
          setShowMemberSelector(false);
        } else if (activeConversation && activeConversation.otherId !== ADMIN_SENTINEL) {
          await sendToMember({
            toMemberId: activeConversation.otherId,
            subject: newSubject.trim() || "Réponse",
            body: newMessage.trim(),
            authorMemberId: me.id
          });
        }
      } else {
        // Membre vers staff
        await sendToAdmins({
          subject: newSubject.trim() || "Message au staff",
          body: newMessage.trim(),
          authorMemberId: me.id
        });
      }

      setNewMessage("");
      setNewSubject("");
      setIsBroadcast(false);

      // Refresh data
      await fetchConversations();
      if (activeConversation) {
        await fetchMessages(activeConversation.otherId);
      }

    } catch (error) {
      console.error("Erreur lors de l'envoi:", error);
    } finally {
      setSending(false);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    if (!user || !me?.id) return;
    fetchConversations();
  }, [user, me?.id, isAdmin]);

  useEffect(() => {
    if (!activeConversation) return;
    fetchMessages(activeConversation.otherId);
  }, [activeConversation, me?.id, isAdmin]);

  // Realtime subscription
  useEffect(() => {
    if (!me?.id) return;

    const subscription = subscribeInbox(me.id, async (event, payload) => {
      await fetchConversations();
      if (activeConversation) {
        await fetchMessages(activeConversation.otherId);
      }
    });

    return () => subscription.unsubscribe();
  }, [me?.id, activeConversation]);

  useEffect(() => {
    if (showMemberSelector && isAdmin) {
      fetchAllMembers();
    }
  }, [showMemberSelector, isAdmin]);

  // ===== Filtered data =====
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.name.toLowerCase().includes(query) ||
      conv.lastBody.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return allMembers;
    const query = memberSearchQuery.toLowerCase();
    return allMembers.filter(member => 
      `${member.firstName || ''} ${member.name || ''}`.toLowerCase().includes(query) ||
      (member.email || '').toLowerCase().includes(query) ||
      (member.badgeId || '').toLowerCase().includes(query)
    );
  }, [allMembers, memberSearchQuery]);

  // ===== Component early returns =====
  if (!user || !me?.id) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-300">
        Connectez-vous pour accéder aux messages.
      </div>
    );
  }

  // ===== Avatar Component =====
  const Avatar = ({ user, size = "w-10 h-10", showOnline = false }) => {
    const sizeClasses = {
      "w-6 h-6": "text-xs",
      "w-8 h-8": "text-xs",
      "w-10 h-10": "text-sm",
      "w-12 h-12": "text-base",
      "w-16 h-16": "text-lg"
    };

    if (user.isStaff) {
      return (
        <div className={`${size} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold ${sizeClasses[size]} shadow-lg border-2 border-white dark:border-gray-800 relative`}>
          BF
          {showOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
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
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
          )}
        </div>
      );
    }

    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold ${sizeClasses[size]} shadow border-2 border-white dark:border-gray-800 relative`}>
        {getInitials(user.firstName, user.lastName)}
        {showOnline && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
        )}
      </div>
    );
  };

  // ===== Conversation Item Component =====
  const ConversationItem = ({ conversation, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left transition-all duration-200 relative group ${
        isActive 
          ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-r-4 border-blue-500" 
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <div className="flex items-center space-x-3">
        <Avatar user={conversation} showOnline={true} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`font-semibold truncate ${
              isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"
            }`}>
              {conversation.name}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {conversation.lastAt ? formatTime(conversation.lastAt) : ""}
              </span>
              {conversation.unread > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full animate-pulse">
                  {conversation.unread}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {conversation.lastBody || "Aucun message"}
          </p>
        </div>
      </div>
    </button>
  );

  // ===== Message Bubble Component =====
  const MessageBubble = ({ message }) => {
    const time = formatTime(message.created_at);
    
    return (
      <div className={`flex mb-4 ${message.isOwn ? "justify-end" : "justify-start"} group`}>
        {!message.isOwn && (
          <Avatar 
            user={{ 
              firstName: activeConversation?.firstName || "U",
              lastName: activeConversation?.lastName || "ser",
              photo: activeConversation?.photo,
              isStaff: activeConversation?.isStaff || false
            }} 
            size="w-8 h-8" 
          />
        )}
        <div className={`max-w-xs lg:max-w-md xl:max-w-lg mx-2 ${message.isOwn ? "order-1" : "order-2"}`}>
          <div className={`px-4 py-2 rounded-2xl shadow-sm relative ${
            message.isOwn 
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" 
              : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
          }`}>
            {message.subject && (
              <div className={`text-sm font-semibold mb-1 ${
                message.isOwn ? "text-blue-100" : "text-gray-900 dark:text-gray-100"
              }`}>
                {message.subject}
              </div>
            )}
            <p className={`text-sm ${
              message.isOwn ? "text-white" : "text-gray-800 dark:text-gray-200"
            }`}>
              {message.body}
            </p>
            <div className={`text-xs mt-1 flex items-center ${
              message.isOwn ? "text-blue-200 justify-end" : "text-gray-500 dark:text-gray-400"
            }`}>
              {time}
              {message.isOwn && (
                <CheckCheck className="w-3 h-3 ml-1" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== Mobile Handling =====
  if (isMobile) {
    if (activeConversation) {
      return (
        <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
          {/* Mobile Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveConversation(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar user={activeConversation} size="w-10 h-10" />
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {activeConversation.name}
                </h2>
                <p className="text-sm text-green-500">En ligne</p>
              </div>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loadingMessages ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Chargement...
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mobile Input */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Tapez votre message..."
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-blue-500"
                  rows={1}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Mobile conversation list
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Messages</h1>
            {isAdmin && (
              <button
                onClick={() => setShowMemberSelector(true)}
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 bg-white dark:bg-gray-800 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Chargement...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Aucune conversation
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.otherId}
                conversation={conv}
                isActive={false}
                onClick={() => setActiveConversation(conv)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // ===== Desktop View =====
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
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
                  onClick={() => setIsBroadcast(!isBroadcast)}
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Chargement...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune conversation trouvée</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.otherId}
                conversation={conv}
                isActive={activeConversation?.otherId === conv.otherId}
                onClick={() => setActiveConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar user={activeConversation} size="w-12 h-12" showOnline={true} />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeConversation.name}
                    </h2>
                    <p className="text-sm text-green-500 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      En ligne
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <Search className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowConversationInfo(!showConversationInfo)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-blue-50/30 to-purple-50/30 dark:from-blue-900/10 dark:to-purple-900/10">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Aucun message dans cette conversation</p>
                    <p className="text-sm mt-2">Commencez la discussion !</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-end space-x-4">
                <div className="flex-1 space-y-2">
                  {/* Subject input for new conversations or important messages */}
                  {(newSubject || !activeConversation.lastAt) && (
                    <input
                      type="text"
                      placeholder="Sujet du message..."
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                  <div className="flex items-end space-x-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tapez votre message..."
                      className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
                      rows={1}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg"
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
                Choisissez une conversation existante dans la liste ou créez-en une nouvelle pour commencer à échanger.
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
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {selectedMembers.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from(selectedMembers).map(memberId => {
                    const member = allMembers.find(m => m.id === memberId);
                    return (
                      <span key={memberId} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        {member?.firstName} {member?.name}
                        <button
                          onClick={() => setSelectedMembers(prev => {
                            const next = new Set(prev);
                            next.delete(memberId);
                            return next;
                          })}
                          className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingMembers ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Chargement...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucun membre trouvé
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      if (selectedMembers.has(member.id)) {
                        setSelectedMembers(prev => {
                          const next = new Set(prev);
                          next.delete(member.id);
                          return next;
                        });
                      } else {
                        setSelectedMembers(prev => new Set([...prev, member.id]));
                      }
                    }}
                    className={`w-full p-3 text-left rounded-xl transition-colors flex items-center space-x-3 ${
                      selectedMembers.has(member.id) 
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    }`}
                  >
                    <Avatar user={member} size="w-10 h-10" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {member.firstName} {member.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.email}
                      </div>
                    </div>
                    {selectedMembers.has(member.id) && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMemberSelector(false);
                    setSelectedMembers(new Set());
                    setMemberSearchQuery("");
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (selectedMembers.size === 1) {
                      const memberId = Array.from(selectedMembers)[0];
                      const member = allMembers.find(m => m.id === memberId);
                      setActiveConversation({
                        otherId: memberId,
                        name: `${member.firstName} ${member.name}`,
                        firstName: member.firstName,
                        lastName: member.name,
                        photo: member.photo,
                        email: member.email,
                        lastBody: "",
                        lastAt: null,
                        unread: 0,
                        isStaff: false
                      });
                      setShowMemberSelector(false);
                      setSelectedMembers(new Set());
                      setMemberSearchQuery("");
                    }
                  }}
                  disabled={selectedMembers.size === 0}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {selectedMembers.size === 1 ? "Ouvrir conversation" : `Groupe (${selectedMembers.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {isBroadcast && (
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
                  onClick={() => {
                    setIsBroadcast(false);
                    setNewMessage("");
                    setNewSubject("");
                  }}
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
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />

              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Votre message à tous les membres..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    defaultChecked
                  />
                  <span>Ne pas m'envoyer une copie</span>
                </label>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setIsBroadcast(false);
                      setNewMessage("");
                      setNewSubject("");
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || !newSubject.trim() || sending}
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
};

export default MessagesPage;