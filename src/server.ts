import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createRunwayCharacterAdapter } from "./adapter.js";
import type { RunwayAdapterConfig } from "./types.js";

export interface RunwayCharacterApiServerOptions {
  adapterConfig?: Partial<RunwayAdapterConfig>;
  port?: number;
  host?: string;
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(text) as Record<string, unknown>;
}

async function readMultipartForm(req: IncomingMessage): Promise<FormData> {
  const request = new Request("http://localhost/upload", {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req as unknown as BodyInit,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return request.formData();
}

function getStringField(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function saveUploadedFile(file: File): Promise<string> {
  const extension = path.extname(file.name || "").toLowerCase() || ".txt";
  const uploadsDir = path.join(os.tmpdir(), "runway-character-uploads");
  await mkdir(uploadsDir, { recursive: true });
  const outputPath = path.join(
    uploadsDir,
    `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);
  return outputPath;
}

async function parseKnowledgeRequest(req: IncomingMessage): Promise<{
  name?: string;
  sourceText?: string;
  sourceFilePath?: string;
  sourceUrl?: string;
  attachmentPaths?: string[];
  attachmentUrls?: string[];
}> {
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    const body = await readJsonBody(req);
    const name = typeof body.name === "string" ? body.name : undefined;
    const sourceText = typeof body.sourceText === "string" ? body.sourceText : undefined;
    const sourceFilePath = typeof body.sourceFilePath === "string" ? body.sourceFilePath : undefined;
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : undefined;
    const attachmentPaths = Array.isArray(body.attachmentPaths)
      ? body.attachmentPaths.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
    const attachmentUrls = Array.isArray(body.attachmentUrls)
      ? body.attachmentUrls.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
    return { name, sourceText, sourceFilePath, sourceUrl, attachmentPaths, attachmentUrls };
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await readMultipartForm(req);
    const name = getStringField(form.get("name"));
    const sourceText = getStringField(form.get("sourceText"));
    const file = form.get("file");

    if (file && typeof file !== "string") {
      const sourceFilePath = await saveUploadedFile(file);
      return { name, sourceText, sourceFilePath };
    }

    return { name, sourceText };
  }

  throw new Error("Unsupported Content-Type. Use application/json or multipart/form-data.");
}

export function createRunwayCharacterApiServer(
  options: RunwayCharacterApiServerOptions = {},
): { server: Server; start: () => Promise<{ port: number; host: string }>; stop: () => Promise<void> } {
  const adapter = createRunwayCharacterAdapter(options.adapterConfig ?? {});
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4319;

  const server = createServer(async (req, res) => {
    cors(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        json(res, 200, { ok: true, service: "runway-character-api" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/characters/from-knowledge") {
        const payload = await parseKnowledgeRequest(req);
        const result = await adapter.executeTool("create_character_from_knowledge", payload);
        json(res, result.ok ? 200 : 400, result);
        return;
      }

      json(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      json(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          const address = server.address();
          resolve({
            port: typeof address === "object" && address ? address.port : port,
            host,
          });
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4319;
  const host = process.env.HOST ?? "127.0.0.1";
  const api = createRunwayCharacterApiServer({ port, host });

  api
    .start()
    .then(({ host: startedHost, port: startedPort }) => {
      process.stdout.write(
        `Runway character API listening on http://${startedHost}:${startedPort}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(
        `Failed to start Runway character API: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
