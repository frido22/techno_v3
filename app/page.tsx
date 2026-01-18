"use client";

import { useState, useCallback } from "react";
import Visualizer from "@/components/Visualizer";

interface HistoryItem {
  id: number;
  prompt: string;
  code: string;
}

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

      setHistory((prev) => [...prev, newItem]);
      setActiveIndex(history.length);
      setPrompt("");
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
    setHistory([]);
    setActiveIndex(null);
    setExpandedCode(new Set());
    setPrompt("");
  };

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
                    <Visualizer isPlaying={true} />
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
