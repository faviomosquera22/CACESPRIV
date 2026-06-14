export type StudentCareerSlug = "enfermeria";

export type StudentCareerOption = {
  slug: StudentCareerSlug;
  label: string;
  simulatorSlug: StudentCareerSlug;
  aliases: string[];
};

export const studentCareerOptions: StudentCareerOption[] = [
  {
    slug: "enfermeria",
    label: "Enfermería",
    simulatorSlug: "enfermeria",
    aliases: ["enfermeria", "enfermería", "nursing"],
  },
];

function normalizeCareer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getStudentCareerOption(career?: string | null) {
  const normalizedCareer = normalizeCareer(career ?? "");

  if (!normalizedCareer) {
    return null;
  }

  return (
    studentCareerOptions.find((option) =>
      [option.slug, option.label, ...option.aliases].some((alias) => {
        const normalizedAlias = normalizeCareer(alias);

        return (
          normalizedCareer === normalizedAlias ||
          normalizedCareer.includes(normalizedAlias)
        );
      }),
    ) ?? null
  );
}

export function isSupportedStudentCareer(career?: string | null) {
  return Boolean(getStudentCareerOption(career));
}
