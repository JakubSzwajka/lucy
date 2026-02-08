# Lucy Backend Separation Migration Specification

**Version:** 1.0
**Date:** 2026-02-08
**Status:** Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Migration Phases](#migration-phases)
4. [Technical Specifications](#technical-specifications)
5. [Security & Authentication](#security--authentication)
6. [Database Migration](#database-migration)
7. [Deployment Strategy](#deployment-strategy)
8. [Testing & Validation](#testing--validation)
9. [Rollback Plan](#rollback-plan)
10. [Appendix](#appendix)

---

## Executive Summary

### Current State
Lucy is a monolithic Electron desktop application with an embedded Next.js server, local SQLite database, and direct AI provider integrations. All business logic, data, and API keys are managed client-side.

### Target State
Lucy will be split into two components:
1. **Backend API Server** - Deployed cloud service (Next.js App Router) handling all business logic, AI integrations, and data persistence
2. **Desktop Frontend** - Lightweight Electron app serving static React UI that communicates with the backend

### Key Benefits
- Centralized API key management (security)
- Multi-device synchronization
- Easier backend updates without app distribution
- Foundation for future web version
- Improved scalability

### Timeline Estimate
- **Phase 1-2**: 2-3 weeks (Backend extraction & setup)
- **Phase 3**: 1 week (Authentication)
- **Phase 4**: 1 week (Database migration)
- **Phase 5**: 1-2 weeks (Frontend integration)
- **Phase 6**: 1 week (Deployment & testing)

**Total: 6-8 weeks**

---

## Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────┐
│           Electron Desktop App                  │
│  ┌──────────────┐      ┌──────────────────┐    │
│  │ Main Process │─────▶│ Next.js Server   │    │
│  │              │      │ (localhost:3000) │    │
│  │              │      │ - API Routes     │    │
│  │              │      │ - Pages          │    │
│  └──────────────┘      │ - SQLite         │    │
│         │              └──────────────────┘    │
│         ▼                                       │
│  ┌──────────────────┐                          │
│  │  BrowserWindow   │                          │
│  │  (React UI)      │                          │
│  └──────────────────┘                          │
│                                                 │
│  SQLite: ~/Library/Application Support/Lucy/   │
└─────────────────────────────────────────────────┘
```

### Target Architecture

```
┌────────────────────────┐           ┌─────────────────────────────┐
│  Desktop Frontend      │           │   Backend Server            │
│  (Electron)            │           │   (Next.js App Router)      │
├────────────────────────┤           ├─────────────────────────────┤
│                        │           │                             │
│  ┌──────────────┐      │  HTTPS    │  ┌────────────────────┐    │
│  │ Main Process │      │  API Calls│  │  Next.js Server    │    │
│  │              │      │◄─────────▶│  │                    │    │
│  │ - Window mgmt│      │           │  │ /api/* endpoints   │    │
│  │ - Auth token │      │           │  │ /      landing page│    │
│  │   storage    │      │           │  │                    │    │
│  └──────────────┘      │           │  └────────────────────┘    │
│         │              │           │           │                │
│         ▼              │           │           ▼                │
│  ┌──────────────────┐ │           │  ┌────────────────────┐    │
│  │  Static React UI │ │           │  │  PostgreSQL        │    │
│  │  (No server)     │ │           │  │  (or PlanetScale)  │    │
│  └──────────────────┘ │           │  └────────────────────┘    │
└────────────────────────┘           └─────────────────────────────┘
     Local install                    Deployed on Vercel/Railway
```

---

## Migration Phases

### Phase 1: Backend Project Setup & Extraction

**Goal:** Create standalone Next.js backend with all API logic

#### 1.1 Create New Backend Repository

```bash
# Project structure
lucy-backend/
├── .env.example
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
├── drizzle.config.ts
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── verify/route.ts
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── chat/route.ts
│   │   │   ├── providers/route.ts
│   │   │   ├── settings/route.ts
│   │   │   ├── system-prompts/
│   │   │   ├── mcp-servers/
│   │   │   ├── tools/route.ts
│   │   │   └── health/route.ts
│   │   └── globals.css
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── services/
│   │   │   ├── chat/
│   │   │   ├── session/
│   │   │   └── agent/
│   │   ├── providers/
│   │   │   ├── anthropic.ts
│   │   │   ├── google.ts
│   │   │   └── openai.ts
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   ├── middleware.ts
│   │   │   └── types.ts
│   │   └── utils/
│   └── middleware.ts                # Global auth middleware
├── public/
└── drizzle/                        # Migrations
```

#### 1.2 Dependencies

```json
{
  "name": "lucy-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.23",
    "@ai-sdk/google": "^3.0.13",
    "@ai-sdk/openai": "^3.0.23",
    "@ai-sdk/mcp": "^1.0.13",
    "@modelcontextprotocol/sdk": "^1.25.3",
    "ai": "^6.0.67",
    "next": "^16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "drizzle-orm": "^0.45.1",
    "@vercel/postgres": "^0.12.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^4.3.6",
    "nanoid": "^5.1.6"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/bcrypt": "^5.0.2",
    "typescript": "^5",
    "drizzle-kit": "^0.31.8"
  }
}
```

#### 1.3 Migration Checklist

- [ ] Copy all API routes from `renderer/src/app/api/**` to `lucy-backend/src/app/api/**`
- [ ] Copy all services from `renderer/src/lib/services/` to `lucy-backend/src/lib/services/`
- [ ] Copy database schema from `renderer/src/lib/db/` to `lucy-backend/src/lib/db/`
- [ ] Copy AI providers from `renderer/src/lib/providers/` to `lucy-backend/src/lib/providers/`
- [ ] Update all import paths (`@/` alias should work in new project)
- [ ] Remove Electron-specific code (IPC handlers, file system paths)
- [ ] Add environment variable validation

#### 1.4 Configuration Files

**next.config.js**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for containerization
  output: "standalone",

  // Disable image optimization for landing page
  images: {
    unoptimized: true,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'Lucy AI',
  },
};

module.exports = nextConfig;
```

**drizzle.config.ts**
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**.env.example**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lucy

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OPENAI_API_KEY=sk-...

# App
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:8888,lucy://

# Optional: Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

---

### Phase 2: Landing Page & Public Routes

**Goal:** Create a public-facing landing page and health check endpoints

#### 2.1 Landing Page

**src/app/page.tsx**
```typescript
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lucy AI</h1>
          <div className="space-x-4">
            <Link href="/docs" className="hover:text-gray-300">
              Docs
            </Link>
            <Link href="/api/health" className="hover:text-gray-300">
              Status
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6">
            Your AI Assistant, Everywhere
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Lucy brings the power of Claude, GPT, and Gemini to your desktop.
            Multi-agent workflows, local-first privacy, seamless sync.
          </p>
          <div className="space-x-4">
            <a
              href="/download"
              className="inline-block bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold"
            >
              Download for macOS
            </a>
            <a
              href="/api/docs"
              className="inline-block bg-gray-800 hover:bg-gray-700 px-8 py-3 rounded-lg font-semibold"
            >
              API Documentation
            </a>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Multi-Model Support</h3>
            <p className="text-gray-400">
              Switch between Claude, GPT-4, and Gemini seamlessly.
            </p>
          </div>
          <div className="p-6 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Agent Workflows</h3>
            <p className="text-gray-400">
              Build complex multi-agent systems with ease.
            </p>
          </div>
          <div className="p-6 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Local-First</h3>
            <p className="text-gray-400">
              Your data stays on your device, synced when you want.
            </p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-8 mt-20 border-t border-gray-800">
        <p className="text-center text-gray-500">
          © 2026 Lucy AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
```

#### 2.2 Health Check Endpoint

**src/app/api/health/route.ts**
```typescript
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check database connection
    await db.execute('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'up',
        api: 'up',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```

---

### Phase 3: Authentication System

**Goal:** Implement JWT-based authentication with secure token management

#### 3.1 Database Schema Updates

**Add users table to schema.ts:**
```typescript
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Update sessions to include userId
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  rootAgentId: text('root_agent_id'),
  // ... rest of fields
});

// Update other tables to include userId for multi-tenancy
```

**For PostgreSQL (production):**
```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

#### 3.2 JWT Utilities

**src/lib/auth/jwt.ts**
```typescript
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return JWTPayloadSchema.parse(decoded);
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
```

#### 3.3 Auth Middleware

**src/lib/auth/middleware.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from './jwt';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ error: NextResponse } | { user: JWTPayload }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

// Middleware for optional auth (public + authenticated routes)
export async function optionalAuth(
  request: NextRequest
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
}
```

#### 3.4 Auth Routes

**src/app/api/auth/login/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { signToken } from '@/lib/auth/jwt';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = LoginSchema.parse(body);

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**src/app/api/auth/register/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { signToken } from '@/lib/auth/jwt';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = RegisterSchema.parse(body);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = nanoid();
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        name,
      })
      .returning();

    // Generate token
    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
    });

    return NextResponse.json(
      {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    // Handle unique constraint violation
    if ((error as any).code === '23505' || (error as any).code === 'SQLITE_CONSTRAINT') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**src/app/api/auth/verify/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);

  if ('error' in authResult) {
    return authResult.error;
  }

  return NextResponse.json({
    valid: true,
    user: authResult.user,
  });
}
```

#### 3.5 Protected Route Example

**src/app/api/sessions/route.ts (updated)**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const { userId } = authResult.user;

  // Only return sessions for authenticated user
  const userSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(sessions.createdAt);

  return NextResponse.json(userSessions);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const { userId } = authResult.user;
  const body = await request.json();

  // Create session with userId
  const newSession = await SessionRepository.create({
    ...body,
    userId, // Ensure session belongs to authenticated user
  });

  return NextResponse.json(newSession, { status: 201 });
}
```

#### 3.6 Global Middleware (Optional)

**src/middleware.ts**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // CORS headers for desktop app
  const response = NextResponse.next();

  const origin = request.headers.get('origin');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

### Phase 4: Database Migration (SQLite → PostgreSQL)

**Goal:** Migrate from local SQLite to production PostgreSQL

#### 4.1 Database Provider Options

| Provider | Pros | Cons | Pricing |
|----------|------|------|---------|
| **Vercel Postgres** | Seamless Vercel integration, auto-scaling | Vendor lock-in | Free tier: 256MB, Paid: $10+/mo |
| **PlanetScale** | Automatic branching, fast, generous free tier | MySQL dialect (not Postgres) | Free tier: 5GB, Paid: $29+/mo |
| **Supabase** | Full Postgres, realtime features, auth | Overhead if not using extras | Free tier: 500MB, Paid: $25+/mo |
| **Railway** | Simple setup, Postgres + hosting | Smaller free tier | Free: $5 credit/mo, Paid: usage-based |
| **Neon** | Serverless Postgres, instant branching | Relatively new | Free tier: 0.5GB, Paid: $19+/mo |

**Recommendation:** Vercel Postgres (if hosting on Vercel) or Neon (best serverless Postgres)

#### 4.2 Schema Migration

**Update drizzle.config.ts:**
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql', // Changed from 'sqlite'
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**Update schema.ts for PostgreSQL:**
```typescript
import { pgTable, text, timestamp, uuid, jsonb, integer } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Sessions table
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  rootAgentId: text('root_agent_id'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Agents table
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  sourceCallId: text('source_call_id'),
  name: text('name'),
  systemPromptId: text('system_prompt_id'),
  model: text('model').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Items table (polymorphic)
export const items = pgTable('items', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'message' | 'tool_call' | 'tool_result' | 'reasoning'
  content: jsonb('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// System prompts table
export const systemPrompts = pgTable('system_prompts', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  isDefault: integer('is_default').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Plans table
export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Plan steps table
export const planSteps = pgTable('plan_steps', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

#### 4.3 Data Migration Script

**scripts/migrate-data.ts**
```typescript
import Database from 'better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from '../src/lib/db/schema';

async function migrateData() {
  console.log('Starting data migration...');

  // Connect to SQLite (source)
  const sqlitePath = process.argv[2] || './lucy.db';
  const sqlite = new Database(sqlitePath, { readonly: true });

  // Connect to PostgreSQL (destination)
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await pgClient.connect();
  const pg = drizzlePg(pgClient, { schema });

  // Migrate users (if needed - or create a default user)
  const defaultUserId = crypto.randomUUID();
  await pg.insert(schema.users).values({
    id: defaultUserId,
    email: 'migrated@user.local',
    passwordHash: 'PLACEHOLDER', // User must reset password
    name: 'Migrated User',
  });

  // Migrate sessions
  const sessions = sqlite.prepare('SELECT * FROM sessions').all();
  for (const session of sessions) {
    await pg.insert(schema.sessions).values({
      ...session,
      userId: defaultUserId,
      tags: session.tags ? JSON.parse(session.tags) : [],
    });
  }

  // Migrate agents
  const agents = sqlite.prepare('SELECT * FROM agents').all();
  for (const agent of agents) {
    await pg.insert(schema.agents).values({
      ...agent,
      userId: defaultUserId,
    });
  }

  // Migrate items
  const items = sqlite.prepare('SELECT * FROM items').all();
  for (const item of items) {
    await pg.insert(schema.items).values({
      ...item,
      userId: defaultUserId,
      content: JSON.parse(item.content),
      metadata: item.metadata ? JSON.parse(item.metadata) : null,
    });
  }

  console.log('Migration complete!');
  await pgClient.end();
  sqlite.close();
}

migrateData().catch(console.error);
```

**Run migration:**
```bash
npx tsx scripts/migrate-data.ts /path/to/lucy.db
```

#### 4.4 Update Database Connection

**src/lib/db/index.ts**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });
```

---

### Phase 5: Frontend Integration

**Goal:** Update desktop app to communicate with backend API

#### 5.1 Update Desktop App Structure

**Changes to make:**
1. Remove embedded Next.js server logic from `main/background.ts`
2. Change Next.js build from `standalone` to `export` (static)
3. Create API client wrapper with auth
4. Add secure token storage in Electron
5. Update all API calls to use backend

#### 5.2 Remove Embedded Server

**main/background.ts (simplified)**
```typescript
import path from "path";
import { app, BrowserWindow, ipcMain } from "electron";
import { createWindow } from "./helpers";

const isProd = process.env.NODE_ENV === "production";
let mainWindow: BrowserWindow | null = null;

async function createMainWindow() {
  mainWindow = createWindow("main", {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isProd) {
    // Serve static files
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  } else {
    // Development mode - webpack dev server
    await mainWindow.loadURL("http://localhost:3000");
  }
}

// IPC Handlers for auth
ipcMain.handle("auth:get-token", async () => {
  // Return stored token from secure storage
  return await getSecureToken();
});

ipcMain.handle("auth:set-token", async (_, token: string) => {
  // Store token securely
  await setSecureToken(token);
});

ipcMain.handle("auth:clear-token", async () => {
  await clearSecureToken();
});

app.on("ready", createMainWindow);
app.on("window-all-closed", () => app.quit());
```

**Add secure token storage using keytar:**
```bash
npm install keytar
```

**main/auth-storage.ts**
```typescript
import keytar from 'keytar';

const SERVICE_NAME = 'lucy-ai';
const ACCOUNT_NAME = 'auth-token';

export async function getSecureToken(): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

export async function setSecureToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
}

export async function clearSecureToken(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
```

#### 5.3 Update Next.js Config

**renderer/next.config.js**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Static export (no server)
  images: {
    unoptimized: true,
  },
  // Custom output directory for Electron
  distDir: isProd ? '../app/renderer' : '.next',
};

module.exports = nextConfig;
```

#### 5.4 API Client with Auth

**renderer/src/lib/api/client.ts**
```typescript
class APIClient {
  private baseURL: string;
  private getToken: () => Promise<string | null>;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Access Electron IPC for token management
    this.getToken = async () => {
      if (typeof window !== 'undefined' && window.electron) {
        return await window.electron.auth.getToken();
      }
      // Fallback for development
      return localStorage.getItem('auth_token');
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      if (window.electron) {
        await window.electron.auth.clearToken();
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    // Store token
    if (window.electron) {
      await window.electron.auth.setToken(result.token);
    } else {
      localStorage.setItem('auth_token', result.token);
    }

    return result;
  }

  async logout() {
    if (window.electron) {
      await window.electron.auth.clearToken();
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  // Session methods
  async getSessions() {
    return this.request('/api/sessions');
  }

  async createSession(data: any) {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Streaming chat
  async chat(sessionId: string, messages: any[], options: any = {}) {
    const token = await this.getToken();

    const response = await fetch(
      `${this.baseURL}/api/sessions/${sessionId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ messages, ...options }),
      }
    );

    if (!response.ok) {
      throw new Error('Chat request failed');
    }

    return response; // Return streaming response
  }
}

export const apiClient = new APIClient();
```

**Preload script types (renderer/src/types/electron.d.ts)**
```typescript
export interface ElectronAPI {
  auth: {
    getToken: () => Promise<string | null>;
    setToken: (token: string) => Promise<void>;
    clearToken: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
```

#### 5.5 Update React Hooks

**renderer/src/hooks/useAuth.ts**
```typescript
import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const { user } = await apiClient.login(email, password);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await apiClient.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const user = await apiClient.request('/api/auth/verify');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
```

**renderer/src/hooks/useSessionChat.ts (updated)**
```typescript
import { useChat } from '@ai-sdk/react';
import { apiClient } from '@/lib/api/client';

export function useSessionChat(sessionId: string) {
  return useChat({
    api: `/api/sessions/${sessionId}/chat`, // Will be proxied to backend
    fetch: async (input, init) => {
      // Use our authenticated API client
      return apiClient.chat(sessionId, init?.body?.messages || []);
    },
  });
}
```

#### 5.6 Login Screen Component

**renderer/src/app/login/page.tsx**
```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Login to Lucy</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 5.7 Build Script Updates

**scripts/build.js (simplified)**
```javascript
async function build() {
  console.log('🚀 Building Lucy Desktop App...\n');

  // Clean
  await fs.remove(APP_DIR);
  await fs.remove(path.join(ROOT, 'dist'));

  // Build Next.js as static export
  console.log('\n📦 Building Next.js (static export)...');
  run('npx next build renderer');

  // Copy static output
  await fs.copy(
    path.join(RENDERER_DIR, 'out'),
    path.join(APP_DIR, 'renderer')
  );

  // Compile main process
  console.log('\n📦 Compiling main process...');
  run('npx tsc');

  // Package with electron-builder
  console.log('\n📦 Packaging Electron app...');
  run('npx electron-builder --config electron-builder.yml');

  console.log('\n✅ Build complete!');
}
```

---

### Phase 6: Deployment

**Goal:** Deploy backend to production and configure desktop app

#### 6.1 Backend Deployment (Vercel)

**vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "JWT_SECRET": "@jwt-secret",
    "ANTHROPIC_API_KEY": "@anthropic-key",
    "GOOGLE_API_KEY": "@google-key",
    "OPENAI_API_KEY": "@openai-key"
  }
}
```

**Deploy:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
# ... add all other secrets

# Deploy
vercel --prod
```

#### 6.2 Alternative: Railway Deployment

**railway.json**
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Deploy:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init

# Add Postgres
railway add

# Set environment variables in dashboard
# railway.app → project → variables

# Deploy
railway up
```

#### 6.3 Database Setup

**For Vercel Postgres:**
```bash
# In Vercel dashboard, add Postgres
# This will create DATABASE_URL automatically

# Run migrations
npx drizzle-kit push
```

**For Railway Postgres:**
```bash
# Add Postgres plugin in Railway dashboard
# Copy DATABASE_URL from plugin

# Run migrations locally
DATABASE_URL="postgresql://..." npx drizzle-kit push
```

#### 6.4 Desktop App Configuration

**renderer/.env.production**
```bash
NEXT_PUBLIC_API_URL=https://api.lucy.app
```

**Update build to include env:**
```javascript
// scripts/build.js
const dotenv = require('dotenv');
const envConfig = dotenv.config({ path: 'renderer/.env.production' }).parsed;

// Write to static file
await fs.writeJson(
  path.join(APP_DIR, 'renderer', 'config.json'),
  { API_URL: envConfig.NEXT_PUBLIC_API_URL }
);
```

#### 6.5 Health Monitoring

**Setup health check monitoring:**
```bash
# Use UptimeRobot, Better Uptime, or Checkly
# Monitor: https://api.lucy.app/api/health
# Alert on: Status != 200 for 2 consecutive checks
```

**Add logging (optional):**
```typescript
// src/lib/logger.ts
import { Logtail } from '@logtail/node';

const logger = process.env.LOGTAIL_TOKEN
  ? new Logtail(process.env.LOGTAIL_TOKEN)
  : console;

export default logger;
```

---

## Security & Authentication

### Security Checklist

- [ ] **Environment Variables**: All secrets in `.env`, never committed
- [ ] **JWT Secret**: Strong random string (min 32 characters)
- [ ] **Password Hashing**: bcrypt with cost factor ≥ 10
- [ ] **CORS**: Whitelist only desktop app origin
- [ ] **Rate Limiting**: Implement for auth endpoints
- [ ] **HTTPS Only**: Enforce SSL in production
- [ ] **SQL Injection**: Use parameterized queries (Drizzle handles this)
- [ ] **XSS Protection**: Sanitize user inputs
- [ ] **CSRF**: Not needed for API-only backend (no cookies)
- [ ] **Token Expiration**: Set reasonable JWT expiry (7 days recommended)
- [ ] **Token Storage**: Use keytar/keychain on desktop, never localStorage
- [ ] **Input Validation**: Zod schemas for all API inputs
- [ ] **Error Messages**: Generic errors, no stack traces to client

### Rate Limiting Implementation

**src/lib/rate-limit.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60000
) {
  return (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const record = rateLimit.get(ip);

    if (!record || now > record.resetAt) {
      rateLimit.set(ip, { count: 1, resetAt: now + windowMs });
      return null;
    }

    if (record.count >= maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    record.count++;
    return null;
  };
}
```

**Use in auth routes:**
```typescript
// src/app/api/auth/login/route.ts
const limiter = rateLimiter(5, 60000); // 5 requests per minute

export async function POST(request: NextRequest) {
  const rateLimitResponse = limiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  // ... rest of login logic
}
```

---

## Testing & Validation

### Backend Tests

**Setup:**
```bash
npm install --save-dev vitest @vitest/ui
```

**vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Test auth flow:**
```typescript
// src/__tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth/jwt';

describe('JWT Auth', () => {
  it('should sign and verify token', () => {
    const payload = { userId: '123', email: 'test@test.com' };
    const token = signToken(payload);
    const verified = verifyToken(token);

    expect(verified).toEqual(payload);
  });

  it('should reject invalid token', () => {
    const verified = verifyToken('invalid-token');
    expect(verified).toBeNull();
  });
});
```

### Integration Tests

**Test API endpoints:**
```typescript
// src/__tests__/api/sessions.test.ts
import { describe, it, expect } from 'vitest';

describe('Sessions API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get token
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    });
    const { token } = await response.json();
    authToken = token;
  });

  it('should create session with auth', async () => {
    const response = await fetch('http://localhost:3000/api/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test Session' }),
    });

    expect(response.status).toBe(201);
    const session = await response.json();
    expect(session.title).toBe('Test Session');
  });

  it('should reject without auth', async () => {
    const response = await fetch('http://localhost:3000/api/sessions');
    expect(response.status).toBe(401);
  });
});
```

### End-to-End Tests

**Setup Playwright:**
```bash
npm install --save-dev @playwright/test
```

**Test desktop app login:**
```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('desktop app login flow', async ({ page }) => {
  await page.goto('http://localhost:8888/login');

  await page.fill('input[type="email"]', 'test@test.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('http://localhost:8888/');
  await expect(page.locator('text=New Chat')).toBeVisible();
});
```

---

## Rollback Plan

### If Migration Fails

1. **Keep old desktop app working**
   - Tag current version before changes: `git tag v0.9.0-pre-migration`
   - Users can revert to old version if backend fails

2. **Dual-mode operation** (recommended)
   - Add environment variable: `USE_EMBEDDED_SERVER=true`
   - Keep embedded Next.js server code in separate branch
   - Allow users to toggle between local/cloud modes

3. **Database backup**
   - Before migration, backup SQLite: `cp lucy.db lucy.db.backup`
   - Provide rollback script to restore local data

4. **Backend rollback**
   - Use Vercel/Railway rollback features
   - Keep previous deployment active
   - DNS/load balancer can point back to old version

---

## Appendix

### A. Environment Variables Reference

**Backend (.env)**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Auth
JWT_SECRET=your-secret-here-min-32-chars
JWT_EXPIRES_IN=7d

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OPENAI_API_KEY=sk-...

# App
NODE_ENV=production
ALLOWED_ORIGINS=lucy://,https://app.lucy.ai

# Optional
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
LOGTAIL_TOKEN=...
```

**Desktop App (.env.production)**
```bash
NEXT_PUBLIC_API_URL=https://api.lucy.app
```

### B. API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/auth/login` | POST | No | User login |
| `/api/auth/register` | POST | No | User registration |
| `/api/auth/verify` | GET | Yes | Verify token |
| `/api/sessions` | GET | Yes | List sessions |
| `/api/sessions` | POST | Yes | Create session |
| `/api/sessions/:id` | GET | Yes | Get session |
| `/api/sessions/:id/chat` | POST | Yes | Chat stream |
| `/api/providers` | GET | Yes | List AI providers |
| `/api/settings` | GET | Yes | Get settings |
| `/api/system-prompts` | GET | Yes | List prompts |
| `/api/mcp-servers` | GET | Yes | List MCP servers |

### C. Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  root_agent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT,
  source_call_id TEXT,
  name TEXT,
  system_prompt_id TEXT,
  model TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Items (polymorphic)
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_agents_session_id ON agents(session_id);
CREATE INDEX idx_items_agent_id ON items(agent_id);
CREATE INDEX idx_items_user_id ON items(user_id);
```

### D. Deployment Commands Cheatsheet

```bash
# Backend (Vercel)
vercel --prod
vercel logs --prod

# Backend (Railway)
railway up
railway logs

# Desktop App
npm run build
# Outputs to dist/Lucy-{version}.dmg

# Database migrations
npx drizzle-kit generate
npx drizzle-kit push

# Run tests
npm test
npm run test:e2e
```

### E. Cost Estimates

**Monthly costs (estimated):**

| Service | Free Tier | Paid (starter) |
|---------|-----------|----------------|
| Vercel Hosting | Unlimited | $20/mo |
| Vercel Postgres | 256MB | $10/mo (2GB) |
| Neon Postgres | 0.5GB | $19/mo (10GB) |
| Railway | $5 credit | ~$10-20/mo |
| Logtail | 1GB/mo | $10/mo (10GB) |
| **Total** | **$0-5** | **$30-60/mo** |

---

## Next Steps

1. **Review this spec** - Ensure all requirements are met
2. **Phase 1 - Start backend extraction** - Create `lucy-backend` repo
3. **Phase 2 - Build landing page** - Simple Next.js pages
4. **Phase 3 - Implement auth** - JWT + protected routes
5. **Phase 4 - Database migration** - SQLite → PostgreSQL
6. **Phase 5 - Update frontend** - Desktop app API client
7. **Phase 6 - Deploy** - Vercel/Railway + test end-to-end

**Questions? Ready to start Phase 1?**
