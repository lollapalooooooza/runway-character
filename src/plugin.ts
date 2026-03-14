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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function shortText(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function maskToken(value: unknown): string | undefined {
  const text = shortText(value, 48);
  if (!text) {
    return undefined;
  }

  if (text.length <= 16) {
    return text;
  }

  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function collectHighlights(data: unknown): Array<[string, string]> {
  const highlights: Array<[string, string]> = [];
  const push = (label: string, value: unknown, formatter?: (input: unknown) => string | undefined) => {
    const formatted = formatter ? formatter(value) : shortText(value);
    if (formatted) {
      highlights.push([label, formatted]);
    }
  };

  const root = asRecord(data);
  if (!root) {
    return highlights;
  }

  const avatar = asRecord(root.avatar);
  if (avatar) {
    push("Avatar", avatar.name);
    push("Avatar ID", avatar.id);
    push("Avatar status", avatar.status);
  }

  const session = asRecord(root.session);
  if (session) {
    push("Session ID", session.id);
    push("Session status", session.status);
    push("Room", session.roomName);
    push("Session key", session.sessionKey, maskToken);
  }

  const credentials = asRecord(root.credentials);
  if (credentials) {
    push("Room", credentials.roomName);
    push("Endpoint", credentials.url);
    push("Token", credentials.token, maskToken);
  }

  const job = asRecord(root.job);
  if (job) {
    push("Job ID", job.id);
    push("Job status", job.status);
    push("Media type", job.mediaType);
  }

  const asset = asRecord(root.asset);
  if (asset) {
    push("Asset ID", asset.id);
    push("Asset path", asset.localPath);
    push("Asset URL", asset.downloadUrl ?? asset.url);
  }

  const profile = asRecord(root.profile);
  if (profile) {
    push("Character", profile.name);
    push("Character ID", profile.id);
  }

  push("Attempts", root.attempts, (value) =>
    typeof value === "number" ? String(value) : undefined,
  );

  return highlights;
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

  const sections: string[] = [];

  if (typeof payload.summary === "string" && payload.summary.trim()) {
    sections.push(`Summary\n${payload.summary.trim()}`);
  }

  const highlights = collectHighlights(payload.data);
  if (highlights.length > 0) {
    sections.push(
      `Key details\n${highlights.map(([label, value]) => `- ${label}: ${value}`).join("\n")}`,
    );
  }

  const error = asRecord(payload.error);
  if (error) {
    const errorLines: string[] = [];
    const code = shortText(error.code);
    const message = shortText(error.message, 220);
    const retryable = typeof error.retryable === "boolean" ? String(error.retryable) : undefined;

    if (code) errorLines.push(`- Code: ${code}`);
    if (message) errorLines.push(`- Message: ${message}`);
    if (retryable) errorLines.push(`- Retryable: ${retryable}`);

    if (errorLines.length > 0) {
      sections.push(`Error\n${errorLines.join("\n")}`);
    }
  }

  if (Array.isArray(payload.nextActions) && payload.nextActions.length > 0) {
    sections.push(
      `Next steps\n${payload.nextActions
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  }

  if (sections.length === 0) {
    return JSON.stringify(result, null, 2);
  }

  return sections.join("\n\n");
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
