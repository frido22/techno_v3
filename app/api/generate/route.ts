import { NextResponse } from "next/server";
import { STRUDEL_SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(request: Request) {
  try {
    const { prompt, currentCode } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const messages: { role: string; content: string }[] = [
      { role: "system", content: STRUDEL_SYSTEM_PROMPT },
    ];

    // If there's existing code, include it as context for refinement
    if (currentCode) {
      messages.push({
        role: "assistant",
        content: currentCode,
      });
      messages.push({
        role: "user",
        content: `Modify the code above: ${prompt}`,
      });
    } else {
      messages.push({
        role: "user",
        content: prompt,
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "z-ai/glm-4.7",
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter error:", error);
      throw new Error("API request failed");
    }

    const data = await response.json();
    const code = data.choices[0]?.message?.content?.trim() || "";

    // Clean up any markdown code blocks if present
    const cleanCode = code
      .replace(/^```(?:javascript|js)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return NextResponse.json({ code: cleanCode });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate music code" },
      { status: 500 }
    );
  }
}
