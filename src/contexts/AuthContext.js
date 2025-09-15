import React, { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'user' | autre
  const [loading, setLoading] = useState(true);
  const [userMemberData, setUserMemberData] = useState(null);

  // ---- helpers robustes ----
  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(); // ✅ évite 406 si 0 ligne

      if (error) {
        console.warn("[AuthContext] user_roles lookup error:", error.message || error);
      }
      // Rôle par défaut si pas d'entrée
      return data?.role || "user";
    } catch (e) {
      console.warn("[AuthContext] user_roles exception:", e);
      return "user";
    }
  };

  const fetchMemberForUser = async (userId, email) => {
    // 1) par user_id
    let { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data;

    // 2) fallback par email
    const { data: byEmail, error: err2 } = await supabase
      .from("members")
      .select("*")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (err2) {
      console.warn("[AuthContext] members lookup error:", err2.message || err2);
    }
    return byEmail || null;
  };

  useEffect(() => {
    const getSessionAndRole = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const [roleValue, memberData] = await Promise.all([
          fetchUserRole(currentUser.id),
          fetchMemberForUser(currentUser.id, currentUser.email),
        ]);

        setRole(roleValue);
        setUserMemberData(memberData);
      } else {
        setRole(null);
        setUserMemberData(null);
      }

      setLoading(false);
    };

    getSessionAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);

      if (newUser) {
        const [roleValue, memberData] = await Promise.all([
          fetchUserRole(newUser.id),
          fetchMemberForUser(newUser.id, newUser.email),
        ]);
        setRole(roleValue);
        setUserMemberData(memberData);
      } else {
        setRole(null);
        setUserMemberData(null);
      }
    });

    return () => {
      try {
        subscription.unsubscribe();
      } catch {}
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, role, loading, userMemberData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
