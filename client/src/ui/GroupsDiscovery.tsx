import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./groups-ui.css";

interface GroupRecord {
  id: number | string;
  nome: string | null;
  valor: number | string | null;
  tipo: string | null;
  max_membros: number | string | null;
}

interface GroupSummary extends GroupRecord {
  participantCount: number;
  alreadyJoined: boolean;
}

type GroupFilter = "todos" | "semanal" | "mensal" | "trimestral";

const filters: { value: GroupFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
];

function numericValue(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatKwanza(value: number | string | null): string {
  const amount = numericValue(value);
  if (amount === null) return "Valor não indicado";

  return `${new Intl.NumberFormat("pt-AO", {
    maximumFractionDigits: 2,
  }).format(amount)} Kz`;
}

function getRpcErrorMessage(cause: unknown): string {
  const error =
    cause && typeof cause === "object"
      ? (cause as { code?: unknown; message?: unknown })
      : {};
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";
  const normalized = message.toLocaleLowerCase("pt-AO");

  if (
    code === "23505" ||
    /already.*(member|join)|já (faz|é|pertence)|já participa|já é membro/.test(normalized)
  ) {
    return "Já faz parte deste grupo.";
  }

  if (/full|capacity|cheio|lotad|sem vagas|vagas esgotadas/.test(normalized)) {
    return "Este grupo já não tem vagas disponíveis.";
  }

  if (/plan|plano|limit|limite/.test(normalized)) {
    return "O limite do seu plano foi atingido.";
  }

  if (/closed|unavailable|not found|indispon|encerrad|privad/.test(normalized)) {
    return "Este grupo já não está disponível.";
  }

  if (code === "PGRST202") {
    return "A função de entrada não está disponível no Supabase.";
  }

  if (
    code === "42501" ||
    /permission denied|not authorized|unauth|session|sessão/.test(normalized)
  ) {
    return "Não foi possível validar a sua sessão para entrar neste grupo.";
  }

  return "Não foi possível entrar neste grupo. Tente novamente.";
}

function hasExplicitRpcFailure(data: unknown): boolean {
  if (data === false) return true;
  if (!data || typeof data !== "object") return false;

  const result = data as { success?: unknown; ok?: unknown };
  return result.success === false || result.ok === false;
}

export default function GroupsDiscovery({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [filter, setFilter] = useState<GroupFilter>("todos");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(
    async (initialLoad = false): Promise<boolean> => {
      if (initialLoad) setLoading(true);
      else setRefreshing(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("groups")
          .select("id,nome,valor,tipo,max_membros")
          .eq("status", "aberto")
          .eq("privado", false)
          .order("valor", { ascending: true });

        if (error) throw error;

        const records = (data ?? []) as unknown as GroupRecord[];
        const groupIds = records.map((group) => group.id);

        const [memberRowsResult, counts] = await Promise.all([
          groupIds.length > 0
            ? supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", userId)
                .in("group_id", groupIds)
            : Promise.resolve({ data: [], error: null }),
          Promise.all(
            records.map(async (group) => {
              const { count, error: countError } = await supabase
                .from("group_members")
                .select("group_id", { count: "exact", head: true })
                .eq("group_id", group.id);

              if (countError) throw countError;
              return [String(group.id), count ?? 0] as const;
            }),
          ),
        ]);

        if (memberRowsResult.error) throw memberRowsResult.error;

        const joinedIds = new Set(
          (memberRowsResult.data ?? []).map((membership) =>
            String((membership as { group_id: number | string }).group_id),
          ),
        );
        const countsByGroup = new Map(counts);

        setGroups(
          records.map((group) => ({
            ...group,
            participantCount: countsByGroup.get(String(group.id)) ?? 0,
            alreadyJoined: joinedIds.has(String(group.id)),
          })),
        );
        return true;
      } catch (cause) {
        console.error("Não foi possível carregar os grupos públicos.", cause);
        setLoadError("Não foi possível carregar os grupos públicos.");
        return false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadGroups(true);
  }, [loadGroups]);

  const visibleGroups = useMemo(
    () =>
      filter === "todos"
        ? groups
        : groups.filter(
            (group) =>
              group.tipo?.toLocaleLowerCase("pt-AO") === filter,
          ),
    [filter, groups],
  );

  async function joinGroup(group: GroupSummary) {
    const groupKey = String(group.id);
    if (joiningGroupId !== null) return;

    setJoiningGroupId(groupKey);
    setJoinError("");
    setFeedback("");

    try {
      const { data, error } = await supabase.rpc("entrar_grupo_kixapp", {
        p_group_id: group.id,
      });

      if (error) {
        console.error("Falha ao entrar no grupo.", error);
        setJoinError(getRpcErrorMessage(error));
        return;
      }

      if (hasExplicitRpcFailure(data)) {
        setJoinError("Não foi possível entrar neste grupo. Tente novamente.");
        return;
      }

      const refreshed = await loadGroups(false);
      setFeedback(
        refreshed
          ? `Entrada confirmada em ${group.nome || "grupo"}. Participantes atualizados.`
          : `Entrada confirmada em ${group.nome || "grupo"}, mas não foi possível atualizar a lista.`,
      );
    } catch (cause) {
      console.error("Falha ao chamar a função de entrada do grupo.", cause);
      setJoinError(getRpcErrorMessage(cause));
    } finally {
      setJoiningGroupId(null);
    }
  }

  return (
    <section
      className="kix-groups-section"
      aria-labelledby="kix-groups-discovery-title"
    >
      <header className="kix-groups-header">
        <div>
          <span className="kix-eyebrow">Comunidade</span>
          <h2 id="kix-groups-discovery-title">Descobrir grupos</h2>
          <p>Encontre Kixikilas públicas abertas.</p>
        </div>
        <button
          className="kix-groups-refresh"
          type="button"
          onClick={() => void loadGroups(false)}
          disabled={loading || refreshing || joiningGroupId !== null}
        >
          {refreshing ? "A atualizar…" : "Atualizar"}
        </button>
      </header>

      <div className="kix-groups-filters" role="group" aria-label="Filtrar grupos">
        {filters.map((item) => (
          <button
            key={item.value}
            className={filter === item.value ? "is-active" : ""}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {feedback && (
        <p className="kix-groups-message kix-groups-message-success" role="status">
          {feedback}
        </p>
      )}

      {joinError && (
        <p className="kix-groups-message kix-groups-message-error" role="alert">
          {joinError}
        </p>
      )}

      {loadError && (
        <div className="kix-groups-load-error" role="alert">
          <p>{loadError}</p>
          <button
            className="kix-groups-refresh"
            type="button"
            onClick={() => void loadGroups(false)}
            disabled={refreshing}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <p className="kix-groups-state" role="status" aria-live="polite">
          A procurar grupos disponíveis…
        </p>
      ) : !loadError && groups.length === 0 ? (
        <p className="kix-groups-state">Neste momento não existem grupos públicos abertos.</p>
      ) : !loadError && visibleGroups.length === 0 ? (
        <p className="kix-groups-state">Não existem grupos nesta periodicidade.</p>
      ) : (
        <div className="kix-groups-grid">
          {visibleGroups.map((group) => {
            const key = String(group.id);
            const capacity = numericValue(group.max_membros);
            const full = capacity !== null && group.participantCount >= capacity;
            const remaining =
              capacity === null ? null : Math.max(capacity - group.participantCount, 0);
            const joining = joiningGroupId === key;

            return (
              <article className="kix-group-card" key={key}>
                <div className="kix-group-card-heading">
                  <span className="kix-group-type">
                    {group.tipo?.trim() || "Tipo não indicado"}
                  </span>
                  {group.alreadyJoined && (
                    <span className="kix-group-member-badge">Já participa</span>
                  )}
                </div>
                <h3>{group.nome?.trim() || "Grupo sem nome"}</h3>
                <p className="kix-group-value">{formatKwanza(group.valor)}</p>
                <div className="kix-group-capacity">
                  <span>Participantes</span>
                  <strong>
                    {group.participantCount}
                    {capacity === null ? "" : ` / ${capacity}`}
                  </strong>
                </div>
                <p className="kix-group-places">
                  {remaining === null
                    ? "Vagas disponíveis: não indicado"
                    : `Vagas disponíveis: ${remaining}`}
                </p>
                <button
                  className="kix-groups-join"
                  type="button"
                  onClick={() => void joinGroup(group)}
                  disabled={
                    joiningGroupId !== null ||
                    group.alreadyJoined ||
                    full
                  }
                >
                  {joining
                    ? "A entrar…"
                    : group.alreadyJoined
                      ? "Já participa"
                      : full
                        ? "Grupo cheio"
                        : "Entrar"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
