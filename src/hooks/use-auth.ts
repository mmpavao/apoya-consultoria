// Hook centralizado de auth: sessão Supabase + perfil + roles.
// IMPORTANTE: o listener é registrado ANTES do getSession() para não perder o primeiro evento.
import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "contador" | "assistente" | "cliente";

export interface Profile {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  cliente_id: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true, session: null, user: null, profile: null, roles: [],
  });

  const loadProfileAndRoles = useCallback(async (userId: string) => {
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setState((s) => ({
      ...s,
      profile: (profile as Profile | null) ?? null,
      roles: ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role),
      loading: false,
    }));
  }, []);

  useEffect(() => {
    // Listener PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) {
        // Defer pra evitar deadlock com a callback do Supabase
        setTimeout(() => loadProfileAndRoles(session.user.id), 0);
      } else {
        setState({ loading: false, session: null, user: null, profile: null, roles: [] });
      }
    });

    // Agora checa sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) loadProfileAndRoles(session.user.id);
      else setState((s) => ({ ...s, loading: false }));
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const hasRole = useCallback((r: AppRole) => state.roles.includes(r), [state.roles]);
  const isStaff = state.roles.some((r) => r === "admin" || r === "contador" || r === "assistente");

  return { ...state, signIn, signUp, signOut, hasRole, isStaff };
}
