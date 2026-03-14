import path from "node:path";

import { createRunwayCharacterAdapter } from "./adapter.js";
import type { RunwayAdapterConfig } from "./types.js";

type PluginConfig = {
  apiKey?: string;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  pollIntervalMs?: number;
  defaultAspectRatio?: string;
  dataRootDir?: string;
  debug?: boolean;
  useLocalStore?: boolean;
  optionalTools?: boolean;
};

type PluginApi = {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: PluginConfig }>;
    };
  };
  logger?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
  resolvePath?: (input: string) => string;
  registerTool: (
    tool: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      execute: (id: string, params: unknown) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
    },
    opts?: { optional?: boolean },
  ) => void;
};

const PLUGIN_ID = "runway-character";
const DEFAULT_API_KEY_ENV = "RUNWAY_API_KEY";

function getPluginConfig(api: PluginApi): PluginConfig {
  return api.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {};
}

function buildAdapterConfig(api: PluginApi, pluginConfig: PluginConfig): Partial<RunwayAdapterConfig> {
  const envVar = pluginConfig.apiKeyEnvVar ?? DEFAULT_API_KEY_ENV;
  const apiKey = pluginConfig.apiKey ?? process.env[envVar];

  const dataRootDir = pluginConfig.dataRootDir
    ? api.resolvePath?.(pluginConfig.dataRootDir) ?? path.resolve(pluginConfig.dataRootDir)
    : undefined;

  return {
    apiKey,
    ...(pluginConfig.baseUrl ? { baseUrl: pluginConfig.baseUrl } : {}),
    ...(pluginConfig.timeoutMs !== undefined ? { timeoutMs: pluginConfig.timeoutMs } : {}),
    ...(pluginConfig.maxRetries !== undefined ? { maxRetries: pluginConfig.maxRetries } : {}),
    ...(pluginConfig.pollIntervalMs !== undefined
      ? { pollIntervalMs: pluginConfig.pollIntervalMs }
      : {}),
    ...(pluginConfig.defaultAspectRatio
      ? { defaultAspectRatio: pluginConfig.defaultAspectRatio }
      : {}),
    ...(dataRootDir ? { dataRootDir } : {}),
    ...(pluginConfig.debug !== undefined ? { debug: pluginConfig.debug } : {}),
    ...(pluginConfig.useLocalStore !== undefined
      ? { useLocalStore: pluginConfig.useLocalStore }
      : {}),
  };
}

function formatToolResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return String(result);
  }

  const payload = result as {
    ok?: boolean;
    summary?: string;
    data?: unknown;
    error?: unknown;
    nextActions?: unknown;
  };

  const parts: string[] = [];

  if (typeof payload.summary === "string" && payload.summary.trim()) {
    parts.push(payload.summary.trim());
  }

  if (payload.data !== undefined) {
    parts.push(`data:\n${JSON.stringify(payload.data, null, 2)}`);
  }

  if (payload.error !== undefined) {
    parts.push(`error:\n${JSON.stringify(payload.error, null, 2)}`);
  }

  if (payload.nextActions !== undefined) {
    parts.push(`nextActions:\n${JSON.stringify(payload.nextActions, null, 2)}`);
  }

  if (parts.length === 0) {
    return JSON.stringify(result, null, 2);
  }

  return parts.join("\n\n");
}

export default function register(api: PluginApi) {
  const pluginConfig = getPluginConfig(api);
  let adapter;

  try {
    adapter = createRunwayCharacterAdapter(buildAdapterConfig(api, pluginConfig));
  } catch (error) {
    api.logger?.warn?.(
      `[${PLUGIN_ID}] Plugin initialized without active tools: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const toolDefinitions = adapter.getToolDefinitions();
  const optional = pluginConfig.optionalTools ?? true;

  for (const tool of toolDefinitions) {
    api.registerTool(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (_id, params) => {
          const result = await adapter.executeTool(tool.name, params);
          return {
            content: [
              {
                type: "text",
                text: formatToolResult(result),
              },
            ],
          };
        },
      },
      { optional },
    );
  }

  api.logger?.info?.(
    `[${PLUGIN_ID}] Registered ${toolDefinitions.length} Runway character tools.${apiKeyWarning(pluginConfig)}`,
  );
}

function apiKeyWarning(pluginConfig: PluginConfig): string {
  const envVar = pluginConfig.apiKeyEnvVar ?? DEFAULT_API_KEY_ENV;
  const apiKey = pluginConfig.apiKey ?? process.env[envVar];

  return apiKey
    ? ""
    : ` Missing API key (${envVar}); local profile/storage tools work, but Runway network generation calls will fail until a key is configured.`;
}
