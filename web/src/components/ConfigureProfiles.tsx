"use client";

import { LinkedInProfile } from "@/lib/types";

interface Props {
  profiles: LinkedInProfile[];
  setProfiles: (p: LinkedInProfile[]) => void;
}

export function ConfigureProfiles({ profiles, setProfiles }: Props) {
  function updateProfile(index: number, field: keyof LinkedInProfile, value: string) {
    const updated = [...profiles];
    updated[index] = { ...updated[index], [field]: value };
    setProfiles(updated);
  }

  function removeProfile(index: number) {
    setProfiles(profiles.filter((_, i) => i !== index));
  }

  function addProfile() {
    setProfiles([...profiles, { name: "", linkedin_url: "", category: "" }]);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Configure LinkedIn Profiles</h2>
      <p className="text-gray-500 mb-8">
        Add the LinkedIn top voices you want to study. We&apos;ll scrape their posts and analyze what makes them perform.
      </p>

      <div className="space-y-4">
        {profiles.map((profile, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => updateProfile(i, "name", e.target.value)}
                  placeholder="Dakota Robertson"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="col-span-6">
                <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn URL</label>
                <input
                  value={profile.linkedin_url}
                  onChange={(e) => updateProfile(i, "linkedin_url", e.target.value)}
                  placeholder="https://www.linkedin.com/in/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <input
                  value={profile.category}
                  onChange={(e) => updateProfile(i, "category", e.target.value)}
                  placeholder="tech"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="col-span-1 flex items-end">
                <button
                  onClick={() => removeProfile(i)}
                  className="w-full py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addProfile}
        className="mt-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full"
      >
        + Add Profile
      </button>
    </div>
  );
}
