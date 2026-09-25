"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, Check, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import {
  EMPTY_ORG,
  computeDigests,
  memberWorkloadFor,
  newOrgId,
  type OrgChart,
} from "@/lib/org";
import { MEMBER_ROLES, type DocumentRef, type Space, type Task, type WorkspaceMember } from "@/lib/types";
import { inviteMember, removeMember, updateMemberRole } from "@/lib/mutations";
import { AssigneeAvatar } from "@/components/tasks/hues";

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
  directory,
}: {
  spaces: Space[];
  tasks: Task[];
  documents: DocumentRef[];
  directory: WorkspaceMember[];
}) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgChart>(loadOrg);
  const [deptName, setDeptName] = useState("");
  const [deptSpace, setDeptSpace] = useState("");
  const [memberPick, setMemberPick] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberDept, setMemberDept] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("Member");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    const person = directory.find((d) => d.id === memberPick);
    if (!person) {
      setError("Pick someone from the directory.");
      return;
    }
    if (!memberDept) {
      setError("Choose a department for this person.");
      return;
    }
    if (org.members.some((m) => m.departmentId === memberDept && (m.email === person.email || m.name === person.name))) {
      setError("That person is already in this department.");
      return;
    }
    setError(null);
    setOrg((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id: newOrgId("person"),
          name: person.name,
          email: person.email,
          role: memberRole.trim() || person.role,
          departmentId: memberDept,
        },
      ],
    }));
    setMemberPick("");
    setMemberRole("");
  }

  function removeOrgMember(id: string) {
    setOrg((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));
  }

  function sendInvite() {
    setError(null);
    startTransition(async () => {
      const result = await inviteMember({
        email: inviteEmail,
        name: inviteName || undefined,
        role: inviteRole,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setInviteEmail("");
      setInviteName("");
      setInviteRole("Member");
      router.refresh();
    });
  }

  function changeRole(id: string, role: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRole(id, role);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function deleteDirectoryMember(id: string, name: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeMember(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Drop matching org-chart rows so workload stops counting them here.
      setOrg((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== id && m.name !== name),
      }));
      router.refresh();
    });
  }

  async function copyInviteLink(email: string, id: string) {
    const url = `${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(
        `You've been invited to Aure. Sign in with ${email} here: ${url}`
      );
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      setError("Couldn't copy — long-press the login URL instead.");
    }
  }

  return (
    <div className="space-y-8">
      <section aria-label="Workspace members" className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-medium tracking-tight">
              Workspace members · {directory.length}
            </h2>
            <p className="text-xs text-muted-foreground">
              The directory of real people. Department picks come from here.
            </p>
          </div>
        </div>
        {directory.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {directory.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <AssigneeAvatar name={d.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{d.email}</span>
                </span>
                <select
                  value={d.role}
                  onChange={(e) => changeRole(d.id, e.target.value)}
                  disabled={isPending}
                  aria-label={`Role for ${d.name}`}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span
                  className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                  title="Open tasks assigned to this person"
                >
                  {memberWorkloadFor(d, tasks)} open
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyInviteLink(d.email, d.id)}
                  aria-label={`Copy invite link for ${d.name}`}
                  title="Copy invite link"
                >
                  {copiedId === d.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteDirectoryMember(d.id, d.name)}
                  aria-label={`Remove ${d.name}`}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nobody yet — invite the first person below.</p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Derived from email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={sendInvite} disabled={isPending || !inviteEmail.trim()} className="min-h-9">
            <UserPlus className="size-4" /> Invite
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Roles are organizational labels — everyone signed in shares the workspace. They sign in with the invited email to join.
        </p>
      </section>

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
                        {memberWorkloadFor({ name: m.name, email: m.email }, tasks)} open
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                          onClick={() => removeOrgMember(m.id)}
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
              <Label htmlFor="member-pick">Person</Label>
              <select
                id="member-pick"
                value={memberPick}
                onChange={(e) => {
                  setMemberPick(e.target.value);
                  const picked = directory.find((d) => d.id === e.target.value);
                  if (picked) setMemberRole(picked.role);
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Pick from directory…</option>
                {directory.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role in department</Label>
              <Input
                id="member-role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder="Defaults to the directory role"
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
              Picked from the directory above, so workload counts match real
              assignees by name or email. Digest visibility per department
              follows the roll-up scope above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
