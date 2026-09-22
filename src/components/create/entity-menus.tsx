"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MoreHorizontal, Pencil } from "lucide-react";
import {
  deleteSpace,
  deleteProject,
  deleteTask,
  deleteDocument,
  deleteFolder,
  deleteList,
  renameFolder,
  renameList,
  updateSpace,
  updateProject,
  updateTask,
  updateDocument,
} from "@/lib/mutations";
import { Button } from "@/components/ui/button";
import { EntityMenu, RenameForm, Dropdown, MenuItem, DeleteMenuItem } from "./entity-menu";

export function SpaceMenu({
  spaceId,
  spaceName,
  onDeleteRedirect = "/spaces",
}: {
  spaceId: string;
  spaceName: string;
  onDeleteRedirect?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onEdit={() => setEditing(true)}
        onDelete={() => deleteSpace(spaceId)}
        onDeleteRedirect={onDeleteRedirect}
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={spaceName}
            onClose={() => setEditing(false)}
            onSave={(name) => updateSpace({ id: spaceId, name })}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function ProjectMenu({
  projectId,
  projectName,
  onDeleteRedirect = "/projects",
}: {
  projectId: string;
  projectName: string;
  onDeleteRedirect?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onEdit={() => setEditing(true)}
        onDelete={() => deleteProject(projectId)}
        onDeleteRedirect={onDeleteRedirect}
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={projectName}
            onClose={() => setEditing(false)}
            onSave={(name) => updateProject({ id: projectId, name })}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function TaskMenu({
  taskId,
  taskTitle,
  onOpenChange,
}: {
  taskId: string;
  taskTitle: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const open = editing;
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onOpenChange={(menuOpen) => onOpenChange?.(menuOpen || editing)}
        onEdit={() => setEditing(true)}
        onDelete={() => deleteTask(taskId)}
        onDeleteRedirect="/tasks"
        deleteLabel="Delete task"
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={taskTitle}
            onClose={() => setEditing(false)}
            onSave={(title) => updateTask({ id: taskId, title })}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function DocumentMenu({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onEdit={() => setEditing(true)}
        onDelete={() => deleteDocument(documentId)}
        onDeleteRedirect="/docs"
        deleteLabel="Delete document"
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={documentTitle}
            onClose={() => setEditing(false)}
            onSave={(title) => updateDocument({ id: documentId, title })}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function FolderMenu({
  folderId,
  folderName,
}: {
  folderId: string;
  folderName: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onEdit={() => setEditing(true)}
        onDelete={() => deleteFolder(folderId)}
        deleteLabel="Delete folder"
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={folderName}
            onClose={() => setEditing(false)}
            onSave={(name) => renameFolder(folderId, name)}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function ListMenu({
  listId,
  listName,
}: {
  listId: string;
  listName: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="relative inline-flex">
      <EntityMenu
        onEdit={() => setEditing(true)}
        onDelete={() => deleteList(listId)}
        deleteLabel="Delete list"
      />
      {editing ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={listName}
            onClose={() => setEditing(false)}
            onSave={(name) => renameList(listId, name)}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}

export function EntityRowMenu({
  viewHref,
  itemName,
  onRename,
  onDelete,
  onDeleteRedirect,
  deleteLabel = "Delete",
}: {
  viewHref?: string;
  itemName: string;
  onRename: (name: string) => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
  onDeleteRedirect?: string;
  deleteLabel?: string;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  return (
    <span className="relative inline-flex">
      <Dropdown
        trigger={
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      >
        {viewHref ? (
          <MenuItem
            icon={<ArrowUpRight className="size-4" />}
            onClick={() => router.push(viewHref)}
          >
            View
          </MenuItem>
        ) : null}
        <MenuItem
          icon={<Pencil className="size-4" />}
          closeOnClick={false}
          onClick={() => setRenaming(true)}
        >
          Rename
        </MenuItem>
        <DeleteMenuItem
          onDelete={onDelete}
          redirectHref={onDeleteRedirect}
          label={deleteLabel}
        />
      </Dropdown>
      {renaming ? (
        <span className="absolute right-0 top-full z-50 mt-1 w-72">
          <RenameForm
            initial={itemName}
            onClose={() => setRenaming(false)}
            onSave={onRename}
            submitLabel="Save"
          />
        </span>
      ) : null}
    </span>
  );
}