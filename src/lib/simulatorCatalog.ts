import type { LucideIcon } from "lucide-react";
import { Stethoscope } from "lucide-react";

export type SimulatorExamType = "enfermeria";

export type SimulatorExamConfig = {
  slug: SimulatorExamType;
  title: string;
  shortTitle: string;
  description: string;
  structure: string[];
  categoryKeywords: string[];
  icon: LucideIcon;
};

export const simulatorExams: SimulatorExamConfig[] = [
  {
    slug: "enfermeria",
    title: "Simulador Enfermería",
    shortTitle: "Enfermería",
    description:
      "Práctica orientada a valorar razonamiento clínico, cuidado integral, seguridad del paciente y toma de decisiones en escenarios frecuentes de enfermería.",
    structure: [
      "Cuidado del adulto, materno infantil, salud comunitaria y fundamentos profesionales.",
      "Preguntas de opción múltiple con una sola respuesta correcta.",
      "Hasta 50 preguntas y temporizador de 60 minutos en esta primera versión.",
    ],
    categoryKeywords: ["enfermeria", "enfermería", "nursing"],
    icon: Stethoscope,
  },
];

export function getSimulatorExam(slug: string) {
  return simulatorExams.find((exam) => exam.slug === slug);
}
