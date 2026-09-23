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
  space_id text not null references spaces(id) on delete cascade,
  description text,
  position bigint not null default 0
);

create table if not exists folders (
  id text primary key,
  name text not null,
  project_id text not null references projects(id) on delete cascade,
  space_id text not null references spaces(id) on delete cascade
);

create table if not exists lists (
  id text primary key,
  name text not null,
  folder_id text references folders(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  space_id text not null references spaces(id) on delete cascade
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  space_id text not null references spaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  list_id text references lists(id) on delete cascade,
  status text not null default 'todo',
  priority text,
  assignee text,
  tags text[] not null default '{}',
  due_date date,
  start_date date,
  description text,
  quote text,
  source_doc_id text
);

create table if not exists task_attachments (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  kind text not null default 'link' check (kind in ('image','video','link')),
  url text not null,
  label text not null default '',
  position bigint not null default 0
);

create table if not exists task_items (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  parent_id text references task_items(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position bigint not null default 0
);

-- Subtask ClickUp fields (safe to re-run on existing databases).
alter table task_items add column if not exists assignee text;
alter table task_items add column if not exists due_date date;
alter table task_items add column if not exists priority text;
alter table task_items add column if not exists description text not null default '';

-- Multiple assignees per task (safe to re-run on existing databases).
alter table tasks add column if not exists assignees text[] not null default '{}';
-- Backfill from the legacy single-assignee column (supports "A, B" strings).
update tasks
set assignees = coalesce((
  select array_agg(trimmed)
  from (
    select nullif(btrim(part, ' '), '') as trimmed
    from unnest(string_to_array(coalesce(assignee, ''), ',')) as part
  ) parts
  where trimmed is not null
), '{}')
where assignees = '{}' and coalesce(assignee, '') <> '';
-- Keep legacy column in sync for old clients.
update tasks set assignee = assignees[1] where array_length(assignees, 1) > 0;

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
  author text not null default '',
  text text not null,
  "when" text not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  title text not null,
  space_id text not null references spaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  kind text not null default 'doc',
  task_ids text[] not null default '{}'
);

create table if not exists document_blocks (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  type text not null default 'paragraph',
  text text not null default '',
  checked boolean not null default false,
  task_id text references tasks(id) on delete set null,
  position bigint not null default 0
);

create table if not exists document_attachments (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  name text not null,
  mime text not null default '',
  size bigint not null default 0,
  data text not null default '',
  position bigint not null default 0
);

-- Make deletions cascade through the tree. Idempotent on an existing database:
-- the constraint is dropped and re-created only if it already exists.
alter table projects drop constraint if exists projects_space_id_fkey;
alter table projects add constraint projects_space_id_fkey foreign key (space_id) references spaces(id) on delete cascade;
alter table folders drop constraint if exists folders_project_id_fkey;
alter table folders add constraint folders_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;
alter table folders drop constraint if exists folders_space_id_fkey;
alter table folders add constraint folders_space_id_fkey foreign key (space_id) references spaces(id) on delete cascade;
alter table lists drop constraint if exists lists_folder_id_fkey;
alter table lists add constraint lists_folder_id_fkey foreign key (folder_id) references folders(id) on delete cascade;
alter table lists drop constraint if exists lists_project_id_fkey;
alter table lists add constraint lists_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;
alter table lists drop constraint if exists lists_space_id_fkey;
alter table lists add constraint lists_space_id_fkey foreign key (space_id) references spaces(id) on delete cascade;
alter table tasks drop constraint if exists tasks_space_id_fkey;
alter table tasks add constraint tasks_space_id_fkey foreign key (space_id) references spaces(id) on delete cascade;
alter table tasks drop constraint if exists tasks_project_id_fkey;
alter table tasks add constraint tasks_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;
alter table tasks drop constraint if exists tasks_list_id_fkey;
alter table tasks add constraint tasks_list_id_fkey foreign key (list_id) references lists(id) on delete cascade;
alter table documents drop constraint if exists documents_space_id_fkey;
alter table documents add constraint documents_space_id_fkey foreign key (space_id) references spaces(id) on delete cascade;
alter table documents drop constraint if exists documents_project_id_fkey;
alter table documents add constraint documents_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;
alter table document_blocks drop constraint if exists document_blocks_task_id_fkey;
alter table document_blocks add constraint document_blocks_task_id_fkey foreign key (task_id) references tasks(id) on delete set null;

-- Add activity timestamps for the history timeline (idempotent on existing DBs).
alter table task_activity add column if not exists author text not null default '';
alter table task_activity add column if not exists created_at timestamptz not null default now();

-- Task provenance (Aure-style quote + source note). Idempotent on existing DBs.
alter table tasks add column if not exists quote text;
alter table tasks add column if not exists source_doc_id text;
alter table tasks drop constraint if exists tasks_source_doc_id_fkey;
alter table tasks add constraint tasks_source_doc_id_fkey foreign key (source_doc_id) references documents(id) on delete set null;

-- Document timestamps for library time grouping (idempotent on existing DBs).
alter table documents add column if not exists created_at timestamptz not null default now();

-- Aure-style library filing: recording type, duration and summary preview,
-- plus the template used for typed notes. Idempotent on existing DBs.
alter table documents add column if not exists recording_type text;
alter table documents add column if not exists duration_secs integer;
alter table documents add column if not exists summary text;
alter table documents add column if not exists note_type text;

-- Prepared notes link back to the recording they were made from.
alter table documents add column if not exists source_doc_id text;
alter table documents drop constraint if exists documents_source_doc_id_fkey;
alter table documents add constraint documents_source_doc_id_fkey foreign key (source_doc_id) references documents(id) on delete set null;
create index if not exists idx_docs_source_doc on documents(source_doc_id);

-- ---------- Indexes ----------

create index if not exists idx_projects_space on projects(space_id);
create index if not exists idx_lists_project on lists(project_id);
create index if not exists idx_tasks_space on tasks(space_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_list on tasks(list_id);
create index if not exists idx_tasks_source_doc on tasks(source_doc_id);
create index if not exists idx_items_task on task_items(task_id);
create index if not exists idx_items_parent on task_items(parent_id);
create index if not exists idx_comments_task on task_comments(task_id);
create index if not exists idx_docs_space on documents(space_id);
create index if not exists idx_blocks_document on document_blocks(document_id);
create index if not exists idx_blocks_task on document_blocks(task_id);
create index if not exists idx_attachments_task on task_attachments(task_id);
create index if not exists idx_doc_attachments_document on document_attachments(document_id);

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
alter table task_attachments enable row level security;
alter table documents enable row level security;
alter table document_blocks enable row level security;
alter table document_attachments enable row level security;

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
  foreach t in array array['projects','folders','lists','tasks','task_items','task_comments','task_activity','task_attachments','documents','document_blocks','document_attachments']
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
-- ---------- File storage ----------
-- Binary uploads (documents, inline media, task attachments) live in a
-- Supabase Storage bucket instead of base64 data URLs in Postgres, so PDFs,
-- images and videos of any reasonable size work. Idempotent on existing DBs.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "workspace_storage_select" on storage.objects;
create policy "workspace_storage_select" on storage.objects
  for select using (bucket_id = 'attachments');
drop policy if exists "workspace_storage_insert" on storage.objects;
create policy "workspace_storage_insert" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
drop policy if exists "workspace_storage_update" on storage.objects;
create policy "workspace_storage_update" on storage.objects
  for update using (bucket_id = 'attachments' and auth.role() = 'authenticated');
drop policy if exists "workspace_storage_delete" on storage.objects;
create policy "workspace_storage_delete" on storage.objects
  for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');
-- Real-time broadcast for live updates (task status, comments, checklist items).
-- Idempotent: skips tables already in the publication, so re-running is safe.
do $$
declare
  t text;
begin
  foreach t in array array['spaces','projects','tasks','task_comments','task_items','folders','lists','task_activity','task_attachments','document_attachments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;
