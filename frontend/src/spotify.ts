// Spotify playlist onboarding (spec Phase 3) — an alternate way IN, not a
// data source: picked tracks are matched to Deezer and run through the
// normal pipeline. Authorization Code + PKCE, fully client-side, no secret.
// The whole feature is gated on VITE_SPOTIFY_CLIENT_ID being set.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const SCOPES = "playlist-read-private playlist-read-collaborative";
const TOKEN_KEY = "fermata.spotify.token";
const VERIFIER_KEY = "fermata.spotify.verifier";
const STATE_KEY = "fermata.spotify.state";

export const spotifyEnabled = Boolean(CLIENT_ID);

export interface SpotifyPlaylist {
  id: string;
  name: string;
  cover: string | null;
  trackCount: number;
  /** Spotify blocks dev-mode apps from reading its own curated playlists. */
  spotifyOwned: boolean;
}

export interface SpotifyTrack {
  title: string;
  artist: string;
  durationS: number;
  cover: string | null;
}

function redirectUri(): string {
  return `${window.location.origin}/`;
}

function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Redirect to Spotify's consent page. */
export async function beginAuth(): Promise<void> {
  if (!CLIENT_ID) return;
  // Spotify rejects http://localhost redirect URIs as insecure but allows
  // the loopback IP. localhost and 127.0.0.1 are different origins (the
  // PKCE verifier in sessionStorage wouldn't survive the round-trip), so
  // hop onto 127.0.0.1 first and resume there via ?spotify=connect.
  if (window.location.hostname === "localhost") {
    window.location.href = `http://127.0.0.1:${window.location.port}/?spotify=connect`;
    return;
  }
  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: await pkceChallenge(verifier),
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/** If the URL carries a Spotify auth code, exchange it for a token.
 *  Returns true when a fresh token was stored. Cleans the URL either way. */
export async function handleCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  const cleanUrl = () => window.history.replaceState({}, "", window.location.pathname);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!CLIENT_ID || !verifier || params.get("state") !== expectedState) {
    cleanUrl();
    return false;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  cleanUrl();
  if (!res.ok) return false;
  const body = (await res.json()) as { access_token: string; expires_in: number };
  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 })
  );
  return true;
}

export function getToken(): string | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: number };
    return Date.now() < expiresAt - 30_000 ? token : null;
  } catch {
    return null;
  }
}

async function spotifyGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error("spotify session expired — connect again");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`spotify ${res.status}: ${body.slice(0, 200) || "(no detail)"}`);
  }
  return res.json();
}

export async function listPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const body = (await spotifyGet(token, "/me/playlists?limit=50")) as {
    items: ({
      id: string;
      name: string;
      images: { url: string }[] | null;
      // pre-March-2026 API calls this "tracks"; the migration renamed it
      tracks: { total: number } | null;
      items: { total: number } | null;
      owner: { id: string } | null;
    } | null)[];
  };
  return body.items
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      cover: p.images?.[0]?.url ?? null,
      trackCount: p.tracks?.total ?? p.items?.total ?? 0,
      spotifyOwned: p.owner?.id === "spotify",
    }));
}

export async function listPlaylistTracks(
  token: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  // March 2026 API migration: /playlists/{id}/tracks is gone for dev-mode
  // apps (403); the replacement is /playlists/{id}/items with the inner
  // "track" field renamed to "item". Fall back to the old endpoint for
  // apps still on the legacy API, and parse both shapes.
  let body: unknown;
  try {
    body = await spotifyGet(token, `/playlists/${playlistId}/items?limit=100`);
  } catch (err) {
    if (err instanceof Error && /spotify (403|404)/.test(err.message)) {
      body = await spotifyGet(token, `/playlists/${playlistId}/tracks?limit=100`);
    } else {
      throw err;
    }
  }
  interface ItemShape {
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { images: { url: string }[] | null } | null;
  }
  const typed = body as {
    items: ({ item?: ItemShape | null; track?: ItemShape | null } | null)[];
  };
  return typed.items
    .map((i) => i?.item ?? i?.track ?? null)
    .filter((t): t is ItemShape => t !== null)
    .map((t) => ({
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      durationS: Math.round(t.duration_ms / 1000),
      cover: t.album?.images?.[0]?.url ?? null,
    }));
}
