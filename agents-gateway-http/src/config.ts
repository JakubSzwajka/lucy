import { resolveDataDir } from "agents-runtime";

export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
export const DATA_DIR = resolveDataDir();
