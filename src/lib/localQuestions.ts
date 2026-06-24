import type { Question } from "@/lib/database.types";
import enfermeriaQuestions from "@/data/enfermeriaQuestions.json";

export const nursingExamDistribution = [
  {
    area: "Cuidado y Procedimientos Clínicos de Enfermería",
    percent: 30,
    count: 30,
  },
  {
    area: "Cuidados de la Mujer, Recién Nacido, Niño y Adolescente",
    percent: 24,
    count: 24,
  },
  {
    area: "Cuidados del Adulto y Adulto Mayor",
    percent: 20,
    count: 20,
  },
  {
    area: "Cuidado Familiar, Comunitario e Intercultural",
    percent: 17,
    count: 17,
  },
  {
    area: "Bases Educativas, Administrativas, Investigativas y Epidemiológicas",
    percent: 9,
    count: 9,
  },
];

export const examDistributionBySlug = {
  enfermeria: nursingExamDistribution,
};

type ExamDistribution = typeof nursingExamDistribution;

function getQuestionArea(question: Question, distribution: ExamDistribution) {
  const category = question.category ?? "";
  const match = distribution.find(({ area }) =>
    category.toLowerCase().includes(area.toLowerCase()),
  );

  return match?.area ?? distribution[0].area;
}

function dedupeQuestions(questions: Question[]) {
  const seen = new Set<string>();
  const result: Question[] = [];

  questions.forEach((question) => {
    if (seen.has(question.id)) {
      return;
    }

    seen.add(question.id);
    result.push(question);
  });

  return result;
}

function shuffleQuestions(questions: Question[]) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentQuestion = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = currentQuestion;
  }

  return shuffled;
}

function selectDistributedExamQuestions(
  questions: Question[],
  distribution: ExamDistribution,
) {
  const availableQuestions = shuffleQuestions(questions);
  const selected: Question[] = [];

  distribution.forEach(({ area, count }) => {
    selected.push(
      ...availableQuestions
        .filter((question) => getQuestionArea(question, distribution) === area)
        .slice(0, count),
    );
  });

  if (selected.length < 100) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const fillQuestions = availableQuestions.filter(
      (question) => !selectedIds.has(question.id),
    );

    selected.push(...fillQuestions.slice(0, 100 - selected.length));
  }

  return dedupeQuestions(selected).slice(0, 100);
}

export function selectNursingExamQuestions(questions: Question[]) {
  return selectDistributedExamQuestions(questions, nursingExamDistribution);
}

export function selectQuestionsForExam(examType: string, questions: Question[]) {
  if (examType === "enfermeria") {
    return selectNursingExamQuestions(questions);
  }

  return questions.slice(0, 100);
}

export function getLocalQuestionsForExam(examType: string) {
  if (examType === "enfermeria") {
    return selectNursingExamQuestions(enfermeriaQuestions as Question[]);
  }

  return [];
}

export function getQuestionsForReinforcement(
  questions: Question[],
  category: string,
  count = 25,
) {
  return shuffleQuestions(
    questions.filter((question) => question.category?.trim() === category),
  ).slice(0, count);
}

export function getLocalQuestionsForReinforcement(
  examType: string,
  category: string,
  count = 25,
) {
  if (examType !== "enfermeria") {
    return [];
  }

  return getQuestionsForReinforcement(
    enfermeriaQuestions as Question[],
    category,
    count,
  );
}

export function isLocalQuestionSet(questions: Question[]) {
  return questions.some((question) => question.id.startsWith("local-"));
}
