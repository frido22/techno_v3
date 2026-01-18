"use client";

import { useEffect, useRef } from "react";

export default function Visualizer({ isPlaying }: { isPlaying: boolean }) {
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

    const draw = () => {
      phaseRef.current += 0.02;
      const points = 128;

      for (let i = 0; i < points; i++) {
        const n = i / points;
        const target =
          Math.sin(n * Math.PI * 3 + phaseRef.current) * 0.4 +
          Math.sin(n * Math.PI * 5 - phaseRef.current * 0.7) * 0.25 +
          Math.sin(n * Math.PI * 2 + phaseRef.current * 1.3) * 0.15;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.1;
      }

      drawWave(ctx, canvas, smoothedRef.current);
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

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
