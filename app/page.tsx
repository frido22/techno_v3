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
    } catch (error) {
      console.error("Failed to initialize Strudel:", error);
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
    setPrompt("");
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-300 p-8 md:p-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-neutral-100 tracking-tight">
              Minimal Techno
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              AI-generated techno patterns
            </p>
          </div>
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
          <section className="mb-8 space-y-3">
            {history.map((item, index) => (
              <div
                key={item.id}
                className={`border bg-neutral-800/50 transition-colors ${
                  activeIndex === index
                    ? "border-neutral-500"
                    : "border-neutral-700"
                }`}
              >
                <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    {item.prompt}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlay(item.code, index)}
                      disabled={isLoading}
                      className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? "..." : isPlaying && activeIndex === index ? "Restart" : "Play"}
                    </button>
                    {isPlaying && activeIndex === index && (
                      <button
                        onClick={handleStop}
                        className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-neutral-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {item.code}
                  </pre>
                </div>
                {isPlaying && activeIndex === index && (
                  <div className="border-t border-neutral-700 bg-neutral-900/50 p-3">
                    <Visualizer isPlaying={true} />
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Skeleton Loading */}
        {isGenerating && (
          <section className="mb-8">
            <div className="border border-neutral-700 bg-neutral-800/50">
              <div className="px-4 py-3 border-b border-neutral-700">
                <div className="h-3 w-32 bg-neutral-700 animate-pulse" />
              </div>
              <div className="p-4 space-y-2">
                <div className="h-3 w-full bg-neutral-700/50 animate-pulse" />
                <div className="h-3 w-4/5 bg-neutral-700/50 animate-pulse" />
                <div className="h-3 w-3/4 bg-neutral-700/50 animate-pulse" />
                <div className="h-3 w-5/6 bg-neutral-700/50 animate-pulse" />
              </div>
            </div>
          </section>
        )}

        {/* Input Section */}
        <section>
          <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-3">
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
            className="w-full h-20 px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 resize-none text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-3 px-4 py-2 bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? "Generating..." : history.length > 0 ? "Refine" : "Generate"}
          </button>
        </section>

      </div>
    </main>
  );
}
