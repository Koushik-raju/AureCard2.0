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

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  spaceId: string;
  projectId?: string;
  listId?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  description?: string;
};

export type TaskItem = {
  id: string;
  /** Root task this item belongs to. */
  taskId: string;
  /** Parent item id. Undefined means a direct child (subtask) of the task. */
  parentId?: string;
  title: string;
  done: boolean;
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
  text: string;
  when: string;
};

export type DocumentRef = {
  id: string;
  title: string;
  spaceId: string;
  projectId?: string;
  kind: "doc" | "note";
  /** Tasks this document is linked to. */
  taskIds?: string[];
};

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
  | "task";

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
