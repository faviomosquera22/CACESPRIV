"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import {
  getPendingLocalReinforcements,
  subscribeToLocalReinforcementChanges,
  type LocalReinforcement,
} from "@/lib/reinforcementStorage";

type SimulatorAccessGateProps = {
  studentId: string;
  examSlug: string;
  serverPending?: Array<{
    sourceSimulationId: string;
    category: string;
  }>;
  children: React.ReactNode;
};

export function SimulatorAccessGate({
  studentId,
  examSlug,
  serverPending = [],
  children,
}: SimulatorAccessGateProps) {
  const [pendingReinforcements, setPendingReinforcements] = useState<
    LocalReinforcement[] | null
  >(null);

  useEffect(() => {
    const updatePendingReinforcements = () => {
      setPendingReinforcements(
        getPendingLocalReinforcements(studentId, examSlug),
      );
    };

    updatePendingReinforcements();
    return subscribeToLocalReinforcementChanges(updatePendingReinforcements);
  }, [examSlug, studentId]);

  if (pendingReinforcements === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Comprobando si hay refuerzos pendientes…
      </div>
    );
  }

  const reinforcements = [
    ...serverPending.map((reinforcement) => ({
      ...reinforcement,
      examSlug,
      score: 0,
      createdAt: "",
      completedAt: null,
    })),
    ...pendingReinforcements,
  ].filter(
    (reinforcement, index, all) =>
      all.findIndex(
        (item) =>
          item.sourceSimulationId === reinforcement.sourceSimulationId &&
          item.category === reinforcement.category,
      ) === index,
  );

  if (reinforcements.length === 0) {
    return children;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Simulador temporalmente bloqueado</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Completa el refuerzo pendiente
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Debes completar el mini test de la categoría con falencias antes de iniciar otro simulador completo.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {reinforcements.map((reinforcement) => {
          const params = new URLSearchParams({
            category: reinforcement.category,
            source: reinforcement.sourceSimulationId,
          });

          return (
            <Link
              key={`${reinforcement.sourceSimulationId}-${reinforcement.category}`}
              href={`/student/reinforcement/${examSlug}?${params.toString()}`}
              className="inline-flex min-h-11 items-center justify-between gap-3 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              <span>{reinforcement.category}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
