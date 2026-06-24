import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ReinforcementQuizClient } from "@/components/ReinforcementQuizClient";
import { requireCompletedStudentProfile } from "@/lib/auth";
import type { Question } from "@/lib/database.types";
import {
  getLocalQuestionsForReinforcement,
  getQuestionsForReinforcement,
} from "@/lib/localQuestions";
import { getMspGuide, REINFORCEMENT_QUESTION_COUNT } from "@/lib/reinforcement";
import { getSimulatorExam } from "@/lib/simulatorCatalog";
import { getStudentCareerOption } from "@/lib/studentCareer";

type ReinforcementPageProps = {
  params: Promise<{ examType: string }>;
  searchParams: Promise<{ category?: string; source?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ReinforcementPage({
  params,
  searchParams,
}: ReinforcementPageProps) {
  const [{ examType }, { category, source }] = await Promise.all([
    params,
    searchParams,
  ]);
  const exam = getSimulatorExam(examType);

  if (!exam || !category || !source) {
    notFound();
  }

  const { profile, supabase } = await requireCompletedStudentProfile();
  const career = getStudentCareerOption(profile.career);

  if (career && exam.slug !== career.simulatorSlug) {
    const params = new URLSearchParams({ category, source });
    redirect(`/student/reinforcement/${career.simulatorSlug}?${params.toString()}`);
  }

  const { data } = await supabase
    .from("questions")
    .select(
      "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, category, difficulty, created_at",
    )
    .eq("category", category)
    .limit(500)
    .returns<Question[]>();

  const selectedFromSupabase = getQuestionsForReinforcement(
    data ?? [],
    category,
    REINFORCEMENT_QUESTION_COUNT,
  );
  const questions =
    selectedFromSupabase.length >= 20
      ? selectedFromSupabase
      : getLocalQuestionsForReinforcement(
          exam.slug,
          category,
          REINFORCEMENT_QUESTION_COUNT,
        );

  if (questions.length < 20) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        No hay suficientes preguntas para crear el mini test de esta categoría.
      </section>
    );
  }

  const guide = getMspGuide(category);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Simulador", href: "/student/simulator" },
          { label: "Refuerzo" },
        ]}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700">Plan de refuerzo</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              {category}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Revisa la guía oficial y completa las {questions.length} preguntas del mini test. Al finalizar se habilitará nuevamente el simulador de {exam.shortTitle}.
            </p>
          </div>
        </div>
        <Link
          href={`/student/results/${source}`}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al resultado
        </Link>
      </section>

      <ReinforcementQuizClient
        questions={questions}
        studentId={profile.id}
        examSlug={exam.slug}
        category={category}
        sourceSimulationId={source}
        guide={guide}
      />
    </div>
  );
}
