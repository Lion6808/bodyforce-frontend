// src/supabaseClient.js — version egress-friendly (URLs mémoïsées + uploads cache-control)

import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------
   1) Client Supabase (singleton pour éviter le warning GoTrue)
------------------------------------------------------------------- */
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://hpgcqrsxttflutdsasar.supabase.co";

const supabaseKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZ2NxcnN4dHRmbHV0ZHNhc2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MjEzMTYsImV4cCI6MjA2Nzk5NzMxNn0.7gecaEShO4oUStTcL9Xi-sJni9Pkb4d3mV5OVWxxiyM";

const SB_OPTS = {
  auth: {
    storageKey: "bodyforce-auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

if (!globalThis.__SUPABASE__) {
  globalThis.__SUPABASE__ = createClient(supabaseUrl, supabaseKey, SB_OPTS);
}
export const supabase = globalThis.__SUPABASE__;

/* ------------------------------------------------------------------
   2) Helpers: cache des publicUrl + uploads avec cacheControl
   (⚠️ Les photos membres ne passent plus par Storage ; on conserve
   ces helpers pour les documents/certificats, etc.)
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

// (Legacy) Utilisé ailleurs pour d'autres images éventuelles.
// Pour les PHOTOS MEMBRES : ne plus appeler ceci.
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

// Raccourci pour les photos si jamais besoin (éviter pour les membres)
export const uploadPhoto = (path, file, opts) =>
  uploadWithCacheControl("photo", path, file, opts);

/* ------------------------------------------------------------------
   3) Services applicatifs
------------------------------------------------------------------- */
export const supabaseServices = {
  /* ---------------- Members ---------------- */

  async getMembersWithoutPhotos() {
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, name, firstName, birthdate, gender, address, phone, mobile, email, subscriptionType, startDate, endDate, badgeId, files, etudiant, badge_number"
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("Erreur getMembersWithoutPhotos:", error);
      throw error;
    }

    return (data || []).map((member) => ({
      ...member,
      files: member.files || [],
      etudiant: !!member.etudiant,
      photo: null,
    }));
  },

  async getMemberPhotos(memberIds) {
    if (!memberIds || memberIds.length === 0) return {};

    const { data, error } = await supabase
      .from("members")
      .select("id, photo")
      .in("id", memberIds);

    if (error) {
      console.error("Erreur getMemberPhotos:", error);
      throw error;
    }

    const photosMap = {};
    (data || []).forEach((member) => {
      if (member.photo) {
        photosMap[member.id] = member.photo;
      }
    });

    return photosMap;
  },

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

  /* ---------------- Presences ---------------- */
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

  // ✅ MODIFIÉ : Utilise maintenant la fonction RPC
  async getPresencesWithMembers(startDate = null, endDate = null) {
    const { data, error } = await supabase.rpc('get_presences_with_members', {
      p_start_date: startDate ? startDate.toISOString() : null,
      p_end_date: endDate ? endDate.toISOString() : null
    });

    if (error) {
      console.error("Erreur getPresencesWithMembers:", error);
      throw error;
    }

    return data || [];
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

  /* ---------------- Payments ---------------- */
  async getPayments(memberId = null) {
    let query = supabase
      .from("payments")
      .select(`*, member:members(id, name, firstName, badgeId, badge_number)`)
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
      .select(`*, member:members(id, name, firstName, badgeId, badge_number)`)
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
      .select(`*, member:members(id, name, firstName, badgeId, badge_number)`)
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

  /* ---------------- Files (documents/certificats) ---------------- */
  // ✅ Upload fichiers (utilise cache long + renvoie l'URL via le cache)
  async uploadFile(bucket, path, file) {
    const uploaded = await uploadWithCacheControl(bucket, path, file);
    const publicUrl = getPublicUrlCached(bucket, uploaded.path);
    return { path: uploaded.path, publicUrl };
    // Note: pour les PHOTOS MEMBRES, ne pas utiliser Storage.
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

  /* ---------------- Stats ---------------- */

  // ✅ VERSION LIGHT : Pour HomePage (stats agrégées seulement via RPC)
  async getStatisticsLight() {
    try {
      const { data, error } = await supabase.rpc('get_statistics');

      if (error) {
        console.error("Erreur getStatisticsLight RPC:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Erreur getStatisticsLight:", error);
      throw error;
    }
  },

  // ✅ VERSION DÉTAILLÉE : Pour StatisticsPage (avec graphiques optimisés via RPC)
  async getDetailedStatistics() {
    try {
      const { data, error } = await supabase.rpc('get_detailed_statistics');

      if (error) {
        console.error("Erreur getDetailedStatistics RPC:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Erreur getDetailedStatistics:", error);
      throw error;
    }
  },

  // ✅ NOUVEAU : Statistiques de présences par année (optimisé pour comparaison)
  async getYearlyPresenceStats(year) {
    try {
      const startDate = `${year}-01-01T00:00:00`;
      const endDate = `${year}-12-31T23:59:59`;

      // Récupérer le nombre de présences pour l'année
      const { count, error: countError } = await supabase
        .from('presences')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (countError) throw countError;

      // Récupérer TOUTES les présences avec pagination (Supabase limite à 1000 par défaut)
      const pageSize = 1000;
      let allPresences = [];
      let from = 0;

      while (true) {
        const { data: presences, error: presError } = await supabase
          .from('presences')
          .select('timestamp')
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
          .order('timestamp', { ascending: true })
          .range(from, from + pageSize - 1);

        if (presError) throw presError;

        allPresences = [...allPresences, ...presences];

        // Si on a moins de pageSize résultats, on a tout récupéré
        if (presences.length < pageSize) break;
        from += pageSize;
      }

      console.log(`📊 [Supabase] getYearlyPresenceStats(${year}): ${allPresences.length} présences récupérées`);

      // Calculer les stats horaires, mensuelles ET matrice jour×heure (pour heatmap)
      const hourlyStats = Array(24).fill(0);
      const monthlyStats = Array(12).fill(0);
      const dayHourMatrix = Array(7).fill(null).map(() => Array(24).fill(0)); // 7 jours × 24 heures

      allPresences.forEach(p => {
        const date = new Date(p.timestamp);
        const hour = date.getHours();
        const dayOfWeek = date.getDay(); // 0 = Dimanche
        hourlyStats[hour]++;
        monthlyStats[date.getMonth()]++;
        dayHourMatrix[dayOfWeek][hour]++;
      });

      const formattedHourly = hourlyStats.map((count, hour) => ({
        hour,
        count
      })).filter(h => h.count > 0);

      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const formattedMonthly = monthlyStats.map((count, month) => ({
        month: monthNames[month],
        monthIndex: month,
        count
      }));

      // Données pour la heatmap radiale (évite un second fetch)
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayTotals = dayHourMatrix.map((hours, dayIndex) => ({
        day: dayNames[dayIndex],
        dayIndex,
        total: hours.reduce((sum, c) => sum + c, 0),
        hours: hours.map((c, h) => ({ hour: h, count: c }))
      }));
      const maxHourly = Math.max(...dayHourMatrix.flat());
      const maxDaily = Math.max(...dayTotals.map(d => d.total));

      console.log(`📊 [Supabase] ${year} - Monthly breakdown:`, formattedMonthly.map(m => `${m.month}:${m.count}`).join(', '));

      return {
        year,
        totalPresences: count || 0,
        hourlyStats: formattedHourly,
        monthlyStats: formattedMonthly,
        avgPerMonth: count ? Math.round(count / 12) : 0,
        // Données heatmap (calculées en même temps, 0 egress supplémentaire)
        heatmapData: {
          matrix: dayHourMatrix,
          dayTotals,
          maxHourly,
          maxDaily,
          totalPresences: allPresences.length
        }
      };
    } catch (error) {
      console.error(`Erreur getYearlyPresenceStats(${year}):`, error);
      throw error;
    }
  },

  // ✅ NOUVEAU : Compte les présences d'une année jusqu'à une date précise (pour comparaison équitable)
  async getPresenceCountUntilDate(year, month, day) {
    try {
      const startDate = `${year}-01-01T00:00:00`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59`;

      const { count, error } = await supabase
        .from('presences')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (error) throw error;

      console.log(`📊 [Supabase] getPresenceCountUntilDate(${year}, ${month}, ${day}): ${count} présences`);
      return count || 0;
    } catch (error) {
      console.error(`Erreur getPresenceCountUntilDate(${year}, ${month}, ${day}):`, error);
      throw error;
    }
  },

  // ✅ CORRIGÉ : Top membres par année (calcul côté client via badge_history avec pagination)
  async getTopMembersByYear(year, limit = 10) {
    try {
      const startDate = `${year}-01-01T00:00:00`;
      const endDate = `${year}-12-31T23:59:59`;

      // Fonction de pagination pour récupérer toutes les données
      const fetchAllWithPagination = async (query) => {
        const pageSize = 1000;
        let allData = [];
        let from = 0;
        while (true) {
          const { data, error } = await query.range(from, from + pageSize - 1);
          if (error) throw error;
          allData = [...allData, ...data];
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return allData;
      };

      // 1. Récupérer TOUTES les présences de l'année (avec pagination)
      const presences = await fetchAllWithPagination(
        supabase
          .from('presences')
          .select('id, badgeId')
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
      );

      // 2. Récupérer tout le badge_history avec date_attribution pour éviter les
      //    contaminations entre membres lors d'une réattribution de badge
      const { data: badgeHistory, error: bhError } = await supabase
        .from('badge_history')
        .select('member_id, badge_real_id, date_attribution')
        .order('date_attribution', { ascending: true });

      if (bhError) throw bhError;

      // 3. Récupérer tous les membres
      const { data: members, error: memError } = await supabase
        .from('members')
        .select('id, name, firstName, badgeId, badge_number');

      if (memError) throw memError;

      // 4. Créer un map badge_real_id -> member_id en tenant compte des dates.
      //    Pour chaque badge, on ne retient que le propriétaire dont la date_attribution
      //    est la plus récente et <= endDate (fin de la période analysée).
      //    Cela évite d'attribuer les passages d'un badge réaffecté à l'ancien propriétaire.
      const badgeToMember = {};
      badgeHistory.forEach(bh => {
        if (!bh.badge_real_id || !bh.member_id) return;
        if (bh.date_attribution && bh.date_attribution > endDate) return;
        // Tri ASC → chaque entrée plus récente écrase la précédente : on garde la plus récente valide
        badgeToMember[bh.badge_real_id] = bh.member_id;
      });

      // 5. Compter les présences par member_id
      const presenceCount = {};
      presences.forEach(p => {
        const memberId = badgeToMember[p.badgeId];
        if (memberId) {
          presenceCount[memberId] = (presenceCount[memberId] || 0) + 1;
        }
      });

      // 6. Créer le résultat avec les infos membres
      const membersMap = {};
      members.forEach(m => {
        membersMap[m.id] = m;
      });

      const result = Object.entries(presenceCount)
        .map(([memberId, count]) => {
          const member = membersMap[memberId];
          if (!member) return null;
          return {
            id: member.id,
            name: member.name,
            firstName: member.firstName,
            badgeId: member.badgeId,
            badge_number: member.badge_number,
            visit_count: count
          };
        })
        .filter(m => m && (m.badge_number || m.badgeId))
        .sort((a, b) => b.visit_count - a.visit_count)
        .slice(0, limit);

      console.log(`📊 [Client] getTopMembersByYear(${year}): ${presences.length} présences analysées, Top ${result.length} membres`);
      return result;
    } catch (error) {
      console.error(`Erreur getTopMembersByYear(${year}):`, error);
      return [];
    }
  },

  // ✅ CORRIGÉ : Top membres par période (calcul côté client via badge_history avec pagination)
  async getTopMembersByPeriod(startDate, endDate, limit = 10) {
    try {
      // Fonction de pagination pour récupérer toutes les données
      const fetchAllWithPagination = async (query) => {
        const pageSize = 1000;
        let allData = [];
        let from = 0;
        while (true) {
          const { data, error } = await query.range(from, from + pageSize - 1);
          if (error) throw error;
          allData = [...allData, ...data];
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return allData;
      };

      // 1. Récupérer TOUTES les présences de la période (avec pagination)
      const presences = await fetchAllWithPagination(
        supabase
          .from('presences')
          .select('id, badgeId')
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
      );

      // 2. Récupérer tout le badge_history avec date_attribution pour éviter les
      //    contaminations entre membres lors d'une réattribution de badge
      const { data: badgeHistory, error: bhError } = await supabase
        .from('badge_history')
        .select('member_id, badge_real_id, date_attribution')
        .order('date_attribution', { ascending: true });

      if (bhError) throw bhError;

      // 3. Récupérer tous les membres
      const { data: members, error: memError } = await supabase
        .from('members')
        .select('id, name, firstName, badgeId, badge_number');

      if (memError) throw memError;

      // 4. Créer un map badge_real_id -> member_id en tenant compte des dates.
      //    Pour chaque badge, on ne retient que le propriétaire dont la date_attribution
      //    est la plus récente et <= endDate (fin de la période analysée).
      //    Cela évite d'attribuer les passages d'un badge réaffecté à l'ancien propriétaire.
      const badgeToMember = {};
      badgeHistory.forEach(bh => {
        if (!bh.badge_real_id || !bh.member_id) return;
        if (bh.date_attribution && bh.date_attribution > endDate) return;
        // Tri ASC → chaque entrée plus récente écrase la précédente : on garde la plus récente valide
        badgeToMember[bh.badge_real_id] = bh.member_id;
      });

      // 5. Compter les présences par member_id
      const presenceCount = {};
      presences.forEach(p => {
        const memberId = badgeToMember[p.badgeId];
        if (memberId) {
          presenceCount[memberId] = (presenceCount[memberId] || 0) + 1;
        }
      });

      // 6. Créer le résultat avec les infos membres
      const membersMap = {};
      members.forEach(m => {
        membersMap[m.id] = m;
      });

      const result = Object.entries(presenceCount)
        .map(([memberId, count]) => {
          const member = membersMap[memberId];
          if (!member) return null;
          return {
            id: member.id,
            name: member.name,
            firstName: member.firstName,
            badgeId: member.badgeId,
            badge_number: member.badge_number,
            visit_count: count
          };
        })
        .filter(m => m && (m.badge_number || m.badgeId))
        .sort((a, b) => b.visit_count - a.visit_count)
        .slice(0, limit);

      return result;
    } catch (error) {
      console.error(`Erreur getTopMembersByPeriod:`, error);
      return [];
    }
  },

  // ✅ VERSION COMPLETE : Pour StatisticsPage (toutes les données)
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
          } catch {
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

  // ✅ NOUVEAU : Statistiques de présences pour un membre
  async getMemberPresenceStats(memberId, startDate = null, endDate = null) {
    try {
      const { data, error } = await supabase.rpc('get_member_presence_stats', {
        p_member_id: memberId,
        p_start_date: startDate ? startDate.toISOString() : null,
        p_end_date: endDate ? endDate.toISOString() : null
      });

      if (error) {
        console.error("Erreur getMemberPresenceStats:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Erreur getMemberPresenceStats:", error);
      throw error;
    }
  },

  /* ---------------- Utils ---------------- */
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
  // ✅ NOUVEAU : Statistiques horaires par jour de semaine (pour heatmap radiale)
  async getHourlyStatsByDayOfWeek(year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      const startDate = `${currentYear}-01-01T00:00:00`;
      const endDate = `${currentYear}-12-31T23:59:59`;

      // Récupérer toutes les présences de l'année avec pagination
      const pageSize = 1000;
      let allPresences = [];
      let from = 0;

      while (true) {
        const { data: presences, error } = await supabase
          .from('presences')
          .select('timestamp')
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
          .order('timestamp', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        allPresences = [...allPresences, ...presences];
        if (presences.length < pageSize) break;
        from += pageSize;
      }

      // Créer une matrice 7 jours x 24 heures
      const matrix = Array(7).fill(null).map(() => Array(24).fill(0));
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

      allPresences.forEach(p => {
        const date = new Date(p.timestamp);
        const dayOfWeek = date.getDay(); // 0 = Dimanche
        const hour = date.getHours();
        matrix[dayOfWeek][hour]++;
      });

      // Calculer les totaux par jour
      const dayTotals = matrix.map((hours, dayIndex) => ({
        day: dayNames[dayIndex],
        dayIndex,
        total: hours.reduce((sum, count) => sum + count, 0),
        hours: hours.map((count, hour) => ({ hour, count }))
      }));

      // Trouver le max pour la normalisation
      const maxHourly = Math.max(...matrix.flat());
      const maxDaily = Math.max(...dayTotals.map(d => d.total));

      console.log(`📊 [Supabase] getHourlyStatsByDayOfWeek(${currentYear}): ${allPresences.length} présences, max horaire: ${maxHourly}`);

      return {
        year: currentYear,
        matrix,
        dayTotals,
        maxHourly,
        maxDaily,
        totalPresences: allPresences.length
      };
    } catch (error) {
      console.error(`Erreur getHourlyStatsByDayOfWeek:`, error);
      throw error;
    }
  },

  /* ---------------- Réattribution de badges ---------------- */
  async reassignBadge(badgeRealId, newMemberId) {
    const { data, error } = await supabase.rpc('reassign_badge', {
      p_badge_real_id: badgeRealId,
      p_new_member_id: newMemberId
    });

    if (error) {
      console.error('Erreur lors de la réattribution du badge:', error);
      throw error;
    }

    return data;
  },
};