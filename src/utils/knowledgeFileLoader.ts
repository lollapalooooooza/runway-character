import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { UnsupportedFeatureError } from "../errors.js";

const execFile = promisify(execFileCallback);

export interface KnowledgeFileLoadResult {
  text: string;
  sourceLabel: string;
}

export async function loadKnowledgeFile(sourceFilePath: string): Promise<KnowledgeFileLoadResult> {
  const resolvedPath = path.resolve(sourceFilePath);
  const extension = path.extname(resolvedPath).toLowerCase();

  if ([".txt", ".md", ".markdown", ".json"].includes(extension)) {
    const text = await readFile(resolvedPath, "utf8");
    return { text, sourceLabel: resolvedPath };
  }

  if (extension === ".pdf") {
    return {
      text: await extractPdfText(resolvedPath),
      sourceLabel: resolvedPath,
    };
  }

  if (extension === ".docx") {
    return {
      text: await extractDocxText(resolvedPath),
      sourceLabel: resolvedPath,
    };
  }

  throw new UnsupportedFeatureError(
    `Unsupported knowledge file type: ${extension || "unknown"}. Supported: .txt, .md, .markdown, .json, .pdf, .docx`,
    { sourceFilePath: resolvedPath, extension },
  );
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { stdout } = await execFile("pdftotext", [filePath, "-"]);
    const text = stdout.trim();
    if (!text) {
      throw new UnsupportedFeatureError(`PDF text extraction produced no text for ${filePath}.`, {
        sourceFilePath: filePath,
      });
    }
    return text;
  } catch (error) {
    throw new UnsupportedFeatureError(
      `PDF knowledge extraction requires the 'pdftotext' command to be available, or a readable text-based PDF.`,
      {
        sourceFilePath: filePath,
        extractor: "pdftotext",
        reason: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

async function extractDocxText(filePath: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "runway-character-docx-"));
  const outputPath = path.join(tempDir, "document.txt");

  try {
    await execFile("textutil", ["-convert", "txt", filePath, "-output", outputPath]);
    const text = (await readFile(outputPath, "utf8")).trim();
    if (!text) {
      throw new UnsupportedFeatureError(`DOCX text extraction produced no text for ${filePath}.`, {
        sourceFilePath: filePath,
      });
    }
    return text;
  } catch (error) {
    throw new UnsupportedFeatureError(
      `DOCX knowledge extraction requires macOS 'textutil' or another DOCX-to-text converter.`,
      {
        sourceFilePath: filePath,
        extractor: "textutil",
        reason: error instanceof Error ? error.message : String(error),
      },
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
