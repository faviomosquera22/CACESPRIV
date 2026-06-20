-- Ejecutar solo cuando se va a reemplazar el banco de preguntas de Enfermería.
-- Este comando elimina intentos históricos porque las respuestas dependen de
-- los IDs de las preguntas. Realiza esta actualización antes de abrir el
-- simulador a estudiantes o en una ventana de mantenimiento.

begin;

truncate table public.simulation_answers, public.simulations, public.questions
restart identity cascade;

commit;

-- Después ejecuta el archivo:
-- supabase/caces_schema_and_enfermeria_seed.sql
