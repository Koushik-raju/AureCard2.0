"use client";

import { useRouter } from "next/navigation";
import {
  FileText,
  FolderKanban,
  LayoutGrid,
  ListTodo,
  Mic,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, MenuItem } from "@/components/create/entity-menu";

const CREATE_ITEMS = [
  { label: "Task", desc: "Trackable work", href: "/tasks", icon: ListTodo },
  { label: "Doc", desc: "Structured document", href: "/docs", icon: FileText },
  { label: "Note", desc: "Quick capture", href: "/docs", icon: StickyNote },
  { label: "Recording", desc: "Voice with transcript", href: "/record", icon: Mic },
  { label: "Space", desc: "Top-level context", href: "/spaces", icon: LayoutGrid },
  { label: "Project", desc: "Grouped work", href: "/projects", icon: FolderKanban },
] as const;

export function CreateMenu() {
  const router = useRouter();
  return (
    <Dropdown
      align="left"
      trigger={
        <Button variant="ghost" size="icon" aria-label="Create new">
          <Plus className="size-4" />
        </Button>
      }
    >
      {CREATE_ITEMS.map((item) => (
        <MenuItem
          key={item.label}
          icon={<item.icon className="size-4 text-muted-foreground" />}
          onClick={() => router.push(item.href)}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>
          </span>
        </MenuItem>
      ))}
    </Dropdown>
  );
}
