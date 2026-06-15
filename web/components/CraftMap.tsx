"use client";

// Your discovery map — a persistent, force-directed graph of every song
// you've analyzed and the craft links between them (from src/discovery.ts).
// Songs you've analyzed are "visited" and wear their own accent color;
// their suggestions are "frontier" nodes (dashed, dimmed) waiting to be
// explored. Click a frontier node to reveal ITS links (cheap /api/suggest)
// and grow the web; "analyze" any node to dive into its full read.
//
// Interaction: drag nodes to rearrange (pins on drop), drag background to
// pan, scroll to zoom toward the cursor.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from "d3-force";
import type { Track } from "@/lib/api";
import { fetchSuggestions, searchTracks } from "@/lib/api";
import {
  clearDiscovery,
  encodeMap,
  getGraph,
  recordLinks,
  setCover,
  stats,
  subscribe,
} from "@/lib/discovery";

interface MapNode {
  key: string;
  title: string;
  artist: string;
  cover: string | null;
  analyzed: boolean;
  accent: string | null;
  expanded: boolean; // already has outgoing craft links
  loading: boolean;
  track: Track | null;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}
interface MapLink {
  source: string | MapNode;
  target: string | MapNode;
  why: string;
}

const VW = 1000;
const VH = 680;
const DRAG_THRESHOLD = 4;

interface CraftMapProps {
  open: boolean;
  focusKey: string | null;
  onClose: () => void;
  onAnalyze: (title: string, artist: string, prefetched?: Track) => void;
  // when set, render this shared graph read-only (a public profile) instead
  // of the viewer's own localStorage map
  external?: { nodes: ExternalNode[]; links: { from: string; to: string; why: string }[] } | null;
}
interface ExternalNode {
  key: string;
  title: string;
  artist: string;
  analyzed: boolean;
  accent: string | null;
}

export function CraftMap({ open, focusKey, onClose, onAnalyze, external }: CraftMapProps) {
  const nodesRef = useRef<Map<string, MapNode>>(new Map());
  const linksRef = useRef<MapLink[]>([]);
  const simRef = useRef<Simulation<MapNode, MapLink> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tRef = useRef({ k: 1, x: 0, y: 0 });
  const coverTried = useRef<Set<string>>(new Set());
  const dragRef = useRef<{
    mode: "node" | "pan";
    node?: MapNode;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startVB?: { x: number; y: number };
    startT?: { x: number; y: number };
  } | null>(null);
  const [, forceTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [st, setSt] = useState(stats);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const render = useCallback(() => forceTick((t) => t + 1), []);

  // rebuild the node/link arrays from the persistent store, preserving the
  // positions of nodes that are already on screen
  const derive = useCallback(() => {
    const { nodes, links } = external
      ? { nodes: external.nodes.map((n) => ({ ...n, cover: null, analyzedAt: null })), links: external.links }
      : getGraph();
    const outgoing = new Set(links.map((l) => l.from));
    const seen = new Set<string>();
    const byKey = nodesRef.current;

    for (const g of nodes) {
      seen.add(g.key);
      const existing = byKey.get(g.key);
      if (existing) {
        existing.title = g.title;
        existing.artist = g.artist;
        if (g.cover) existing.cover = g.cover;
        existing.analyzed = g.analyzed;
        existing.accent = g.accent;
        existing.expanded = outgoing.has(g.key);
      } else {
        // place a new node near a neighbour already on screen, else center
        const parentKey = links.find((l) => l.to === g.key && byKey.has(l.from))?.from;
        const parent = parentKey ? byKey.get(parentKey) : undefined;
        byKey.set(g.key, {
          key: g.key,
          title: g.title,
          artist: g.artist,
          cover: g.cover,
          analyzed: g.analyzed,
          accent: g.accent,
          expanded: outgoing.has(g.key),
          loading: false,
          track: null,
          x: (parent?.x ?? VW / 2) + (Math.random() - 0.5) * 80,
          y: (parent?.y ?? VH / 2) + (Math.random() - 0.5) * 80,
        });
      }
    }
    for (const k of [...byKey.keys()]) if (!seen.has(k)) byKey.delete(k);

    // pin the focus node at center for orientation
    const focus =
      (focusKey && byKey.get(focusKey)) ??
      [...byKey.values()].filter((n) => n.analyzed).sort(() => 0)[0];
    for (const n of byKey.values()) {
      if (n === focus) {
        n.fx = VW / 2;
        n.fy = VH / 2;
      }
    }

    linksRef.current = links
      .map((l) => {
        const s = byKey.get(l.from);
        const t = byKey.get(l.to);
        return s && t ? { source: s, target: t, why: l.why } : null;
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const sim = simRef.current;
    if (sim) {
      sim.nodes([...byKey.values()]);
      (sim.force("link") as ReturnType<typeof forceLink<MapNode, MapLink>>).links(linksRef.current);
      sim.alpha(0.8).restart();
    }
    render();
  }, [focusKey, render, external]);

  // expand a node (cheap suggest) — grows the persistent graph
  const expand = useCallback(
    async (node: MapNode) => {
      if (external || node.expanded || node.loading) return; // read-only profiles don't grow
      node.loading = true;
      render();
      try {
        const sugg = await fetchSuggestions(node.title, node.artist);
        recordLinks(node.key, sugg); // store change -> derive via subscription
      } catch {
        /* allow retry */
      } finally {
        node.loading = false;
        render();
      }
    },
    [render]
  );

  // seed sim + subscribe on open
  useEffect(() => {
    if (!open) return;
    tRef.current = { k: 1, x: 0, y: 0 };
    nodesRef.current = new Map();
    linksRef.current = [];
    coverTried.current = new Set();

    const sim = forceSimulation<MapNode, MapLink>([])
      .force("charge", forceManyBody().strength(-640))
      .force(
        "link",
        forceLink<MapNode, MapLink>([])
          .id((d) => d.key)
          .distance(180)
          .strength(0.45)
      )
      .force("center", forceCenter(VW / 2, VH / 2).strength(0.04))
      .force("collide", forceCollide<MapNode>((d) => (d.analyzed ? 88 : 70)))
      .on("tick", render);
    simRef.current = sim;

    derive();
    setSt(external ? externalStats(external) : stats());
    const unsub = external
      ? () => {}
      : subscribe(() => {
          derive();
          setSt(stats());
        });
    return () => {
      sim.stop();
      simRef.current = null;
      unsub();
    };
  }, [open, derive, render, external]);

  // lazily fetch covers (+ analyzable track) for nodes that lack art
  useEffect(() => {
    if (!open) return;
    for (const n of nodesRef.current.values()) {
      if (n.cover || coverTried.current.has(n.key)) continue;
      coverTried.current.add(n.key);
      searchTracks(`${n.title} ${n.artist}`)
        .then((r) => {
          if (r[0]) {
            n.cover = r[0].cover;
            n.track = r[0];
            setCover(n.key, r[0].cover);
            render();
          }
        })
        .catch(() => {});
    }
  });

  // ---------------------------------------------------- pan / zoom / drag
  function toViewBox(cx: number, cy: number) {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function vbToGraph(vb: { x: number; y: number }) {
    const { k, x, y } = tRef.current;
    return { x: (vb.x - x) / k, y: (vb.y - y) / k };
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vb = toViewBox(e.clientX, e.clientY);
      const { k, x, y } = tRef.current;
      const nk = Math.min(3, Math.max(0.35, k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      tRef.current = { k: nk, x: vb.x - nk * ((vb.x - x) / k), y: vb.y - nk * ((vb.y - y) / k) };
      render();
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [open, render]);

  function onNodePointerDown(e: React.PointerEvent, n: MapNode) {
    e.stopPropagation();
    dragRef.current = { mode: "node", node: n, moved: false, startClientX: e.clientX, startClientY: e.clientY };
    simRef.current?.alphaTarget(0.3).restart();
  }
  function onBackgroundPointerDown(e: React.PointerEvent) {
    dragRef.current = {
      mode: "pan",
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVB: toViewBox(e.clientX, e.clientY),
      startT: { x: tRef.current.x, y: tRef.current.y },
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY) > DRAG_THRESHOLD)
      d.moved = true;
    if (d.mode === "node" && d.node) {
      const g = vbToGraph(toViewBox(e.clientX, e.clientY));
      d.node.fx = g.x;
      d.node.fy = g.y;
      d.node.x = g.x;
      d.node.y = g.y;
      render();
    } else if (d.mode === "pan" && d.startVB && d.startT) {
      const vb = toViewBox(e.clientX, e.clientY);
      tRef.current.x = d.startT.x + (vb.x - d.startVB.x);
      tRef.current.y = d.startT.y + (vb.y - d.startVB.y);
      render();
    }
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    simRef.current?.alphaTarget(0);
    if (d?.mode === "node" && d.node && !d.moved) {
      if (external) onAnalyze(d.node.title, d.node.artist, d.node.track ?? undefined);
      else void expand(d.node);
    }
  }

  const nodes = [...nodesRef.current.values()];
  const links = linksRef.current;
  const t = tRef.current;
  const resolve = (end: string | MapNode) =>
    typeof end === "string" ? nodesRef.current.get(end) : end;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "var(--canvas)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="col-wide"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: 24,
              paddingBottom: 8,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 620,
                  fontSize: 21,
                  letterSpacing: "-0.015em",
                }}
              >
                {external ? "a craft map" : "your craft map"}
                <span style={{ color: "var(--accent)" }}>.</span>
              </span>
              <p className="mono-faint" style={{ marginTop: 4 }}>
                {st.explored} explored · {st.frontier} to discover · {st.links} links ·{" "}
                {external ? "click a song to analyze it" : "drag to move · scroll to zoom"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
              {!external && st.explored > 0 && (
                <button
                  disabled={sharing}
                  onClick={async () => {
                    setSharing(true);
                    const data = encodeMap();
                    let url = `${window.location.origin}/u/${data}`; // long fallback
                    try {
                      const res = await fetch("/api/map", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data }),
                      });
                      if (res.ok) {
                        const { id } = (await res.json()) as { id: string };
                        url = `${window.location.origin}/u/${id}`;
                      }
                    } catch {
                      /* keep the long fallback */
                    }
                    await navigator.clipboard?.writeText(url).catch(() => {});
                    setSharing(false);
                    setShared(true);
                    window.setTimeout(() => setShared(false), 1800);
                  }}
                  className="mono"
                  style={{ textDecoration: "underline" }}
                >
                  {sharing ? "creating link…" : shared ? "link copied ✓" : "share my map ↗"}
                </button>
              )}
              {!external && st.explored > 1 && (
                <button
                  onClick={() => {
                    if (confirm("Clear your whole discovery map?")) clearDiscovery();
                  }}
                  className="mono-faint"
                  style={{ textDecoration: "underline" }}
                >
                  clear
                </button>
              )}
              <button onClick={onClose} className="mono" style={{ textDecoration: "underline" }}>
                close ✕
              </button>
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ flex: 1, width: "100%", minHeight: 0, cursor: "grab", touchAction: "none" }}
            onPointerDown={onBackgroundPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              <pattern id="dotgrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="1.2" fill="var(--line)" />
              </pattern>
            </defs>
            <g transform={`translate(${t.x}, ${t.y}) scale(${t.k})`}>
              {/* forensic dot-grid backdrop */}
              <rect x={-3000} y={-3000} width={6000} height={6000} fill="url(#dotgrid)" opacity={0.55} />

              {/* edges */}
              {links.map((l, i) => {
                const s = resolve(l.source);
                const tg = resolve(l.target);
                if (!s || !tg) return null;
                const lit = hover === s.key || hover === tg.key;
                const mx = ((s.x ?? 0) + (tg.x ?? 0)) / 2;
                const my = ((s.y ?? 0) + (tg.y ?? 0)) / 2;
                return (
                  <g key={i}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={tg.x}
                      y2={tg.y}
                      stroke={lit ? "var(--accent)" : "var(--bar)"}
                      strokeWidth={lit ? 1.5 : 1}
                      opacity={lit ? 1 : 0.45}
                    />
                    {lit && (
                      <text
                        x={mx}
                        y={my - 5}
                        textAnchor="middle"
                        style={{ fontFamily: "var(--mono)", fontSize: 10, fill: "var(--ink-soft)" }}
                      >
                        {l.why.length > 56 ? l.why.slice(0, 54) + "…" : l.why}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* nodes */}
              {nodes.map((n) => {
                const isFocus = n.key === focusKey;
                const r = n.analyzed ? 34 : 26;
                const ring = n.analyzed ? n.accent ?? "var(--accent)" : "var(--grey)";
                return (
                  <g
                    key={n.key}
                    transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                    style={{ cursor: "grab", animation: "node-pop 0.5s ease-out" }}
                    opacity={n.analyzed ? 1 : 0.62}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    onMouseEnter={() => setHover(n.key)}
                    onMouseLeave={() => setHover((h) => (h === n.key ? null : h))}
                  >
                    {isFocus && (
                      <circle r={r + 7} fill="none" stroke={ring} strokeWidth={1.5} opacity={0.5}>
                        <animate attributeName="r" values={`${r + 5};${r + 12};${r + 5}`} dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <clipPath id={`clip-${n.key}`}>
                      <circle r={r} />
                    </clipPath>
                    <circle
                      r={r + 3}
                      fill="none"
                      stroke={hover === n.key ? "var(--accent)" : ring}
                      strokeWidth={n.analyzed ? 2 : 1.5}
                      strokeDasharray={n.analyzed ? undefined : "3 4"}
                    />
                    <circle r={r} fill="var(--bar)" />
                    {n.cover && (
                      <image
                        href={n.cover}
                        x={-r}
                        y={-r}
                        width={r * 2}
                        height={r * 2}
                        clipPath={`url(#clip-${n.key})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                    {n.loading && (
                      <circle r={r + 9} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 8" opacity={0.8}>
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <text
                      y={r + 18}
                      textAnchor="middle"
                      style={{
                        fontFamily: "var(--serif)",
                        fontWeight: 560,
                        fontSize: 14,
                        fill: "var(--ink)",
                      }}
                    >
                      {n.title.length > 26 ? n.title.slice(0, 24) + "…" : n.title}
                    </text>
                    <text
                      y={r + 33}
                      textAnchor="middle"
                      style={{ fontFamily: "var(--mono)", fontSize: 10, fill: "var(--grey)" }}
                    >
                      {n.artist.length > 30 ? n.artist.slice(0, 28) + "…" : n.artist}
                    </text>
                    {hover === n.key && (
                      <g
                        transform={`translate(0, ${-r - 16})`}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAnalyze(n.title, n.artist, n.track ?? undefined);
                        }}
                      >
                        <rect x={-34} y={-13} width={68} height={22} rx={4} fill="var(--ink)" />
                        <text
                          textAnchor="middle"
                          y={2}
                          style={{ fontFamily: "var(--mono)", fontSize: 10.5, fill: "var(--canvas)" }}
                        >
                          analyze ↗
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
function externalStats(ext: { nodes: { analyzed: boolean }[]; links: unknown[] }) {
  const explored = ext.nodes.filter((n) => n.analyzed).length;
  return { explored, frontier: ext.nodes.length - explored, links: ext.links.length };
}
