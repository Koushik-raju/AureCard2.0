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
insert into tasks (id, title, space_id, project_id, list_id, status, priority, assignee, tags, due_date, start_date, description, quote, source_doc_id) values
  ('task-rep', 'Fix Assessment Report', 'space-work', 'proj-patient', 'list-mobile-bugs', 'in-progress', 'high', 'Koushik', '{Bug,Production}', '2026-09-12', '2026-09-08', 'Change the "Start" button to "View" on the production Assessment Report.', 'On the production Assessment Report, the button still says Start instead of View.', 'doc-req'),
  ('task-login', 'Fix login', 'space-work', 'proj-patient', 'list-mobile-bugs', 'todo', 'high', 'Koushik', '{Bug}', '2026-09-10', null, null, 'Login fails on the second attempt with valid credentials.', 'doc-qa-checklist'),
  ('task-register', 'Patient registration flow', 'space-work', 'proj-patient', 'list-mobile-prio', 'todo', 'high', 'Rashmi', '{Feature}', '2026-09-16', null, null, null, null),
  ('task-crm-doc', 'Complete CRM documentation', 'space-work', 'proj-crm', 'list-doc-wip', 'todo', 'medium', 'Koushik', '{}', '2026-09-15', null, null, null, null),
  ('task-build', 'Review developer build', 'space-work', 'proj-crm', 'list-dev-sprint', 'in-progress', 'medium', 'Koushik', '{}', '2026-09-10', null, null, null, null),
  ('task-qa', 'QA assessment', 'space-work', 'proj-crm', 'list-qa-bugs', 'todo', 'medium', 'Rashmi', '{}', '2026-09-11', null, null, null, null),
  ('task-docs', 'Update documentation', 'space-work', 'proj-crm', 'list-doc-wip', 'todo', 'low', 'Koushik', '{}', '2026-09-12', null, null, null, null),
  ('task-table', 'New table component', 'space-work', 'proj-crm', 'list-dev-backlog', 'todo', 'low', 'Rashmi', '{Enhancement}', '2026-09-19', null, null, null, null),
  ('task-notify', 'Notification centre', 'space-work', 'proj-patient', 'list-mobile-prio', 'in-progress', 'medium', 'Rashmi', '{Feature}', '2026-09-17', null, null, null, null),
  ('task-release', 'Prepare release notes', 'space-product', 'proj-launch', null, 'in-progress', 'high', 'Koushik', '{}', '2026-09-18', null, null, null, null),
  ('task-launch-check', 'Complete launch checklist', 'space-product', 'proj-launch', null, 'todo', 'medium', 'Koushik', '{}', '2026-09-20', null, null, null, null),
  ('task-copy', 'Write landing copy', 'space-marketing', 'proj-website', null, 'todo', 'medium', 'Rashmi', '{}', '2026-09-14', null, null, null, null)
on conflict (id) do update set
  title = excluded.title, space_id = excluded.space_id, project_id = excluded.project_id, list_id = excluded.list_id,
  status = excluded.status, priority = excluded.priority, assignee = excluded.assignee, tags = excluded.tags,
  due_date = excluded.due_date, start_date = excluded.start_date, description = excluded.description,
  quote = excluded.quote, source_doc_id = excluded.source_doc_id;

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
insert into task_activity (id, task_id, text, "when", created_at) values
  ('ta-1', 'task-rep', 'Koushik changed the status to In Progress', '2 hours ago', now() - interval '2 hours'),
  ('ta-2', 'task-rep', 'Koushik updated the due date to Sep 12', '2 hours ago', now() - interval '2 hours'),
  ('ta-3', 'task-rep', 'Rashmi added a comment', '1 hour ago', now() - interval '1 hour'),
  ('ta-4', 'task-rep', 'The task was created', 'Yesterday', now() - interval '26 hours'),
  ('ta-5', 'task-build', 'Koushik started the review', '30 minutes ago', now() - interval '30 minutes')
on conflict (id) do update set
  task_id = excluded.task_id, text = excluded.text, "when" = excluded."when", created_at = excluded.created_at;

-- ---------- Documents ----------
insert into documents (id, title, space_id, project_id, kind, task_ids, recording_type, duration_secs, summary, note_type, created_at) values
  ('doc-req', 'Assessment Report Requirements', 'space-work', 'proj-patient', 'doc', '{task-rep}', null, null, null, null, now() - interval '6 days'),
  ('doc-qa-checklist', 'QA Release Checklist', 'space-work', 'proj-crm', 'doc', '{task-qa,task-login}', null, null, null, null, now() - interval '5 days'),
  ('doc-release-notes', 'Release Notes v2.4', 'space-product', 'proj-launch', 'doc', '{task-release}', null, null, null, null, now() - interval '4 days'),
  ('note-meeting', 'Meeting — Product sync', 'space-work', null, 'note', '{}', null, null, null, 'meeting', now() - interval '3 days'),
  ('note-onboarding', 'Ideas for onboarding flow', 'space-product', null, 'note', '{}', null, null, null, 'general', now() - interval '2 days'),
  ('rec-today', 'Recording 21 Sept, 12:17', 'space-work', null, 'file', '{}', 'thought', 42, 'The speaker described a template covering both book and home appointments.', null, now() - interval '3 hours'),
  ('rec-week-1', 'Search function broken in new design', 'space-work', 'proj-patient', 'file', '{}', 'thought', 65, 'The search function is not working in the organizations client app''s new design.', null, now() - interval '50 hours'),
  ('rec-week-2', 'Recording 17 Sept, 18:08', 'space-work', 'proj-patient', 'file', '{task-rep}', 'thought', 11, 'A brief exchange in which a change was requested: rename a button from Start to View.', null, now() - interval '96 hours')
on conflict (id) do update set
  title = excluded.title, space_id = excluded.space_id, project_id = excluded.project_id,
  kind = excluded.kind, task_ids = excluded.task_ids, recording_type = excluded.recording_type,
  duration_secs = excluded.duration_secs, summary = excluded.summary, note_type = excluded.note_type;

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

-- ---------- Task attachments (images, videos, links) ----------
insert into task_attachments (id, task_id, kind, url, label, position) values
  ('ta-link-1', 'task-rep', 'link', 'https://figma.com/file/atlas/report-v2', 'Design reference', 0),
  ('ta-img-1', 'task-rep', 'image', E'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="%23f59e0b" rx="8"/><text x="12" y="36" font-size="16" fill="white">Mockup</text></svg>', 'Report mockup', 1)
on conflict (id) do update set
  task_id = excluded.task_id, kind = excluded.kind, url = excluded.url, label = excluded.label, position = excluded.position;

-- ---------- Document attachments (files attached to documents) ----------
insert into document_attachments (id, document_id, name, mime, size, data, position) values
  ('da-1', 'doc-req', 'spec.pdf', 'application/pdf', 248012, E'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLU31jBQs9YwUDA0ADSgKcwplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKMTAwCmVuZG9iago=', 0),
  ('da-2', 'doc-req', 'report-sample.png', 'image/png', 12600, E'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="%23f59e0b" rx="10"/><text x="14" y="44" font-size="18" fill="white">Report</text></svg>', 1)
on conflict (id) do update set
  document_id = excluded.document_id, name = excluded.name, mime = excluded.mime,
  size = excluded.size, data = excluded.data, position = excluded.position;