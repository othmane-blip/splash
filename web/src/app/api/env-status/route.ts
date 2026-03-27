import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    apify: !!process.env.APIFY_API_TOKEN,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  });
}
