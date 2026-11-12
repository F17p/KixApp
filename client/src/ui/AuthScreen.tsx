import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./kixapp-ui.css";

export type AuthScreenState =
  | "sign-in"
  | "sign-up"
  | "confirmation"
  | "reset-request"
  | "reset-completion";

export interface AuthScreenProps {
  initialState?: AuthScreenState;
  loading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onResendConfirmation: (email: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onSetPassword: (password: string) => Promise<void>;
}

function BrandMark() {
  return (
    <div className="kix-brand-mark" aria-label="KixApp">
      <span className="kix-brand-symbol" aria-hidden="true" />
      <span>KixApp</span>
    </div>
  );
}

function MessageIcon({ success = false }: { success?: boolean }) {
  return success ? (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 10 3.2 3.2L15.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4.5M10 13.6v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailIllustration() {
  return (
    <div className="kix-notice-illustration" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="4.5" y="7.5" width="23" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="m6 10 10 7.5L26 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21.5 5v5M19 7.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function AuthScreen({
  initialState = "sign-in",
  loading = false,
  error,
  successMessage,
  onSignIn,
  onSignUp,
  onResendConfirmation,
  onRequestPasswordReset,
  onSetPassword,
}: AuthScreenProps) {
  const [view, setView] = useState<AuthScreenState>(initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setView(initialState);
  }, [initialState]);

  const pending = loading || busy;
  const shownError = localError || error || "";
  const shownSuccess = localSuccess || successMessage || "";

  function changeView(next: AuthScreenState) {
    setView(next);
    setLocalError("");
    setLocalSuccess("");
    setPassword("");
    setConfirmPassword("");
  }

  async function runAction(action: () => Promise<void>, successText?: string) {
    setLocalError("");
    setLocalSuccess("");
    setBusy(true);
    try {
      await action();
      if (successText) setLocalSuccess(successText);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível concluir o pedido.";
      const lower = message.toLowerCase();
      if (
        view === "sign-in" &&
        (lower.includes("email not confirmed") || lower.includes("email not verified") || lower.includes("not confirmed"))
      ) {
        setView("confirmation");
      } else {
        setLocalError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (view === "sign-in" || view === "sign-up") {
      if (password.length < 6) {
        setLocalError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (view === "sign-up" && password !== confirmPassword) {
        setLocalError("As senhas não coincidem. Confirme a senha e tente novamente.");
        return;
      }
      if (view === "sign-in") {
        await runAction(() => onSignIn(cleanEmail, password));
      } else {
        await runAction(async () => {
          await onSignUp(cleanEmail, password);
          setView("confirmation");
        });
      }
      return;
    }

    if (view === "reset-request") {
      await runAction(
        () => onRequestPasswordReset(cleanEmail),
        "Se existir uma conta associada a este email, receberá as instruções de recuperação."
      );
      return;
    }

    if (view === "reset-completion") {
      if (password.length < 6) {
        setLocalError("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("As senhas não coincidem. Confirme a nova senha e tente novamente.");
        return;
      }
      await runAction(async () => {
        await onSetPassword(password);
        setPassword("");
        setConfirmPassword("");
        setView("sign-in");
        setLocalSuccess("A sua senha foi actualizada. Já pode iniciar sessão.");
      });
    }
  }

  async function resendConfirmation() {
    await runAction(
      () => onResendConfirmation(email.trim()),
      "Novo email de confirmação enviado. Verifique também a pasta de spam."
    );
  }

  const isPasswordForm = view === "sign-in" || view === "sign-up" || view === "reset-completion";
  const heading = {
    "sign-in": "É bom tê-lo de volta.",
    "sign-up": "Comece a juntar.",
    confirmation: "Confirme o seu email.",
    "reset-request": "Recupere o acesso.",
    "reset-completion": "Defina uma nova senha.",
  }[view];
  const intro = {
    "sign-in": "Entre para acompanhar as suas poupanças e a sua participação.",
    "sign-up": "Crie a sua conta para começar a poupar em conjunto.",
    confirmation: "Só falta confirmar que este email lhe pertence.",
    "reset-request": "Enviaremos instruções para o email associado à sua conta.",
    "reset-completion": "Escolha uma senha nova e segura para a sua conta.",
  }[view];

  return (
    <main className="kix-ui kix-auth-shell">
      <aside className="kix-auth-story" aria-label="Sobre a KixApp">
        <BrandMark />
        <div className="kix-auth-story-copy">
          <span className="kix-eyebrow">Poupamos lado a lado</span>
          <h1>Juntos, o futuro <em>ganha forma.</em></h1>
          <p>
            A sua kixikila, agora mais perto. Acompanhe o que juntou e mantenha
            a sua comunidade no caminho certo.
          </p>
        </div>
        <div className="kix-auth-note">
          <span className="kix-auth-note-mark" aria-hidden="true">K</span>
          <span>Feita para poupar em comunidade, com clareza.</span>
        </div>
      </aside>

      <section className="kix-auth-panel" aria-labelledby="kix-auth-title">
        <div className="kix-auth-card">
          <div className="kix-auth-mobile-brand"><BrandMark /></div>
          <span className="kix-eyebrow">KixApp · Kixikila digital</span>
          <h2 id="kix-auth-title">{heading}</h2>
          <p className="kix-auth-intro">{intro}</p>

          {shownError && (
            <div className="kix-message kix-message-error" role="alert">
              <MessageIcon />
              <span>{shownError}</span>
            </div>
          )}
          {shownSuccess && (
            <div className="kix-message kix-message-success" role="status">
              <MessageIcon success />
              <span>{shownSuccess}</span>
            </div>
          )}

          {view === "confirmation" ? (
            <div>
              <MailIllustration />
              <p className="kix-notice-detail">
                Enviámos um link de confirmação para <strong>{email || "o seu email"}</strong>.
                Abra a mensagem para activar a conta; se não a encontrar, veja a pasta de spam.
              </p>
              <div className="kix-auth-actions">
                <button
                  className="kix-button kix-button-full"
                  type="button"
                  onClick={resendConfirmation}
                  disabled={pending || !email.trim()}
                >
                  {pending ? "A enviar…" : "Reenviar email de confirmação"}
                </button>
                <button
                  className="kix-button kix-button-secondary kix-button-full"
                  type="button"
                  onClick={() => changeView("sign-in")}
                  disabled={pending}
                >
                  Voltar ao início de sessão
                </button>
              </div>
            </div>
          ) : (
            <form className="kix-form" onSubmit={handleSubmit} noValidate={false}>
              {view !== "reset-completion" && (
                <div className="kix-field">
                  <label htmlFor="kix-email">Email</label>
                  <input
                    id="kix-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="nome@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    aria-invalid={Boolean(shownError)}
                  />
                </div>
              )}

              {isPasswordForm && (
                <div className="kix-field">
                  <label htmlFor="kix-password">
                    {view === "reset-completion" ? "Nova senha" : "Senha"}
                  </label>
                  <input
                    id="kix-password"
                    type="password"
                    name="password"
                    autoComplete={view === "sign-in" ? "current-password" : "new-password"}
                    placeholder="Pelo menos 6 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                    aria-invalid={Boolean(shownError)}
                  />
                </div>
              )}

              {(view === "sign-up" || view === "reset-completion") && (
                <div className="kix-field">
                  <label htmlFor="kix-confirm-password">Confirmar senha</label>
                  <input
                    id="kix-confirm-password"
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Escreva a senha novamente"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={6}
                    required
                    aria-invalid={Boolean(shownError)}
                  />
                </div>
              )}

              {view === "sign-in" && (
                <div className="kix-form-meta">
                  <button className="kix-text-button" type="button" onClick={() => changeView("reset-request")}>
                    Esqueci a senha
                  </button>
                </div>
              )}

              <button className="kix-button kix-button-full" type="submit" disabled={pending}>
                {pending
                  ? "Aguarde…"
                  : view === "sign-in"
                    ? "Iniciar sessão"
                    : view === "sign-up"
                      ? "Criar conta"
                      : view === "reset-request"
                        ? "Enviar instruções"
                        : "Guardar nova senha"}
              </button>
            </form>
          )}

          {view === "sign-in" && (
            <p className="kix-auth-switch">
              Ainda não tem conta?
              <button className="kix-text-button" type="button" onClick={() => changeView("sign-up")}>
                Criar conta
              </button>
            </p>
          )}
          {view === "sign-up" && (
            <p className="kix-auth-switch">
              Já tem conta?
              <button className="kix-text-button" type="button" onClick={() => changeView("sign-in")}>
                Iniciar sessão
              </button>
            </p>
          )}
          {(view === "reset-request" || view === "reset-completion") && (
            <p className="kix-auth-switch">
              Lembrou-se da senha?
              <button className="kix-text-button" type="button" onClick={() => changeView("sign-in")}>
                Voltar ao início de sessão
              </button>
            </p>
          )}
          <p className="kix-auth-footer">A sua poupança merece um lugar seguro.</p>
        </div>
      </section>
    </main>
  );
}
