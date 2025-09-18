import React, { useEffect, useMemo, useRef, useState } from "react";
import { 
  MessageCircle, 
  Search, 
  Send, 
  MoreVertical, 
  Users, 
  Broadcast,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
  X,
  Plus,
  ArrowLeft,
  Settings,
  Filter
} from "lucide-react";

// Mock data pour la démonstration
const mockUser = {
  id: "user-1",
  role: "admin"
};

const mockMe = {
  id: 1,
  firstName: "Sophie",
  name: "Martin",
  email: "sophie.martin@bodyforce.com",
  photo: null
};

const mockMembers = [
  { id: 1, firstName: "Sophie", name: "Martin", email: "sophie.martin@bf.com", photo: null, badgeId: "001" },
  { id: 2, firstName: "Pierre", name: "Dupont", email: "pierre.dupont@bf.com", photo: null, badgeId: "002" },
  { id: 3, firstName: "Marie", name: "Bernard", email: "marie.bernard@bf.com", photo: null, badgeId: "003" },
  { id: 4, firstName: "Thomas", name: "Petit", email: "thomas.petit@bf.com", photo: null, badgeId: "004" },
  { id: 5, firstName: "Julie", name: "Robert", email: "julie.robert@bf.com", photo: null, badgeId: "005" },
];

const mockConversations = [
  {
    otherId: -1,
    name: "Équipe BodyForce",
    photo: null,
    lastBody: "Merci pour votre retour concernant les nouveaux horaires",
    lastAt: new Date().toISOString(),
    unread: 2,
    isStaff: true
  },
  {
    otherId: 2,
    name: "Pierre Dupont",
    firstName: "Pierre",
    lastName: "Dupont",
    photo: null,
    lastBody: "D'accord pour le rendez-vous de demain",
    lastAt: new Date(Date.now() - 3600000).toISOString(),
    unread: 0,
    isStaff: false
  },
  {
    otherId: 3,
    name: "Marie Bernard",
    firstName: "Marie",
    lastName: "Bernard",
    photo: null,
    lastBody: "Parfait, je confirme ma présence",
    lastAt: new Date(Date.now() - 7200000).toISOString(),
    unread: 1,
    isStaff: false
  }
];

const mockMessages = [
  {
    id: 1,
    kind: "in",
    subject: "Nouveaux horaires",
    body: "Bonjour, j'aimerais connaître les nouveaux horaires d'ouverture de la salle.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    author_member_id: 2
  },
  {
    id: 2,
    kind: "out",
    subject: "Re: Nouveaux horaires",
    body: "Bonjour Pierre, les nouveaux horaires sont : Lun-Ven 6h-22h, Sam-Dim 8h-20h. N'hésitez pas si vous avez d'autres questions !",
    created_at: new Date(Date.now() - 82800000).toISOString(),
    author_member_id: 1
  },
  {
    id: 3,
    kind: "in",
    subject: "",
    body: "Merci beaucoup pour ces informations !",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    author_member_id: 2
  }
];

const MessagesPage = () => {
  const [user] = useState(mockUser);
  const [me] = useState(mockMe);
  const [role] = useState("admin");
  const isAdmin = role === "admin";

  // States
  const [conversations, setConversations] = useState(mockConversations);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState(mockMessages);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const messagesEndRef = useRef(null);

  // Responsive handling
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.name.toLowerCase().includes(query) ||
      conv.lastBody.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Utility functions
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      kind: "out",
      subject: newSubject || "",
      body: newMessage,
      created_at: new Date().toISOString(),
      author_member_id: me.id
    };

    setMessages(prev => [...prev, message]);
    setNewMessage("");
    setNewSubject("");
    setShowComposer(false);
  };

  // Avatar Component
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

  // Conversation Item Component
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
                {formatTime(conversation.lastAt)}
              </span>
              {conversation.unread > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full animate-pulse">
                  {conversation.unread}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {conversation.lastBody}
          </p>
        </div>
      </div>
    </button>
  );

  // Message Bubble Component
  const MessageBubble = ({ message, isOwn }) => {
    const time = formatTime(message.created_at);
    
    return (
      <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"} group`}>
        {!isOwn && (
          <Avatar 
            user={{ 
              firstName: "Pierre", 
              lastName: "Dupont",
              photo: null,
              isStaff: message.author_member_id === -1
            }} 
            size="w-8 h-8" 
          />
        )}
        <div className={`max-w-xs lg:max-w-md xl:max-w-lg mx-2 ${isOwn ? "order-1" : "order-2"}`}>
          <div className={`px-4 py-2 rounded-2xl shadow-sm relative ${
            isOwn 
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" 
              : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
          }`}>
            {message.subject && (
              <div className={`text-sm font-semibold mb-1 ${
                isOwn ? "text-blue-100" : "text-gray-900 dark:text-gray-100"
              }`}>
                {message.subject}
              </div>
            )}
            <p className={`text-sm ${
              isOwn ? "text-white" : "text-gray-800 dark:text-gray-200"
            }`}>
              {message.body}
            </p>
            <div className={`text-xs mt-1 flex items-center ${
              isOwn ? "text-blue-200 justify-end" : "text-gray-500 dark:text-gray-400"
            }`}>
              {time}
              {isOwn && (
                <CheckCheck className="w-3 h-3 ml-1" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mobile view handling
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
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.author_member_id === me.id}
              />
            ))}
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
                disabled={!newMessage.trim()}
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
                onClick={() => setShowComposer(true)}
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
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.otherId}
              conversation={conv}
              isActive={false}
              onClick={() => setActiveConversation(conv)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop view
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
                  <Broadcast className="w-4 h-4" />
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
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.otherId}
              conversation={conv}
              isActive={activeConversation?.otherId === conv.otherId}
              onClick={() => setActiveConversation(conv)}
            />
          ))}
          
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune conversation trouvée</p>
            </div>
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
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.author_member_id === me.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-end space-x-4">
                <div className="flex-1 space-y-2">
                  {/* Subject input for new conversations */}
                  {!activeConversation.lastAt && (
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
                      disabled={!newMessage.trim()}
                      className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg"
                    >
                      <Send className="w-5 h-5" />
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
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Choisissez une conversation existante dans la liste ou créez-en une nouvelle pour commencer à échanger.
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowMemberSelector(true)}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
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
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {mockMembers.filter(m => m.id !== me.id).map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setActiveConversation({
                      otherId: member.id,
                      name: `${member.firstName} ${member.name}`,
                      firstName: member.firstName,
                      lastName: member.name,
                      photo: member.photo,
                      lastBody: "",
                      lastAt: null,
                      unread: 0,
                      isStaff: false
                    });
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
              ))}
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
                    <Broadcast className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Message de diffusion</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer un message à tous les membres
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBroadcast(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
                  <Broadcast className="w-4 h-4" />
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
                    onClick={() => setIsBroadcast(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      handleSendMessage();
                      setIsBroadcast(false);
                    }}
                    disabled={!newMessage.trim() || !newSubject.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Broadcast className="w-4 h-4 inline mr-2" />
                    Diffuser
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Info Sidebar */}
      {showConversationInfo && activeConversation && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Informations</h3>
              <button
                onClick={() => setShowConversationInfo(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-center">
              <Avatar user={activeConversation} size="w-20 h-20" />
              <h4 className="text-xl font-semibold mt-4 mb-2">
                {activeConversation.name}
              </h4>
              <p className="text-sm text-green-500 flex items-center justify-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                En ligne
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Actions rapides
              </h5>
              <div className="space-y-2">
                <button className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center space-x-3">
                  <Search className="w-5 h-5 text-gray-500" />
                  <span>Rechercher dans la conversation</span>
                </button>
                <button className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-gray-500" />
                  <span>Paramètres de notification</span>
                </button>
              </div>
            </div>

            {activeConversation.isStaff && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Équipe BodyForce
                </h5>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <Avatar user={{ isStaff: true }} size="w-8 h-8" />
                    <div>
                      <div className="text-sm font-medium">Support technique</div>
                      <div className="text-xs text-gray-500">En ligne</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <Avatar user={{ isStaff: true }} size="w-8 h-8" />
                    <div>
                      <div className="text-sm font-medium">Administration</div>
                      <div className="text-xs text-gray-500">En ligne</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Médias partagés
              </h5>
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;