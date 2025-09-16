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
// - (optionnel) listSentByCurrentAdmin({limit, offset})

import { supabase } from "../supabaseClient";

/**
 * Récupère l'id du membre lié à un user_id (auth.uid)
 * @param {string} userId - UUID de l'utilisateur Supabase
 * @returns {Promise<number|null>} member.id ou null si introuvable
 */
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

/**
 * Liste la boîte de réception d'un membre
 * @param {number} memberId - id (bigint) de public.members
 * @param {{limit?: number, offset?: number}} opts
 * @returns {Promise<Array>}
 */
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

/**
 * Compte les messages non lus d'un membre
 * @param {number} memberId
 * @returns {Promise<number>}
 */
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

/**
 * Marque un message (ligne recipient) comme lu
 * @param {number} receiptId - id (bigserial) de public.message_recipients
 * @returns {Promise<void>}
 */
export async function markRead(receiptId) {
  if (!receiptId) return;
  const { error } = await supabase
    .from("message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", receiptId);
  if (error) throw error;
}

/**
 * Envoie un message (admin uniquement via RLS)
 * - Un message est créé dans `messages`
 * - Une ligne par destinataire est créée dans `message_recipients`
 *
 * @param {Object} params
 * @param {string} params.subject
 * @param {string} params.body
 * @param {number[]} [params.recipientMemberIds=[]] - ids members (ignorée si isBroadcast=true)
 * @param {number|null} [params.authorMemberId=null] - id member de l'auteur (optionnel)
 * @param {boolean} [params.isBroadcast=false] - diffusion globale (tous les membres)
 * @param {boolean} [params.excludeAuthor=true] - exclure l'auteur des destinataires
 * @returns {Promise<Object>} message créé
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

  // Récupère l'user actuel pour author_user_id
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error("Utilisateur non authentifié.");

  // 1) Créer le message
  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .insert({
      subject: subject.trim(),
      body: body.trim(),
      is_broadcast: Boolean(isBroadcast),
      author_user_id: user.id,
      author_member_id: authorMemberId ?? null,
    })
    .select("*")
    .single();

  if (msgErr) throw msgErr;

  // 2) Construire la liste des destinataires
  let targets = recipientMemberIds;

  if (isBroadcast) {
    // Tous les membres (remplace par une vue active_members si tu en crées une)
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

  // Option : exclure l'auteur
  if (excludeAuthor && authorMemberId) {
    targets = targets.filter((id) => id !== authorMemberId);
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
 * Abonnement Realtime aux nouveaux messages (INSERT) et aux lectures (UPDATE) pour un membre
 * Appelle onChange('insert' | 'update', payload) à chaque event (recalcule ensuite le badge).
 *
 * @param {number} memberId
 * @param {(kind: 'insert'|'update', payload: any) => void} onChange
 * @returns {{ unsubscribe: () => void }}
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

/** Fil admin<->membre (toutes directions) */
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
    kind: "inbound",          // admin -> membre
    id: `in_${r.id}`,
    message_id: r.message_id,
    created_at: r.messages?.created_at || r.created_at,
    subject: r.messages?.subject,
    body: r.messages?.body,
    author_member_id: r.messages?.author_member_id,
  }));

  const B = (outbound || []).map((m) => ({
    kind: "outbound",         // membre -> admin
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

/** Fil "mes messages" (moi <-> admins) pour un membre connecté */
export async function listMyThread(myMemberId) {
  return listThreadWithMember(myMemberId);
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
