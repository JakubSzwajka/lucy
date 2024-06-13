import { z } from 'zod';
import { config } from 'dotenv';
/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */

config();

const api = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.string().default('3000'),
  OPENAI_API_KEY: z.string(),
  SLACK_BOT_TOKEN: z.string(),
  SLACK_APP_LEVEL_TOKEN: z.string(),
  AUTH_TOKEN: z.string(),
  DB_HOST: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z.string(),
  DB_CA_CERT: z.string().optional(),
  TODOIST_API_KEY: z.string(),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SLACK_APP_LEVEL_TOKEN: process.env.SLACK_APP_LEVEL_TOKEN,
  AUTH_TOKEN: process.env.AUTH_TOKEN,
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: process.env.DB_PORT,
  DB_CA_CERT: Buffer.from(process.env.DB_CA_CERT || '', 'base64').toString(),
  TODOIST_API_KEY: process.env.TODOIST_API_KEY,
};

type ApiSchemaInput = z.infer<typeof api>;
type ApiSchemaOutput = z.infer<typeof api>;
type ApiSafeParseReturn = z.SafeParseReturnType<
  ApiSchemaInput,
  ApiSchemaOutput
>;

let env = process.env as ApiSchemaOutput;

const skip =
  process.env.SKIP_ENV_VALIDATION === 'true' ||
  process.env.SKIP_ENV_VALIDATION === '1';

if (!skip) {
  const parsed: ApiSafeParseReturn = api.safeParse(processEnv);

  if (parsed.success === false) {
    const errors = parsed.error.flatten().fieldErrors;
    console.error('❌ Invalid environment variables:', JSON.stringify(errors));
    throw new Error(`Invalid environment variables ${JSON.stringify(errors)}`);
  }

  env = new Proxy(parsed.data, {
    get(target, prop) {
      return target[/** @type {keyof typeof target} */ prop];
    },
  });
}

export { env };
