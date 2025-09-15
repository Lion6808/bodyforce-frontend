import React, { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userMemberData, setUserMemberData] = useState(null);

  useEffect(() => {
    const getSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .single();

        if (error) {
          console.error("Erreur récupération rôle:", error.message);
        }
        setRole(data?.role || null);

        // ✅ Récupérer les données du membre lié à cet utilisateur
        const { data: memberData, error: memberError } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", currentUser.id)
          .single();

        if (memberError) {
          console.warn("⚠️ Erreur récupération données membre:", memberError.message);
          setUserMemberData(null);
        } else {
          setUserMemberData(memberData);
        }
      } else {
        setRole(null);
        setUserMemberData(null);
      }

      setLoading(false);
    };

    getSessionAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);

      if (newUser) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", newUser.id)
          .single()
          .then(({ data }) => setRole(data?.role || null));

        supabase
          .from("members")
          .select("*")
          .eq("user_id", newUser.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.warn("⚠️ Erreur récupération données membre (reconnexion):", error.message);
              setUserMemberData(null);
            } else {
              setUserMemberData(data);
            }
          });
      } else {
        setRole(null);
        setUserMemberData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, role, loading, userMemberData }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
