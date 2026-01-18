"use client";

import { useEffect, useRef } from "react";

export default function Visualizer({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const barCount = 48;
    const gap = 2;
    const barWidth = (canvas.width - (barCount - 1) * gap) / barCount;
    if (barsRef.current.length === 0) {
      barsRef.current = new Array(barCount).fill(0);
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 80;

      for (let i = 0; i < barCount; i++) {
        const lowFreq = i < 8;
        const midFreq = i >= 8 && i < 24;
        const highFreq = i >= 24;

        let target = 0;
        if (lowFreq) {
          target = Math.abs(Math.sin(time * 1.5)) * 0.9 + Math.random() * 0.1;
        } else if (midFreq) {
          target = Math.sin(time * 0.8 + i * 0.2) * 0.3 + 0.4 + Math.random() * 0.15;
        } else if (highFreq) {
          target = Math.abs(Math.sin(time * 3 + i * 0.5)) * 0.5 + Math.random() * 0.3;
        }

        target = Math.min(1, target) * canvas.height * 0.9;
        barsRef.current[i] += (target - barsRef.current[i]) * 0.25;

        const h = barsRef.current[i];
        const x = i * (barWidth + gap);

        ctx.fillStyle = "#525252";
        ctx.fillRect(x, canvas.height - h, barWidth, h);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={576}
      height={40}
      className="w-full h-10"
    />
  );
}
