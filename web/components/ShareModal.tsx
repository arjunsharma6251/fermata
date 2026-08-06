"use client";

// Overlay that previews the share card, lets you pick which moment to
// feature, and exports it as a crisp PNG (or native share on mobile).

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toPng } from "html-to-image";
import type { Analysis } from "@/lib/api";
import { toMomentSlug } from "@/lib/slug";
import { ShareCard } from "./ShareCard";

interface ShareModalProps {
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ analysis, open, onClose }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [momentIdx, setMomentIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const moments = analysis.explanation.moments;
  const moment = moments[momentIdx] ?? moments[0];
  const fileName = `fermata-${analysis.track.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  async function render(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    await document.fonts.ready;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#faf8f5",
    });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function onDownload() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${analysis.track.title} — fermata`,
          text: moment.why_it_hits,
        });
      } else {
        await onDownload();
      }
    } catch {
      /* user cancelled share — ignore */
    } finally {
      setBusy(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.canShare;

  // a link that opens the song parked on this exact moment (/m/<slug>),
  // carrying the accent so its OG card wears the song's color
  function onCopyLink() {
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    const url = `${window.location.origin}/m/${toMomentSlug(
      analysis.track.title,
      analysis.track.artist,
      analysis.track.cover,
      moment,
      /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : undefined
    )}`;
    void navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(22, 19, 15, 0.42)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            overflowY: "auto",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
          >
            {/* the card, scaled to fit; captured at full size */}
            <div
              style={{
                transform: "scale(var(--card-scale, 0.82))",
                transformOrigin: "top center",
                boxShadow: "0 24px 60px rgba(22,19,15,0.28)",
                borderRadius: 2,
              }}
            >
              <ShareCard ref={cardRef} analysis={analysis} moment={moment} />
            </div>

            {/* moment selector */}
            {moments.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  maxWidth: 460,
                  marginTop: -80,
                }}
              >
                {moments.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setMomentIdx(i)}
                    className="mono"
                    style={{
                      fontSize: 11,
                      padding: "5px 11px",
                      borderRadius: 3,
                      border: `1px solid ${i === momentIdx ? "var(--accent)" : "var(--line)"}`,
                      color: i === momentIdx ? "var(--accent)" : "var(--canvas)",
                      background: i === momentIdx ? "var(--canvas)" : "rgba(250,248,245,0.12)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {m.moment}
                  </button>
                ))}
              </div>
            )}

            {/* actions */}
            <div style={{ display: "flex", gap: 12 }}>
              {canShare && (
                <button
                  onClick={() => void onShare()}
                  disabled={busy}
                  style={actionStyle(true)}
                >
                  {busy ? "rendering…" : "share"}
                </button>
              )}
              <button onClick={() => void onDownload()} disabled={busy} style={actionStyle(false)}>
                {busy ? "rendering…" : "download png"}
              </button>
              <button onClick={onCopyLink} style={actionStyle(false)}>
                {linkCopied ? "copied ✓" : "copy moment link"}
              </button>
              <button onClick={onClose} style={actionStyle(false)}>
                close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function actionStyle(primary: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--mono)",
    fontSize: 12.5,
    letterSpacing: "0.02em",
    padding: "10px 18px",
    borderRadius: 4,
    cursor: "pointer",
    border: `1px solid ${primary ? "var(--canvas)" : "rgba(250,248,245,0.4)"}`,
    background: primary ? "var(--canvas)" : "transparent",
    color: primary ? "var(--ink)" : "var(--canvas)",
  };
}