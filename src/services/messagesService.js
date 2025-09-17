// 📄 src/services/messagesService.js
// Service de messagerie Supabase (messages + destinataires + Realtime)
// Compatible avec members(id: bigint, user_id: uuid) et les RLS définies.
//
// Expose :
// - getMemberIdByUserId(userId)
// - listInbox(memberId, {limit, offset})
// - countUnread(memberId)
// - markRead(receiptId)
// - sendMessage({ subject, body, recipientMemberIds, authorMemberId, isBroadcast, excludeAuthor })
// - subscribeInbox(memberId, onChange)
// - listSentByCurrentAdmin({limit, offset})
// - fetchAdminMemberIds()
// - listThreadWithMember(memberId)
// - listMyThread(myMemberId)
// - sendToMember({ toMemberId, subject, body, authorMemberId })
// - sendToAdmins({ subject, body, authorMemberId })
// - sendBroadcast({ subject, body, excludeAuthor })
// - markAllRead(), markConversationRead(otherMemberId)

import { supabase } from "../supabaseClient";

/** Récupère l'id du membre lié à un user_id (auth.uid) */
export async function getMemberIdByUserId(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Liste la boîte de réception d'un membre */
export async function listInbox(memberId, { limit = 50, offset = 0 } = {}) {
  if (!memberId) return [];
  const { data, error } = await supabase
    .from("message_recipients")
    .select(
      `
      id,
      message_id,
      read_at,
      created_at,
      messages:message_id (
        id,
        subject,
        body,
        created_at,
        is_broadcast,
        author_user_id,
        author_member_id
      )
    `
    )
    .eq("recipient_member_id", memberId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

/** Compte les messages non lus d'un membre */
export async function countUnread(memberId) {
  if (!memberId) return 0;
  const { count, error } = await supabase
    .from("message_recipients")
    .select("id", { count: "exact", head: true })
    .eq("recipient_member_id", memberId)
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

/** Marque un message (ligne recipient) comme lu */
export async function markRead(receiptId) {
  if (!receiptId) return;
  const { error } = await supabase
    .from("message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", receiptId);
  if (error) throw error;
}

/**
 * Envoie un message
 * - Crée 1 ligne dans `messages`
 * - Crée N lignes dans `message_recipients`
 */
export async function sendMessage({
  subject,
  body,
  recipientMemberIds = [],
  authorMemberId = null,
  isBroadcast = false,
  excludeAuthor = true,
}) {
  if (!subject?.trim() || !body?.trim()) {
    throw new Error("Sujet et message requis.");
  }

  // User courant (pour author_user_id)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error("Utilisateur non authentifié.");

  // ✅ Toujours essayer d'avoir author_member_id (fallback si non fourni)
  let authorMemberIdFinal = authorMemberId ?? null;
  if (!authorMemberIdFinal) {
    try {
      authorMemberIdFinal = await getMemberIdByUserId(user.id);
    } catch {
      /* no-op */
    }
  }

  // 1) Créer le message (renseigner user + member pour robustesse)
  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .insert({
      subject: subject.trim(),
      body: body.trim(),
      is_broadcast: Boolean(isBroadcast),
      author_user_id: user.id,                // ✅
      author_member_id: authorMemberIdFinal,  // ✅ (peut rester null si introuvable)
    })
    .select("*")
    .single();
  if (msgErr) throw msgErr;

  // 2) Construire la liste des destinataires
  let targets = recipientMemberIds;

  if (isBroadcast) {
    // Tous les membres (tu peux remplacer par une vue active_members si besoin)
    const { data: allMembers, error: mErr } = await supabase
      .from("members")
      .select("id");
    if (mErr) throw mErr;
    targets = (allMembers || []).map((m) => m.id);
  }

  // Nettoyage : unique + numériques
  targets = Array.from(
    new Set(
      (targets || [])
        .map((x) => (typeof x === "string" ? Number(x) : x))
        .filter((x) => Number.isFinite(x))
    )
  );

  // Exclure l'auteur si demandé
  if (excludeAuthor && authorMemberIdFinal) {
    targets = targets.filter((id) => id !== authorMemberIdFinal);
  }

  if (targets.length === 0) return message;

  // 3) Insert en batch dans message_recipients
  const BATCH = 500;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    const rows = slice.map((rid) => ({
      message_id: message.id,
      recipient_member_id: rid,
    }));
    const { error: recErr } = await supabase.from("message_recipients").insert(rows);
    if (recErr) throw recErr;
  }

  return message;
}

/**
 * Abonnement Realtime aux nouveaux messages (INSERT) et lectures (UPDATE)
 * onChange('insert'|'update', payload)
 */
export function subscribeInbox(memberId, onChange) {
  if (!memberId) return { unsubscribe: () => {} };

  const channel = supabase
    .channel(`inbox_${memberId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_recipients",
        filter: `recipient_member_id=eq.${memberId}`,
      },
      (payload) => onChange?.("insert", payload)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "message_recipients",
        filter: `recipient_member_id=eq.${memberId}`,
      },
      (payload) => onChange?.("update", payload)
    )
    .subscribe();

  return {
    unsubscribe: () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* no-op */
      }
    },
  };
}

/* ===== Optionnel : liste des messages envoyés par l'admin courant ===== */
export async function listSentByCurrentAdmin({ limit = 50, offset = 0 } = {}) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, subject, body, created_at, is_broadcast, author_member_id")
    .eq("author_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

/* ========= Threads (historique style chat) ========= */

/** IDs des membres admins (via la vue admin_members) */
export async function fetchAdminMemberIds() {
  const { data, error } = await supabase.from("admin_members").select("id");
  if (error) throw error;
  return (data || []).map((r) => r.id);
}

/** Fil admin<->membre (toutes directions) — utile côté Admin */
export async function listThreadWithMember(memberId) {
  if (!memberId) return [];

  // Messages reçus par ce membre (admin -> membre)
  const { data: inbound, error: inErr } = await supabase
    .from("message_recipients")
    .select(`
      id,
      message_id,
      created_at,
      read_at,
      messages:message_id (
        id, subject, body, created_at, author_member_id, is_broadcast
      )
    `)
    .eq("recipient_member_id", memberId)
    .order("created_at", { ascending: true });
  if (inErr) throw inErr;

  // Messages envoyés par ce membre (membre -> admins)
  const { data: outbound, error: outErr } = await supabase
    .from("messages")
    .select("id, subject, body, created_at, author_member_id, is_broadcast")
    .eq("author_member_id", memberId)
    .order("created_at", { ascending: true });
  if (outErr) throw outErr;

  const A = (inbound || []).map((r) => ({
    kind: "inbound", // admin -> membre (du point de vue du membre)
    id: `in_${r.id}`,
    message_id: r.message_id,
    created_at: r.messages?.created_at || r.created_at,
    subject: r.messages?.subject,
    body: r.messages?.body,
    author_member_id: r.messages?.author_member_id,
  }));

  const B = (outbound || []).map((m) => ({
    kind: "outbound", // membre -> admin
    id: `out_${m.id}`,
    message_id: m.id,
    created_at: m.created_at,
    subject: m.subject,
    body: m.body,
    author_member_id: m.author_member_id,
  }));

  const all = [...A, ...B].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  return all;
}

/**
 * Fil "mes messages" (moi <-> admins) pour un membre connecté
 * ✅ Robuste : on lit ce que *j’ai envoyé* via author_user_id = user.id
 */
export async function listMyThread(myMemberId) {
  if (!myMemberId) return [];

  // Reçus (admins -> moi)
  const { data: inbound, error: e1 } = await supabase
    .from("message_recipients")
    .select(`
      id, read_at, created_at,
      messages:message_id (id, subject, body, created_at, author_member_id, author_user_id)
    `)
    .eq("recipient_member_id", myMemberId);
  if (e1) throw e1;

  // Envoyés (moi -> admins), clé = author_user_id
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sent, error: e2 } = await supabase
    .from("messages")
    .select(`
      id, subject, body, created_at, author_member_id, author_user_id,
      recipients:message_recipients (recipient_member_id)
    `)
    .eq("author_user_id", user?.id || "");
  if (e2) throw e2;

  const inboundMapped = (inbound || []).map((r) => ({
    id: `in_${r.id}`,
    message_id: r.messages?.id,
    subject: r.messages?.subject,
    body: r.messages?.body,
    created_at: r.messages?.created_at || r.created_at,
    author_member_id: r.messages?.author_member_id,
    direction: "in",
  }));

  const outboundMapped = [];
  (sent || []).forEach((m) => {
    (m.recipients || []).forEach((rcpt) => {
      outboundMapped.push({
        id: `out_${m.id}_${rcpt.recipient_member_id}`,
        message_id: m.id,
        subject: m.subject,
        body: m.body,
        created_at: m.created_at,
        author_member_id: m.author_member_id, // peut être null sur anciens messages
        direction: "out",
      });
    });
  });

  const all = [...inboundMapped, ...outboundMapped].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  return all;
}

/** Envoi direct à 1 membre (admin -> membre) */
export async function sendToMember({ toMemberId, subject, body, authorMemberId }) {
  return sendMessage({
    subject,
    body,
    recipientMemberIds: [toMemberId],
    authorMemberId: authorMemberId ?? null,
    isBroadcast: false,
  });
}

/** Envoi membre -> admins (destinataires = tous les admin_members) */
export async function sendToAdmins({ subject, body, authorMemberId }) {
  const adminIds = await fetchAdminMemberIds();
  return sendMessage({
    subject,
    body,
    recipientMemberIds: adminIds,
    authorMemberId: authorMemberId ?? null,
    isBroadcast: false,
  });
}

/** Diffusion globale (RPC SQL: send_broadcast_message) */
export async function sendBroadcast({ subject, body, excludeAuthor = true }) {
  const { data, error } = await supabase.rpc("send_broadcast_message", {
    p_subject: subject,
    p_body: body,
    p_exclude_author: excludeAuthor,
  });
  if (error) throw error;
  return data; // message_id
}

/** (option) Tout marquer lu — nécessite la RPC mark_all_read */
export async function markAllRead() {
  const { data, error } = await supabase.rpc("mark_all_read");
  if (error) throw error;
  return data || 0;
}

/** (option) Marquer une conversation comme lue — nécessite la RPC mark_conversation_read */
export async function markConversationRead(otherMemberId) {
  const { data, error } = await supabase.rpc("mark_conversation_read", {
    p_other_member_id: otherMemberId,
  });
  if (error) throw error;
  return data || 0;
}
