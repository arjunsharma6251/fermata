// One audio element per preview URL; time updates on rAF while playing so
// the playhead sweeps smoothly instead of stuttering on `timeupdate`.

import { useCallback, useEffect, useRef, useState } from "react";

export interface Player {
  playing: boolean;
  time: number;
  duration: number;
  toggle: () => void;
  seek: (seconds: number) => void;
}

export function usePlayer(src: string | null): Player {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = "auto";
    audioRef.current = audio;
    const onMeta = () => setDuration(audio.duration || 30);
    const onEnd = () => {
      setPlaying(false);
      setTime(0);
      audio.currentTime = 0;
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      setTime(0);
    };
  }, [src]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 30));
    setTime(audio.currentTime);
  }, []);

  return { playing, time, duration, toggle, seek };
}
