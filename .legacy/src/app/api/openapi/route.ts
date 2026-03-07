import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/server/openapi/spec";

export async function GET() {
  return NextResponse.json(openApiSpec);
}
