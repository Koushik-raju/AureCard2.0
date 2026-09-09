-- Atlas seed data
-- Run AFTER schema.sql. Safe to re-run (upserts).

-- ---------- Spaces ----------
insert into spaces (id, name, description, accent, position) values
  ('space-work', 'Work', 'Client projects, product development, and day-to-day operations.', 'orange', 0),
  ('space-product', 'Product', 'Product strategy, releases, and requirement planning.', 'amber', 1),
  ('space-personal', 'Personal', 'Personal projects, planning, and everyday life.', 'sage', 2),
  ('space-marketing', 'Marketing', 'Campaigns, content, and brand work.', 'clay', 3)
on conflict (id) do update set name = excluded.name, description = excluded.description, accent = excluded.accent, position = excluded.position;

-- ---------- Projects ----------
insert into projects (id, name, space_id, description, position) values
  ('proj-patient', 'Patient App', 'space-work', 'Mobile patient portal and CRM.', 0),
  ('proj-crm', 'CRM Revamp', 'space-work', 'Redesign of the core CRM experience.', 1),
  ('proj-launch', 'Product Launch', 'space-product', 'Q3 release coordination.', 0),
  ('proj-website', 'Website Refresh', 'space-marketing', 'Marketing site re-design.', 0)
on conflict (id) do update set name = excluded.name, space_id = excluded.space_id, description = excluded.description, position = excluded.position;

-- ---------- Folders ----------
insert into folders (id, name, project_id, space_id) values
  ('folder-dev', 'Development', 'proj-crm', 'space-work'),
  ('folder-qa', 'QA', 'proj-crm', 'space-work'),
  ('folder-docs', 'Documentation', 'proj-crm', 'space-work'),
  ('folder-mobile', 'Mobile', 'proj-patient', 'space-work'),
  ('folder-ops', 'Operations', 'proj-patient', 'space-work')
on conflict (id) do update set name = excluded.name, project_id = excluded.project_id, space_id = excluded.space_id;

-- ---------- Lists ----------
insert into lists (id, name, folder_id, project_id, space_id) values
  ('list-mobile-prio', 'Priorities', 'folder-mobile', 'proj-patient', 'space-work'),
  ('list-mobile-bugs', 'Bugs', 'folder-mobile', 'proj-patient', 'space-work'),
  ('list-dev-backlog', 'Backlog', 'folder-dev', 'proj-crm', 'space-work'),
  ('list-dev-sprint', 'Current Sprint', 'folder-dev', 'proj-crm', 'space-work'),
  ('list-qa-bugs', 'Bugs', 'folder-qa', 'proj-crm', 'space-work'),
  ('list-doc-wip', 'In Progress', 'folder-docs', 'proj-crm', 'space-work')
on conflict (id) do update set name = excluded.name, folder_id = excluded.folder_id, project_id = excluded.project_id, space_id = excluded.space_id;

-- ---------- Tasks ----------
insert into tasks (id, title, space_id, project_id, list_id, status, priority, assignee, tags, due_date, start_date, description) values
  ('task-rep', 'Fix Assessment Report', 'space-work', 'proj-patient', 'list-mobile-bugs', 'in-progress', 'high', 'Koushik', '{Bug,Production}', '2026-09-12', '2026-09-08', 'Change the "Start" button to "View" on the production Assessment Report.'),
  ('task-login', 'Fix login', 'space-work', 'proj-patient', 'list-mobile-bugs', 'todo', 'high', 'Koushik', '{Bug}', '2026-09-10', null, null),
  ('task-register', 'Patient registration flow', 'space-work', 'proj-patient', 'list-mobile-prio', 'todo', 'high', 'Rashmi', '{Feature}', '2026-09-16', null, null),
  ('task-crm-doc', 'Complete CRM documentation', 'space-work', 'proj-crm', 'list-doc-wip', 'todo', 'medium', 'Koushik', '{}', '2026-09-15', null, null),
  ('task-build', 'Review developer build', 'space-work', 'proj-crm', 'list-dev-sprint', 'in-progress', 'medium', 'Koushik', '{}', '2026-09-10', null, null),
  ('task-qa', 'QA assessment', 'space-work', 'proj-crm', 'list-qa-bugs', 'todo', 'medium', 'Rashmi', '{}', '2026-09-11', null, null),
  ('task-docs', 'Update documentation', 'space-work', 'proj-crm', 'list-doc-wip', 'todo', 'low', 'Koushik', '{}', '2026-09-12', null, null),
  ('task-table', 'New table component', 'space-work', 'proj-crm', 'list-dev-backlog', 'todo', 'low', 'Rashmi', '{Enhancement}', '2026-09-19', null, null),
  ('task-notify', 'Notification centre', 'space-work', 'proj-patient', 'list-mobile-prio', 'in-progress', 'medium', 'Rashmi', '{Feature}', '2026-09-17', null, null),
  ('task-release', 'Prepare release notes', 'space-product', 'proj-launch', null, 'in-progress', 'high', 'Koushik', '{}', '2026-09-18', null, null),
  ('task-launch-check', 'Complete launch checklist', 'space-product', 'proj-launch', null, 'todo', 'medium', 'Koushik', '{}', '2026-09-20', null, null),
  ('task-copy', 'Write landing copy', 'space-marketing', 'proj-website', null, 'todo', 'medium', 'Rashmi', '{}', '2026-09-14', null, null)
on conflict (id) do update set
  title = excluded.title, space_id = excluded.space_id, project_id = excluded.project_id, list_id = excluded.list_id,
  status = excluded.status, priority = excluded.priority, assignee = excluded.assignee, tags = excluded.tags,
  due_date = excluded.due_date, start_date = excluded.start_date, description = excluded.description;

-- ---------- Task items (subtasks / checklists) ----------
insert into task_items (id, task_id, parent_id, title, done, position) values
  ('item-rep-1', 'task-rep', null, 'Update button text', true, 0),
  ('item-rep-1a', 'task-rep', 'item-rep-1', 'Update source component', true, 0),
  ('item-rep-1b', 'task-rep', 'item-rep-1', 'Confirm against design ref', false, 1),
  ('item-rep-2', 'task-rep', null, 'Check mobile', false, 1),
  ('item-rep-2a', 'task-rep', 'item-rep-2', 'iPhone layout', false, 0),
  ('item-rep-2b', 'task-rep', 'item-rep-2', 'Android layout', false, 1),
  ('item-rep-3', 'task-rep', null, 'Test production', false, 2),
  ('item-rep-3a', 'task-rep', 'item-rep-3', 'Run on staging', false, 0),
  ('item-rep-3b', 'task-rep', 'item-rep-3', 'Verify live', false, 1),
  ('item-rep-4', 'task-rep', null, 'QA approval', false, 3),
  ('item-build-1', 'task-build', null, 'Review pull request', true, 0),
  ('item-build-1a', 'task-build', 'item-build-1', 'Approve code changes', true, 0),
  ('item-build-1b', 'task-build', 'item-build-1', 'Leave feedback', false, 1),
  ('item-build-2', 'task-build', null, 'Check bundle size', false, 1),
  ('item-reg-1', 'task-register', null, 'Wire form validation', true, 0),
  ('item-reg-2', 'task-register', null, 'Add success state', false, 1)
on conflict (id) do update set
  task_id = excluded.task_id, parent_id = excluded.parent_id, title = excluded.title,
  done = excluded.done, position = excluded.position;

-- ---------- Task comments ----------
insert into task_comments (id, task_id, author, text, created_at) values
  ('tc-1', 'task-rep', 'Rashmi', 'Can you confirm the exact label text from the design file?', '2026-09-08T09:30:00Z'),
  ('tc-2', 'task-rep', 'Koushik', 'Yes — it''s "View" per the latest spec. All good on my side.', '2026-09-08T10:05:00Z'),
  ('tc-3', 'task-rep', 'Rashmi', 'Looks correct. Moving to QA.', '2026-09-08T11:12:00Z')
on conflict (id) do update set
  task_id = excluded.task_id, author = excluded.author, text = excluded.text, created_at = excluded.created_at;

-- ---------- Task activity ----------
insert into task_activity (id, task_id, text, "when") values
  ('ta-1', 'task-rep', 'Koushik changed the status to In Progress', '2 hours ago'),
  ('ta-2', 'task-rep', 'Koushik updated the due date to Sep 12', '2 hours ago'),
  ('ta-3', 'task-rep', 'Rashmi added a comment', '1 hour ago'),
  ('ta-4', 'task-rep', 'The task was created', 'Yesterday'),
  ('ta-5', 'task-build', 'Koushik started the review', '30 minutes ago')
on conflict (id) do update set
  task_id = excluded.task_id, text = excluded.text, "when" = excluded."when";

-- ---------- Documents ----------
insert into documents (id, title, space_id, project_id, kind, task_ids) values
  ('doc-req', 'Assessment Report Requirements', 'space-work', 'proj-patient', 'doc', '{task-rep}'),
  ('doc-qa-checklist', 'QA Release Checklist', 'space-work', 'proj-crm', 'doc', '{task-qa,task-login}'),
  ('doc-release-notes', 'Release Notes v2.4', 'space-product', 'proj-launch', 'doc', '{task-release}'),
  ('note-meeting', 'Meeting — Product sync', 'space-work', null, 'note', '{}'),
  ('note-onboarding', 'Ideas for onboarding flow', 'space-product', null, 'note', '{}')
on conflict (id) do update set
  title = excluded.title, space_id = excluded.space_id, project_id = excluded.project_id,
  kind = excluded.kind, task_ids = excluded.task_ids;

-- ---------- Document blocks ----------
insert into document_blocks (id, document_id, type, text, checked, task_id, position) values
  -- Assessment Report Requirements
  ('blk-req-1', 'doc-req', 'heading', 'Assessment Report Requirements', false, null, 0),
  ('blk-req-2', 'doc-req', 'paragraph', 'This module lets patients view and download their completed assessment reports in a clear, calm format.', false, null, 1),
  ('blk-req-3', 'doc-req', 'subheading', 'Goals', false, null, 2),
  ('blk-req-4', 'doc-req', 'bulleted', 'Patients can open their report with a single tap', false, null, 3),
  ('blk-req-5', 'doc-req', 'bulleted', 'Reports render identically on mobile and desktop', false, null, 4),
  ('blk-req-6', 'doc-req', 'bulleted', 'Reports are stored securely and never lost', false, null, 5),
  ('blk-req-7', 'doc-req', 'subheading', 'Notes', false, null, 6),
  ('blk-req-8', 'doc-req', 'quote', 'The start button should read View, not Start, once a report exists.', false, null, 7),
  ('blk-req-9', 'doc-req', 'callout', 'Non-blocking: PDF export can ship in a later release.', false, null, 8),
  ('blk-req-10', 'doc-req', 'code', E'report.open()\n// shows the report with a View action', false, null, 9),
  -- QA Release Checklist
  ('blk-qa-1', 'doc-qa-checklist', 'heading', 'QA Release Checklist', false, null, 0),
  ('blk-qa-2', 'doc-qa-checklist', 'paragraph', 'Run through every item before shipping. Checking an item updates the linked task automatically.', false, null, 1),
  ('blk-qa-3', 'doc-qa-checklist', 'task', 'Test login', false, 'task-login', 2),
  ('blk-qa-4', 'doc-qa-checklist', 'task', 'Test patient registration', false, 'task-register', 3),
  ('blk-qa-5', 'doc-qa-checklist', 'task', 'Test assessment report', false, 'task-rep', 4),
  ('blk-qa-6', 'doc-qa-checklist', 'task', 'Test notifications', false, 'task-notify', 5),
  ('blk-qa-7', 'doc-qa-checklist', 'subheading', 'Exit criteria', false, null, 6),
  ('blk-qa-8', 'doc-qa-checklist', 'checklist', 'All critical bugs resolved', false, null, 7),
  ('blk-qa-9', 'doc-qa-checklist', 'checklist', 'Mobile layouts verified', false, null, 8),
  ('blk-qa-10', 'doc-qa-checklist', 'divider', '', false, null, 9),
  ('blk-qa-11', 'doc-qa-checklist', 'callout', 'Confirm with Rashmi before marking the release as ready.', false, null, 10)
on conflict (id) do update set
  document_id = excluded.document_id, type = excluded.type, text = excluded.text,
  checked = excluded.checked, task_id = excluded.task_id, position = excluded.position;