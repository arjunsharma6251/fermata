// Your discovery map — a persistent graph of the songs you've analyzed and
// the craft links between them, accumulated across sessions in localStorage.
// Nodes you've analyzed are "visited" (they carry their own accent color);
// their suggestions are "frontier" nodes waiting to be explored.

export interface DiscoverySong {
  key: string;
  title: string;
  artist: string;
  cover: string | null;
}
export interface DiscoveryNode extends DiscoverySong {
  analyzed: boolean;
  accent: string | null;
  analyzedAt: number | null;
}
export interface DiscoveryLink {
  from: string;
  to: string;
  why: string;
}

interface Store {
  songs: Record<string, DiscoverySong>;
  analyzed: Record<string, { accent: string | null; at: number }>;
  links: DiscoveryLink[];
}

const STORAGE_KEY = "fermata.discovery.v1";
const EMPTY: Store = { songs: {}, analyzed: {}, links: [] };

export const songKey = (title: string, artist: string) =>
  `${title}|${artist}`.toLowerCase().replace(/\s+/g, " ").trim();

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY);
    const s = JSON.parse(raw) as Store;
    return { songs: s.songs ?? {}, analyzed: s.analyzed ?? {}, links: s.links ?? [] };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — the map just won't persist */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function addLink(s: Store, from: string, to: string, why: string) {
  if (from === to) return;
  const existing = s.links.find((l) => l.from === from && l.to === to);
  if (existing) {
    if (why && !existing.why) existing.why = why;
  } else {
    s.links.push({ from, to, why });
  }
}

/** A fully-analyzed song: marks it visited (with its accent) and records its
 *  craft-linked suggestions as frontier nodes + edges. */
export function recordAnalysis(
  song: DiscoverySong,
  accent: string | null,
  suggestions: { title: string; artist: string; why: string }[]
) {
  const s = load();
  s.songs[song.key] = { ...s.songs[song.key], ...song };
  s.analyzed[song.key] = { accent, at: Date.now() };
  for (const sg of suggestions) {
    const k = songKey(sg.title, sg.artist);
    if (!s.songs[k]) s.songs[k] = { key: k, title: sg.title, artist: sg.artist, cover: null };
    addLink(s, song.key, k, sg.why);
  }
  save(s);
}

/** Map-side expansion of a node (cheap /api/suggest) — adds frontier links
 *  without marking the parent analyzed. */
export function recordLinks(
  fromKey: string,
  suggestions: { title: string; artist: string; why: string }[]
) {
  const s = load();
  for (const sg of suggestions) {
    const k = songKey(sg.title, sg.artist);
    if (!s.songs[k]) s.songs[k] = { key: k, title: sg.title, artist: sg.artist, cover: null };
    addLink(s, fromKey, k, sg.why);
  }
  save(s);
}

export function setCover(key: string, cover: string | null) {
  if (!cover) return;
  const s = load();
  if (s.songs[key] && !s.songs[key].cover) {
    s.songs[key].cover = cover;
    save(s);
  }
}

export function getGraph(): { nodes: DiscoveryNode[]; links: DiscoveryLink[] } {
  const s = load();
  const nodes = Object.values(s.songs).map((song) => ({
    ...song,
    analyzed: !!s.analyzed[song.key],
    accent: s.analyzed[song.key]?.accent ?? null,
    analyzedAt: s.analyzed[song.key]?.at ?? null,
  }));
  // only links whose endpoints both exist
  const ids = new Set(nodes.map((n) => n.key));
  const links = s.links.filter((l) => ids.has(l.from) && ids.has(l.to));
  return { nodes, links };
}

export function stats(): { explored: number; frontier: number; links: number } {
  const { nodes, links } = getGraph();
  const explored = nodes.filter((n) => n.analyzed).length;
  return { explored, frontier: nodes.length - explored, links: links.length };
}

export function clearDiscovery() {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}
