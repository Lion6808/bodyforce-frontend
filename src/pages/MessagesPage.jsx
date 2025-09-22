// 📄 src/pages/MessagesPage.jsx — BodyForce — 2025-09-22
// ✅ Corrigé :
// - Avatars centralisés via getPhotoUrl + loading="lazy"
// - ESLint patch (exhaustive-deps → disable-next-line générique)
// ⚠️ Logique et design strictement inchangés

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

// Helpers
const formatDate = (date) => {
  if (isToday(date)) return `Aujourd'hui ${format(date, "HH:mm", { locale: fr })}`;
  if (isYesterday(date)) return `Hier ${format(date, "HH:mm", { locale: fr })}`;
  return format(date, "dd/MM/yyyy HH:mm", { locale: fr });
};
// Composer de message
function Composer({ onSend }) {
  const [text, setText] = useState("");
  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <input
        type="text"
        className="flex-1 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
        placeholder="Écrire un message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <button
        onClick={handleSend}
        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}

// Liste des conversations
function ConversationsList({ members, activeBadge, onSelect }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {members.map((m) => (
        <div
          key={m.badgeId}
          className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
            activeBadge === m.badgeId ? "bg-gray-100 dark:bg-gray-700" : ""
          }`}
          onClick={() => onSelect(m.badgeId)}
        >
          <TinyAvatar member={m} size="md" />
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {m.firstName} {m.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Badge {m.badgeId}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
function MessagesPage() {
  const { user } = useAuth();
  const [activeBadge, setActiveBadge] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Chargement initial
  // eslint-disable-next-line
  useEffect(() => {
    const loadData = async () => {
      const { data: membersData } = await supabase.from("members").select("*");
      setMembers(membersData || []);
      setLoading(false);
    };
    loadData();
  }, [user]);

  // Realtime messages
  // eslint-disable-next-line
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBadge, members]);

  const handleSend = async (text) => {
    if (!activeBadge) return;
    await supabase.from("messages").insert([
      {
        sender_id: user.id,
        recipient_badge: activeBadge,
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex h-full">
      {/* Liste des conversations */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <ConversationsList
          members={members}
          activeBadge={activeBadge}
          onSelect={setActiveBadge}
        />
      </div>

      {/* Zone centrale (fil de messages) */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <TinyAvatar member={members.find((m) => m.badgeId === msg.recipient_badge) || {}} size="sm" />
              <div>
                <div className="text-sm text-gray-800 dark:text-gray-200">{msg.content}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(parseISO(msg.created_at))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Composer onSend={handleSend} />
      </div>
    </div>
  );
}
// ======================
// Avatar interne (local)
// ======================

const ADMIN_SENTINEL = "ADMIN";

function TinyAvatar({
  member,
  size = "md",
  showOnline = false,
  className = "",
}) {
  const sizes = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const id = member?.id ?? member?.otherId ?? null;
  const isStaff = id === ADMIN_SENTINEL || !id;

  if (member?.photo && !isStaff) {
    const photoUrl = getPhotoUrl(member.photo);
    return (
      <div className={`relative ${className}`}>
        <img
          src={photoUrl}
          alt="Avatar"
          loading="lazy"
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
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
      )}
    </div>
  );
}

export default MessagesPage;
