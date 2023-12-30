import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */
const api = z.object({
  NOTION_TOKEN: z.string(),
  AUTH_TOKEN: z.string(),
  PROJECTS_DATABASE_ID: z.string(),
  SLACK_BOT_TOKEN: z.string(),
  OPENAI_API_KEY: z.string(),
  OPENAI_THREAD_ID: z.string(),
  OPENAI_ASSISTANT_ID: z.string(),
  PORT: z.string().optional().default("3000"),
});

const processEnv = {
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  AUTH_TOKEN: process.env.AUTH_TOKEN,
  PROJECTS_DATABASE_ID: process.env.PROJECTS_DATABASE_ID,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_THREAD_ID: process.env.OPENAI_THREAD_ID,
  OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID,
  PORT: process.env.PORT,
};

type ApiSchemaInput = z.infer<typeof api>;
type ApiSchemaOutput = z.infer<typeof api>;
type ApiSafeParseReturn = z.SafeParseReturnType<ApiSchemaInput, ApiSchemaOutput>;

let env = process.env as ApiSchemaOutput;

const skip = process.env.SKIP_ENV_VALIDATION === "true" || process.env.SKIP_ENV_VALIDATION === "1";

if (!skip) {
  const parsed: ApiSafeParseReturn = api.safeParse(processEnv);

  if (parsed.success === false) {
    const errors = parsed.error.flatten().fieldErrors;
    console.error("❌ Invalid environment variables:", JSON.stringify(errors));
    throw new Error(`Invalid environment variables ${JSON.stringify(errors)}`);
  }

  env = new Proxy(parsed.data, {
    get(target, prop) {
      return target[prop as keyof typeof target];
    },
  });
}
console.log("✅ Environment variables loaded successfully");
export { env };
