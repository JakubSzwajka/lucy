import { z } from 'zod';
import { config } from 'dotenv';
/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */

config();

const api = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  OPENAI_API_KEY: z.string(),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
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
