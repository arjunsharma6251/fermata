"""Analysis cache — SQLite, keyed on normalized (artist, title, duration).

Same song never pays for a second LLM call. This is the whole cost story
for v1, so the cache sits in front of the entire analyze pipeline.
"""

import json
import re
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "cache" / "fermata.db"


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
    return conn


def cache_key(artist: str, title: str, duration: int) -> str:
    norm = lambda s: re.sub(r"\W+", " ", s.lower()).strip()
    return f"{norm(artist)}|{norm(title)}|{duration}"


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
