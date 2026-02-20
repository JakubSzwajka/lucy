"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemories } from "@/hooks/useMemories";
import type { Memory, MemoryType, UpdateMemoryInput } from "@/types/memory";

const TYPE_COLORS: Record<MemoryType, string> = {
  fact: "#3b82f6",
  preference: "#a855f7",
  relationship: "#22c55e",
  principle: "#f59e0b",
  commitment: "#ef4444",
  moment: "#ec4899",
  skill: "#06b6d4",
};

const TAG_COLOR = "#6b7280";

type LayoutMode = "circular" | "force" | "clustered";
type EdgeType = "straight" | "default" | "smoothstep";
type BgVariant = "dots" | "lines" | "cross" | "none";

interface GraphSettings {
  layout: LayoutMode;
  edgeType: EdgeType;
  tagSpacing: number;     // multiplier for tag ring radius
  ringGap: number;        // gap between tag and memory rings
  showTags: boolean;
  edgeOpacity: number;    // 0-100
  bgVariant: BgVariant;
  nodeScale: number;      // 0.5-2
}

const DEFAULT_SETTINGS: GraphSettings = {
  layout: "circular",
  edgeType: "straight",
  tagSpacing: 1,
  ringGap: 280,
  showTags: true,
  edgeOpacity: 40,
  bgVariant: "dots",
  nodeScale: 1,
};

function MemoryNode({ data }: { data: { label: string; type: MemoryType; confidence: number; selected?: boolean; dimmed?: boolean } }) {
  const opacity = data.dimmed ? 0.25 : 1;
  const borderWidth = data.selected ? 2 : 1;
  return (
    <div
      className="px-3 py-2 rounded-lg border text-xs max-w-[220px] shadow-md transition-opacity duration-200"
      style={{
        opacity,
        backgroundColor: `${TYPE_COLORS[data.type]}15`,
        borderColor: data.selected ? TYPE_COLORS[data.type] : `${TYPE_COLORS[data.type]}60`,
        borderWidth,
        color: "#e5e7eb",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: TYPE_COLORS[data.type] }}
        />
        <span className="font-mono opacity-60">{data.type}</span>
        <span className="ml-auto font-mono opacity-40">{data.confidence.toFixed(2)}</span>
      </div>
      <div className="leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: data.selected ? 10 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

function TagNode({ data }: { data: { label: string; count: number; selected?: boolean; dimmed?: boolean } }) {
  const size = Math.max(40, Math.min(72, 30 + data.count * 6));
  const opacity = data.dimmed ? 0.25 : 1;
  return (
    <div
      className="rounded-full flex items-center justify-center border shadow-md transition-opacity duration-200"
      style={{
        width: size,
        height: size,
        opacity,
        backgroundColor: data.selected ? `${TAG_COLOR}40` : `${TAG_COLOR}20`,
        borderColor: data.selected ? "#e5e7eb" : `${TAG_COLOR}50`,
        borderWidth: data.selected ? 2 : 1,
        color: data.selected ? "#e5e7eb" : "#9ca3af",
        fontSize: Math.max(9, Math.min(12, 8 + data.count)),
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <span className="font-mono truncate px-1" title={data.label}>{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memory: MemoryNode,
  tag: TagNode,
};

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  memoryMap: Map<string, Memory>;
  tagMemories: Map<string, string[]>; // tag -> memory IDs
  memoryTags: Map<string, string[]>;  // memory ID -> tags
}

// Simple force simulation (runs synchronously for small graphs)
function forceLayout(
  memories: Memory[],
  tagList: [string, number][],
  _tagMemories: Map<string, string[]>,
): { memPositions: Map<string, { x: number; y: number }>; tagPositions: Map<string, { x: number; y: number }> } {
  // Initialize positions in a circle
  const allIds: string[] = [];
  const pos = new Map<string, { x: number; y: number }>();

  for (let i = 0; i < tagList.length; i++) {
    const id = `tag:${tagList[i][0]}`;
    const angle = (2 * Math.PI * i) / tagList.length;
    pos.set(id, { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 });
    allIds.push(id);
  }
  for (let i = 0; i < memories.length; i++) {
    const id = `mem:${memories[i].id}`;
    const angle = (2 * Math.PI * i) / memories.length;
    pos.set(id, { x: Math.cos(angle) * 400, y: Math.sin(angle) * 400 });
    allIds.push(id);
  }

  // Build edge list
  const links: [string, string][] = [];
  for (const mem of memories) {
    for (const tag of mem.tags ?? []) {
      links.push([`mem:${mem.id}`, `tag:${tag}`]);
    }
  }

  // Run iterations
  const iterations = 80;
  const repulsion = 8000;
  const attraction = 0.005;
  const damping = 0.9;
  const vel = new Map<string, { vx: number; vy: number }>();
  for (const id of allIds) vel.set(id, { vx: 0, vy: 0 });

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const a = pos.get(allIds[i])!;
        const b = pos.get(allIds[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vel.get(allIds[i])!.vx += fx;
        vel.get(allIds[i])!.vy += fy;
        vel.get(allIds[j])!.vx -= fx;
        vel.get(allIds[j])!.vy -= fy;
      }
    }
    // Attraction along edges
    for (const [src, tgt] of links) {
      const a = pos.get(src);
      const b = pos.get(tgt);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * attraction;
      const fy = dy * attraction;
      vel.get(src)!.vx += fx;
      vel.get(src)!.vy += fy;
      vel.get(tgt)!.vx -= fx;
      vel.get(tgt)!.vy -= fy;
    }
    // Apply velocity
    for (const id of allIds) {
      const v = vel.get(id)!;
      const p = pos.get(id)!;
      v.vx *= damping;
      v.vy *= damping;
      p.x += v.vx;
      p.y += v.vy;
    }
  }

  const memPositions = new Map<string, { x: number; y: number }>();
  const tagPositions = new Map<string, { x: number; y: number }>();
  for (const [id, p] of pos) {
    if (id.startsWith("mem:")) memPositions.set(id.slice(4), p);
    else if (id.startsWith("tag:")) tagPositions.set(id.slice(4), p);
  }
  return { memPositions, tagPositions };
}

// Clustered layout: group memories by their primary (first) tag
function clusteredLayout(
  memories: Memory[],
  tagList: [string, number][],
): { memPositions: Map<string, { x: number; y: number }>; tagPositions: Map<string, { x: number; y: number }> } {
  const memPositions = new Map<string, { x: number; y: number }>();
  const tagPositions = new Map<string, { x: number; y: number }>();

  const clusterRadius = Math.max(300, tagList.length * 60);

  // Position each tag as cluster center
  for (let i = 0; i < tagList.length; i++) {
    const angle = (2 * Math.PI * i) / tagList.length;
    tagPositions.set(tagList[i][0], {
      x: Math.cos(angle) * clusterRadius,
      y: Math.sin(angle) * clusterRadius,
    });
  }

  // Group memories by primary tag
  const clusters = new Map<string, Memory[]>();
  const untagged: Memory[] = [];
  for (const mem of memories) {
    const primaryTag = (mem.tags ?? [])[0];
    if (primaryTag && tagPositions.has(primaryTag)) {
      const list = clusters.get(primaryTag) ?? [];
      list.push(mem);
      clusters.set(primaryTag, list);
    } else {
      untagged.push(mem);
    }
  }

  // Arrange memories around their cluster center
  for (const [tag, mems] of clusters) {
    const center = tagPositions.get(tag)!;
    const subRadius = Math.max(80, mems.length * 20);
    for (let i = 0; i < mems.length; i++) {
      const angle = (2 * Math.PI * i) / mems.length;
      memPositions.set(mems[i].id, {
        x: center.x + Math.cos(angle) * subRadius,
        y: center.y + Math.sin(angle) * subRadius,
      });
    }
  }

  // Untagged in center
  for (let i = 0; i < untagged.length; i++) {
    const angle = (2 * Math.PI * i) / Math.max(1, untagged.length);
    memPositions.set(untagged[i].id, { x: Math.cos(angle) * 80, y: Math.sin(angle) * 80 });
  }

  return { memPositions, tagPositions };
}

function buildGraph(memories: Memory[], settings: GraphSettings): GraphData {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const tagCounts = new Map<string, number>();
  const tagMemories = new Map<string, string[]>();
  const memoryTags = new Map<string, string[]>();
  const memoryMap = new Map<string, Memory>();

  for (const mem of memories) {
    memoryMap.set(mem.id, mem);
    const tags = mem.tags ?? [];
    memoryTags.set(mem.id, tags);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      const list = tagMemories.get(tag) ?? [];
      list.push(mem.id);
      tagMemories.set(tag, list);
    }
  }

  const tagList = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
  const opacityHex = Math.round((settings.edgeOpacity / 100) * 255).toString(16).padStart(2, "0");

  if (settings.layout === "force") {
    const { memPositions, tagPositions } = forceLayout(memories, tagList, tagMemories);

    if (settings.showTags) {
      for (const [tag, count] of tagList) {
        const p = tagPositions.get(tag) ?? { x: 0, y: 0 };
        nodes.push({
          id: `tag:${tag}`,
          type: "tag",
          position: { x: p.x * settings.nodeScale, y: p.y * settings.nodeScale },
          data: { label: tag, count, selected: false, dimmed: false },
        });
      }
    }

    for (const mem of memories) {
      const p = memPositions.get(mem.id) ?? { x: 0, y: 0 };
      nodes.push({
        id: `mem:${mem.id}`,
        type: "memory",
        position: { x: p.x * settings.nodeScale, y: p.y * settings.nodeScale },
        data: { label: mem.content, type: mem.type, confidence: mem.confidenceScore, selected: false, dimmed: false },
      });
      if (settings.showTags) {
        for (const tag of mem.tags ?? []) {
          edges.push({
            id: `edge:${mem.id}:${tag}`,
            source: `mem:${mem.id}`,
            target: `tag:${tag}`,
            type: settings.edgeType,
            style: { stroke: `${TYPE_COLORS[mem.type]}${opacityHex}`, strokeWidth: 1.5 },
          });
        }
      }
    }
  } else if (settings.layout === "clustered") {
    const { memPositions, tagPositions } = clusteredLayout(memories, tagList);

    if (settings.showTags) {
      for (const [tag, count] of tagList) {
        const p = tagPositions.get(tag) ?? { x: 0, y: 0 };
        nodes.push({
          id: `tag:${tag}`,
          type: "tag",
          position: { x: p.x * settings.nodeScale, y: p.y * settings.nodeScale },
          data: { label: tag, count, selected: false, dimmed: false },
        });
      }
    }

    for (const mem of memories) {
      const p = memPositions.get(mem.id) ?? { x: 0, y: 0 };
      nodes.push({
        id: `mem:${mem.id}`,
        type: "memory",
        position: { x: p.x * settings.nodeScale, y: p.y * settings.nodeScale },
        data: { label: mem.content, type: mem.type, confidence: mem.confidenceScore, selected: false, dimmed: false },
      });
      if (settings.showTags) {
        for (const tag of mem.tags ?? []) {
          edges.push({
            id: `edge:${mem.id}:${tag}`,
            source: `mem:${mem.id}`,
            target: `tag:${tag}`,
            type: settings.edgeType,
            style: { stroke: `${TYPE_COLORS[mem.type]}${opacityHex}`, strokeWidth: 1.5 },
          });
        }
      }
    }
  } else {
    // Circular (original)
    const tagRadius = Math.max(200, tagList.length * 30) * settings.tagSpacing;
    const memRadius = tagRadius + settings.ringGap;

    if (settings.showTags) {
      for (let i = 0; i < tagList.length; i++) {
        const [tag, count] = tagList[i];
        const angle = (2 * Math.PI * i) / tagList.length;
        nodes.push({
          id: `tag:${tag}`,
          type: "tag",
          position: { x: Math.cos(angle) * tagRadius * settings.nodeScale, y: Math.sin(angle) * tagRadius * settings.nodeScale },
          data: { label: tag, count, selected: false, dimmed: false },
        });
      }
    }

    for (let i = 0; i < memories.length; i++) {
      const mem = memories[i];
      const angle = (2 * Math.PI * i) / memories.length;
      nodes.push({
        id: `mem:${mem.id}`,
        type: "memory",
        position: { x: Math.cos(angle) * memRadius * settings.nodeScale, y: Math.sin(angle) * memRadius * settings.nodeScale },
        data: { label: mem.content, type: mem.type, confidence: mem.confidenceScore, selected: false, dimmed: false },
      });

      if (settings.showTags) {
        for (const tag of mem.tags ?? []) {
          edges.push({
            id: `edge:${mem.id}:${tag}`,
            source: `mem:${mem.id}`,
            target: `tag:${tag}`,
            type: settings.edgeType,
            style: { stroke: `${TYPE_COLORS[mem.type]}${opacityHex}`, strokeWidth: 1.5 },
          });
        }
      }
    }
  }

  return { nodes, edges, memoryMap, tagMemories, memoryTags };
}

// Settings panel
function GraphSettingsMenu({
  settings,
  onChange,
}: {
  settings: GraphSettings;
  onChange: (s: GraphSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const set = <K extends keyof GraphSettings>(key: K, val: GraphSettings[K]) =>
    onChange({ ...settings, [key]: val });

  return (
    <div ref={menuRef} className="absolute top-3 left-3 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-dark hover:text-foreground transition-colors shadow-lg flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Graph
      </button>

      {open && (
        <div className="mt-1.5 bg-background-secondary border border-border rounded-lg shadow-xl w-64 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-mono text-muted-darker uppercase tracking-wider">Graph Settings</span>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {/* Layout */}
            <div>
              <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider block mb-1">Layout</label>
              <div className="flex gap-1">
                {(["circular", "force", "clustered"] as LayoutMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => set("layout", mode)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      settings.layout === mode
                        ? "bg-foreground/10 text-foreground border border-border"
                        : "text-muted-dark hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Edge type */}
            <div>
              <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider block mb-1">Edges</label>
              <div className="flex gap-1">
                {([["straight", "Straight"], ["default", "Bezier"], ["smoothstep", "Step"]] as [EdgeType, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => set("edgeType", val)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      settings.edgeType === val
                        ? "bg-foreground/10 text-foreground border border-border"
                        : "text-muted-dark hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Edge opacity */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider">Edge Opacity</label>
                <span className="font-mono text-muted-darker text-[10px]">{settings.edgeOpacity}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={settings.edgeOpacity}
                onChange={(e) => set("edgeOpacity", Number(e.target.value))}
                className="w-full h-1 accent-neutral-500"
              />
            </div>

            {/* Spacing (circular only) */}
            {settings.layout === "circular" && (
              <>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider">Tag Spacing</label>
                    <span className="font-mono text-muted-darker text-[10px]">{settings.tagSpacing.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={settings.tagSpacing}
                    onChange={(e) => set("tagSpacing", Number(e.target.value))}
                    className="w-full h-1 accent-neutral-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider">Ring Gap</label>
                    <span className="font-mono text-muted-darker text-[10px]">{settings.ringGap}px</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={600}
                    step={20}
                    value={settings.ringGap}
                    onChange={(e) => set("ringGap", Number(e.target.value))}
                    className="w-full h-1 accent-neutral-500"
                  />
                </div>
              </>
            )}

            {/* Node scale */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider">Spread</label>
                <span className="font-mono text-muted-darker text-[10px]">{settings.nodeScale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={settings.nodeScale}
                onChange={(e) => set("nodeScale", Number(e.target.value))}
                className="w-full h-1 accent-neutral-500"
              />
            </div>

            {/* Background */}
            <div>
              <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider block mb-1">Background</label>
              <div className="flex gap-1">
                {(["dots", "lines", "cross", "none"] as BgVariant[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => set("bgVariant", v)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      settings.bgVariant === v
                        ? "bg-foreground/10 text-foreground border border-border"
                        : "text-muted-dark hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Show tags toggle */}
            <div className="flex items-center justify-between">
              <label className="text-muted-dark font-mono text-[10px] uppercase tracking-wider">Show Tags</label>
              <button
                onClick={() => set("showTags", !settings.showTags)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  settings.showTags ? "bg-blue-500/60" : "bg-neutral-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    settings.showTags ? "left-4" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={() => onChange({ ...DEFAULT_SETTINGS })}
              className="w-full text-center text-[10px] font-mono text-muted-darker hover:text-muted-dark transition-colors pt-1 border-t border-border"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Detail panel for selected memory
function MemoryDetail({
  memory,
  onClose,
  onDelete,
  onUpdate,
}: {
  memory: Memory;
  onClose: () => void;
  onDelete: (id: string) => Promise<unknown>;
  onUpdate: (id: string, updates: UpdateMemoryInput) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);

  const handleSave = async () => {
    await onUpdate(memory.id, { content: editContent });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this memory?")) {
      await onDelete(memory.id);
      onClose();
    }
  };

  return (
    <div className="absolute top-3 right-3 w-80 bg-background-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: TYPE_COLORS[memory.type] }}
          />
          <span className="text-xs font-mono text-muted-dark">{memory.type}</span>
          <span className="text-xs font-mono text-muted-darker">{memory.confidenceScore.toFixed(2)}</span>
        </div>
        <button onClick={onClose} className="text-muted-dark hover:text-foreground transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-ship text-xs px-3 py-1">Save</button>
              <button onClick={() => { setEditing(false); setEditContent(memory.content); }} className="text-xs text-muted-dark hover:text-foreground px-3 py-1">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{memory.content}</p>
        )}

        <div className="space-y-1.5 text-xs text-muted-dark">
          <div className="flex justify-between">
            <span>Confidence</span>
            <span className="font-mono">{memory.confidenceLevel} ({memory.confidenceScore.toFixed(2)})</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="font-mono">{memory.status}</span>
          </div>
          <div className="flex justify-between">
            <span>Created</span>
            <span className="font-mono">{timeAgo(memory.createdAt)}</span>
          </div>
          {(memory.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {memory.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-background text-[10px] font-mono text-muted-dark">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1 border-t border-border">
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-muted-dark hover:text-foreground transition-colors">
              Edit
            </button>
          )}
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail for selected tag
function TagDetail({
  tag,
  connectedMemories,
  onClose,
}: {
  tag: string;
  connectedMemories: Memory[];
  onClose: () => void;
}) {
  return (
    <div className="absolute top-3 right-3 w-80 bg-background-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-mono text-foreground">{tag}</span>
        <button onClick={onClose} className="text-muted-dark hover:text-foreground transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-dark mb-3">{connectedMemories.length} memories</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {connectedMemories.map((mem) => (
            <div key={mem.id} className="flex items-start gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: TYPE_COLORS[mem.type] }} />
              <span className="text-foreground leading-snug">{mem.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoryGraphInner() {
  const { memories, isLoading, updateMemory, deleteMemory } = useMemories({ limit: 200 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const { fitView } = useReactFlow();

  const graphData = useMemo(() => buildGraph(memories, settings), [memories, settings]);

  // Re-fit view when layout changes
  const prevLayout = useRef(settings.layout);
  useEffect(() => {
    if (prevLayout.current !== settings.layout) {
      prevLayout.current = settings.layout;
      setTimeout(() => fitView({ padding: 0.3 }), 50);
    }
  }, [settings.layout, fitView]);

  // Apply highlighting based on selection
  const highlightedNodes = useMemo(() => {
    if (!selectedNodeId) return graphData.nodes;

    let connectedIds: Set<string>;

    if (selectedNodeId.startsWith("mem:")) {
      const memId = selectedNodeId.slice(4);
      const tags = graphData.memoryTags.get(memId) ?? [];
      connectedIds = new Set([selectedNodeId]);
      for (const tag of tags) {
        connectedIds.add(`tag:${tag}`);
        for (const otherId of graphData.tagMemories.get(tag) ?? []) {
          connectedIds.add(`mem:${otherId}`);
        }
      }
    } else if (selectedNodeId.startsWith("tag:")) {
      const tag = selectedNodeId.slice(4);
      const memIds = graphData.tagMemories.get(tag) ?? [];
      connectedIds = new Set([selectedNodeId]);
      for (const memId of memIds) {
        connectedIds.add(`mem:${memId}`);
        for (const t of graphData.memoryTags.get(memId) ?? []) {
          connectedIds.add(`tag:${t}`);
        }
      }
    } else {
      return graphData.nodes;
    }

    return graphData.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected: node.id === selectedNodeId,
        dimmed: !connectedIds.has(node.id),
      },
    }));
  }, [graphData, selectedNodeId]);

  const highlightedEdges = useMemo(() => {
    if (!selectedNodeId) return graphData.edges;

    let connectedIds: Set<string>;
    if (selectedNodeId.startsWith("mem:")) {
      const memId = selectedNodeId.slice(4);
      const tags = graphData.memoryTags.get(memId) ?? [];
      connectedIds = new Set([selectedNodeId]);
      for (const tag of tags) {
        connectedIds.add(`tag:${tag}`);
        for (const otherId of graphData.tagMemories.get(tag) ?? []) {
          connectedIds.add(`mem:${otherId}`);
        }
      }
    } else if (selectedNodeId.startsWith("tag:")) {
      const tag = selectedNodeId.slice(4);
      connectedIds = new Set([selectedNodeId]);
      for (const memId of graphData.tagMemories.get(tag) ?? []) {
        connectedIds.add(`mem:${memId}`);
        for (const t of graphData.memoryTags.get(memId) ?? []) {
          connectedIds.add(`tag:${t}`);
        }
      }
    } else {
      return graphData.edges;
    }

    return graphData.edges.map((edge) => {
      const connected = connectedIds.has(edge.source) && connectedIds.has(edge.target);
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: connected ? 1 : 0.08,
          strokeWidth: connected ? 2 : 1,
        },
        animated: connected && (edge.source === selectedNodeId || edge.target === selectedNodeId),
      };
    });
  }, [graphData, selectedNodeId]);

  const [nodes, , onNodesChange] = useNodesState(highlightedNodes);
  const [_edges, , onEdgesChange] = useEdgesState(highlightedEdges);

  // Keep nodes/edges in sync with highlighting changes
  const displayNodes = useMemo(() => {
    // Preserve positions from dragged nodes but update data from highlighting
    if (nodes.length === highlightedNodes.length && nodes.length > 0) {
      return nodes.map((n, i) => ({
        ...n,
        data: highlightedNodes[i]?.data ?? n.data,
      }));
    }
    return highlightedNodes;
  }, [nodes, highlightedNodes]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Get selected item details
  const selectedMemory = useMemo(() => {
    if (!selectedNodeId?.startsWith("mem:")) return null;
    return graphData.memoryMap.get(selectedNodeId.slice(4)) ?? null;
  }, [selectedNodeId, graphData]);

  const selectedTag = useMemo(() => {
    if (!selectedNodeId?.startsWith("tag:")) return null;
    const tag = selectedNodeId.slice(4);
    const memIds = graphData.tagMemories.get(tag) ?? [];
    return { tag, memories: memIds.map((id) => graphData.memoryMap.get(id)).filter(Boolean) as Memory[] };
  }, [selectedNodeId, graphData]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-dark">Loading graph...</div>;
  }

  if (memories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="label-dark">{"// NO_DATA"}</span>
          <p className="text-sm text-muted-dark mt-2">No memories to visualize.</p>
        </div>
      </div>
    );
  }

  const bgVariantMap: Record<string, BackgroundVariant> = {
    dots: BackgroundVariant.Dots,
    lines: BackgroundVariant.Lines,
    cross: BackgroundVariant.Cross,
  };

  return (
    <div className="flex-1 w-full h-full relative" style={{ minHeight: 500 }}>
      <ReactFlow
        nodes={displayNodes}
        edges={highlightedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: settings.edgeType }}
        minZoom={0.1}
        maxZoom={2}
      >
        {settings.bgVariant !== "none" && (
          <Background color="#333" gap={24} variant={bgVariantMap[settings.bgVariant]} />
        )}
        <Controls
          showInteractive={false}
          className="!bg-background-secondary !border-border !shadow-lg [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-background-secondary"
        />
      </ReactFlow>

      <GraphSettingsMenu settings={settings} onChange={setSettings} />

      {selectedMemory && (
        <MemoryDetail
          memory={selectedMemory}
          onClose={() => setSelectedNodeId(null)}
          onDelete={deleteMemory}
          onUpdate={updateMemory}
        />
      )}

      {selectedTag && (
        <TagDetail
          tag={selectedTag.tag}
          connectedMemories={selectedTag.memories}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}

export function MemoryGraph() {
  return (
    <ReactFlowProvider>
      <MemoryGraphInner />
    </ReactFlowProvider>
  );
}
