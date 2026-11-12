import { useState } from "react";
import "./kixapp-ui.css";

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  nome: string | null;
  saldo: number | null;
  plano: string | null;
  grupos_usados: number | null;
  telefone: string | null;
  plano_expira: string | null;
  status: string | null;
}

export interface ProfileLoadError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface DashboardViewProps {
  user: AuthUser;
  profile: Profile | null;
  loading?: boolean;
  error?: ProfileLoadError | null;
  profileNotFound?: boolean;
  successMessage?: string | null;
  onSignOut: () => Promise<void>;
  onRetry?: () => void;
}

function BrandMark() {
  return (
    <div className="kix-brand-mark" aria-label="KixApp">
      <span className="kix-brand-symbol" aria-hidden="true" />
      <span>KixApp</span>
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.5 4H5.8A1.8 1.8 0 0 0 4 5.8v8.4A1.8 1.8 0 0 0 5.8 16h2.7M12 13.5l3.5-3.5L12 6.5M15.2 10H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" fill="none" aria-hidden="true">
      <path d="M12.5 8v5M12.5 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12.5" cy="12.5" r="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "K";
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-AO") ?? "").join("");
}

function formatKwanza(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 2 }).format(safeValue);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-AO", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function LoadingState() {
  return (
    <div className="kix-ui" aria-label="A carregar os dados da sua conta" aria-busy="true">
      <div className="kix-skeleton-wrap">
        <div className="kix-skeleton kix-skeleton-short" />
        <div className="kix-skeleton-row">
          <div className="kix-skeleton kix-skeleton-tile" />
          <div className="kix-skeleton kix-skeleton-tile" />
        </div>
        <div className="kix-skeleton-row">
          <div className="kix-skeleton kix-skeleton-short" />
          <div className="kix-skeleton kix-skeleton-short" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardView({
  user,
  profile,
  loading = false,
  error,
  profileNotFound = false,
  successMessage,
  onSignOut,
  onRetry,
}: DashboardViewProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  if (loading) return <LoadingState />;

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await onSignOut();
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : "Não foi possível terminar a sessão.");
    } finally {
      setSigningOut(false);
    }
  }

  if (error) {
    return (
      <main className="kix-ui">
        <section className="kix-dashboard-state" role="alert">
          <div className="kix-error-state-icon"><ErrorMark /></div>
          <h1>Não foi possível carregar a conta.</h1>
          <p>{error.message}</p>
          {(error.code || error.details || error.hint) && (
            <dl className="kix-profile-error-details" aria-label="Detalhes do erro">
              {error.code && (
                <div>
                  <dt>Código Supabase</dt>
                  <dd>{error.code}</dd>
                </div>
              )}
              {error.details && (
                <div>
                  <dt>Detalhes</dt>
                  <dd>{error.details}</dd>
                </div>
              )}
              {error.hint && (
                <div>
                  <dt>Sugestão</dt>
                  <dd>{error.hint}</dd>
                </div>
              )}
            </dl>
          )}
          {onRetry && (
            <button className="kix-button" type="button" onClick={onRetry}>Tentar novamente</button>
          )}
        </section>
      </main>
    );
  }

  if (profileNotFound) {
    return (
      <main className="kix-ui">
        <section className="kix-dashboard-state" role="status">
          <div className="kix-empty-profile">
            <h1>Perfil não encontrado</h1>
            <p>Esta conta não tem um perfil associado. Nenhum perfil foi criado automaticamente.</p>
          </div>
          {onRetry && (
            <button className="kix-button" type="button" onClick={onRetry}>
              Verificar novamente
            </button>
          )}
        </section>
      </main>
    );
  }

  const displayName = profile?.nome?.trim() || user.email;
  const firstName = profile?.nome?.trim().split(/\s+/)[0];
  const expiration = formatDate(profile?.plano_expira ?? null);
  const groupCountLabel =
    profile?.grupos_usados === null || profile?.grupos_usados === undefined
      ? "Não indicado"
      : `${profile.grupos_usados} ${profile.grupos_usados === 1 ? "grupo" : "grupos"} registados`;
  const greeting = firstName ? `Olá, ${firstName}.` : "Olá.";

  return (
    <main className="kix-ui kix-dashboard">
      <header className="kix-dashboard-header">
        <div className="kix-dashboard-header-inner">
          <BrandMark />
          <div className="kix-header-greeting">
            <div className="kix-avatar" aria-hidden="true">{initials(profile?.nome || user.email)}</div>
            <div className="kix-header-identity">
              <strong>{displayName}</strong>
              <span>{user.email}</span>
            </div>
            <button className="kix-signout" type="button" onClick={signOut} disabled={signingOut}>
              <SignOutIcon />
              {signingOut ? "A terminar…" : "Terminar sessão"}
            </button>
          </div>
        </div>
      </header>

      <div className="kix-dashboard-main">
        <div className="kix-dashboard-heading">
          <div>
            <span className="kix-eyebrow">O seu espaço</span>
            <h1>{greeting}</h1>
            <p>Veja como está a sua poupança e a sua participação.</p>
          </div>
          <time className="kix-day-stamp" dateTime={new Date().toISOString().slice(0, 10)}>
            {new Intl.DateTimeFormat("pt-AO", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </time>
        </div>

        {successMessage && (
          <div className="kix-message kix-message-success kix-dashboard-feedback" role="status">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5 10 3.2 3.2L15.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {signOutError && (
          <div className="kix-message kix-message-error kix-dashboard-feedback" role="alert">
            <ErrorMark />
            <span>{signOutError}</span>
          </div>
        )}

        {!profile ? (
          <section className="kix-dashboard-state" aria-live="polite">
            <div className="kix-empty-profile">
              <h1>A verificar o perfil</h1>
              <p>Os dados da sua conta ainda não estão disponíveis.</p>
            </div>
          </section>
        ) : (
          <>
            <div className="kix-dashboard-grid">
              <section className="kix-balance-card" aria-labelledby="kix-balance-title">
                <div>
                  <span className="kix-balance-label" id="kix-balance-title">Saldo disponível</span>
                  <strong className="kix-balance-value">
                    {profile.saldo === null ? (
                      "Não indicado"
                    ) : (
                      <>
                        {formatKwanza(profile.saldo)}{" "}
                        <span className="kix-balance-currency">Kz</span>
                      </>
                    )}
                  </strong>
                </div>
                <span className="kix-balance-foot">Saldo registado no seu perfil</span>
              </section>

              <section className="kix-overview-card" aria-labelledby="kix-groups-title">
                <div>
                  <h2 id="kix-groups-title">A sua participação</h2>
                  <p className="kix-overview-caption">Grupos usados na sua conta KixApp.</p>
                  <div className="kix-overview-number">
                    {profile.grupos_usados ?? "—"}
                  </div>
                </div>
                <div className="kix-overview-foot">
                  <strong>{groupCountLabel}</strong>
                </div>
              </section>
            </div>

            <div className="kix-lower-grid">
              <section className="kix-profile-card" aria-labelledby="kix-profile-title">
                <div className="kix-section-title">
                  <div>
                    <h2 id="kix-profile-title">Os seus dados</h2>
                    <p>Informação associada à sua conta.</p>
                  </div>
                </div>
                <dl className="kix-profile-details">
                  <div className="kix-detail">
                    <dt>Nome</dt>
                    <dd>{profile.nome?.trim() || "Não indicado"}</dd>
                  </div>
                  <div className="kix-detail">
                    <dt>Email</dt>
                    <dd title={profile.email || user.email}>{profile.email || user.email}</dd>
                  </div>
                  <div className="kix-detail">
                    <dt>Telefone</dt>
                    <dd>{profile.telefone || "Não indicado"}</dd>
                  </div>
                  <div className="kix-detail">
                    <dt>Estado da conta</dt>
                    <dd>{profile.status || "Não indicado"}</dd>
                  </div>
                </dl>
              </section>

              <section className="kix-plan-card" aria-labelledby="kix-plan-title">
                <div className="kix-section-title">
                  <div>
                    <h2 id="kix-plan-title">O seu plano</h2>
                    <p>Detalhes do plano associado.</p>
                  </div>
                  <span className="kix-plan-badge">
                    {profile.plano?.trim() || "Não indicado"}
                  </span>
                </div>
                <div className="kix-plan-status">{profile.status || "Estado não indicado"}</div>
                <div className="kix-plan-expiry">
                  Data de validade: <strong>{expiration || "Não indicada"}</strong>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
