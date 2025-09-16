// 📄 src/components/MemberMessagesTab.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { listThreadWithMember, sendToMember } from "../services/messagesService";
import { format, parseISO } from "date-fns";
import { supabase } from "../supabaseClient";

export default function MemberMessagesTab({ memberId }) {
  const { user, role, userMemberData: me } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  const [thread, setThread] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // Charge le thread
  useEffect(() => {
    if (!memberId || !user) return;
    (async () => {
      const data = await listThreadWithMember(memberId);
      setThread(data);
      scrollToEnd();
    })();
  }, [memberId, user]);

  // Realtime sur messages reçus par CE membre (insert)
  useEffect(() => {
    if (!memberId) return;
    const ch = supabase
      .channel(`thread_member_${memberId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message_recipients",
        filter: `recipient_member_id=eq.${memberId}`,
      }, async () => {
        const data = await listThreadWithMember(memberId);
        setThread(data);
        scrollToEnd();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [memberId]);

  const scrollToEnd = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  const onSend = async () => {
    if (!isAdmin || !subject.trim() || !body.trim() || !me?.id) return;
    setSending(true);
    try {
      await sendToMember({
        toMemberId: memberId,
        subject,
        body,
        authorMemberId: me.id,
      });
      setSubject("");
      setBody("");
      // recharge (ou push optimiste, ici reload simple)
      const data = await listThreadWithMember(memberId);
      setThread(data);
      scrollToEnd();
    } finally {
      setSending(false);
    }
  };

  const bubble = (msg) => {
    // côté admin : si author_member_id === memberId => message du membre (gauche), sinon message admin (droite)
    const isMine = msg.author_member_id !== memberId; // "moi" = admin
    const created = typeof msg.created_at === "string" ? parseISO(msg.created_at) : new Date(msg.created_at);
    return (
      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow
          ${isMine ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"}`}>
          {msg.subject && <div className="text-xs opacity-90 font-semibold mb-1">{msg.subject}</div>}
          <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
          <div className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>
            {format(created, "dd/MM/yyyy HH:mm")}
          </div>
        </div>
      </div>
    );
  };

  if (!isAdmin) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Seuls les administrateurs peuvent envoyer ici.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fil */}
      <div className="flex-1 overflow-y-auto p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {thread.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">Aucune conversation pour le moment.</div>
        )}
        {thread.map(bubble)}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-3 grid grid-cols-1 gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Sujet"
        />
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Écrire un message…"
        />
        <div className="flex justify-end">
          <button
            onClick={onSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
