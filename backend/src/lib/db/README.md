# DB Module

Drizzle Postgres schema and DB singleton.

## Public API

- `db` from `index.ts`
- typed table/schema exports from `schema.ts`

## Use It Like This

```ts
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

const rows = await db.select().from(sessions);
```

## Responsibility Boundary

This module defines storage shape and access primitive.
Business semantics belong in repository/service/capability modules.
