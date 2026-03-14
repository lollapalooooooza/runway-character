import { loadKnowledgeFile } from "../utils/knowledgeFileLoader.js";

import type {
  CreateCharacterProfileInput,
  IngestCharacterKnowledgeInput,
  IngestCharacterKnowledgeOutput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import {
  readOptionalBoolean,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
} from "../utils/guards.js";

function parseIngestCharacterKnowledgeInput(input: unknown): IngestCharacterKnowledgeInput {
  const record = readRecord(input, "ingest_character_knowledge input");
  const parsed: IngestCharacterKnowledgeInput = {};

  const name = readOptionalString(record.name, "name");
  const sourceText = readOptionalString(record.sourceText, "sourceText");
  const sourceFilePath = readOptionalString(record.sourceFilePath, "sourceFilePath");
  const sourceUrl = readOptionalString(record.sourceUrl, "sourceUrl");
  const attachmentPaths = readOptionalStringArray(record.attachmentPaths, "attachmentPaths");
  const attachmentUrls = readOptionalStringArray(record.attachmentUrls, "attachmentUrls");
  const appendAsContinuityNote =
    readOptionalBoolean(record.appendAsContinuityNote, "appendAsContinuityNote") ?? true;

  if (!sourceText && !sourceFilePath && !sourceUrl && !attachmentPaths?.length && !attachmentUrls?.length) {
    throw new Error("Provide sourceText, sourceFilePath, sourceUrl, attachmentPaths, or attachmentUrls.");
  }

  if (name !== undefined) {
    parsed.name = name;
  }

  if (sourceText !== undefined) {
    parsed.sourceText = sourceText;
  }

  if (sourceFilePath !== undefined) {
    parsed.sourceFilePath = sourceFilePath;
  }

  if (sourceUrl !== undefined) {
    parsed.sourceUrl = sourceUrl;
  }

  if (attachmentPaths !== undefined) {
    parsed.attachmentPaths = attachmentPaths;
  }

  if (attachmentUrls !== undefined) {
    parsed.attachmentUrls = attachmentUrls;
  }

  parsed.appendAsContinuityNote = appendAsContinuityNote;
  return parsed;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,;，；、]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function firstSentence(value: string, max = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}…`;
}

function extractValue(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escaped}\\s*[:：]\\s*(.+)`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractSection(text: string, labels: string[]): string[] {
  const lines = text.split(/\r?\n/);
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const collected: string[] = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inSection && collected.length > 0) {
        break;
      }
      continue;
    }

    const lower = line.toLowerCase();
    const isHeader = normalizedLabels.some((label) =>
      lower === label || lower === `${label}:` || lower === `${label}：`,
    );

    if (isHeader) {
      inSection = true;
      continue;
    }

    if (inSection) {
      if (/^[#]{1,6}\s+/.test(line) || /^[A-Za-z\u4e00-\u9fff][^:：]{0,30}[:：]$/.test(line)) {
        break;
      }
      collected.push(line.replace(/^[-*]\s*/, ""));
    }
  }

  return collected;
}

function detectStyleTags(text: string): string[] {
  const dictionary = [
    "cinematic",
    "realistic",
    "anime",
    "editorial",
    "fashion",
    "3d",
    "stylized",
    "clean portrait",
    "photorealistic",
    "科幻",
    "写实",
    "电影感",
    "二次元",
    "时尚",
    "卡通",
  ];

  const lower = text.toLowerCase();
  return unique(dictionary.filter((tag) => lower.includes(tag.toLowerCase())));
}

function summarizeKnowledge(text: string, max = 1200): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 1).trim()}…`;
}

function buildProfileDraft(name: string | undefined, text: string, appendAsContinuityNote: boolean): IngestCharacterKnowledgeOutput {
  const visualSummary = extractValue(text, ["visualSummary", "visual summary", "外观概述", "视觉概述", "角色外观", "外貌"]);
  const description = extractValue(text, ["description", "简介", "描述", "背景", "设定"]);
  const ageRange = extractValue(text, ["ageRange", "age range", "年龄", "年龄段"]);
  const genderPresentation = extractValue(text, ["genderPresentation", "gender presentation", "性别气质", "性别呈现"]);
  const ethnicityOrAppearanceNotes = extractValue(text, ["ethnicityOrAppearanceNotes", "appearance notes", "外貌备注", "种族", "外形补充"]);
  const hair = extractValue(text, ["hair", "发型", "头发"]);
  const face = extractValue(text, ["face", "面部", "五官", "脸"]);
  const bodyType = extractValue(text, ["bodyType", "body type", "身材", "体型"]);
  const personality = extractValue(text, ["personality", "性格", "人格"]);
  const voiceNotes = extractValue(text, ["voiceNotes", "voice", "声音", "音色"]);
  const cinematicUniverse = extractValue(text, ["cinematicUniverse", "universe", "世界观", "宇宙设定"]);
  const mood = extractValue(text, ["mood", "情绪", "氛围"]);
  const visualLanguage = extractValue(text, ["visualLanguage", "visual language", "视觉语言", "画面语言"]);

  const wardrobe = unique([
    ...splitList(extractValue(text, ["wardrobe", "服装", "穿搭", "衣着"]) ?? ""),
    ...extractSection(text, ["wardrobe", "服装", "穿搭", "衣着"]),
  ]);
  const accessories = unique([
    ...splitList(extractValue(text, ["accessories", "配饰", "饰品"]) ?? ""),
    ...extractSection(text, ["accessories", "配饰", "饰品"]),
  ]);
  const styleTags = unique([
    ...splitList(extractValue(text, ["styleTags", "style tags", "风格标签"]) ?? ""),
    ...detectStyleTags(text),
  ]);
  const consistencyRules = unique([
    ...splitList(extractValue(text, ["consistencyRules", "consistency rules", "一致性规则", "保持一致"]) ?? ""),
    ...extractSection(text, ["consistencyRules", "一致性规则", "保持一致"]),
  ]);

  const inferredName = name
    ?? extractValue(text, ["name", "角色名", "姓名", "名字"])
    ?? "Untitled Character";

  const derivedVisualSummary = visualSummary
    ?? unique([hair ?? "", face ?? "", wardrobe[0] ?? "", mood ?? ""])
      .filter(Boolean)
      .join(", ");

  const continuityNotes = unique([
    ...(appendAsContinuityNote ? [firstSentence(summarizeKnowledge(text, 400))] : []),
    ...extractSection(text, ["continuityNotes", "continuity notes", "连续性备注", "连续性说明"]),
  ]);

  const profileDraft: CreateCharacterProfileInput = {
    name: inferredName,
    ...(description ? { description } : {}),
    ...(derivedVisualSummary ? { visualSummary: derivedVisualSummary } : {}),
    ...(ageRange ? { ageRange } : {}),
    ...(genderPresentation ? { genderPresentation } : {}),
    ...(ethnicityOrAppearanceNotes ? { ethnicityOrAppearanceNotes } : {}),
    ...(hair ? { hair } : {}),
    ...(face ? { face } : {}),
    ...(bodyType ? { bodyType } : {}),
    ...(wardrobe.length > 0 ? { wardrobe } : {}),
    ...(accessories.length > 0 ? { accessories } : {}),
    ...(personality ? { personality } : {}),
    ...(voiceNotes ? { voiceNotes } : {}),
    ...(styleTags.length > 0 ? { styleTags } : {}),
    ...(cinematicUniverse ? { cinematicUniverse } : {}),
    ...(mood ? { mood } : {}),
    ...(visualLanguage ? { visualLanguage } : {}),
    ...(consistencyRules.length > 0 ? { consistencyRules } : {}),
    ...(continuityNotes.length > 0 ? { continuityNotes } : {}),
  };

  return {
    knowledge: {
      sourceSummary: summarizeKnowledge(text),
      extractedFields: {
        name: inferredName,
        ...(description ? { description } : {}),
        ...(derivedVisualSummary ? { visualSummary: derivedVisualSummary } : {}),
        ...(ageRange ? { ageRange } : {}),
        ...(genderPresentation ? { genderPresentation } : {}),
        ...(ethnicityOrAppearanceNotes ? { ethnicityOrAppearanceNotes } : {}),
        ...(hair ? { hair } : {}),
        ...(face ? { face } : {}),
        ...(bodyType ? { bodyType } : {}),
        wardrobe,
        accessories,
        ...(personality ? { personality } : {}),
        ...(voiceNotes ? { voiceNotes } : {}),
        styleTags,
        ...(cinematicUniverse ? { cinematicUniverse } : {}),
        ...(mood ? { mood } : {}),
        ...(visualLanguage ? { visualLanguage } : {}),
        consistencyRules,
        continuityNotes,
      },
    },
    profileDraft,
    suggestedNextActions: [
      "create_character_profile",
      "update_character_profile",
      "generate_character_image",
    ],
  };
}

async function loadKnowledgeText(input: IngestCharacterKnowledgeInput): Promise<{ text: string; sourceLabel: string }> {
  if (input.sourceText) {
    return { text: input.sourceText, sourceLabel: "inline text" };
  }

  const attachmentPath = input.attachmentPaths?.find(Boolean);
  if (attachmentPath) {
    return loadKnowledgeFile(attachmentPath);
  }

  if (input.sourceFilePath) {
    return loadKnowledgeFile(input.sourceFilePath);
  }

  const attachmentUrl = input.attachmentUrls?.find(Boolean);
  if (attachmentUrl) {
    return { text: attachmentUrl, sourceLabel: "attachment url" };
  }

  if (input.sourceUrl) {
    return { text: input.sourceUrl, sourceLabel: "source url" };
  }

  throw new Error("No usable knowledge source found.");
}

export function ingestCharacterKnowledgeTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<IngestCharacterKnowledgeInput> {
  return {
    name: "ingest_character_knowledge",
    description:
      "Convert long-form character text or a local text file into a structured character knowledge draft that can be used with create_character_profile or update_character_profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Optional explicit character name override." },
        sourceText: { type: "string", description: "Long-form character knowledge text." },
        sourceFilePath: { type: "string", description: "Local path to a .txt, .md, .markdown, .json, .pdf, or .docx file." },
        sourceUrl: { type: "string", description: "Optional URL to a text-like knowledge source." },
        attachmentPaths: { type: "array", items: { type: "string" }, description: "Attachment file paths from OpenClaw media context, e.g. MediaPaths." },
        attachmentUrls: { type: "array", items: { type: "string" }, description: "Attachment URLs from OpenClaw media context, e.g. MediaUrls." },
        appendAsContinuityNote: { type: "boolean", description: "Whether to keep a compressed source summary as a continuity note." },
      },
    },
    parse: parseIngestCharacterKnowledgeInput,
    handler: async (input) => context.ingestCharacterKnowledge(input),
  };
}

export async function ingestCharacterKnowledge(
  input: IngestCharacterKnowledgeInput,
): Promise<{ output: IngestCharacterKnowledgeOutput; sourceLabel: string }> {
  const { text, sourceLabel } = await loadKnowledgeText(input);
  return {
    output: buildProfileDraft(input.name, text, input.appendAsContinuityNote ?? true),
    sourceLabel,
  };
}
