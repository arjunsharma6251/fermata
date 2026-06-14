// The craft map — a force-directed graph of songs connected by shared craft
// moves. The current song is the center; its suggestions radiate out. Click
// a song to reveal ITS craft links (cheap /api/suggest), growing the web.
// Click "analyze" on any node to dive into its full read.
//
// Interaction: drag nodes to rearrange (they pin where you drop them), drag
// the background to pan, scroll to zoom toward the cursor.

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
import type { Analysis, Track } from "../api";
import { fetchSuggestions, searchTracks } from "../api";

interface MapNode {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  track: Track | null;
  center: boolean;
  expanded: boolean;
  loading: boolean;
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
const MAX_NODES = 40;
const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag

const key = (title: string, artist: string) =>
  `${title}|${artist}`.toLowerCase().replace(/\s+/g, " ").trim();

interface CraftMapProps {
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
  onAnalyze: (title: string, artist: string, prefetched?: Track) => void;
}

export function CraftMap({ analysis, open, onClose, onAnalyze }: CraftMapProps) {
  const nodesRef = useRef<MapNode[]>([]);
  const linksRef = useRef<MapLink[]>([]);
  const simRef = useRef<Simulation<MapNode, MapLink> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tRef = useRef({ k: 1, x: 0, y: 0 }); // pan/zoom transform
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
  const render = useCallback(() => forceTick((t) => t + 1), []);

  const restart = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.nodes(nodesRef.current);
    (sim.force("link") as ReturnType<typeof forceLink<MapNode, MapLink>>).links(linksRef.current);
    sim.alpha(0.9).restart();
  }, []);

  const grow = useCallback(
    async (parent: MapNode, sugg: { title: string; artist: string; why: string }[]) => {
      const existing = new Set(nodesRef.current.map((n) => key(n.title, n.artist)));
      for (const s of sugg) {
        if (nodesRef.current.length >= MAX_NODES) break;
        const k = key(s.title, s.artist);
        if (existing.has(k)) {
          linksRef.current.push({
            source: parent.id,
            target: nodeIdFor(nodesRef.current, k),
            why: s.why,
          });
          continue;
        }
        existing.add(k);
        const node: MapNode = {
          id: `n${nodesRef.current.length}-${k}`,
          title: s.title,
          artist: s.artist,
          cover: null,
          track: null,
          center: false,
          expanded: false,
          loading: false,
          x: (parent.x ?? VW / 2) + (Math.random() - 0.5) * 70,
          y: (parent.y ?? VH / 2) + (Math.random() - 0.5) * 70,
        };
        nodesRef.current.push(node);
        linksRef.current.push({ source: parent.id, target: node.id, why: s.why });
        searchTracks(`${s.title} ${s.artist}`)
          .then((r) => {
            node.cover = r[0]?.cover ?? null;
            node.track = r[0] ?? null;
            render();
          })
          .catch(() => {});
      }
      restart();
      render();
    },
    [restart, render]
  );

  const expand = useCallback(
    async (node: MapNode) => {
      if (node.expanded || node.loading) return;
      node.loading = true;
      render();
      try {
        const sugg = await fetchSuggestions(node.title, node.artist);
        node.expanded = true;
        await grow(node, sugg);
      } catch {
        /* leave unexpanded so it can be retried */
      } finally {
        node.loading = false;
        render();
      }
    },
    [grow, render]
  );

  // seed the graph when opened
  useEffect(() => {
    if (!open) return;
    tRef.current = { k: 1, x: 0, y: 0 };
    const center: MapNode = {
      id: "center",
      title: analysis.track.title,
      artist: analysis.track.artist,
      cover: analysis.track.cover,
      track: analysis.track,
      center: true,
      expanded: true,
      loading: false,
      x: VW / 2,
      y: VH / 2,
      fx: VW / 2,
      fy: VH / 2,
    };
    nodesRef.current = [center];
    linksRef.current = [];

    const sim = forceSimulation<MapNode, MapLink>(nodesRef.current)
      .force("charge", forceManyBody().strength(-620))
      .force(
        "link",
        forceLink<MapNode, MapLink>(linksRef.current)
          .id((d) => d.id)
          .distance(175)
          .strength(0.45)
      )
      .force("center", forceCenter(VW / 2, VH / 2).strength(0.04))
      // bigger collide radius so labels don't pile up on neighbours
      .force("collide", forceCollide<MapNode>((d) => (d.center ? 90 : 78)))
      .on("tick", render);
    simRef.current = sim;

    void grow(center, analysis.explanation.suggestions ?? []);

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [open, analysis, grow, render]);

  // ---------------------------------------------------- pan / zoom / drag

  function toViewBox(cx: number, cy: number): { x: number; y: number } {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function vbToGraph(vb: { x: number; y: number }): { x: number; y: number } {
    const { k, x, y } = tRef.current;
    return { x: (vb.x - x) / k, y: (vb.y - y) / k };
  }

  // wheel-zoom via a non-passive native listener (so preventDefault works)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vb = toViewBox(e.clientX, e.clientY);
      const { k, x, y } = tRef.current;
      const nk = Math.min(3, Math.max(0.4, k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      tRef.current = { k: nk, x: vb.x - nk * ((vb.x - x) / k), y: vb.y - nk * ((vb.y - y) / k) };
      render();
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [open, render]);

  function onNodePointerDown(e: React.PointerEvent, n: MapNode) {
    e.stopPropagation();
    dragRef.current = {
      mode: "node",
      node: n,
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
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
    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY);
      if (dist > DRAG_THRESHOLD) d.moved = true;
    }
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
      void expand(d.node); // a press without movement = a click
    }
  }

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const t = tRef.current;
  const resolve = (end: string | MapNode): MapNode | undefined =>
    typeof end === "string" ? nodes.find((n) => n.id === end) : end;

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
                the craft map<span style={{ color: "var(--accent)" }}>.</span>
              </span>
              <p className="mono-faint" style={{ marginTop: 4 }}>
                click a song to reveal its craft links · drag to move · scroll to zoom
              </p>
            </div>
            <button onClick={onClose} className="mono" style={{ textDecoration: "underline" }}>
              close ✕
            </button>
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
            <g transform={`translate(${t.x}, ${t.y}) scale(${t.k})`}>
              {/* edges */}
              {links.map((l, i) => {
                const s = resolve(l.source);
                const tg = resolve(l.target);
                if (!s || !tg) return null;
                const lit = hover === s.id || hover === tg.id;
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
                      opacity={lit ? 1 : 0.5}
                    />
                    {lit && (
                      <text
                        x={mx}
                        y={my - 5}
                        textAnchor="middle"
                        style={{ fontFamily: "var(--mono)", fontSize: 10, fill: "var(--ink-soft)" }}
                      >
                        {l.why.length > 54 ? l.why.slice(0, 52) + "…" : l.why}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* nodes */}
              {nodes.map((n) => {
                const r = n.center ? 40 : 30;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                  >
                    <clipPath id={`clip-${n.id}`}>
                      <circle r={r} />
                    </clipPath>
                    <circle
                      r={r + 3}
                      fill="none"
                      stroke={n.center || hover === n.id ? "var(--accent)" : "var(--line)"}
                      strokeWidth={n.center ? 2 : 1.5}
                    />
                    <circle r={r} fill="var(--bar)" />
                    {n.cover && (
                      <image
                        href={n.cover}
                        x={-r}
                        y={-r}
                        width={r * 2}
                        height={r * 2}
                        clipPath={`url(#clip-${n.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                    {n.loading && (
                      <circle
                        r={r + 8}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        strokeDasharray="6 8"
                        opacity={0.7}
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="0"
                          to="360"
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
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
                    {hover === n.id && !n.center && (
                      <g
                        transform={`translate(0, ${-r - 16})`}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onAnalyze(n.title, n.artist, n.track ?? undefined);
                        }}
                      >
                        <rect x={-34} y={-13} width={68} height={22} rx={4} fill="var(--ink)" />
                        <text
                          textAnchor="middle"
                          y={2}
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10.5,
                            fill: "var(--canvas)",
                          }}
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

function nodeIdFor(nodes: MapNode[], k: string): string {
  return nodes.find((n) => key(n.title, n.artist) === k)?.id ?? k;
}
