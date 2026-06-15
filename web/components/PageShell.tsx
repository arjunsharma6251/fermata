// Shared editorial chrome for the server-rendered content pages (tours,
// daily). The wordmark links home; content sits in a centered column.

import Link from "next/link";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="col" style={{ paddingTop: 28, paddingBottom: 120 }}>
      <header style={{ marginBottom: 48 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 620,
              fontSize: 22,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            fermata<span style={{ color: "var(--accent)" }}>.</span>
          </span>
        </Link>
      </header>
      {children}
    </div>
  );
}
