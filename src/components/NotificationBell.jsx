// 📄 src/components/NotificationBell.jsx
import React, { useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { countUnread, subscribeInbox } from "../services/messagesService";

export default function NotificationBell() {
  const { user, userMemberData: member } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let sub;
    (async () => {
      if (!user || !member?.id) return;
      const refresh = async () => {
        try {
          const n = await countUnread(member.id);
          setUnread(n || 0);
        } catch (e) {
          // Optionnel: log e
        }
      };
      await refresh(); // initial
      sub = subscribeInbox(member.id, async () => {
        await refresh(); // à chaque INSERT/UPDATE
      });
    })();
    return () => sub?.unsubscribe?.();
  }, [user, member?.id]);

  if (!user || !member?.id) return null;

  return (
    <button
      onClick={() => navigate("/messages")}
      className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      aria-label="Messages"
      title="Messages"
      type="button"
    >
      <FaBell className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 text-xs rounded-full bg-red-600 text-white flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
