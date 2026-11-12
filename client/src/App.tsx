import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AuthScreen, { type AuthScreenState } from "./ui/AuthScreen";
import DashboardView, { type Profile } from "./ui/DashboardView";
import { supabase } from "./lib/supabase";

const profileColumns =
  "id,email,nome,saldo,plano,grupos_usados,telefone,plano_expira,status";

interface ProfileRecord {
  id: string;
  email: string | null;
  nome: string | null;
  saldo: number | string | null;
  plano: string | null;
  grupos_usados: number | null;
  telefone: string | null;
  plano_expira: string | null;
  status: string | null;
}

function normalizeProfile(record: ProfileRecord): Profile {
  const balance = Number(record.saldo ?? 0);
  const groupCount = Number(record.grupos_usados ?? 0);

  return {
    id: record.id,
    email: record.email ?? "",
    nome: record.nome,
    saldo: Number.isFinite(balance) ? balance : 0,
    plano: record.plano || "Basic",
    grupos_usados: Number.isFinite(groupCount) ? groupCount : 0,
    telefone: record.telefone,
    plano_expira: record.plano_expira,
    status: record.status,
  };
}

async function loadOrCreateProfile(user: User): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeProfile(data as ProfileRecord);

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      saldo: 0,
      plano: "Basic",
      grupos_usados: 0,
    })
    .select(profileColumns)
    .single();

  if (!createError && created) {
    return normalizeProfile(created as ProfileRecord);
  }

  // A profile trigger may have inserted the row between the read and insert.
  const { data: existing, error: retryError } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", user.id)
    .maybeSingle();

  if (!retryError && existing) {
    return normalizeProfile(existing as ProfileRecord);
  }

  throw createError ?? retryError ?? new Error("Não foi possível carregar o perfil.");
}

function getInitialAuthView(): AuthScreenState {
  return new URLSearchParams(window.location.search).get("reset_password") === "true"
    ? "reset-completion"
    : "sign-in";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [recoverySession, setRecoverySession] = useState(
    () => getInitialAuthView() === "reset-completion",
  );
  const recoverySessionRef = useRef(recoverySession);
  const [authView, setAuthView] = useState<AuthScreenState>(getInitialAuthView);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        recoverySessionRef.current = true;
        setRecoverySession(true);
        setAuthView("reset-completion");
        setUser(session?.user ?? null);
        setSessionLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setProfileError(null);
        recoverySessionRef.current = false;
        setRecoverySession(false);
        setAuthView("sign-in");
        setSessionError(null);
        setSessionLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        setSessionError(null);
        if (!recoverySessionRef.current) setAuthView("sign-in");
      } else if (event === "INITIAL_SESSION") {
        setUser(null);
      }

      setSessionLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSessionError(error.message);
        } else if (data.session?.user) {
          setUser(data.session.user);
        } else {
          setUser(null);
        }
        setSessionLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSessionError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível verificar a sessão.",
        );
        setSessionLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    setProfileError(null);

    void loadOrCreateProfile(user)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setProfile(null);
        setProfileError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os dados do perfil.",
        );
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, user?.email, profileRetry]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset_password=true`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }, []);

  const setNewPassword = useCallback(async (password: string) => {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;

    window.history.replaceState({}, document.title, window.location.pathname);
    recoverySessionRef.current = false;
    setRecoverySession(false);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  if (sessionLoading) {
    return (
      <main className="kix-ui kix-dashboard-state" role="status" aria-live="polite">
        <p>A preparar a sua conta…</p>
      </main>
    );
  }

  if (!user || recoverySession) {
    return (
      <AuthScreen
        initialState={authView}
        error={sessionError}
        onSignIn={signIn}
        onSignUp={signUp}
        onResendConfirmation={resendConfirmation}
        onRequestPasswordReset={requestPasswordReset}
        onSetPassword={setNewPassword}
      />
    );
  }

  return (
    <DashboardView
      user={{
        id: user.id,
        email: user.email ?? "",
      }}
      profile={profile}
      loading={profileLoading}
      error={profileError}
      onRetry={() => setProfileRetry((attempt) => attempt + 1)}
      onSignOut={signOut}
    />
  );
}
