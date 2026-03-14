import type {
  CreateCharacterFromKnowledgeInput,
  IngestCharacterKnowledgeInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import {
  readOptionalString,
  readOptionalStringArray,
  readRecord,
} from "../utils/guards.js";

function parseCreateCharacterFromKnowledgeInput(
  input: unknown,
): CreateCharacterFromKnowledgeInput {
  const record = readRecord(input, "create_character_from_knowledge input");
  const parsed: CreateCharacterFromKnowledgeInput = {};

  const name = readOptionalString(record.name, "name");
  const sourceText = readOptionalString(record.sourceText, "sourceText");
  const sourceFilePath = readOptionalString(record.sourceFilePath, "sourceFilePath");
  const sourceUrl = readOptionalString(record.sourceUrl, "sourceUrl");
  const attachmentPaths = readOptionalStringArray(record.attachmentPaths, "attachmentPaths");
  const attachmentUrls = readOptionalStringArray(record.attachmentUrls, "attachmentUrls");

  if (!sourceText && !sourceFilePath && !sourceUrl && !attachmentPaths?.length && !attachmentUrls?.length) {
    throw new Error("Provide sourceText, sourceFilePath, sourceUrl, attachmentPaths, or attachmentUrls.");
  }

  if (name !== undefined) parsed.name = name;
  if (sourceText !== undefined) parsed.sourceText = sourceText;
  if (sourceFilePath !== undefined) parsed.sourceFilePath = sourceFilePath;
  if (sourceUrl !== undefined) parsed.sourceUrl = sourceUrl;
  if (attachmentPaths !== undefined) parsed.attachmentPaths = attachmentPaths;
  if (attachmentUrls !== undefined) parsed.attachmentUrls = attachmentUrls;

  return parsed;
}

export function createCharacterFromKnowledgeTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<CreateCharacterFromKnowledgeInput> {
  return {
    name: "create_character_from_knowledge",
    description:
      "Create a character profile directly from long-form character knowledge text or a local text file.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Optional explicit character name override." },
        sourceText: { type: "string", description: "Long-form character knowledge text." },
        sourceFilePath: { type: "string", description: "Local path to a .txt, .md, .markdown, .json, .pdf, or .docx file." },
        sourceUrl: { type: "string", description: "Optional URL to a text-like knowledge file." },
        attachmentPaths: { type: "array", items: { type: "string" }, description: "Attachment file paths from OpenClaw media context, e.g. MediaPaths." },
        attachmentUrls: { type: "array", items: { type: "string" }, description: "Attachment URLs from OpenClaw media context, e.g. MediaUrls." },
      },
    },
    parse: parseCreateCharacterFromKnowledgeInput,
    handler: async (input) => context.createCharacterFromKnowledge(input),
  };
}

export function toKnowledgeInput(
  input: CreateCharacterFromKnowledgeInput,
): IngestCharacterKnowledgeInput {
  return {
    ...(input.name ? { name: input.name } : {}),
    ...(input.sourceText ? { sourceText: input.sourceText } : {}),
    ...(input.sourceFilePath ? { sourceFilePath: input.sourceFilePath } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.attachmentPaths ? { attachmentPaths: input.attachmentPaths } : {}),
    ...(input.attachmentUrls ? { attachmentUrls: input.attachmentUrls } : {}),
    appendAsContinuityNote: true,
  };
}
