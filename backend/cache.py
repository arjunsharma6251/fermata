"""Analysis cache — SQLite, keyed on normalized (artist, title, duration).

Same song never pays for a second LLM call. This is the whole cost story
for v1, so the cache sits in front of the entire analyze pipeline.
"""

import json
import os
import re
import sqlite3
import time
from pathlib import Path

_CACHE_DIR = Path(
    os.environ.get("FERMATA_CACHE_DIR", Path(__file__).resolve().parent.parent / "cache")
)
DB_PATH = _CACHE_DIR / "fermata.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS analyses ("
        "  key TEXT PRIMARY KEY,"
        "  result TEXT NOT NULL,"
        "  created_at REAL NOT NULL"
        ")"
    )
    # craft-map suggestions, keyed on (artist, title) — independent of the
    # full analysis so the map can expand a node without analyzing it
    conn.execute(
        "CREATE TABLE IF NOT EXISTS suggestions ("
        "  key TEXT PRIMARY KEY,"
        "  result TEXT NOT NULL,"
        "  created_at REAL NOT NULL"
        ")"
    )
    return conn


def _norm(s: str) -> str:
    return re.sub(r"\W+", " ", s.lower()).strip()


def cache_key(artist: str, title: str, duration: int) -> str:
    return f"{_norm(artist)}|{_norm(title)}|{duration}"


def suggest_key(artist: str, title: str) -> str:
    return f"{_norm(artist)}|{_norm(title)}"


def get(key: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT result FROM analyses WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def put(key: str, result: dict) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO analyses (key, result, created_at) VALUES (?, ?, ?)",
            (key, json.dumps(result), time.time()),
        )


def get_suggest(key: str) -> list | None:
    with _connect() as conn:
        row = conn.execute("SELECT result FROM suggestions WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def put_suggest(key: str, result: list) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO suggestions (key, result, created_at) VALUES (?, ?, ?)",
            (key, json.dumps(result), time.time()),
        )
