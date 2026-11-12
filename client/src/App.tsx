import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AuthScreen, { type AuthScreenState } from "./ui/AuthScreen";
import DashboardView, {
  type Profile,
  type ProfileLoadError,
} from "./ui/DashboardView";
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

function parseOptionalNumber(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProfile(record: ProfileRecord): Profile {

  return {
    id: record.id,
    email: record.email ?? "",
    nome: record.nome,
    saldo: parseOptionalNumber(record.saldo),
    plano: record.plano,
    grupos_usados: parseOptionalNumber(record.grupos_usados),
    telefone: record.telefone,
    plano_expira: record.plano_expira,
    status: record.status,
  };
}

function sanitizeDiagnosticText(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;

  return value
    .trim()
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[token redacted]",
    )
    .replace(
      /\b((?:access[_ -]?token|refresh[_ -]?token|password|senha|secret|api[_ -]?key|authorization|service[_ -]?role[_ -]?key)\s*[:=]\s*["']?)[^,\s;"']+/gi,
      "$1[redacted]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[id redacted]",
    )
    .replace(/\b\d{9,15}\b/g, "[number redacted]")
    .replace(
      /\b\d[\d.,]*\s*(?:Kz|AOA)\b|\b(?:Kz|AOA)\s*[\d.,]+/gi,
      "[financial value redacted]",
    )
    .slice(0, 800);
}

function readProfileLoadError(cause: unknown): ProfileLoadError {
  const candidates: Partial<ProfileLoadError>[] = [];
  const visited = new Set<object>();

  function visit(value: unknown, depth: number) {
    if (typeof value === "string") {
      const message = sanitizeDiagnosticText(value);
      if (message) candidates.push({ message });
      return;
    }

    if (
      depth > 4 ||
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      return;
    }

    const record = value as Record<string, unknown>;
    if (visited.has(record)) return;
    visited.add(record);

    const candidate: Partial<ProfileLoadError> = {
      code: sanitizeDiagnosticText(record.code),
      message: sanitizeDiagnosticText(
        value instanceof Error ? value.message : record.message,
      ),
      details: sanitizeDiagnosticText(record.details),
      hint: sanitizeDiagnosticText(record.hint),
    };

    if (Object.values(candidate).some(Boolean)) candidates.push(candidate);

    for (const key of ["error", "cause", "originalError"]) {
      if (key in record) visit(record[key], depth + 1);
    }
  }

  visit(cause, 0);

  const ordered = candidates.sort((left, right) => {
    const score = (candidate: Partial<ProfileLoadError>) =>
      (candidate.code ? 4 : 0) +
      (candidate.details ? 2 : 0) +
      (candidate.hint ? 2 : 0) +
      (candidate.message ? 1 : 0);
    return score(right) - score(left);
  });

  return {
    message:
      ordered.find((candidate) => candidate.message)?.message ??
      "Não foi possível carregar os dados do perfil.",
    code: ordered.find((candidate) => candidate.code)?.code,
    details: ordered.find((candidate) => candidate.details)?.details,
    hint: ordered.find((candidate) => candidate.hint)?.hint,
  };
}

async function loadProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeProfile(data as ProfileRecord) : null;
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
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
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
        setProfileNotFound(false);
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
      setProfileNotFound(false);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfile(null);
    setProfileNotFound(false);
    setProfileLoading(true);
    setProfileError(null);

    void loadProfile(user)
      .then((nextProfile) => {
        if (!active) return;
        if (nextProfile) {
          setProfile(nextProfile);
          setProfileNotFound(false);
        } else {
          setProfile(null);
          setProfileNotFound(true);
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setProfile(null);
        setProfileNotFound(false);
        setProfileError(readProfileLoadError(cause));
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
      profileNotFound={profileNotFound}
      onRetry={() => setProfileRetry((attempt) => attempt + 1)}
      onSignOut={signOut}
    />
  );
}
