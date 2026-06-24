import { CheckCircle2 } from "lucide-react";
import type { ReinforcementAttempt } from "@/lib/database.types";
import { formatDate, formatScore } from "@/lib/format";

type ReinforcementResultsSummaryProps = {
  attempts: Array<
    Pick<
      ReinforcementAttempt,
      | "id"
      | "category"
      | "total_questions"
      | "correct_answers"
      | "score"
      | "completed_at"
      | "created_at"
    >
  >;
};

export function ReinforcementResultsSummary({
  attempts,
}: ReinforcementResultsSummaryProps) {
  if (attempts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Resultados de refuerzo completados
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Estos mini tests ya habilitaron nuevamente el simulador.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {attempts.map((attempt) => (
          <article
            key={attempt.id}
            className="rounded-lg border border-emerald-200 bg-white p-4"
          >
            <h4 className="text-sm font-semibold leading-6 text-slate-950">
              {attempt.category}
            </h4>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-semibold text-emerald-700">
                {formatScore(attempt.score)}
              </p>
              <p className="text-sm text-slate-600">
                {attempt.correct_answers} de {attempt.total_questions} correctas
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Completado el {formatDate(attempt.completed_at ?? attempt.created_at)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
