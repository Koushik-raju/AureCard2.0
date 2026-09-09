import type {
  DocumentBlock,
  DocumentRef,
  Folder,
  List,
  Project,
  Space,
  Task,
  TaskActivity,
  TaskComment,
  TaskItem,
} from "@/lib/types";

export const spaces: Space[] = [
  {
    id: "space-work",
    name: "Work",
    description: "Client projects, product development, and day-to-day operations.",
    accent: "orange",
  },
  {
    id: "space-product",
    name: "Product",
    description: "Product strategy, releases, and requirement planning.",
    accent: "amber",
  },
  {
    id: "space-personal",
    name: "Personal",
    description: "Personal projects, planning, and everyday life.",
    accent: "sage",
  },
  {
    id: "space-marketing",
    name: "Marketing",
    description: "Campaigns, content, and brand work.",
    accent: "clay",
  },
];

export const projects: Project[] = [
  { id: "proj-patient", name: "Patient App", spaceId: "space-work", description: "Mobile patient portal and CRM." },
  { id: "proj-crm", name: "CRM Revamp", spaceId: "space-work", description: "Redesign of the core CRM experience." },
  { id: "proj-launch", name: "Product Launch", spaceId: "space-product", description: "Q3 release coordination." },
  { id: "proj-website", name: "Website Refresh", spaceId: "space-marketing", description: "Marketing site re-design." },
];

export const folders: Folder[] = [
  { id: "folder-dev", name: "Development", projectId: "proj-crm", spaceId: "space-work" },
  { id: "folder-qa", name: "QA", projectId: "proj-crm", spaceId: "space-work" },
  { id: "folder-docs", name: "Documentation", projectId: "proj-crm", spaceId: "space-work" },
  { id: "folder-mobile", name: "Mobile", projectId: "proj-patient", spaceId: "space-work" },
  { id: "folder-ops", name: "Operations", projectId: "proj-patient", spaceId: "space-work" },
];

export const lists: List[] = [
  { id: "list-mobile-prio", name: "Priorities", folderId: "folder-mobile", projectId: "proj-patient", spaceId: "space-work" },
  { id: "list-mobile-bugs", name: "Bugs", folderId: "folder-mobile", projectId: "proj-patient", spaceId: "space-work" },
  { id: "list-dev-backlog", name: "Backlog", folderId: "folder-dev", projectId: "proj-crm", spaceId: "space-work" },
  { id: "list-dev-sprint", name: "Current Sprint", folderId: "folder-dev", projectId: "proj-crm", spaceId: "space-work" },
  { id: "list-qa-bugs", name: "Bugs", folderId: "folder-qa", projectId: "proj-crm", spaceId: "space-work" },
  { id: "list-doc-wip", name: "In Progress", folderId: "folder-docs", projectId: "proj-crm", spaceId: "space-work" },
];

export const tasks: Task[] = [
  { id: "task-rep", title: "Fix Assessment Report", spaceId: "space-work", projectId: "proj-patient", listId: "list-mobile-bugs", status: "in-progress", priority: "high", assignee: "Koushik", tags: ["Bug", "Production"], dueDate: "2026-09-12", startDate: "2026-09-08", description: "Change the \"Start\" button to \"View\" on the production Assessment Report." },
  { id: "task-login", title: "Fix login", spaceId: "space-work", projectId: "proj-patient", listId: "list-mobile-bugs", status: "todo", priority: "high", assignee: "Koushik", tags: ["Bug"], dueDate: "2026-09-10" },
  { id: "task-register", title: "Patient registration flow", spaceId: "space-work", projectId: "proj-patient", listId: "list-mobile-prio", status: "todo", priority: "high", assignee: "Rashmi", tags: ["Feature"], dueDate: "2026-09-16" },
  { id: "task-crm-doc", title: "Complete CRM documentation", spaceId: "space-work", projectId: "proj-crm", listId: "list-doc-wip", status: "todo", priority: "medium", assignee: "Koushik", dueDate: "2026-09-15" },
  { id: "task-build", title: "Review developer build", spaceId: "space-work", projectId: "proj-crm", listId: "list-dev-sprint", status: "in-progress", priority: "medium", assignee: "Koushik", dueDate: "2026-09-10" },
  { id: "task-qa", title: "QA assessment", spaceId: "space-work", projectId: "proj-crm", listId: "list-qa-bugs", status: "todo", priority: "medium", assignee: "Rashmi", dueDate: "2026-09-11" },
  { id: "task-docs", title: "Update documentation", spaceId: "space-work", projectId: "proj-crm", listId: "list-doc-wip", status: "todo", priority: "low", assignee: "Koushik", dueDate: "2026-09-12" },
  { id: "task-table", title: "New table component", spaceId: "space-work", projectId: "proj-crm", listId: "list-dev-backlog", status: "todo", priority: "low", assignee: "Rashmi", tags: ["Enhancement"], dueDate: "2026-09-19" },
  { id: "task-notify", title: "Notification centre", spaceId: "space-work", projectId: "proj-patient", listId: "list-mobile-prio", status: "in-progress", priority: "medium", assignee: "Rashmi", tags: ["Feature"], dueDate: "2026-09-17" },
  { id: "task-release", title: "Prepare release notes", spaceId: "space-product", projectId: "proj-launch", status: "in-progress", priority: "high", assignee: "Koushik", dueDate: "2026-09-18" },
  { id: "task-launch-check", title: "Complete launch checklist", spaceId: "space-product", projectId: "proj-launch", status: "todo", priority: "medium", assignee: "Koushik", dueDate: "2026-09-20" },
  { id: "task-copy", title: "Write landing copy", spaceId: "space-marketing", projectId: "proj-website", status: "todo", priority: "medium", assignee: "Rashmi", dueDate: "2026-09-14" },
];

export const documents: DocumentRef[] = [
  { id: "doc-req", title: "Assessment Report Requirements", spaceId: "space-work", projectId: "proj-patient", kind: "doc", taskIds: ["task-rep"] },
  { id: "doc-qa-checklist", title: "QA Release Checklist", spaceId: "space-work", projectId: "proj-crm", kind: "doc", taskIds: ["task-qa", "task-login"] },
  { id: "doc-release-notes", title: "Release Notes v2.4", spaceId: "space-product", projectId: "proj-launch", kind: "doc", taskIds: ["task-release"] },
  { id: "note-meeting", title: "Meeting — Product sync", spaceId: "space-work", kind: "note" },
  { id: "note-onboarding", title: "Ideas for onboarding flow", spaceId: "space-product", kind: "note" },
];

export const documentBlocks: DocumentBlock[] = [
  // Assessment Report Requirements
  { id: "blk-req-1", documentId: "doc-req", type: "heading", text: "Assessment Report Requirements" },
  { id: "blk-req-2", documentId: "doc-req", type: "paragraph", text: "This module lets patients view and download their completed assessment reports in a clear, calm format." },
  { id: "blk-req-3", documentId: "doc-req", type: "subheading", text: "Goals" },
  { id: "blk-req-4", documentId: "doc-req", type: "bulleted", text: "Patients can open their report with a single tap" },
  { id: "blk-req-5", documentId: "doc-req", type: "bulleted", text: "Reports render identically on mobile and desktop" },
  { id: "blk-req-6", documentId: "doc-req", type: "bulleted", text: "Reports are stored securely and never lost" },
  { id: "blk-req-7", documentId: "doc-req", type: "subheading", text: "Notes" },
  { id: "blk-req-8", documentId: "doc-req", type: "quote", text: "The start button should read View, not Start, once a report exists." },
  { id: "blk-req-9", documentId: "doc-req", type: "callout", text: "Non-blocking: PDF export can ship in a later release." },
  { id: "blk-req-10", documentId: "doc-req", type: "code", text: "report.open()\n// shows the report with a View action" },

  // QA Release Checklist — task blocks linked to real tasks
  { id: "blk-qa-1", documentId: "doc-qa-checklist", type: "heading", text: "QA Release Checklist" },
  { id: "blk-qa-2", documentId: "doc-qa-checklist", type: "paragraph", text: "Run through every item before shipping. Checking an item updates the linked task automatically." },
  { id: "blk-qa-3", documentId: "doc-qa-checklist", type: "task", checked: false, taskId: "task-login", text: "Test login" },
  { id: "blk-qa-4", documentId: "doc-qa-checklist", type: "task", checked: false, taskId: "task-register", text: "Test patient registration" },
  { id: "blk-qa-5", documentId: "doc-qa-checklist", type: "task", checked: false, taskId: "task-rep", text: "Test assessment report" },
  { id: "blk-qa-6", documentId: "doc-qa-checklist", type: "task", checked: false, taskId: "task-notify", text: "Test notifications" },
  { id: "blk-qa-7", documentId: "doc-qa-checklist", type: "subheading", text: "Exit criteria" },
  { id: "blk-qa-8", documentId: "doc-qa-checklist", type: "checklist", checked: false, text: "All critical bugs resolved" },
  { id: "blk-qa-9", documentId: "doc-qa-checklist", type: "checklist", checked: false, text: "Mobile layouts verified" },
  { id: "blk-qa-10", documentId: "doc-qa-checklist", type: "divider", text: "" },
  { id: "blk-qa-11", documentId: "doc-qa-checklist", type: "callout", text: "Confirm with Rashmi before marking the release as ready." },
];

export function getSpace(id: string): Space | undefined {
  return spaces.find((s) => s.id === id);
}

export function getSpacesByProject(projectId: string): Space | undefined {
  const p = projects.find((pr) => pr.id === projectId);
  return p ? getSpace(p.spaceId) : undefined;
}

export function getProjectsForSpace(spaceId: string): Project[] {
  return projects.filter((p) => p.spaceId === spaceId);
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function getFoldersForProject(projectId: string): Folder[] {
  return folders.filter((f) => f.projectId === projectId);
}

export function getListsForProject(projectId: string): List[] {
  return lists.filter((l) => l.projectId === projectId);
}

export function getListsForFolder(folderId: string): List[] {
  return lists.filter((l) => l.folderId === folderId);
}

export function getTasksForSpace(spaceId: string): Task[] {
  return tasks.filter((t) => t.spaceId === spaceId);
}

export function getTasksForProject(projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function getTasksForList(listId: string): Task[] {
  return tasks.filter((t) => t.listId === listId);
}

export function getDocsForSpace(spaceId: string) {
  return documents.filter((d) => d.spaceId === spaceId);
}

export function getDocsForProject(projectId: string) {
  return documents.filter((d) => d.projectId === projectId);
}

export const taskItems: TaskItem[] = [
  // Fix Assessment Report — subtasks with nested checklists
  { id: "item-rep-1", taskId: "task-rep", title: "Update button text", done: true },
  { id: "item-rep-1a", taskId: "task-rep", parentId: "item-rep-1", title: "Update source component", done: true },
  { id: "item-rep-1b", taskId: "task-rep", parentId: "item-rep-1", title: "Confirm against design ref", done: false },
  { id: "item-rep-2", taskId: "task-rep", title: "Check mobile", done: false },
  { id: "item-rep-2a", taskId: "task-rep", parentId: "item-rep-2", title: "iPhone layout", done: false },
  { id: "item-rep-2b", taskId: "task-rep", parentId: "item-rep-2", title: "Android layout", done: false },
  { id: "item-rep-3", taskId: "task-rep", title: "Test production", done: false },
  { id: "item-rep-3a", taskId: "task-rep", parentId: "item-rep-3", title: "Run on staging", done: false },
  { id: "item-rep-3b", taskId: "task-rep", parentId: "item-rep-3", title: "Verify live", done: false },
  { id: "item-rep-4", taskId: "task-rep", title: "QA approval", done: false },

  // Review developer build
  { id: "item-build-1", taskId: "task-build", title: "Review pull request", done: true },
  { id: "item-build-1a", taskId: "task-build", parentId: "item-build-1", title: "Approve code changes", done: true },
  { id: "item-build-1b", taskId: "task-build", parentId: "item-build-1", title: "Leave feedback", done: false },
  { id: "item-build-2", taskId: "task-build", title: "Check bundle size", done: false },

  // Patient registration flow
  { id: "item-reg-1", taskId: "task-register", title: "Wire form validation", done: true },
  { id: "item-reg-2", taskId: "task-register", title: "Add success state", done: false },
];

export const taskComments: TaskComment[] = [
  {
    id: "tc-1",
    taskId: "task-rep",
    author: "Rashmi",
    text: "Can you confirm the exact label text from the design file?",
    createdAt: "2026-09-08T09:30:00",
  },
  {
    id: "tc-2",
    taskId: "task-rep",
    author: "Koushik",
    text: "Yes — it's \"View\" per the latest spec. All good on my side.",
    createdAt: "2026-09-08T10:05:00",
  },
  {
    id: "tc-3",
    taskId: "task-rep",
    author: "Rashmi",
    text: "Looks correct. Moving to QA.",
    createdAt: "2026-09-08T11:12:00",
  },
];

export const taskActivity: TaskActivity[] = [
  { id: "ta-1", taskId: "task-rep", text: "Koushik changed the status to In Progress", when: "2 hours ago" },
  { id: "ta-2", taskId: "task-rep", text: "Koushik updated the due date to Sep 12", when: "2 hours ago" },
  { id: "ta-3", taskId: "task-rep", text: "Rashmi added a comment", when: "1 hour ago" },
  { id: "ta-4", taskId: "task-rep", text: "The task was created", when: "Yesterday" },
  { id: "ta-5", taskId: "task-build", text: "Koushik started the review", when: "30 minutes ago" },
];

export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

export function getTaskItemsForTask(taskId: string): TaskItem[] {
  return taskItems.filter((s) => s.taskId === taskId);
}

export function getTaskItems(): TaskItem[] {
  return taskItems;
}

export function getCommentsForTask(taskId: string): TaskComment[] {
  return taskComments.filter((c) => c.taskId === taskId);
}

export function getActivityForTask(taskId: string): TaskActivity[] {
  return taskActivity.filter((a) => a.taskId === taskId);
}

export function getList(id: string): List | undefined {
  return lists.find((l) => l.id === id);
}

export function getStatusLabel(status: Task["status"]): string {
  switch (status) {
    case "in-progress":
      return "In Progress";
    case "done":
      return "Done";
    default:
      return "To Do";
  }
}

export function getTaskStatusCounts() {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}

export function getDocument(id: string): DocumentRef | undefined {
  return documents.find((d) => d.id === id);
}

export function getDocumentsForTask(taskId: string): DocumentRef[] {
  return documents.filter((d) => d.taskIds?.includes(taskId));
}

export function getTasksForDocument(documentId: string): Task[] {
  const doc = getDocument(documentId);
  if (!doc?.taskIds) return [];
  return doc.taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
}

export function getBlocksForDocument(documentId: string): DocumentBlock[] {
  return documentBlocks.filter((b) => b.documentId === documentId);
}
