import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck, Stethoscope } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentAuthContext } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/routes";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentAuthContext();

  if (context?.profile) {
    redirect(getRoleHomePath(context.profile.role));
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialError =
    resolvedSearchParams.error === "missing-profile"
      ? "Tu cuenta no tiene un perfil asignado. Contacta al administrador."
      : undefined;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 bg-cover bg-center text-white"
      style={{ backgroundImage: "url('/images/nursing-login-hero.png')" }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.82)_0%,rgba(15,23,42,0.58)_39%,rgba(15,23,42,0.12)_68%,rgba(15,23,42,0.04)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950/70 to-transparent" />

      <section className="relative z-10 grid min-h-screen w-full gap-10 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-center lg:px-12 xl:px-16">
        <div className="max-w-2xl py-8 lg:py-0">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-300 text-slate-950 shadow-sm shadow-cyan-950/20">
            <Stethoscope className="h-7 w-7" aria-hidden="true" />
          </div>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Plataforma externa
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Simulador CACES Enfermería
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-100">
            Práctica supervisada para estudiantes externos, con control docente
            sobre accesos, intentos y seguimiento académico.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur">
              <ClipboardCheck className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              Banco de Enfermería
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              Supervisión docente
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center pb-8 lg:justify-end lg:pb-0">
          <div className="w-full max-w-md">
            <div className="mb-5 text-white lg:text-slate-950">
              <p className="text-sm font-semibold text-cyan-100 lg:text-cyan-700">
                Acceso autorizado
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                Iniciar sesión
              </h2>
            </div>
            <LoginForm initialError={initialError} />
          </div>
        </div>
      </section>
    </main>
  );
}
