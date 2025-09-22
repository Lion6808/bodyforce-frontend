// 📄 src/pages/MessagesPage.js — BodyForce — 2025-09-22
// 🎯 Objectif : page Messages complète, avatars centralisés via <Avatar> (lazy + URL mémoïsée)
// ⚠️ Si besoin, ajuste les noms de colonnes marqués // TODO pour coller à ton schéma.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../contexts/AuthContext";
import {
  Send,
  RefreshCw,
  AlertCircle,
  Search,
  Users,
  Image as ImageIcon,
  Paperclip,
  Loader2,
  ChevronDown,
} from "lucide-react";
import Avatar from "../components/Avatar"; // ← composant centralisé
// import { getPhotoUrl } from "../supabaseClient"; // si besoin direct

// ───────────────────────────────────────────────────────────────────────────────
// Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Tailwind helpers
const cn = (...classes) => classes.filter(Boolean).join(" ");

const ui = {
  page: "min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4",
  maxW: "max-w-6xl mx-auto",
  card: "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
  headerCard: "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4",
  input:
    "w-full border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500",
  buttonPrimary:
    "px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-60",
  buttonGhost:
    "px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition",
  badge:
    "px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
};

// Dates utils
const f = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtTime = (iso) => (iso ? f.format(new Date(iso)) : "");
const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

// ───────────────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, role } = useAuth(); // role si nécessaire (admin/mod)
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeBadge, setActiveBadge] = useState(null); // fil privé par membre (ex: DM)
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paging, setPaging] = useState(false);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Pagination
  const PAGE_SIZE = 50;

  // ────────────────────────────────────────────────────────────────────────────
  // Chargement des membres + premier lot de messages
  const loadMembers = async () => {
    // TODO: adapte la table/colonnes si besoin (members: badgeId, name, firstName, avatarUrl/photo)
    const { data, error } = await supabase.from("members").select("*");
    if (error) throw new Error(error.message);
    setMembers(Array.isArray(data) ? data : []);
  };

  const loadMessages = async ({ append = false } = {}) => {
    // TODO: adapte la table/colonnes si besoin
    // Table: messages
    // Colonnes attendues: id, created_at, content, sender_badge (ou senderBadgeId), recipient_badge (optionnel si DM), attachments (array/json)
    // Si tu n'as QUE du canal global, ignore recipient_badge dans le filtre.
    const base = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (activeBadge) {
      // Filtre DM: soit (sender=me AND recipient=active) OR (sender=active AND recipient=me)
      // On utilise RPC/SQL custom ? Ici 2 requêtes simples mergées.
      const meBadge = getMyBadge();
      const { data: d1, error: e1 } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_badge.eq.${meBadge},recipient_badge.eq.${activeBadge}),and(sender_badge.eq.${activeBadge},recipient_badge.eq.${meBadge})`
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (e1) throw new Error(e1.message);

      const newChunk = Array.isArray(d1) ? d1 : [];
      setHasMore(newChunk.length === PAGE_SIZE);
      setMessages((prev) =>
        append ? [...prev, ...newChunk] : newChunk
      );
      return;
    }

    const { data, error } = await base;
    if (error) throw new Error(error.message);
    const chunk = Array.isArray(data) ? data : [];
    setHasMore(chunk.length === PAGE_SIZE);
    setMessages((prev) => (append ? [...prev, ...chunk] : chunk));
  };

  const getMyBadge = () => {
    // TODO: ajuste selon ton mapping user -> member
    // Par défaut, on suppose user.email et members.email (sinon stocke badgeId dans le profil auth)
    const me =
      members.find((m) => m.email && m.email === user?.email) ||
      members.find((m) => m.user_id && m.user_id === user?.id) ||
      null;
    return me?.badgeId || null;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        await loadMembers();
        await loadMessages();
      } catch (e) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
        // auto scroll bas
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBadge]);

  // Realtime (optionnel) — écouter les nouveaux messages
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new;
          // Filtre : si DM actif, n'ajoute que s'il correspond à la conv
          if (activeBadge) {
            const meBadge = getMyBadge();
            const ok =
              (row.sender_badge === meBadge && row.recipient_badge === activeBadge) ||
              (row.sender_badge === activeBadge && row.recipient_badge === meBadge);
            if (!ok) return;
          } else {
            // canal global
            if (row.recipient_badge) return; // on ignore les DM si on est en global
          }
          setMessages((prev) => [row, ...prev]);
          // scroll vers le bas si auteur == moi
          if (row.sender_badge === getMyBadge()) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBadge, members]);

  // Recherche texte locale (simple)
  const filteredMessages = useMemo(() => {
    if (!query.trim()) return messages;
    const q = query.toLowerCase();
    return messages.filter((m) => (m.content || "").toLowerCase().includes(q));
  }, [messages, query]);

  // Grouping par jour
  const groups = useMemo(() => {
    const out = [];
    let current = [];
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      const msg = filteredMessages[i];
      if (
        current.length === 0 ||
        isSameDay(current[current.length - 1]?.created_at, msg.created_at)
      ) {
        current.push(msg);
      } else {
        out.push(current);
        current = [msg];
      }
    }
    if (current.length) out.push(current);
    return out; // chaque groupe = messages d'une même journée (du plus ancien au plus récent)
  }, [filteredMessages]);

  // Charger plus (pagination ancienne)
  const loadMore = async () => {
    if (!hasMore || paging || messages.length === 0) return;
    try {
      setPaging(true);
      // dernière date courante (la plus ancienne)
      const oldest = messages[messages.length - 1]?.created_at;
      if (!oldest) return;

      let qry = supabase
        .from("messages")
        .select("*")
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (activeBadge) {
        const meBadge = getMyBadge();
        qry = supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_badge.eq.${meBadge},recipient_badge.eq.${activeBadge}),and(sender_badge.eq.${activeBadge},recipient_badge.eq.${meBadge})`
          )
          .lt("created_at", oldest)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
      }

      const { data, error } = await qry;
      if (error) throw new Error(error.message);
      const chunk = Array.isArray(data) ? data : [];
      setHasMore(chunk.length === PAGE_SIZE);
      setMessages((prev) => [...prev, ...chunk]);
    } catch (e) {
      setError(e.message || "Erreur de pagination");
    } finally {
      setPaging(false);
    }
  };

  // Envoi d’un message
  const onSend = async () => {
    if (!text.trim()) return;
    try {
      setSending(true);
      setError("");
      const meBadge = getMyBadge();

      // TODO: si tu n'as pas de DM, retire recipient_badge
      const payload = {
        content: text.trim(),
        sender_badge: meBadge,
        recipient_badge: activeBadge || null,
      };

      const { error } = await supabase.from("messages").insert([payload]);
      if (error) throw new Error(error.message);
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (e) {
      setError(e.message || "Impossible d’envoyer le message");
    } finally {
      setSending(false);
    }
  };

  const onAttachClick = () => fileInputRef.current?.click();

  const onAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      // TODO: si tu gères des pièces jointes, uploade dans Supabase Storage avec cacheControl long
      // const path = `messages/${Date.now()}_${file.name}`;
      // const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
      //   cacheControl: "31536000",
      //   upsert: true,
      // });
      // if (upErr) throw new Error(upErr.message);
      // Ici, on poste juste un message “fichier joint” à titre d’exemple:
      setText((t) => (t ? `${t} [fichier: ${file.name}]` : `[fichier: ${file.name}]`));
    } catch (e2) {
      setError(e2.message || "Échec upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const meBadge = getMyBadge();

  // ────────────────────────────────────────────────────────────────────────────
  // UI Header
  const Header = () => (
    <div className={ui.headerCard}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Messages</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Discussions {activeBadge ? "privées" : "canal général"}
              {activeBadge && (
                <span className={cn(ui.badge, "ml-2")}>
                  avec {members.find((m) => m.badgeId === activeBadge)?.firstName || "Membre"} #
                  {activeBadge}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={cn(ui.input, "pl-9 w-64")}
              placeholder="Rechercher un message…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={ui.buttonGhost}
            onClick={() => {
              setQuery("");
              setActiveBadge(null);
            }}
            title="Réinitialiser"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  // Liste des membres (DM)
  const MembersSidebar = () => {
    const [filter, setFilter] = useState("");
    const list = useMemo(() => {
      const base = [...members];
      if (!filter.trim()) return base;
      const q = filter.toLowerCase();
      return base.filter(
        (m) =>
          `${m.name || ""} ${m.firstName || ""}`.toLowerCase().includes(q) ||
          (m.badgeId || "").toString().includes(q)
      );
    }, [members, filter]);

    return (
      <div className={cn(ui.card, "p-3 h-full flex flex-col")}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={cn(ui.input, "pl-9")}
            placeholder="Rechercher un membre…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="mt-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(100vh - 280px)" }}>
          {list.map((m) => (
            <button
              key={m.badgeId}
              onClick={() => setActiveBadge(m.badgeId)}
              className={cn(
                "w-full text-left p-2 rounded-lg flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition",
                activeBadge === m.badgeId && "bg-gray-100 dark:bg-gray-700"
              )}
            >
              {m.photo || m.avatarUrl ? (
                <Avatar member={m} size="w-9 h-9" className="border border-blue-200 dark:border-blue-600" />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {m.firstName?.[0] || ""}
                  {m.name?.[0] || ""}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {m.firstName} {m.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Badge {m.badgeId}</div>
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-3">Aucun membre</div>
          )}
        </div>

        <button
          onClick={() => setActiveBadge(null)}
          className={cn(ui.buttonPrimary, "mt-auto justify-center")}
          title="Revenir au canal général"
        >
          <ChevronDown className="w-4 h-4" />
          Canal général
        </button>
      </div>
    );
  };

  // Bulle message
  const MessageBubble = ({ msg }) => {
    const sender = members.find((m) => m.badgeId === msg.sender_badge) || {};
    const mine = msg.sender_badge === meBadge;
    return (
      <div className={cn("flex gap-3 items-end", mine ? "justify-end" : "justify-start")}>
        {!mine && (
          sender.photo || sender.avatarUrl ? (
            <Avatar member={sender} size="w-8 h-8" className="border border-blue-200 dark:border-blue-600 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {sender.firstName?.[0] || ""}
              {sender.name?.[0] || ""}
            </div>
          )
        )}
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-4 py-2 shadow",
            mine
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm"
              : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm"
          )}
        >
          <div className="text-xs opacity-80 mb-0.5">
            {sender.firstName} {sender.name} • {fmtTime(msg.created_at)}
          </div>
          <div className="whitespace-pre-wrap break-words text-sm">{msg.content}</div>
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs opacity-90">
              <Paperclip className="w-4 h-4" />
              {msg.attachments.length} pièce(s) jointe(s)
            </div>
          )}
        </div>
        {mine && (
          sender.photo || sender.avatarUrl ? (
            <Avatar member={sender} size="w-8 h-8" className="border border-blue-200 dark:border-blue-600 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {sender.firstName?.[0] || ""}
              {sender.name?.[0] || ""}
            </div>
          )
        )}
      </div>
    );
  };

  // Zone composition
  const Composer = () => (
    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-end gap-2">
        <button
          onClick={onAttachClick}
          className={cn(ui.buttonGhost, "h-10 w-10 flex items-center justify-center")}
          title="Joindre un fichier"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
          className="hidden"
          onChange={onAttachFile}
        />

        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          className={cn(ui.input, "flex-1 resize-none")}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSend();
          }}
        />
        <button
          onClick={onSend}
          disabled={sending || !text.trim()}
          className={cn(ui.buttonPrimary, "h-10")}
          title="Envoyer (Ctrl/⌘+Entrée)"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          Envoyer
        </button>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Rendu

  if (loading) {
    return (
      <div className={ui.page}>
        <div className={ui.maxW}>
          <div className={cn(ui.card, "p-12 flex items-center justify-center")}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-white animate-spin" />
              </div>
              <div className="text-gray-700 dark:text-gray-300">Chargement des messages…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={ui.page}>
        <div className={ui.maxW}>
          <div className={cn(ui.card, "p-10 text-center")}>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Erreur</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <button
              onClick={() => {
                setError("");
                setLoading(true);
                Promise.all([loadMembers(), loadMessages()])
                  .catch((e) => setError(e.message || "Erreur"))
                  .finally(() => setLoading(false));
              }}
              className={ui.buttonPrimary}
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className={ui.maxW}>
        <Header />

        <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-4">
          {/* Sidebar membres */}
          <MembersSidebar />

          {/* Zone messages */}
          <div className={cn(ui.card, "flex flex-col min-h-[70vh]")}>
            {/* Bouton charger plus (anciens) */}
            <div className="p-2 flex justify-center">
              <button
                onClick={loadMore}
                disabled={!hasMore || paging}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition",
                  (!hasMore || paging) && "opacity-60 cursor-default"
                )}
              >
                {paging ? "Chargement…" : hasMore ? "Charger plus de messages" : "Fin de l’historique"}
              </button>
            </div>

            {/* Liste messages */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
              {groups.length === 0 && (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  Aucun message pour l’instant.
                </div>
              )}

              {groups.map((group, idx) => (
                <div key={idx} className="mb-6">
                  {/* Séparateur date */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {new Date(group[0].created_at).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                  </div>

                  <div className="space-y-3">
                    {group.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <Composer />
          </div>
        </div>
      </div>
    </div>
  );
}
