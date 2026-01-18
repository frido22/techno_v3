"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Visualizer from "@/components/Visualizer";

interface HistoryItem {
  id: number;
  prompt: string;
  code: string;
}

// Extract BPM from Strudel code (looks for setcpm(XXX))
function extractBpm(code: string): number {
  const match = code.match(/setcpm\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 130;
}

// Evolution prompts - short, varied, subtle changes
const EVOLUTION_PROMPTS = [
  "tweak the hi-hat pattern slightly",
  "add more reverb to one element",
  "shift the melody notes slightly",
  "adjust a filter cutoff",
  "make the kick punchier",
  "add a subtle percussion layer",
  "vary the bass pattern",
  "change the delay amount",
  "brighten one synth",
  "strip back one element",
  "add pan movement",
  "vary the hat velocities",
  "change one melody note",
  "add swing to the hats",
  "darken the atmosphere",
  "add a new arp note",
  "shift the groove slightly",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [expandedCode, setExpandedCode] = useState<Set<number>>(new Set());
  const [strudelModule, setStrudelModule] = useState<{
    evaluate: (code: string) => Promise<void>;
    hush: () => void;
  } | null>(null);

  // Auto-evolve state
  const [autoEvolve, setAutoEvolve] = useState(false);
  const [evolveInterval, setEvolveInterval] = useState(3); // minutes
  const [timeLeft, setTimeLeft] = useState(0); // seconds until next evolution
  const evolveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const currentCode = activeIndex !== null ? history[activeIndex]?.code : null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          currentCode: currentCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate");
      }

      const newItem: HistoryItem = {
        id: Date.now(),
        prompt: prompt.trim(),
        code: data.code,
      };

      const newIndex = history.length;
      setHistory((prev) => [...prev, newItem]);
      setActiveIndex(newIndex);
      setPrompt("");

      // Auto-play the new mix - no hush() for smooth transition
      const api = await initStrudel();
      if (api) {
        try {
          await api.evaluate(data.code);
          setIsPlaying(true);
        } catch (err) {
          console.error("Auto-play error:", err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  const initStrudel = useCallback(async () => {
    if (strudelModule) return strudelModule;

    setIsLoading(true);
    try {
      const strudelLib = await import("@strudel/web");
      await strudelLib.initStrudel();
      const api = {
        evaluate: strudelLib.evaluate,
        hush: strudelLib.hush,
      };
      setStrudelModule(api);
      return api;
    } catch (err) {
      console.error("Failed to initialize Strudel:", err);
      setError("Failed to initialize audio engine");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [strudelModule]);

  const handlePlay = async (code: string, index: number) => {
    const api = await initStrudel();
    if (api) {
      try {
        api.hush();
        await api.evaluate(code);
        setActiveIndex(index);
        setIsPlaying(true);
      } catch (error) {
        console.error("Playback error:", error);
        setError("Failed to play");
      }
    }
  };

  const handleStop = () => {
    if (strudelModule) {
      strudelModule.hush();
      setIsPlaying(false);
      setAutoEvolve(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleClear = () => {
    handleStop();
    setAutoEvolve(false);
    setHistory([]);
    setActiveIndex(null);
    setExpandedCode(new Set());
    setPrompt("");
  };

  // Auto-evolve: trigger evolution with random prompt
  const triggerEvolve = useCallback(async () => {
    if (!currentCode || isGenerating) return;

    const randomPrompt = EVOLUTION_PROMPTS[Math.floor(Math.random() * EVOLUTION_PROMPTS.length)];
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: randomPrompt,
          currentCode: currentCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to evolve");
      }

      const newItem: HistoryItem = {
        id: Date.now(),
        prompt: randomPrompt,
        code: data.code,
      };

      const newIndex = history.length;
      setHistory((prev) => [...prev, newItem]);
      setActiveIndex(newIndex);

      // Play the evolved mix - no hush() for smooth transition
      if (strudelModule) {
        try {
          await strudelModule.evaluate(data.code);
          setIsPlaying(true);
        } catch (err) {
          console.error("Auto-evolve play error:", err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evolution failed");
      setAutoEvolve(false);
    } finally {
      setIsGenerating(false);
    }
  }, [currentCode, isGenerating, history.length, strudelModule]);

  // Auto-evolve timer effect
  useEffect(() => {
    // Clear existing timers
    if (evolveTimerRef.current) clearTimeout(evolveTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!autoEvolve || !isPlaying || !currentCode) {
      setTimeLeft(0);
      return;
    }

    // Set initial countdown
    const intervalMs = evolveInterval * 60 * 1000;
    setTimeLeft(evolveInterval * 60);

    // Countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Evolution timer
    evolveTimerRef.current = setTimeout(() => {
      triggerEvolve();
    }, intervalMs);

    return () => {
      if (evolveTimerRef.current) clearTimeout(evolveTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoEvolve, isPlaying, currentCode, evolveInterval, triggerEvolve]);

  const toggleCode = (id: number) => {
    setExpandedCode((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-300 p-8 md:p-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-medium text-neutral-100 tracking-tight">
            Minimal Techno
          </h1>
          {history.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Clear
            </button>
          )}
        </header>

        {/* Auto-Evolve Controls */}
        {isPlaying && currentCode && (
          <section className="mb-6 flex items-center gap-4">
            <button
              onClick={() => setAutoEvolve(!autoEvolve)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                autoEvolve
                  ? "bg-neutral-100 text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Auto {autoEvolve ? "On" : "Off"}
            </button>
            {autoEvolve && (
              <>
                <select
                  value={evolveInterval}
                  onChange={(e) => setEvolveInterval(Number(e.target.value))}
                  className="bg-neutral-800 text-neutral-400 text-xs px-2 py-1 rounded border-none focus:outline-none"
                >
                  <option value={1}>1 min</option>
                  <option value={2}>2 min</option>
                  <option value={3}>3 min</option>
                  <option value={5}>5 min</option>
                </select>
                {timeLeft > 0 && !isGenerating && (
                  <span className="text-xs text-neutral-500">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                  </span>
                )}
                {isGenerating && (
                  <span className="text-xs text-neutral-400 animate-pulse">
                    evolving...
                  </span>
                )}
              </>
            )}
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="mb-6 space-y-3">
            {history.map((item, index) => (
              <div
                key={item.id}
                className={`bg-neutral-800/50 rounded-lg transition-colors ${
                  activeIndex === index
                    ? "bg-neutral-800"
                    : ""
                }`}
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    {item.prompt}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleCode(item.id)}
                      className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      {expandedCode.has(item.id) ? "Hide" : "Code"}
                    </button>
                    <button
                      onClick={() => handlePlay(item.code, index)}
                      disabled={isLoading}
                      className="px-3 py-1 text-xs bg-neutral-700 rounded hover:bg-neutral-600 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? "..." : isPlaying && activeIndex === index ? "Restart" : "Play"}
                    </button>
                    {isPlaying && activeIndex === index && (
                      <button
                        onClick={handleStop}
                        className="px-3 py-1 text-xs bg-neutral-700 rounded hover:bg-neutral-600 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
                {expandedCode.has(item.id) && (
                  <div className="px-4 pb-3 overflow-x-auto">
                    <pre className="text-xs text-neutral-500 font-mono whitespace-pre leading-relaxed">
                      {item.code}
                    </pre>
                  </div>
                )}
                {isPlaying && activeIndex === index && (
                  <div className="px-4 pb-3">
                    <Visualizer isPlaying={true} bpm={extractBpm(item.code)} />
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Skeleton Loading */}
        {isGenerating && (
          <section className="mb-6">
            <div className="bg-neutral-800/50 rounded-lg">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="h-3 w-40 bg-neutral-700 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-6 w-12 bg-neutral-700/50 rounded animate-pulse" />
                  <div className="h-6 w-12 bg-neutral-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Input Section */}
        <section>
          <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
            {history.length > 0 ? "Refine the mix" : "Describe your sound"}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              history.length > 0
                ? "add more hi-hats, make it faster, add reverb..."
                : "dark minimal techno for a 2 hour work session..."
            }
            className="w-full h-20 px-4 py-3 bg-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none border-none resize-none text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-2 px-4 py-2 bg-neutral-100 text-neutral-900 text-sm font-medium rounded-lg hover:bg-white disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? "Generating..." : history.length > 0 ? "Refine" : "Generate"}
          </button>
        </section>

      </div>
    </main>
  );
}
