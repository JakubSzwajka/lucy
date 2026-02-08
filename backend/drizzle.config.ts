import { defineConfig } from "drizzle-kit";

const provider = process.env.DATABASE_PROVIDER || "sqlite";

export default provider === "postgres"
  ? defineConfig({
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: { url: process.env.DATABASE_URL! },
    })
  : defineConfig({
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url: "./lucy.db" },
    });
