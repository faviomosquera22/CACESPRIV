"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";

type StudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function StudentHistoryClient({
  studentId,
  serverSimulations,
}: StudentHistoryClientProps) {
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
    () => mergeSimulationRecords([...localSimulations, ...serverSimulations]),
    [localSimulations, serverSimulations],
  );

  return (
    <SimulationHistoryTable
      simulations={simulations}
      resultBasePath="/student/results"
      emptyMessage="Aún no tienes simulaciones registradas."
    />
  );
}
