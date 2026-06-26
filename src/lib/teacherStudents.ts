import type { StudentCardData } from "@/components/StudentCard";
import {
  mergeSimulationRecords,
  type CloudSimulationRecord,
} from "@/lib/cloudSimulationStorage";
import type { Profile, Simulation } from "@/lib/database.types";
import { demoStudentProfiles } from "@/lib/demoStudents";
import { average } from "@/lib/format";
import { getStudentCareerOption } from "@/lib/studentCareer";
import {
  simulationAttemptHistorySelect,
  simulationAttemptToHistoryRecord,
  type SimulationAttemptHistoryRow,
} from "@/lib/supabaseSimulationAttempts";
import type { SupabaseServerClient } from "@/lib/supabaseServer";

type StudentSimulationRecord = CloudSimulationRecord & {
  student_id: string;
};
type StudentSimulationAttemptRow = SimulationAttemptHistoryRow & {
  student_id: string;
};

function getSimulationDate(simulation: CloudSimulationRecord) {
  return simulation.finished_at ?? simulation.created_at;
}

function getBestScore(simulations: CloudSimulationRecord[]) {
  return Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );
}

export async function getTeacherStudentCards(supabase: SupabaseServerClient) {
  const { data: studentProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, career, created_at")
    .eq("role", "student")
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  const students =
    studentProfiles && studentProfiles.length > 0
      ? studentProfiles
      : demoStudentProfiles;
  const studentIds = students.map((student) => student.id);

  const { data: legacySimulationRows } =
    studentIds.length > 0
      ? await supabase
          .from("simulations")
          .select("*")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
          .returns<Simulation[]>()
      : { data: [] };
  const { data: attemptRows } =
    studentIds.length > 0
      ? await supabase
          .from("simulation_attempts")
          .select(`student_id, ${simulationAttemptHistorySelect}`)
          .in("student_id", studentIds)
          .eq("status", "finished")
          .order("created_at", { ascending: false })
          .returns<StudentSimulationAttemptRow[]>()
      : { data: [] };

  const simulations: StudentSimulationRecord[] = [
    ...(legacySimulationRows ?? []),
    ...(attemptRows ?? []).map((attempt) => ({
      student_id: attempt.student_id,
      ...simulationAttemptToHistoryRecord(attempt),
    })),
  ];
  const simulationsByStudent = new Map<string, StudentSimulationRecord[]>();

  simulations.forEach((simulation) => {
    const current = simulationsByStudent.get(simulation.student_id) ?? [];
    current.push(simulation);
    simulationsByStudent.set(simulation.student_id, current);
  });

  return students.map((student): StudentCardData => {
    const studentSimulations = mergeSimulationRecords(
      simulationsByStudent.get(student.id) ?? [],
    );
    const latestSimulation = studentSimulations[0] ?? null;
    const career = getStudentCareerOption(student.career);

    return {
      id: student.id,
      fullName: student.full_name || student.email || "Sin nombre",
      email: student.email || "Sin correo",
      careerSlug: career?.slug ?? null,
      careerLabel: career?.label ?? student.career ?? "Sin área",
      simulationsCount: studentSimulations.length,
      averageScore: average(
        studentSimulations.map((simulation) => simulation.score),
      ),
      bestScore: getBestScore(studentSimulations),
      lastActivity: latestSimulation ? getSimulationDate(latestSimulation) : null,
    };
  });
}
