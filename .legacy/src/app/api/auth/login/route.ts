export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/db/schema";
import { signToken } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { success } = rateLimit(`login:${ip}`, 5, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (found.length === 0) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const user = found[0];
  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const token = signToken({ userId: user.id, email: user.email });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
