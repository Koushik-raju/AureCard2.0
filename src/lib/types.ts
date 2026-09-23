export type Accent = "orange" | "amber" | "olive" | "clay" | "sage" | "ink";

export type Space = {
  id: string;
  name: string;
  description: string;
  accent: Accent;
};

export type Project = {
  id: string;
  name: string;
  spaceId: string;
  description?: string;
};

export type Folder = {
  id: string;
  name: string;
  projectId: string;
  spaceId: string;
};

export type List = {
  id: string;
  name: string;
  folderId?: string;
  projectId: string;
  spaceId: string;
};

export type TaskStatus = "todo" | "in-progress" | "in-review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type TaskAttachmentKind = "image" | "video" | "link";

export type TaskAttachment = {
  id: string;
  taskId: string;
  kind: TaskAttachmentKind;
  url: string;
  label?: string;
};

export type Task = {
  id: string;
  title: string;
  spaceId: string;
  projectId?: string;
  listId?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  /** @deprecated Single assignee (first entry of `assignees`). Kept for backwards compat. */
  assignee?: string;
  /** Multiple owners. When present, `assignee` mirrors the first entry. */
  assignees?: string[];
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  description?: string;
  /** Verbatim quote this task was captured from (Aure-style provenance). */
  quote?: string;
  /** Document/note this task was captured from. */
  sourceDocId?: string;
};

export type DocumentAttachment = {
  id: string;
  documentId: string;
  name: string;
  mime: string;
  size: number;
  /** File contents as a data URL. */
  data: string;
};

export type TaskItem = {
  id: string;
  /** Root task this item belongs to. */
  taskId: string;
  /** Parent item id. Undefined means a direct child (subtask) of the task. */
  parentId?: string;
  title: string;
  done: boolean;
  assignee?: string;
  dueDate?: string;
  priority?: TaskPriority;
  /** Notion-style body blocks stored as a JSON envelope (see `@/lib/task-body`). */
  description?: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  author: string;
  text: string;
  createdAt: string;
};

export type TaskActivity = {
  id: string;
  taskId: string;
  author: string;
  text: string;
  when: string;
  /** ISO timestamp for grouping history by day (DB only). */
  createdAt?: string;
};

export type DocumentRef = {
  id: string;
  title: string;
  spaceId: string;
  projectId?: string;
  kind: "doc" | "note" | "file";
  /** Tasks this document is linked to. */
  taskIds?: string[];
  /** Recording/note this document was prepared from (notes prepared from recordings). */
  sourceDocId?: string;
  /** ISO timestamp for library time grouping (DB only; absent on old rows). */
  createdAt?: string;
  /** Aure-style filing for recordings: what the note sounds like. */
  recordingType?: RecordingType;
  /** Recording length in seconds (audio/file docs). */
  durationSecs?: number;
  /** One-line summary preview for recording cards. */
  summary?: string;
  /** Template used for typed notes. */
  noteType?: NoteType;
};

export type RecordingType = "meeting" | "call" | "thought" | "lecture" | "conversation";

export type NoteType = "general" | "meeting" | "soap";

export type DocumentBlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "bulleted"
  | "numbered"
  | "checklist"
  | "quote"
  | "divider"
  | "callout"
  | "code"
  | "task"
  | "image"
  | "video"
  | "link";

export type DocumentBlock = {
  id: string;
  documentId: string;
  type: DocumentBlockType;
  text: string;
  checked?: boolean;
  /** For task blocks — references a real Task. */
  taskId?: string;
};

export type Document = DocumentRef & {
  blocks: DocumentBlock[];
};
