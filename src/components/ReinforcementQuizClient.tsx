"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import type { OptionLetter, Question } from "@/lib/database.types";
import { completeLocalReinforcement } from "@/lib/reinforcementStorage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { SimulationQuestion } from "@/components/SimulationQuestion";

type ReinforcementQuizClientProps = {
  questions: Question[];
  studentId: string;
  examSlug: string;
  category: string;
  sourceSimulationId: string;
  guide: {
    title: string;
    description: string;
    href: string;
  };
};

export function ReinforcementQuizClient({
  questions,
  studentId,
  examSlug,
  category,
  sourceSimulationId,
  guide,
}: ReinforcementQuizClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<string, OptionLetter>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const correctAnswers = useMemo(
    () =>
      questions.filter((question) => answers[question.id] === question.correct_option)
        .length,
    [answers, questions],
  );

  function selectAnswer(option: OptionLetter) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: option,
    }));
  }

  async function finishReinforcement() {
    if (!allAnswered || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSaveNotice("");

    try {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("reinforcement_attempts").insert({
          student_id: studentId,
          source_simulation_id: sourceSimulationId,
          exam_slug: examSlug,
          category,
          total_questions: questions.length,
          correct_answers: correctAnswers,
        });

        if (error) {
          throw error;
        }
      } catch {
        setSaveNotice(
          "El refuerzo se registró en este navegador. Para sincronizarlo entre dispositivos, ejecuta el SQL de refuerzos en Supabase.",
        );
      }

      completeLocalReinforcement(studentId, sourceSimulationId, category);
      setIsComplete(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Refuerzo completado</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Ya puedes volver al simulador completo
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Completaste {questions.length} preguntas de {category} con {correctAnswers} respuestas correctas.
            </p>
            {saveNotice ? <p className="mt-3 text-sm text-amber-800">{saveNotice}</p> : null}
            <Link
              href={`/student/simulator/${examSlug}`}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Ir al simulador
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-sky-800">Lectura recomendada antes de responder</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{guide.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{guide.description}</p>
        <a
          href={guide.href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:text-sky-950"
        >
          Abrir guía oficial del MSP
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Mini test de refuerzo</p>
            <p className="mt-1 text-sm text-slate-600">Pregunta {currentIndex + 1} de {questions.length} · {answeredCount} respondidas</p>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {category}
          </span>
        </div>
      </section>

      <SimulationQuestion
        question={currentQuestion}
        selectedOption={answers[currentQuestion.id]}
        onSelect={selectAnswer}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0 || isSubmitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>
        {currentIndex === questions.length - 1 ? (
          <button
            type="button"
            onClick={() => void finishReinforcement()}
            disabled={!allAnswered || isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Guardando..." : "Finalizar refuerzo"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {!allAnswered ? (
        <p className="text-sm text-slate-500">Debes responder las {questions.length} preguntas para finalizar el refuerzo.</p>
      ) : null}
    </div>
  );
}
