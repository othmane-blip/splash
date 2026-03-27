"use client";

import { useState, useEffect } from "react";
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
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(!userContext);
  const [answers, setAnswers] = useState<Record<string, string>>(() => contextToAnswers(userContext));
  const [saved, setSaved] = useState(false);

  // Auto-load profile from server config if not already set
  useEffect(() => {
    if (userContext) {
      setLoading(false);
      return;
    }

    fetch("/api/user-profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setUserContext(data.profile);
          setAnswers(contextToAnswers(data.profile));
        } else {
          setEditing(true); // No profile yet, show the form
        }
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    const ctx: UserContext = {
      name: answers.name || "",
      role: answers.role || "",
      industry: answers.industry || "",
      expertise_areas: splitList(answers.expertise_areas),
      recent_achievements: splitList(answers.recent_achievements),
      opinions: splitList(answers.opinions),
      target_audience: answers.target_audience || "",
      tone_preference: answers.tone_preference || "professional",
    };
    setUserContext(ctx);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div className="text-gray-400">Loading profile...</div>;
  }

  // Profile exists — show summary view
  if (userContext && !editing) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-2">About You</h2>
        <p className="text-gray-500 mb-6">Your profile is saved. This is used to generate personalized posts.</p>

        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Profile updated!
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <ProfileField label="Name" value={userContext.name} />
          <ProfileField label="Role" value={userContext.role} />
          <ProfileField label="Industry" value={userContext.industry} />
          <ProfileField label="Expertise" value={userContext.expertise_areas.join(", ")} />
          <ProfileField label="Recent achievements" value={userContext.recent_achievements.join(", ")} />
          <ProfileField label="Opinions & hot takes" value={userContext.opinions.join(", ")} />
          <ProfileField label="Target audience" value={userContext.target_audience} />
          <ProfileField label="Tone" value={userContext.tone_preference} />
        </div>

        <button
          onClick={() => {
            setAnswers(contextToAnswers(userContext));
            setEditing(true);
          }}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Edit Profile
        </button>
      </div>
    );
  }

  // No profile or editing — show form
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Tell Us About Yourself</h2>
      <p className="text-gray-500 mb-8">
        Fill this out once. Your answers are saved and used every time you generate posts.
      </p>

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

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Save Profile
          </button>
          {userContext && (
            <button
              onClick={() => setEditing(false)}
              className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value || <span className="text-gray-400 italic">Not set</span>}</dd>
    </div>
  );
}

function contextToAnswers(ctx: UserContext | null): Record<string, string> {
  if (!ctx) return { tone_preference: "professional" };
  return {
    name: ctx.name,
    role: ctx.role,
    industry: ctx.industry,
    expertise_areas: ctx.expertise_areas.join(", "),
    recent_achievements: ctx.recent_achievements.join(", "),
    opinions: ctx.opinions.join(", "),
    target_audience: ctx.target_audience,
    tone_preference: ctx.tone_preference,
  };
}

function splitList(val: string | undefined): string[] {
  return (val || "").split(",").map((s) => s.trim()).filter(Boolean);
}
