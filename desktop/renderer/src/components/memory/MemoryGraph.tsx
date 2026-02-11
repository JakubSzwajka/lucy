"use client";

import { useMemo, useState, useCallback } from "react";
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
const HIGHLIGHT_OPACITY = "ff";
const DIM_OPACITY = "18";

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

function buildGraph(memories: Memory[]): GraphData {
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
  const tagRadius = Math.max(200, tagList.length * 30);
  const memRadius = tagRadius + 280;

  for (let i = 0; i < tagList.length; i++) {
    const [tag, count] = tagList[i];
    const angle = (2 * Math.PI * i) / tagList.length;
    nodes.push({
      id: `tag:${tag}`,
      type: "tag",
      position: { x: Math.cos(angle) * tagRadius, y: Math.sin(angle) * tagRadius },
      data: { label: tag, count, selected: false, dimmed: false },
    });
  }

  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const angle = (2 * Math.PI * i) / memories.length;
    nodes.push({
      id: `mem:${mem.id}`,
      type: "memory",
      position: { x: Math.cos(angle) * memRadius, y: Math.sin(angle) * memRadius },
      data: { label: mem.content, type: mem.type, confidence: mem.confidenceScore, selected: false, dimmed: false },
    });

    for (const tag of mem.tags ?? []) {
      edges.push({
        id: `edge:${mem.id}:${tag}`,
        source: `mem:${mem.id}`,
        target: `tag:${tag}`,
        style: { stroke: `${TYPE_COLORS[mem.type]}40`, strokeWidth: 1.5 },
      });
    }
  }

  return { nodes, edges, memoryMap, tagMemories, memoryTags };
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
            <span>{timeAgo(memory.createdAt)}</span>
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

export function MemoryGraph() {
  const { memories, isLoading, updateMemory, deleteMemory } = useMemories({ limit: 200 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const graphData = useMemo(() => buildGraph(memories), [memories]);

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
  const [edges, , onEdgesChange] = useEdgesState(highlightedEdges);

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
        defaultEdgeOptions={{ type: "straight" }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#333" gap={24} />
        <Controls
          showInteractive={false}
          className="!bg-background-secondary !border-border !shadow-lg [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-background-secondary"
        />
      </ReactFlow>

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
