"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import {
  EMPTY_ORG,
  computeDigests,
  memberWorkload,
  newOrgId,
  type OrgChart,
} from "@/lib/org";
import type { DocumentRef, Space, Task } from "@/lib/types";

function loadOrg(): OrgChart {
  const raw = readJson<OrgChart>(PREF_KEYS.org, EMPTY_ORG);
  return {
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    members: Array.isArray(raw.members) ? raw.members : [],
  };
}

export function OrgManager({
  spaces,
  tasks,
  documents,
}: {
  spaces: Space[];
  tasks: Task[];
  documents: DocumentRef[];
}) {
  const [org, setOrg] = useState<OrgChart>(loadOrg);
  const [deptName, setDeptName] = useState("");
  const [deptSpace, setDeptSpace] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberDept, setMemberDept] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    writeJson(PREF_KEYS.org, org);
  }, [org]);

  const digests = useMemo(
    () => computeDigests(org, tasks, documents, spaces),
    [org, tasks, documents, spaces]
  );

  function addDepartment() {
    const name = deptName.trim();
    if (!name) {
      setError("Give the department a name.");
      return;
    }
    setError(null);
    setOrg((prev) => ({
      ...prev,
      departments: [...prev.departments, { id: newOrgId("dept"), name, spaceId: deptSpace }],
    }));
    setDeptName("");
    setDeptSpace("");
  }

  function removeDepartment(id: string) {
    setOrg((prev) => ({
      departments: prev.departments.filter((d) => d.id !== id),
      members: prev.members.filter((m) => m.departmentId !== id),
    }));
  }

  function addMember() {
    const name = memberName.trim();
    if (!name) {
      setError("Give the person a name.");
      return;
    }
    if (!memberDept) {
      setError("Choose a department for this person.");
      return;
    }
    setError(null);
    setOrg((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id: newOrgId("person"),
          name,
          role: memberRole.trim() || "Member",
          departmentId: memberDept,
        },
      ],
    }));
    setMemberName("");
    setMemberRole("");
  }

  function removeMember(id: string) {
    setOrg((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));
  }

  return (
    <div className="space-y-8">
      {digests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
          No departments yet. Create your first department below — notes roll
          up into digests level by level.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {digests.map((digest) => (
            <article key={digest.department.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-serif text-lg font-medium tracking-tight">
                      {digest.department.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Rolls up: {digest.scopeName}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDepartment(digest.department.id)}
                  aria-label={`Remove ${digest.department.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "People", value: digest.members.length },
                  { label: "Open", value: digest.openTasks },
                  { label: "Done", value: digest.doneTasks },
                  { label: "Notes", value: digest.docs },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/50 px-2 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </dt>
                    <dd className="mt-0.5 text-xl font-medium tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
              {digest.members.length > 0 ? (
                <ul className="mt-4 divide-y divide-border">
                  {digest.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.role}</span>
                      <span
                        className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                        title="Open tasks assigned to this person"
                      >
                        {memberWorkload(m.name, tasks)} open
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(m.id)}
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No people yet.</p>
              )}
            </article>
          ))}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-medium tracking-tight">
            <Plus className="size-4" /> New department
          </h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Cardiology"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-space">Rolls up</Label>
              <select
                id="dept-space"
                value={deptSpace}
                onChange={(e) => setDeptSpace(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Whole workspace</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} space
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={addDepartment} className="min-h-11">
              Add department
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-medium tracking-tight">
            <UserPlus className="size-4" /> Add person
          </h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Dr. Rao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <Input
                id="member-role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder="e.g. Physician"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-dept">Department</Label>
              <select
                id="member-dept"
                value={memberDept}
                onChange={(e) => setMemberDept(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Choose…</option>
                {org.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={addMember}
              disabled={org.departments.length === 0}
              className="min-h-11"
            >
              Add person
            </Button>
            <p className="text-xs text-muted-foreground">
              Workload counts match open tasks assigned to the same name. Digest
              visibility per department follows the roll-up scope above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
