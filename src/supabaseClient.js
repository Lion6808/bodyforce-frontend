// src/supabaseClient.js — version egress-friendly (URLs mémoïsées + uploads cache-control)

import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------
   1) Client Supabase
------------------------------------------------------------------- */
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://hpgcqrsxttflutdsasar.supabase.co";

const supabaseKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZ2NxcnN4dHRmbHV0ZHNhc2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MjEzMTYsImV4cCI6MjA2Nzk5NzMxNn0.7gecaEShO4oUStTcL9Xi-sJni9Pkb4d3mV5OVWxxiyM";

const SB_OPTS = {
  auth: {
    storageKey: 'bodyforce-auth',
+    autoRefreshToken: true,
+    persistSession: true,
+    detectSessionInUrl: true,
  },
};
 if (!globalThis.__SUPABASE__) {
   globalThis.__SUPABASE__ = createClient(supabaseUrl, supabaseKey, SB_OPTS);
 }
 export const supabase = globalThis.__SUPABASE__;

/* ------------------------------------------------------------------
   2) Helpers: cache des publicUrl + uploads avec cacheControl
------------------------------------------------------------------- */

// Petit cache mémoire pour éviter de recalculer les publicUrl à chaque rendu
const publicUrlCache = new Map(); // key: `${bucket}/${path}` -> url

export const getPublicUrlCached = (bucket, path) => {
  if (!bucket || !path) return "";
  const key = `${bucket}/${path}`;
  const cached = publicUrlCache.get(key);
  if (cached) return cached;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl || "";
  if (url) publicUrlCache.set(key, url);
  return url;
};

// 👉 Utilisé par tes pages pour les avatars
export const getPhotoUrl = (path) => getPublicUrlCached("photo", path);

// Upload générique avec cache long (1 an) et upsert
export const uploadWithCacheControl = async (bucket, path, file, opts = {}) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: "31536000", ...opts });
  if (error) throw error;
  // Invalide le cache pour cette ressource
  publicUrlCache.delete(`${bucket}/${path}`);
  return data;
};

// Raccourci pour les photos
export const uploadPhoto = (path, file, opts) =>
  uploadWithCacheControl("photo", path, file, opts);

/* ------------------------------------------------------------------
   3) Services existants (inchangés fonctionnellement)
------------------------------------------------------------------- */
export const supabaseServices = {
  async getMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Erreur getMembers:", error);
      throw error;
    }

    return (data || []).map((member) => ({
      ...member,
      files: member.files || [],
      etudiant: !!member.etudiant,
    }));
  },

  async getMemberById(id) {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error("Erreur getMemberById:", error);
      throw error;
    }

    return {
      ...data,
      files: data.files || [],
      etudiant: !!data.etudiant,
    };
  },

  async getMemberByBadgeId(badgeId) {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("badgeId", badgeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error("Erreur getMemberByBadgeId:", error);
      throw error;
    }

    return {
      ...data,
      files: data.files || [],
      etudiant: !!data.etudiant,
    };
  },

  async createMember(memberData) {
    const { data, error } = await supabase
      .from("members")
      .insert([memberData])
      .select()
      .single();

    if (error) {
      console.error("Erreur createMember:", error);
      throw error;
    }

    return data;
  },

  async updateMember(id, memberData) {
    const { data, error } = await supabase
      .from("members")
      .update(memberData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Erreur updateMember:", error);
      throw error;
    }

    return data;
  },

  async deleteMember(id) {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) {
      console.error("Erreur deleteMember:", error);
      throw error;
    }
  },

  async getPresences(startDate = null, endDate = null, badgeId = null) {
    let query = supabase
      .from("presences")
      .select("*")
      .order("timestamp", { ascending: false });

    if (startDate) query = query.gte("timestamp", startDate.toISOString());
    if (endDate) query = query.lte("timestamp", endDate.toISOString());
    if (badgeId) query = query.eq("badgeId", badgeId);

    const { data, error } = await query;

    if (error) {
      console.error("Erreur getPresences:", error);
      throw error;
    }

    return data || [];
  },

  async getPresencesWithMembers(startDate = null, endDate = null) {
    const presences = await this.getPresences(startDate, endDate);
    const members = await this.getMembers();
    const membersMap = {};
    members.forEach((m) => {
      if (m.badgeId) membersMap[m.badgeId] = m;
    });

    return presences.map((presence) => ({
      ...presence,
      member: membersMap[presence.badgeId] || null,
    }));
  },

  async createPresence(badgeId, timestamp = new Date()) {
    const { data, error } = await supabase
      .from("presences")
      .insert([{ badgeId, timestamp: timestamp.toISOString() }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        console.warn("Présence déjà enregistrée:", badgeId, timestamp);
        return null;
      }
      console.error("Erreur createPresence:", error);
      throw error;
    }

    return data;
  },

  async deletePresence(id) {
    const { error } = await supabase.from("presences").delete().eq("id", id);
    if (error) {
      console.error("Erreur deletePresence:", error);
      throw error;
    }
  },

  async deletePresencesByBadgeId(badgeId) {
    const { error } = await supabase
      .from("presences")
      .delete()
      .eq("badgeId", badgeId);

    if (error) {
      console.error("Erreur deletePresencesByBadgeId:", error);
      throw error;
    }
  },

  async getPayments(memberId = null) {
    let query = supabase
      .from("payments")
      .select(`*, member:members(id, name, firstName, badgeId)`)
      .order("date_paiement", { ascending: false });

    if (memberId) query = query.eq("member_id", memberId);

    const { data, error } = await query;

    if (error) {
      console.error("Erreur getPayments:", error);
      throw error;
    }

    return data || [];
  },

  async createPayment(paymentData) {
    const { data, error } = await supabase
      .from("payments")
      .insert([paymentData])
      .select(`*, member:members(id, name, firstName, badgeId)`)
      .single();

    if (error) {
      console.error("Erreur createPayment:", error);
      throw error;
    }

    return data;
  },

  async updatePayment(id, paymentData) {
    const { data, error } = await supabase
      .from("payments")
      .update(paymentData)
      .eq("id", id)
      .select(`*, member:members(id, name, firstName, badgeId)`)
      .single();

    if (error) {
      console.error("Erreur updatePayment:", error);
      throw error;
    }

    return data;
  },

  async deletePayment(id) {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      console.error("Erreur deletePayment:", error);
      throw error;
    }
  },

  async togglePaymentStatus(id, isPaid) {
    return this.updatePayment(id, { is_paid: isPaid });
  },

  // ✅ Upload fichiers (utilise cache long + renvoie l’URL via le cache)
  async uploadFile(bucket, path, file) {
    const uploaded = await uploadWithCacheControl(bucket, path, file);
    const publicUrl = getPublicUrlCached(bucket, uploaded.path);
    return { path: uploaded.path, publicUrl };
  },

  async deleteFile(bucket, path) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Erreur deleteFile:", error);
      throw error;
    }
    publicUrlCache.delete(`${bucket}/${path}`);
  },

  // ✅ getPublicUrl passe par le cache
  getPublicUrl(bucket, path) {
    return getPublicUrlCached(bucket, path);
  },

  async getStatistics() {
    try {
      // Pagination Supabase (par 1000)
      const pageSize = 1000;
      const fetchAll = async (table) => {
        let allData = [];
        let from = 0;
        let to = pageSize - 1;
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, to);
          if (error) throw error;
          allData = [...allData, ...data];
          if (data.length < pageSize) break;
          from += pageSize;
          to += pageSize;
        }
        return allData;
      };

      const [members, presences, payments] = await Promise.all([
        fetchAll("members"),
        fetchAll("presences"),
        fetchAll("payments"),
      ]);

      const today = new Date();
      const stats = {
        total: members.length,
        actifs: 0,
        expirés: 0,
        hommes: 0,
        femmes: 0,
        etudiants: 0,
        membresExpirés: [],
      };

      members.forEach((member) => {
        if (member.endDate) {
          try {
            const endDate = new Date(member.endDate);
            if (endDate > today) stats.actifs++;
            else {
              stats.expirés++;
              stats.membresExpirés.push({
                id: member.id,
                name: member.name,
                firstName: member.firstName,
                endDate: member.endDate,
              });
            }
          } catch (e) {
            stats.expirés++;
          }
        } else {
          stats.expirés++;
        }

        if (member.gender === "Homme") stats.hommes++;
        else if (member.gender === "Femme") stats.femmes++;
        if (member.etudiant) stats.etudiants++;
      });

      return {
        stats,
        members,
        presences,
        payments,
        totalPresences: presences.length,
        totalPayments: payments.reduce(
          (sum, p) => sum + parseFloat(p.amount || 0),
          0
        ),
        unpaidPayments: payments.filter((p) => !p.is_paid).length,
      };
    } catch (error) {
      console.error("Erreur getStatistics:", error);
      throw error;
    }
  },

  async testConnection() {
    try {
      const { error } = await supabase.from("members").select("id").limit(1);
      if (error) throw error;
      console.log("✅ Connexion Supabase OK");
      return true;
    } catch (error) {
      console.error("❌ Erreur connexion Supabase:", error);
      return false;
    }
  },

  async cleanDuplicatePresences() {
    try {
      const { data, error } = await supabase.rpc("clean_duplicate_presences");
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Erreur cleanDuplicatePresences:", error);
      throw error;
    }
  },
};
