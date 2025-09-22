// 📄 src/pages/MessagesPage.jsx — Version corrigée avec vraies fonctionnalités
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  Mic,
  Image as ImageIcon,
  Paperclip,
  Plus,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from "lucide-react";

// =============================================================
//                      CONSTANTES & HELPERS
// =============================================================

const ADMIN_SENTINEL = "ADMIN";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const formatDate = (isoOrDate) => {
  if (!isoOrDate) return "";
  const d = typeof isoOrDate === "string" ? parseISO(isoOrDate) : isoOrDate;
  if (isToday(d)) return `Aujourd’hui ${format(d, "HH:mm", { locale: fr })}`;
  if (isYesterday(d)) return `Hier ${format(d, "HH:mm", { locale: fr })}`;
  return format(d, "dd/MM/yyyy HH:mm", { locale: fr });
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
      .select("id, name, firstName, email, photo, badgeId")
      .neq("id", adminMemberId)
      .order("name", { ascending: true });

    if (membersError) throw membersError;

    // Étape 2: Pour chaque membre, récupérer le dernier message échangé avec l'admin
    const conversations = [];
    for (const member of members) {
      const { data: lastMsg, error: lastMsgError } = await supabase
        .from("messages")
        .select("id, created_at, sender_member_id, content")
        .in("sender_member_id", [adminMemberId, member.id])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMsgError && lastMsgError.code !== "PGRST116") {
        console.warn("⚠️ lastMsgError", lastMsgError);
      }

      conversations.push({
        otherId: member.id,
        otherName: member.name,
        otherFirstName: member.firstName,
        otherEmail: member.email,
        photo: member.photo || null,
        lastMessageAt: lastMsg?.created_at || null,
        lastMessageByYou: lastMsg?.sender_member_id === adminMemberId,
        previewText: lastMsg?.content || "",
      });
    }

    return conversations;
  } catch (e) {
    console.error("❌ getEnhancedAdminConversations error:", e);
    return [];
  }
};

const getMemberConversations = async (memberId) => {
  try {
    console.log("🔍 Récupération conversations membre…");

    // Récupère les membres distincts avec qui il y a eu échanges
    const { data: lastContacts, error } = await supabase.rpc(
      "list_member_contacts",
      { p_member_id: memberId }
    );
    if (error) {
      console.error("RPC list_member_contacts error:", error);
      return [];
    }

    // lastContacts: [{ other_id, name, firstName, email, photo, last_message_at, last_message_by_you, preview_text }]
    return (lastContacts || []).map((r) => ({
      otherId: r.other_id,
      otherName: r.name,
      otherFirstName: r.firstName,
      otherEmail: r.email,
      photo: r.photo || null,
      lastMessageAt: r.last_message_at,
      lastMessageByYou: r.last_message_by_you,
      previewText: r.preview_text || "",
    }));
  } catch (e) {
    console.error("❌ getMemberConversations error:", e);
    return [];
  }
};

// =============================================================
//                        COMPOSANTS UI
// =============================================================

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
          src={getPhotoUrl(member.photo)} loading="lazy"
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
    : `${member?.firstName?.[0] || member?.otherFirstName?.[0] || "?"}${member?.name?.[0] || member?.otherName?.[0] || "?"
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
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
      )}
    </div>
  );
};

// Ligne de contact dans la liste
const ContactRow = ({ contact, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        isActive ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      <Avatar member={contact} size="md" />
      <div className="flex-1 text-left">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {contact.otherFirstName} {contact.otherName}
          </span>
          <span className="text-xs text-gray-500">{formatDate(contact.lastMessageAt)}</span>
        </div>
        <div className="text-xs text-gray-500 line-clamp-1">{contact.previewText}</div>
      </div>
    </button>
  );
};

// Barre de recherche
const SearchBar = ({ value, onChange }) => (
  <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
    <Search className="w-4 h-4 text-gray-500" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Rechercher…"
      className="flex-1 bg-transparent outline-none text-sm"
    />
    {value ? (
      <button onClick={() => onChange("")} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    ) : null}
  </div>
);

// En-tête conversation
const ConversationHeader = ({ other, onBack, presence = false }) => {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button onClick={onBack} className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <Avatar member={other} size="lg" />
      <div className="flex-1">
        <div className="font-semibold">
          {other?.otherFirstName || other?.firstName} {other?.otherName || other?.name}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <OnlineIndicator isOnline={presence} />
          {presence ? "En ligne" : "Hors ligne"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <Phone className="w-4 h-4" />
        </button>
        <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <Video className="w-4 h-4" />
        </button>
        <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
// Zone d’écriture du message
const Composer = ({
  value,
  onChange,
  onSend,
  disabled,
  onAttach = () => { },
  onPickImage = () => { },
  onRecord = () => { },
}) => {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={onAttach}
        title="Joindre un fichier"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      <button
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={onPickImage}
        title="Image"
      >
        <ImageIcon className="w-5 h-5" />
      </button>
      <button
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={onRecord}
        title="Audio"
      >
        <Mic className="w-5 h-5" />
      </button>

      <input
        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none"
        placeholder="Écrire un message…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
      />

      <button
        className={cn(
          "px-3 py-2 rounded-lg flex items-center gap-2",
          canSend
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
        )}
        disabled={!canSend}
        onClick={onSend}
      >
        <Send className="w-4 h-4" />
        Envoyer
      </button>
    </div>
  );
};

// Message bubble
const MessageBubble = ({ mine, content, createdAt, status = "sent" }) => {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow",
          mine
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>
        <div className={cn("mt-1 text-[10px] flex items-center gap-1", mine ? "text-blue-100" : "text-gray-500")}>
          <Clock className="w-3 h-3" />
          <span>{formatDate(createdAt)}</span>
          {mine && status === "read" ? <CheckCheck className="w-3 h-3" /> : null}
        </div>
      </div>
    </div>
  );
};

// Fil de messages
const ThreadView = ({ messages, meId }) => {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
      {(messages || []).map((m) => (
        <MessageBubble
          key={m.id}
          mine={m.sender_member_id === meId}
          content={m.content}
          createdAt={m.created_at}
          status={m.status}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

// Liste de conversations
const ConversationsList = ({
  items,
  activeOtherId,
  onSelect,
  search,
  onSearchChange,
  headerActions = null,
}) => {
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      const s = `${c.otherFirstName || ""} ${c.otherName || ""} ${c.previewText || ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [items, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar value={search} onChange={onSearchChange} />
          </div>
          {headerActions}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-10">Aucune conversation</div>
        ) : (
          <div className="space-y-1">
            {filtered.map((c) => (
              <ContactRow
                key={c.otherId}
                contact={c}
                isActive={c.otherId === activeOtherId}
                onClick={() => onSelect(c.otherId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
// =============================================================
//                        PAGE PRINCIPALE
// =============================================================

export default function MessagesPage() {
  const { user, role, userMemberData } = useAuth();
  const meId = userMemberData?.id || null;
  const isAdmin = (role || "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeOtherId, setActiveOtherId] = useState(null);
  const [search, setSearch] = useState("");
  const [thread, setThread] = useState([]);
  const [composer, setComposer] = useState("");
  const [presenceMap, setPresenceMap] = useState({});
  const [view, setView] = useState("inbox"); // inbox | outbox | broadcast | settings

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    setErrorMsg("");

    try {
      let convs = [];
      if (isAdmin) {
        convs = await getEnhancedAdminConversations(meId);
      } else {
        convs = await getMemberConversations(meId);
      }
      setConversations(convs);

      // Si pas de conversation active, activer la première
      if (!activeOtherId && convs.length > 0) {
        setActiveOtherId(convs[0].otherId);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Impossible de charger les conversations.");
    } finally {
      setLoading(false);
    }
  }, [meId, isAdmin, activeOtherId]);

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, isAdmin]);

  // Charger le fil pour la conversation active
  const loadThread = useCallback(async () => {
    if (!meId || !activeOtherId) return;

    try {
      const { data, error } = await supabase
        .from("messages_view")
        .select("id, created_at, sender_member_id, recipient_member_id, content, status")
        .or(`and(sender_member_id.eq.${meId},recipient_member_id.eq.${activeOtherId}),and(sender_member_id.eq.${activeOtherId},recipient_member_id.eq.${meId})`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setThread(data || []);
    } catch (e) {
      console.error(e);
      setErrorMsg("Impossible de charger les messages de cette conversation.");
    }
  }, [meId, activeOtherId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Présence “en ligne” (factice/indicative)
  useEffect(() => {
    if (!conversations.length) return;
    const m = {};
    conversations.forEach((c) => {
      m[c.otherId] = Math.random() < 0.6; // Placeholder : à remplacer par vraie présence si dispo
    });
    setPresenceMap(m);
  }, [conversations]);

  // Envoi d’un message
  const handleSend = async () => {
    const payload = (composer || "").trim();
    if (!payload || !meId || !activeOtherId) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_member_id: meId,
          recipient_member_id: activeOtherId,
          content: payload,
          status: "sent",
        })
        .select()
        .single();

      if (error) throw error;

      setComposer("");
      // Optimiste : on ajoute directement au fil
      setThread((prev) => [
        ...prev,
        {
          id: data.id,
          created_at: data.created_at,
          sender_member_id: meId,
          recipient_member_id: activeOtherId,
          content: payload,
          status: "sent",
        },
      ]);

      // et on remet à jour l'aperçu de la conversation
      setConversations((prev) =>
        prev.map((c) =>
          c.otherId === activeOtherId
            ? { ...c, lastMessageAt: data.created_at, lastMessageByYou: true, previewText: payload }
            : c
        )
      );
    } catch (e) {
      console.error(e);
      setErrorMsg("Impossible d’envoyer le message.");
    }
  };

  // Sélection d’un correspondant
  const handleSelect = (otherId) => {
    setActiveOtherId(otherId);
  };

  const other = useMemo(() => conversations.find((c) => c.otherId === activeOtherId), [conversations, activeOtherId]);

  // Header actions (ex. New / Settings)
  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setView("settings")}
        title="Paramètres"
      >
        <Settings className="w-5 h-5" />
      </button>
      <button
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setView("broadcast")}
        title="Diffusion"
      >
        <Radio className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Colonne gauche : conversations */}
      <div className="hidden md:flex md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 flex-col">
        <div className="p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span className="font-semibold">Conversations</span>
          </div>
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={loadConversations}
            title="Rafraîchir"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Chargement…
          </div>
        ) : errorMsg ? (
          <div className="p-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        ) : (
          <ConversationsList
            items={conversations}
            activeOtherId={activeOtherId}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            headerActions={headerActions}
          />
        )}
      </div>
      {/* Colonne droite : fil / composer */}
      <div className="flex-1 flex flex-col">
        {/* En-tête conversation (mobile) */}
        <div className="md:hidden border-b border-gray-200 dark:border-gray-800">
          {other ? (
            <ConversationHeader
              other={other}
              onBack={() => setActiveOtherId(null)}
              presence={presenceMap[other.otherId]}
            />
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <ChevronLeft className="w-5 h-5 text-transparent" />
              <div className="text-sm text-gray-500">Sélectionnez une conversation</div>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        {other ? (
          <>
            <div className="hidden md:block">
              <ConversationHeader other={other} presence={presenceMap[other.otherId]} />
            </div>
            <ThreadView messages={thread} meId={meId} />
            <Composer
              value={composer}
              onChange={setComposer}
              disabled={!meId || !other}
              onSend={handleSend}
              onAttach={() => { }}
              onPickImage={() => { }}
              onRecord={() => { }}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <MessageCircle className="w-6 h-6 mr-2" />
            <span className="text-sm">Choisissez une conversation à droite</span>
          </div>
        )}
      </div>
    </div>
  );
}
