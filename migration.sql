-- ============================================================
-- Quiz Ariana — Esquema Supabase
-- Ejecutar en: SQL Editor del dashboard de jrhmykilnqndvgnsmueo
-- RLS deshabilitado (uso interno, una sola familia)
-- ============================================================

-- Limpieza (idempotente — comenta si ya hay datos en producción)
drop table if exists player_answers cascade;
drop table if exists quiz_questions cascade;
drop table if exists ariana_answers cascade;
drop table if exists quiz_sessions cascade;

-- 1) Sesiones del juego
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'collecting'
    check (status in ('collecting','ready','playing','finished'))
);

-- 2) Respuestas sinceras de Ariana
create table ariana_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  question_number int not null check (question_number between 1 and 12),
  question_text text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (session_id, question_number)
);

-- 3) Preguntas del quiz con sus 4 opciones (1 correcta + 3 generadas por IA)
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  question_number int not null check (question_number between 1 and 12),
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('a','b','c','d')),
  created_at timestamptz not null default now(),
  unique (session_id, question_number)
);

-- 4) Respuestas de los jugadores (papá, mamá, etc.)
create table player_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  player_name text not null,
  question_number int not null check (question_number between 1 and 12),
  selected_option char(1) not null check (selected_option in ('a','b','c','d')),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, player_name, question_number)
);

-- Índices útiles para el scoreboard en tiempo real
create index player_answers_session_idx on player_answers(session_id);
create index player_answers_session_player_idx on player_answers(session_id, player_name);

-- RLS desactivado explícitamente (uso interno, no expuesto al público)
alter table quiz_sessions  disable row level security;
alter table ariana_answers disable row level security;
alter table quiz_questions disable row level security;
alter table player_answers disable row level security;

-- ============================================================
-- Realtime: habilitar para las tablas que el front escucha
-- ============================================================
alter publication supabase_realtime add table player_answers;
alter publication supabase_realtime add table quiz_sessions;
