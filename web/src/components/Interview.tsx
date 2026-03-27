"use client";

import { useState } from "react";
import { UserContext } from "@/lib/types";

const QUESTIONS = [
  { key: "name", question: "What's your name?", help: "Used to personalize your posts" },
  { key: "role", question: "What's your current role and company?", help: "e.g., 'Senior Product Manager at Stripe'" },
  { key: "industry", question: "What industry are you in?", help: "e.g., 'FinTech', 'SaaS', 'Healthcare AI'" },
  { key: "expertise_areas", question: "Top 3-5 areas of expertise", help: "Comma-separated", isList: true },
  { key: "recent_achievements", question: "2-3 recent wins or achievements", help: "Comma-separated", isList: true },
  { key: "opinions", question: "Strong opinions or hot takes about your industry", help: "Comma-separated", isList: true },
  { key: "target_audience", question: "Who is your target audience on LinkedIn?", help: "e.g., 'tech founders, product managers'" },
  { key: "tone_preference", question: "Preferred tone", help: "", isTone: true },
];

interface Props {
  userContext: UserContext | null;
  setUserContext: (ctx: UserContext) => void;
}

export function Interview({ userContext, setUserContext }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (!userContext) {
      return { tone_preference: "professional" } as Record<string, string>;
    }
    return {
      name: userContext.name,
      role: userContext.role,
      industry: userContext.industry,
      expertise_areas: userContext.expertise_areas.join(", "),
      recent_achievements: userContext.recent_achievements.join(", "),
      opinions: userContext.opinions.join(", "),
      target_audience: userContext.target_audience,
      tone_preference: userContext.tone_preference,
    } as Record<string, string>;
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const ctx: UserContext = {
      name: answers.name || "",
      role: answers.role || "",
      industry: answers.industry || "",
      expertise_areas: (answers.expertise_areas || "").split(",").map((s) => s.trim()).filter(Boolean),
      recent_achievements: (answers.recent_achievements || "").split(",").map((s) => s.trim()).filter(Boolean),
      opinions: (answers.opinions || "").split(",").map((s) => s.trim()).filter(Boolean),
      target_audience: answers.target_audience || "",
      tone_preference: answers.tone_preference || "professional",
    };
    setUserContext(ctx);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Tell Us About Yourself</h2>
      <p className="text-gray-500 mb-8">Your answers help generate posts that sound authentically like you.</p>

      <div className="space-y-5 max-w-2xl">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{q.question}</label>
            {q.help && <p className="text-xs text-gray-400 mb-2">{q.help}</p>}

            {q.isTone ? (
              <div className="flex gap-3">
                {["professional", "casual", "bold"].map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setAnswers({ ...answers, tone_preference: tone })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      answers.tone_preference === tone
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            ) : q.isList ? (
              <textarea
                value={answers[q.key] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            ) : (
              <input
                value={answers[q.key] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            )}
          </div>
        ))}

        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {saved ? "Saved!" : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
