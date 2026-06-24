import type { SimulationAnswerWithQuestion } from "@/lib/database.types";

export const REINFORCEMENT_QUESTION_COUNT = 25;
export const WEAKNESS_SCORE_THRESHOLD = 70;

export type MspGuide = {
  title: string;
  description: string;
  href: string;
};

export type CategoryPerformance = {
  category: string;
  total: number;
  correct: number;
  score: number;
  guide: MspGuide;
};

const defaultGuide: MspGuide = {
  title: "Gacetas epidemiológicas y manual SIVE-ALERTA",
  description:
    "Repasa vigilancia epidemiológica, notificación, análisis de datos y respuesta ante eventos de salud pública.",
  href: "https://www.salud.gob.ec/gacetas-inmunoprevenibles/",
};

const guideByCategory: Record<string, MspGuide> = {
  "Enfermería - Cuidados de la Mujer, Recién Nacido, Niño y Adolescente": {
    title: "Guía de Práctica Clínica: Control Prenatal",
    description:
      "Refuerza control prenatal, factores de riesgo, educación y seguimiento de la gestante.",
    href: "https://www.salud.gob.ec/wp-content/uploads/2014/05/GPC-CPN-final-mayo-2016-DNN.pdf",
  },
  "Enfermería - Cuidado y Procedimientos Clínicos de Enfermería": {
    title: "Manual MSP: control de enterobacterias a nivel hospitalario",
    description:
      "Repasa prevención y control de infecciones, vigilancia y medidas seguras de atención hospitalaria.",
    href: "https://www.salud.gob.ec/wp-content/uploads/2025/01/Manual_control_de_enterobacterias_productoras_de_carbapenemasas_a_nivel_hospitalario.pdf",
  },
  "Enfermería - Cuidados del Adulto y Adulto Mayor": {
    title: "Guía de Práctica Clínica: Enfermedad Renal Crónica",
    description:
      "Refuerza prevención, diagnóstico, tratamiento, seguimiento y referencia del paciente adulto y adulto mayor.",
    href: "https://www.salud.gob.ec/wp-content/uploads/2018/10/guia_prevencion_diagnostico_tratamiento_enfermedad_renal_cronica_2018.pdf",
  },
  "Enfermería - Cuidado Familiar, Comunitario e Intercultural": {
    title: "Manual operativo del Modelo de Atención Integral de Salud",
    description:
      "Refuerza APS, continuidad de atención, red pública e intervención con personas, familias y comunidades.",
    href: "https://www.salud.gob.ec/wp-content/uploads/downloads/2013/07/DOCBASERED100613.pdf",
  },
  "Enfermería - Bases Educativas, Administrativas, Investigativas y Epidemiológicas": {
    title: "Gacetas epidemiológicas y manual SIVE-ALERTA",
    description:
      "Refuerza vigilancia epidemiológica, notificación, análisis de datos y respuesta ante eventos de salud pública.",
    href: "https://www.salud.gob.ec/gacetas-inmunoprevenibles/",
  },
};

export function getMspGuide(category: string) {
  return guideByCategory[category] ?? defaultGuide;
}

function getCategoryName(answer: SimulationAnswerWithQuestion) {
  return answer.questions?.category?.trim() || "Sin categoría";
}

export function getCategoryPerformances(
  answers: SimulationAnswerWithQuestion[],
): CategoryPerformance[] {
  const summaries = new Map<
    string,
    Omit<CategoryPerformance, "score" | "guide">
  >();

  answers.forEach((answer) => {
    const category = getCategoryName(answer);
    const current = summaries.get(category) ?? { category, total: 0, correct: 0 };
    current.total += 1;
    current.correct += answer.is_correct === true ? 1 : 0;
    summaries.set(category, current);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      score:
        summary.total > 0
          ? Math.round((summary.correct / summary.total) * 10000) / 100
          : 0,
      guide: getMspGuide(summary.category),
    }))
    .sort((left, right) => left.score - right.score || left.category.localeCompare(right.category));
}

export function getCategoryWeaknesses(answers: SimulationAnswerWithQuestion[]) {
  return getCategoryPerformances(answers).filter(
    (summary) => summary.score < WEAKNESS_SCORE_THRESHOLD,
  );
}
