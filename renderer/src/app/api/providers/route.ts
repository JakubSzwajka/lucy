import { NextResponse } from "next/server";
import { getAvailableProviders } from "@/lib/ai/providers";

export async function GET() {
  const providers = getAvailableProviders();
  return NextResponse.json(providers);
}
