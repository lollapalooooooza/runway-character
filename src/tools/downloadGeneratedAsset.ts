import type {
  DownloadGeneratedAssetInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import {
  readOptionalBoolean,
  readOptionalString,
  readRecord,
  readString,
} from "../utils/guards.js";

function parseDownloadGeneratedAssetInput(input: unknown): DownloadGeneratedAssetInput {
  const record = readRecord(input, "download_generated_asset input");
  const parsed: DownloadGeneratedAssetInput = {
    assetId: readString(record.assetId, "assetId"),
  };

  const outputDir = readOptionalString(record.outputDir, "outputDir");
  const overwrite = readOptionalBoolean(record.overwrite, "overwrite");

  if (outputDir !== undefined) {
    parsed.outputDir = outputDir;
  }

  if (overwrite !== undefined) {
    parsed.overwrite = overwrite;
  }

  return parsed;
}

export function downloadGeneratedAssetTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<DownloadGeneratedAssetInput> {
  return {
    name: "download_generated_asset",
    description: "Download a normalized generated asset to a local file path.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["assetId"],
      properties: {
        assetId: { type: "string" },
        outputDir: { type: "string" },
        overwrite: { type: "boolean" },
      },
    },
    parse: parseDownloadGeneratedAssetInput,
    handler: async (input) => context.downloadGeneratedAsset(input),
  };
}
