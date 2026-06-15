"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StatCard } from "@/components/StatCard";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type TeacherStudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
  serverAnswers: SimulationAnswerWithQuestion[];
};

type LocalSimulationResultPayload = {
  answers?: SimulationAnswerWithQuestion[];
};

type CategoryWeakness = {
  category: string;
  total: number;
  incorrect: number;
  failureRate: number;
};

function getAnswerCategory(answer: SimulationAnswerWithQuestion) {
  return answer.questions?.category?.trim() || "Sin categoría";
}

function buildCategoryWeaknesses(
  answers: SimulationAnswerWithQuestion[],
): CategoryWeakness[] {
  const summaries = new Map<string, Omit<CategoryWeakness, "failureRate">>();

  answers.forEach((answer) => {
    const category = getAnswerCategory(answer);
    const current = summaries.get(category) ?? {
      category,
      total: 0,
      incorrect: 0,
    };

    current.total += 1;
    current.incorrect += answer.is_correct === true ? 0 : 1;
    summaries.set(category, current);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      failureRate:
        summary.total > 0
          ? Math.round((summary.incorrect / summary.total) * 10000) / 100
          : 0,
    }))
    .sort(
      (left, right) =>
        right.incorrect - left.incorrect ||
        right.failureRate - left.failureRate ||
        right.total - left.total ||
        left.category.localeCompare(right.category),
    );
}

function readLocalSimulationAnswers(simulations: SimulationHistoryRecord[]) {
  return simulations.flatMap((simulation) => {
    try {
      const rawValue = window.localStorage.getItem(
        `local-simulation:${simulation.id}`,
      );

      if (!rawValue) {
        return [];
      }

      const payload = JSON.parse(rawValue) as LocalSimulationResultPayload;
      return payload.answers ?? [];
    } catch {
      return [];
    }
  });
}

function getFailureTone(failureRate: number) {
  if (failureRate >= 60) {
    return "bg-red-500";
  }

  if (failureRate >= 35) {
    return "bg-amber-500";
  }

  return "bg-sky-500";
}

function CategoryWeaknessSummary({
  weaknesses,
}: {
  weaknesses: CategoryWeakness[];
}) {
  const topWeakness = weaknesses.find((weakness) => weakness.incorrect > 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-100">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-normal text-slate-950">
              Categorías con más fallos
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Muestra dónde se concentra la mayor cantidad de respuestas
              incorrectas del estudiante.
            </p>
          </div>
        </div>

        {topWeakness ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4" aria-hidden="true" />
              Mayor refuerzo
            </div>
            <p className="mt-1 max-w-md leading-6">{topWeakness.category}</p>
          </div>
        ) : null}
      </div>

      {weaknesses.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Aún no hay respuestas registradas para calcular categorías de fallo.
        </div>
      ) : topWeakness ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {weaknesses.slice(0, 6).map((weakness) => {
            const safeFailureRate = Math.min(
              100,
              Math.max(0, weakness.failureRate),
            );

            return (
              <article
                key={weakness.category}
                className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold leading-6 text-slate-950">
                      {weakness.category}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {weakness.incorrect} incorrectas de {weakness.total}{" "}
                      preguntas respondidas
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-lg font-semibold text-slate-950">
                    {formatScore(weakness.failureRate)}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-lg bg-white">
                  <div
                    className={`h-full rounded-lg ${getFailureTone(
                      weakness.failureRate,
                    )}`}
                    style={{ width: `${safeFailureRate}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          No hay respuestas incorrectas registradas para este estudiante.
        </div>
      )}
    </section>
  );
}

export function TeacherStudentHistoryClient({
  studentId,
  serverSimulations,
  serverAnswers,
}: TeacherStudentHistoryClientProps) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const rawValue = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () => window.localStorage.getItem(storageKey),
    () => null,
  );

  const localSimulations = useMemo(() => {
    if (!rawValue) {
      return [];
    }

    try {
      return JSON.parse(rawValue) as SimulationHistoryRecord[];
    } catch {
      return [];
    }
  }, [rawValue]);

  const simulations = useMemo(
    () =>
      [...localSimulations, ...serverSimulations].sort((left, right) => {
        const leftTime = new Date(
          left.finished_at ?? left.created_at ?? 0,
        ).getTime();
        const rightTime = new Date(
          right.finished_at ?? right.created_at ?? 0,
        ).getTime();

        return rightTime - leftTime;
      }),
    [localSimulations, serverSimulations],
  );
  const localAnswers = useMemo(
    () => readLocalSimulationAnswers(localSimulations),
    [localSimulations],
  );
  const categoryWeaknesses = useMemo(
    () => buildCategoryWeaknesses([...localAnswers, ...serverAnswers]),
    [localAnswers, serverAnswers],
  );
  const scores = simulations.map((simulation) => simulation.score);
  const latestSimulation = simulations[0] ?? null;
  const bestScore = Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );

  return (
    <>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Simulaciones realizadas"
          value={simulations.length}
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
        />
        <StatCard
          title="Promedio general"
          value={formatScore(average(scores))}
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
        />
        <StatCard
          title="Mejor puntaje"
          value={formatScore(bestScore)}
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          tone="green"
        />
        <StatCard
          title="Última simulación"
          value={formatDate(
            latestSimulation?.finished_at ?? latestSimulation?.created_at,
          )}
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          tone="slate"
        />
      </section>

      <CategoryWeaknessSummary weaknesses={categoryWeaknesses} />

      <section>
        <h3 className="mb-4 text-xl font-semibold tracking-normal text-slate-950">
          Historial completo
        </h3>
        <SimulationHistoryTable
          simulations={simulations}
          emptyMessage="Este estudiante aún no tiene simulaciones registradas."
        />
      </section>
    </>
  );
}
