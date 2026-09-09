-- Atlas workspace schema
-- Paste into Supabase → SQL Editor and run.

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ---------- Core tables ----------

create table if not exists spaces (
  id text primary key,
  name text not null,
  description text not null default '',
  accent text not null default 'orange',
  position bigint not null default 0
);

create table if not exists projects (
  id text primary key,
  name text not null,
  space_id text not null references spaces(id),
  description text,
  position bigint not null default 0
);

create table if not exists folders (
  id text primary key,
  name text not null,
  project_id text not null references projects(id),
  space_id text not null references spaces(id)
);

create table if not exists lists (
  id text primary key,
  name text not null,
  folder_id text references folders(id),
  project_id text not null references projects(id),
  space_id text not null references spaces(id)
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  space_id text not null references spaces(id),
  project_id text references projects(id),
  list_id text references lists(id),
  status text not null default 'todo',
  priority text,
  assignee text,
  tags text[] not null default '{}',
  due_date date,
  start_date date,
  description text
);

create table if not exists task_items (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  parent_id text references task_items(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position bigint not null default 0
);

create table if not exists task_comments (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists task_activity (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  text text not null,
  "when" text not null
);

create table if not exists documents (
  id text primary key,
  title text not null,
  space_id text not null references spaces(id),
  project_id text references projects(id),
  kind text not null default 'doc',
  task_ids text[] not null default '{}'
);

create table if not exists document_blocks (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  type text not null default 'paragraph',
  text text not null default '',
  checked boolean not null default false,
  task_id text references tasks(id),
  position bigint not null default 0
);

-- ---------- Indexes ----------

create index if not exists idx_projects_space on projects(space_id);
create index if not exists idx_lists_project on lists(project_id);
create index if not exists idx_tasks_space on tasks(space_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_list on tasks(list_id);
create index if not exists idx_items_task on task_items(task_id);
create index if not exists idx_items_parent on task_items(parent_id);
create index if not exists idx_comments_task on task_comments(task_id);
create index if not exists idx_docs_space on documents(space_id);
create index if not exists idx_blocks_document on document_blocks(document_id);
create index if not exists idx_blocks_task on document_blocks(task_id);

-- ---------- Row Level Security ----------
-- Single shared workspace: any signed-in user can read/write everything.

alter table spaces enable row level security;
alter table projects enable row level security;
alter table folders enable row level security;
alter table lists enable row level security;
alter table tasks enable row level security;
alter table task_items enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;
alter table documents enable row level security;
alter table document_blocks enable row level security;

drop policy if exists "workspace_select" on spaces;
create policy "workspace_select" on spaces for select using (auth.role() = 'authenticated');
drop policy if exists "workspace_insert" on spaces;
create policy "workspace_insert" on spaces for insert with check (auth.role() = 'authenticated');
drop policy if exists "workspace_update" on spaces;
create policy "workspace_update" on spaces for update using (auth.role() = 'authenticated');
drop policy if exists "workspace_delete" on spaces;
create policy "workspace_delete" on spaces for delete using (auth.role() = 'authenticated');

-- Reusable helper to apply the same policies to each table.
do $$
declare
  t text;
begin
  foreach t in array array['projects','folders','lists','tasks','task_items','task_comments','task_activity','documents','document_blocks']
  loop
    execute format('drop policy if exists "workspace_select" on %I;', t);
    execute format('create policy "workspace_select" on %I for select using (auth.role() = ''authenticated'');', t);
    execute format('drop policy if exists "workspace_insert" on %I;', t);
    execute format('create policy "workspace_insert" on %I for insert with check (auth.role() = ''authenticated'');', t);
    execute format('drop policy if exists "workspace_update" on %I;', t);
    execute format('create policy "workspace_update" on %I for update using (auth.role() = ''authenticated'');', t);
    execute format('drop policy if exists "workspace_delete" on %I;', t);
    execute format('create policy "workspace_delete" on %I for delete using (auth.role() = ''authenticated'');', t);
  end loop;
end $$;