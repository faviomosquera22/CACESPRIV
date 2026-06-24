import Link from "next/link";
import { ArrowRight, BookOpenCheck, ExternalLink, ShieldAlert } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import {
  getCategoryWeaknesses,
  WEAKNESS_SCORE_THRESHOLD,
} from "@/lib/reinforcement";
import { formatScore } from "@/lib/format";

type ReinforcementRecommendationsProps = {
  answers: SimulationAnswerWithQuestion[];
  examSlug: string;
  sourceSimulationId: string;
};

export function ReinforcementRecommendations({
  answers,
  examSlug,
  sourceSimulationId,
}: ReinforcementRecommendationsProps) {
  const weaknesses = getCategoryWeaknesses(answers);

  if (weaknesses.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Refuerzo requerido antes del próximo simulador
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Tu rendimiento fue menor a {WEAKNESS_SCORE_THRESHOLD}% en las áreas
            siguientes. Revisa la guía del MSP y completa el mini test de 25
            preguntas para volver a habilitar el simulador completo.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {weaknesses.map((weakness) => {
          const params = new URLSearchParams({
            category: weakness.category,
            source: sourceSimulationId,
          });

          return (
            <article
              key={weakness.category}
              className="rounded-lg border border-amber-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold leading-6 text-slate-950">
                    {weakness.category}
                  </h4>
                  <p className="mt-1 text-sm text-amber-800">
                    {weakness.correct} de {weakness.total} correctas · {formatScore(weakness.score)}
                  </p>
                </div>
                <BookOpenCheck className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              </div>
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-slate-950">{weakness.guide.title}</p>
                <p className="mt-1">{weakness.guide.description}</p>
                <a
                  href={weakness.guide.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 font-semibold text-sky-800 hover:text-sky-950"
                >
                  Revisar guía oficial del MSP
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <Link
                href={`/student/reinforcement/${examSlug}?${params.toString()}`}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Realizar mini test (25 preguntas)
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
