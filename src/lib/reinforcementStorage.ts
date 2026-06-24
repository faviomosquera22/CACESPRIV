import type { CategoryPerformance } from "@/lib/reinforcement";

const LOCAL_REINFORCEMENTS_UPDATED_EVENT = "local-reinforcements-updated";

export type LocalReinforcement = {
  sourceSimulationId: string;
  examSlug: string;
  category: string;
  score: number;
  createdAt: string;
  completedAt: string | null;
};

function getStorageKey(studentId: string) {
  return `local-reinforcements:${studentId}`;
}

export function subscribeToLocalReinforcementChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCAL_REINFORCEMENTS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCAL_REINFORCEMENTS_UPDATED_EVENT, onStoreChange);
  };
}

export function readLocalReinforcements(studentId: string): LocalReinforcement[] {
  const rawValue = window.localStorage.getItem(getStorageKey(studentId));

  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as LocalReinforcement[];
  } catch {
    return [];
  }
}

function writeLocalReinforcements(
  studentId: string,
  reinforcements: LocalReinforcement[],
) {
  window.localStorage.setItem(
    getStorageKey(studentId),
    JSON.stringify(reinforcements),
  );
  window.dispatchEvent(new Event(LOCAL_REINFORCEMENTS_UPDATED_EVENT));
}

export function writePendingLocalReinforcements(
  studentId: string,
  sourceSimulationId: string,
  examSlug: string,
  weaknesses: CategoryPerformance[],
) {
  const existing = readLocalReinforcements(studentId);
  const newEntries = weaknesses.map<LocalReinforcement>((weakness) => ({
    sourceSimulationId,
    examSlug,
    category: weakness.category,
    score: weakness.score,
    createdAt: new Date().toISOString(),
    completedAt: null,
  }));
  const unaffected = existing.filter(
    (item) => item.sourceSimulationId !== sourceSimulationId,
  );

  writeLocalReinforcements(studentId, [...newEntries, ...unaffected]);
}

export function completeLocalReinforcement(
  studentId: string,
  sourceSimulationId: string,
  category: string,
) {
  const completedAt = new Date().toISOString();
  const existing = readLocalReinforcements(studentId);
  const matched = existing.some(
    (item) =>
      item.sourceSimulationId === sourceSimulationId && item.category === category,
  );
  const next = matched
    ? existing.map((item) =>
        item.sourceSimulationId === sourceSimulationId && item.category === category
          ? { ...item, completedAt }
          : item,
      )
    : [
        {
          sourceSimulationId,
          examSlug: "enfermeria",
          category,
          score: 0,
          createdAt: completedAt,
          completedAt,
        },
        ...existing,
      ];

  writeLocalReinforcements(studentId, next);
}

export function getPendingLocalReinforcements(studentId: string, examSlug: string) {
  return readLocalReinforcements(studentId).filter(
    (item) => item.examSlug === examSlug && !item.completedAt,
  );
}
