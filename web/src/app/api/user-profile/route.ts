import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // Read from config/user_profile.json at the repo root
    // On Vercel, this file is bundled at build time
    const filePath = join(process.cwd(), "..", "config", "user_profile.json");
    const data = readFileSync(filePath, "utf-8");
    const profile = JSON.parse(data);

    // Only return if the profile has been filled out (name is set)
    if (profile.name) {
      return NextResponse.json({ profile, source: "config" });
    }

    return NextResponse.json({ profile: null, source: "none" });
  } catch {
    return NextResponse.json({ profile: null, source: "none" });
  }
}
