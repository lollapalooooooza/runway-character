#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createRunwayCharacterAdapter, runCharacterConsistencySmoke } from "./index.js";
import type { RunwayAdapterConfig } from "./types.js";

function printUsage() {
  console.log(`Usage:
  runway-smoke create-profile <json-file>
  runway-smoke image <characterId> <prompt>
  runway-smoke wait <jobId>
  runway-smoke download <assetId> [outputDir]
  runway-smoke character-consistency [name]

Environment:
  RUNWAY_API_KEY=...
  RUNWAY_BASE_URL=...             optional
  RUNWAY_DEBUG=true               optional
  RUNWAY_POLL_INTERVAL_MS=2000    optional
`);
}

async function readJsonFile(filePath: string) {
  const absolute = path.resolve(filePath);
  const text = await readFile(absolute, "utf8");
  return JSON.parse(text) as unknown;
}

async function loadOpenClawRunwayConfig(): Promise<Partial<RunwayAdapterConfig>> {
  const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");

  try {
    const text = await readFile(configPath, "utf8");
    const parsed = JSON.parse(text) as {
      plugins?: {
        entries?: Record<string, { config?: Record<string, unknown> }>;
      };
    };

    const pluginConfig = parsed.plugins?.entries?.["runway-character"]?.config;
    if (!pluginConfig) {
      return {};
    }

    const readString = (key: string) => {
      const value = pluginConfig[key];
      return typeof value === "string" && value.trim() !== "" ? value : undefined;
    };
    const readNumber = (key: string) => {
      const value = pluginConfig[key];
      return typeof value === "number" ? value : undefined;
    };
    const readBoolean = (key: string) => {
      const value = pluginConfig[key];
      return typeof value === "boolean" ? value : undefined;
    };

    const dataRootDir = readString("dataRootDir");

    return {
      ...(readString("apiKey") ? { apiKey: readString("apiKey") } : {}),
      ...(readString("baseUrl") ? { baseUrl: readString("baseUrl") } : {}),
      ...(readNumber("timeoutMs") !== undefined ? { timeoutMs: readNumber("timeoutMs") } : {}),
      ...(readNumber("maxRetries") !== undefined ? { maxRetries: readNumber("maxRetries") } : {}),
      ...(readNumber("pollIntervalMs") !== undefined ? { pollIntervalMs: readNumber("pollIntervalMs") } : {}),
      ...(readString("defaultAspectRatio")
        ? { defaultAspectRatio: readString("defaultAspectRatio") }
        : {}),
      ...(readBoolean("debug") !== undefined ? { debug: readBoolean("debug") } : {}),
      ...(readBoolean("useLocalStore") !== undefined
        ? { useLocalStore: readBoolean("useLocalStore") }
        : {}),
      ...(dataRootDir ? { dataRootDir: path.resolve(path.dirname(configPath), dataRootDir) } : {}),
    };
  } catch {
    return {};
  }
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  const adapterConfig = await loadOpenClawRunwayConfig();

  if (command === "character-consistency") {
    const [name] = args;
    const result = await runCharacterConsistencySmoke({
      ...adapterConfig,
      ...(name ? { name } : {}),
    } as Parameters<typeof runCharacterConsistencySmoke>[0]);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const adapter = createRunwayCharacterAdapter(adapterConfig);

  try {
    switch (command) {
      case "create-profile": {
        const [jsonFile] = args;
        if (!jsonFile) {
          throw new Error("create-profile requires a JSON file path.");
        }
        const payload = await readJsonFile(jsonFile);
        const result = await adapter.executeTool("create_character_profile", payload);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "image": {
        const [characterId, ...promptParts] = args;
        const prompt = promptParts.join(" ").trim();
        if (!characterId || !prompt) {
          throw new Error("image requires <characterId> <prompt>.");
        }
        const result = await adapter.executeTool("generate_character_image", {
          characterId,
          prompt,
        });
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "wait": {
        const [jobId] = args;
        if (!jobId) {
          throw new Error("wait requires <jobId>.");
        }
        const result = await adapter.executeTool("wait_for_generation_job", {
          jobId,
        });
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "download": {
        const [assetId, outputDir] = args;
        if (!assetId) {
          throw new Error("download requires <assetId> [outputDir].");
        }
        const result = await adapter.executeTool("download_generated_asset", {
          assetId,
          ...(outputDir ? { outputDir } : {}),
        });
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await adapter.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
