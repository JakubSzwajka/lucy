import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";
import { AuthResult } from "./types";

export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    user: {
      userId: payload.userId,
      email: payload.email,
    },
  };
}

export async function optionalAuth(
  request: NextRequest
): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  return {
    user: {
      userId: payload.userId,
      email: payload.email,
    },
  };
}
