import { describe, expect, it } from "vitest";
import { buildMindGraph } from "@/lib/mindmap";

describe("buildMindGraph", () => {
  it("marks subjects spanning recordings as shared (amber)", () => {
    const graph = buildMindGraph({
      spaces: [{ id: "s1", name: "Work", description: "", accent: "orange" }],
      projects: [{ id: "p1", name: "App", spaceId: "s1" }],
      documents: [
        { id: "d1", title: "Rec one", spaceId: "s1", projectId: "p1", kind: "file", recordingType: "thought", taskIds: ["t1"] },
        { id: "d2", title: "Rec two", spaceId: "s1", projectId: "p1", kind: "file", recordingType: "thought", taskIds: ["t2"] },
        { id: "d3", title: "Lone note", spaceId: "s1", kind: "note" },
      ],
      tasks: [
        { id: "t1", title: "Fix login", spaceId: "s1", status: "todo", tags: ["Bug"], sourceDocId: "d1" },
        { id: "t2", title: "Fix logout", spaceId: "s1", status: "todo", tags: ["Bug"], sourceDocId: "d2" },
      ],
    });
    const topics = graph.nodes.filter((n) => n.kind === "topic");
    expect(topics.map((n) => n.label)).toEqual(["Bug"]);
    const docs = new Map(graph.nodes.filter((n) => n.kind !== "topic" && n.kind !== "space" && n.kind !== "project").map((n) => [n.id, n]));
    expect(docs.get("doc:d1")?.shared).toBe(true);
    expect(docs.get("doc:d2")?.shared).toBe(true);
    expect(docs.get("doc:d3")?.shared).toBe(false);
    // Edges link recordings to their shared topic.
    expect(graph.edges).toContainEqual({ from: "doc:d1", to: "topic:Bug" });
    expect(graph.edges).toContainEqual({ from: "doc:d2", to: "topic:Bug" });
  });

  it("lays nodes out by depth without overlap", () => {
    const graph = buildMindGraph({
      spaces: [{ id: "s1", name: "Work", description: "", accent: "orange" }],
      projects: [],
      documents: [{ id: "d1", title: "Note", spaceId: "s1", kind: "note" }],
      tasks: [],
    });
    const xs = new Map(graph.nodes.map((n) => [n.kind, n.x]));
    expect(xs.get("space")).toBeLessThan(xs.get("note")!);
  });
});
