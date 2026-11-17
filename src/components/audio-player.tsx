"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Pause, Play, LoaderCircle } from "lucide-react";
import type WaveSurfer from "wavesurfer.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/types";

export function AudioPlayer({
  assetId,
  label = "音频",
  initialDuration,
}: {
  assetId: string;
  label?: string;
  initialDuration?: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const playbackId = useId();
  const player = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration ?? 0);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setPlaying(false);
    setTime(0);
    import("wavesurfer.js")
      .then(({ default: WaveSurfer }) => {
        if (disposed || !container.current) return;
        const colors = getComputedStyle(document.documentElement);
        const wave = WaveSurfer.create({
          container: container.current,
          url: `/api/assets/${assetId}`,
          waveColor: colors.getPropertyValue("--wave").trim(),
          progressColor: colors.getPropertyValue("--primary").trim(),
          cursorWidth: 0,
          height: 42,
          barWidth: 2,
          barGap: 3,
          barRadius: 2,
          normalize: true,
        });
        player.current = wave;
        wave.on("ready", () => {
          setDuration(wave.getDuration());
          setReady(true);
        });
        wave.on("timeupdate", (value) => setTime(Math.floor(value)));
        wave.on("play", () => {
          setPlaying(true);
          window.dispatchEvent(
            new CustomEvent("mimo:play", { detail: playbackId }),
          );
        });
        wave.on("pause", () => setPlaying(false));
        wave.on("finish", () => setPlaying(false));
        wave.on("error", () => {
          if (!disposed) toast.error("音频加载失败，请刷新后重试。");
        });
      })
      .catch(() => {
        if (!disposed) toast.error("播放器加载失败，请刷新后重试。");
      });
    const pauseOthers = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== playbackId)
        player.current?.pause();
    };
    window.addEventListener("mimo:play", pauseOthers);
    return () => {
      disposed = true;
      player.current?.destroy();
      player.current = null;
      window.removeEventListener("mimo:play", pauseOthers);
    };
  }, [assetId, playbackId]);

  useEffect(() => {
    const colors = getComputedStyle(document.documentElement);
    player.current?.setOptions({
      waveColor: colors.getPropertyValue("--wave").trim(),
      progressColor: colors.getPropertyValue("--primary").trim(),
    });
  }, [resolvedTheme]);

  return (
    <div className="audio-player">
      <Button
        variant="outline"
        size="icon"
        className="play-button"
        disabled={!ready}
        aria-label={`${playing ? "暂停" : "播放"}${label}`}
        onClick={() => {
          void player.current
            ?.playPause()
            .catch(() => toast.error("播放失败，请再点击播放。"));
        }}
      >
        {!ready ? (
          <LoaderCircle className="spin" />
        ) : playing ? (
          <Pause fill="currentColor" />
        ) : (
          <Play fill="currentColor" />
        )}
      </Button>
      <div ref={container} className="waveform" aria-label={`${label}波形`} />
      <span className="audio-time">
        {formatDuration(playing ? time : duration)}
      </span>
    </div>
  );
}
