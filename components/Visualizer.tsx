"use client";

import { useEffect, useRef } from "react";

interface VisualizerProps {
  isPlaying: boolean;
  bpm?: number;
}

export default function Visualizer({ isPlaying, bpm = 130 }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const smoothedRef = useRef<number[]>(new Array(128).fill(0));
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      const fadeOut = () => {
        let hasValue = false;
        for (let i = 0; i < smoothedRef.current.length; i++) {
          smoothedRef.current[i] *= 0.9;
          if (Math.abs(smoothedRef.current[i]) > 0.01) hasValue = true;
        }
        drawWave(ctx, canvas, smoothedRef.current);
        if (hasValue) {
          requestAnimationFrame(fadeOut);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
      fadeOut();
      return;
    }

    // Calculate phase increment based on BPM
    // At 60fps, increment = (2 * PI * BPM) / (60 * 60) for one cycle per beat
    const baseIncrement = (Math.PI * bpm) / 1800;

    const draw = () => {
      phaseRef.current += baseIncrement;
      const points = 128;

      for (let i = 0; i < points; i++) {
        const n = i / points;
        // Multiple wave frequencies for more interesting visualization
        const target =
          Math.sin(n * Math.PI * 4 + phaseRef.current) * 0.35 +
          Math.sin(n * Math.PI * 8 - phaseRef.current * 2) * 0.2 +
          Math.sin(n * Math.PI * 2 + phaseRef.current * 0.5) * 0.25;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.15;
      }

      drawWave(ctx, canvas, smoothedRef.current);
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, bpm]);

  function drawWave(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height / 2;
    const amplitude = canvas.height * 0.35;

    ctx.beginPath();

    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * canvas.width;
      const y = centerY - values[i] * amplitude;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = "#525252";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={40}
      className="w-full h-10"
    />
  );
}
