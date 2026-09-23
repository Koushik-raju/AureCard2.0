"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MindGraph, MindNode } from "@/lib/mindmap";
import { DOC_NODE_KINDS } from "@/lib/mindmap";
import { cn } from "@/lib/utils";

const NODE_W = 200;
const NODE_H = 52;

function nodeClasses(node: MindNode): string {
  if (node.kind === "space") return "fill-primary stroke-primary";
  if (node.kind === "project") return "fill-secondary stroke-border";
  if (node.kind === "topic") return "fill-amber-500/20 stroke-amber-500";
  return node.shared
    ? "fill-amber-500/10 stroke-amber-500"
    : "fill-muted stroke-border";
}

function labelClasses(node: MindNode): string {
  if (node.kind === "space") return "fill-primary-foreground";
  if (node.kind === "topic" || (DOC_NODE_KINDS.has(node.kind) && node.shared))
    return "fill-amber-700 dark:fill-amber-300";
  return "fill-foreground";
}

/**
 * Reusable pan-and-zoom concept canvas. The global mind-map page feeds it
 * the whole library; per-note tabs can feed it a single-note subgraph.
 */
export function MindmapCanvas({ graph }: { graph: MindGraph }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Start zoomed in one step so labels are readable on load.
  const [zoom, setZoom] = useState(1.3);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const height = useMemo(() => {
    const maxY = graph.nodes.reduce((m, n) => Math.max(m, n.y), 0);
    return Math.max(320, maxY + 120);
  }, [graph]);

  const width = useMemo(() => {
    const maxX = graph.nodes.reduce((m, n) => Math.max(m, n.x), 0);
    return Math.max(640, maxX + NODE_W + 80);
  }, [graph]);

  function reset() {
    setPan({ x: 0, y: 0 });
    setZoom(1.3);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-amber-500" /> Shared subject
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-muted-foreground/40" /> Standalone
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-primary" /> Space
        </span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))} aria-label="Zoom in">
          <Plus className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} aria-label="Zoom out">
          <Minus className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={reset} aria-label="Reset view">
          <RotateCcw className="size-4" />
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-[480px] w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label="Library concept map"
          onPointerDown={(e) => {
            dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerLeave={() => {
            dragRef.current = null;
          }}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoom((z) => Math.max(0.4, Math.min(2, +(z - Math.sign(e.deltaY) * 0.08).toFixed(2))));
          }}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {graph.edges.map((edge, i) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const shared = to.kind === "topic" || (DOC_NODE_KINDS.has(to.kind) && to.shared);
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  strokeWidth={shared ? 2 : 1.25}
                  className={shared ? "stroke-amber-500/70" : "stroke-border"}
                />
              );
            })}
            {graph.nodes.map((node) => (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  strokeWidth={node.kind === "space" ? 0 : 1.5}
                  className={nodeClasses(node)}
                />
                <text
                  x={14}
                  y={22}
                  fontSize={11}
                  fontWeight={600}
                  className={cn("uppercase", labelClasses(node))}
                  opacity={0.75}
                >
                  {node.kind}
                </text>
                <text x={14} y={40} fontSize={13} className={labelClasses(node)}>
                  {node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label}
                  <title>{node.label}</title>
                </text>
                {node.href ? (
                  <Link href={node.href} aria-label={`Open ${node.label}`}>
                    <rect width={NODE_W} height={NODE_H} rx={12} fill="transparent" />
                  </Link>
                ) : null}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Drag to pan · Ctrl/⌘ + scroll to zoom · click a card to open it. Amber
        branches mark subjects that appear in more than one recording.
      </p>
    </div>
  );
}
