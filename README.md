# Simulador CACES Enfermería

Aplicación externa en Next.js, TypeScript, Tailwind CSS y Supabase para que estudiantes practiquen simulaciones tipo CACES de Enfermería y docentes controlen accesos, creación de alumnos e historial académico.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Completa las variables públicas de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Los docentes pueden crear estudiantes desde el panel siempre que `SUPABASE_SERVICE_ROLE_KEY` esté configurada. Cada usuario necesita un registro en `profiles` con `role` igual a `student` o `teacher`; los estudiantes deben quedar habilitados con el área `Enfermería`.

## Rutas

- `/login`
- `/student/dashboard`
- `/student/simulator`
- `/student/results/[simulationId]`
- `/teacher/dashboard`
- `/teacher/students/[studentId]`

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Banco de preguntas

El repositorio incluye el banco procesado en `src/data/enfermeriaQuestions.json` y el seed de Supabase en `supabase/caces_schema_and_enfermeria_seed.sql`. Los documentos fuente se mantienen localmente en `BASE DE PREGUNTAS CACES` y no se versionan porque incluyen PDFs grandes que superan el limite de GitHub.

Para regenerar el banco local y el seed de Supabase:

```bash
python3 scripts/extract_enfermeria_questions.py
```

El script genera `src/data/enfermeriaQuestions.json` y `supabase/caces_schema_and_enfermeria_seed.sql`. Solo carga preguntas de Enfermería con respuesta identificable; deja fuera Psicología y PDFs de referencia como `MAIS` o `SCORE MAMA`.

Para sincronizar resultados entre equipos, ejecuta una sola vez
`supabase/simulation_attempts_storage.sql` en Supabase SQL Editor. Cada intento
queda guardado con sus preguntas y respuestas; los intentos locales anteriores
se migran automáticamente cuando el estudiante vuelve a iniciar sesión.

Para habilitar el bloqueo y la liberación del simulador mediante los mini tests,
ejecuta también `supabase/reinforcement_attempts_storage.sql`. Sin esa tabla el
refuerzo seguirá funcionando en el navegador actual, pero no se sincronizará
entre dispositivos. Si ya ejecutaste una versión anterior de ese script, vuelve
a ejecutarlo para añadir el puntaje y las respuestas del resultado de refuerzo.

Cuando agregues documentos a `BASE DE PREGUNTAS CACES`, vuelve a ejecutar el
extractor. Para reemplazar el banco remoto, ejecuta primero
`supabase/question_bank_refresh.sql` y luego el seed regenerado.

## Verificación

```bash
npm run lint
npm run build
```

## Tablas esperadas

La app consume las tablas `profiles`, `questions`, `simulations` y `simulation_answers` en Supabase.

Usa `supabase/caces_schema_and_enfermeria_seed.sql` para crear el esquema y cargar el banco de Enfermería.
