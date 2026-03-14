import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadKnowledgeFile } from "../src/utils/knowledgeFileLoader.js";
import { createTempConfig } from "./fixtures/factories.js";

describe("knowledge file loader", () => {
  it("loads plain text knowledge files", async () => {
    const config = await createTempConfig();
    const filePath = path.join(config.dataRootDir!, "knowledge.txt");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(filePath, "姓名: 阿澈\n外观概述: 黑发。", "utf8");

    const result = await loadKnowledgeFile(filePath);
    expect(result.text).toContain("阿澈");
  });

  it("rejects unsupported file types with a helpful message", async () => {
    const config = await createTempConfig();
    const filePath = path.join(config.dataRootDir!, "knowledge.rtf");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(filePath, "{\\rtf1 fake}", "utf8");

    await expect(loadKnowledgeFile(filePath)).rejects.toMatchObject({
      code: "UNSUPPORTED_FEATURE",
    });
  });

  it("reports a helpful error for pdf extraction when pdftotext is unavailable or extraction fails", async () => {
    const config = await createTempConfig();
    const filePath = path.join(config.dataRootDir!, "knowledge.pdf");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(filePath, "%PDF-1.4 fake", "utf8");

    await expect(loadKnowledgeFile(filePath)).rejects.toMatchObject({
      code: "UNSUPPORTED_FEATURE",
    });
  });
});
