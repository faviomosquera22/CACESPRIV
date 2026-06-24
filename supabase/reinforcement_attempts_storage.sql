-- Ejecutar en Supabase SQL Editor después de simulation_attempts_storage.sql.
-- Registra la finalización de los mini tests que liberan un nuevo simulador.

create extension if not exists pgcrypto;

create table if not exists public.reinforcement_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  source_simulation_id text not null,
  exam_slug text not null check (exam_slug = 'enfermeria'),
  category text not null,
  total_questions integer not null check (total_questions between 20 and 25),
  correct_answers integer not null check (correct_answers between 0 and total_questions),
  completed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone default now(),
  unique (student_id, source_simulation_id, category)
);

create index if not exists reinforcement_attempts_student_source_idx
on public.reinforcement_attempts (student_id, source_simulation_id);

alter table public.reinforcement_attempts enable row level security;

drop policy if exists "Students can read own reinforcement attempts" on public.reinforcement_attempts;
create policy "Students can read own reinforcement attempts"
on public.reinforcement_attempts for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own reinforcement attempts" on public.reinforcement_attempts;
create policy "Students can insert own reinforcement attempts"
on public.reinforcement_attempts for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can read reinforcement attempts" on public.reinforcement_attempts;
create policy "Teachers can read reinforcement attempts"
on public.reinforcement_attempts for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

notify pgrst, 'reload schema';
