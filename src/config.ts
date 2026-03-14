import path from "node:path";

import { ConfigError } from "./errors.js";
import type { RunwayAdapterConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.dev.runwayml.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DATA_ROOT = path.resolve(process.cwd(), "data");

function readEnvString(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value : undefined;
}

function readBoolean(
  value: string | boolean | undefined,
  fallback: boolean,
  key: string,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new ConfigError(`${key} must be "true" or "false".`);
}

function readPositiveInteger(
  value: string | number | undefined,
  fallback: number,
  key: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`${key} must be a positive integer.`);
  }

  return parsed;
}

function readNonNegativeInteger(
  value: string | number | undefined,
  fallback: number,
  key: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ConfigError(`${key} must be a non-negative integer.`);
  }

  return parsed;
}

function readUrl(value: string | undefined, key: string): string {
  if (!value) {
    throw new ConfigError(`${key} is required.`);
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new ConfigError(`${key} must be a valid URL.`);
  }
}

export function resolveRunwayAdapterConfig(
  overrides: Partial<RunwayAdapterConfig> = {},
  env: NodeJS.ProcessEnv = process.env,
): RunwayAdapterConfig {
  const apiKey = overrides.apiKey ?? readEnvString(env, "RUNWAY_API_KEY");

  const baseUrl = readUrl(
    overrides.baseUrl ?? readEnvString(env, "RUNWAY_BASE_URL") ?? DEFAULT_BASE_URL,
    "RUNWAY_BASE_URL",
  );

  const dataRootDir = overrides.dataRootDir ?? DEFAULT_DATA_ROOT;
  const defaultOutputDir = path.resolve(
    overrides.defaultOutputDir ??
      readEnvString(env, "RUNWAY_DEFAULT_OUTPUT_DIR") ??
      path.join(dataRootDir, "generated"),
  );

  return {
    apiKey,
    baseUrl,
    timeoutMs: readPositiveInteger(
      overrides.timeoutMs ?? readEnvString(env, "RUNWAY_TIMEOUT_MS"),
      DEFAULT_TIMEOUT_MS,
      "RUNWAY_TIMEOUT_MS",
    ),
    maxRetries: readNonNegativeInteger(
      overrides.maxRetries ?? readEnvString(env, "RUNWAY_MAX_RETRIES"),
      DEFAULT_MAX_RETRIES,
      "RUNWAY_MAX_RETRIES",
    ),
    pollIntervalMs: readNonNegativeInteger(
      overrides.pollIntervalMs ?? readEnvString(env, "RUNWAY_POLL_INTERVAL_MS"),
      DEFAULT_POLL_INTERVAL_MS,
      "RUNWAY_POLL_INTERVAL_MS",
    ),
    defaultAspectRatio:
      overrides.defaultAspectRatio ??
      readEnvString(env, "RUNWAY_DEFAULT_ASPECT_RATIO") ??
      DEFAULT_ASPECT_RATIO,
    defaultOutputDir,
    debug: readBoolean(
      overrides.debug ?? readEnvString(env, "RUNWAY_DEBUG"),
      false,
      "RUNWAY_DEBUG",
    ),
    useLocalStore: readBoolean(
      overrides.useLocalStore ?? readEnvString(env, "RUNWAY_USE_LOCAL_STORE"),
      true,
      "RUNWAY_USE_LOCAL_STORE",
    ),
    dataRootDir,
    charactersDir: path.resolve(
      overrides.charactersDir ?? path.join(dataRootDir, "characters"),
    ),
    assetsDir: path.resolve(overrides.assetsDir ?? path.join(dataRootDir, "assets")),
    jobsDir: path.resolve(overrides.jobsDir ?? path.join(dataRootDir, "jobs")),
    apiPaths: overrides.apiPaths ?? {
      createGenerationJob: "generation-jobs",
      getGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}`,
      cancelGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}/cancel`,
      uploadAsset: "uploads",
    },
    ...(overrides.fetchFn ? { fetchFn: overrides.fetchFn } : {}),
  };
}
