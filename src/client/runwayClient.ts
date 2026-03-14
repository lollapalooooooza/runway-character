import {
  NotFoundError,
  TimeoutError,
  UpstreamApiError,
  UnsupportedFeatureError,
} from "../errors.js";
import { mapRunwayApiError } from "../mappers/errorMapper.js";
import type {
  CharacterProfile,
  ConsumeRealtimeSessionInput,
  CreateLiveAvatarInput,
  CreateRealtimeSessionInput,
  FetchLike,
  JsonObject,
  JsonValue,
  LiveAvatarResponse,
  RealtimeSessionCredentials,
  RealtimeSessionResponse,
  RunwayAdapterConfig,
  RunwayApiRequest,
  RunwayApiResponse,
  RunwayCharacterMetadataResponse,
  RunwayClientContract,
  RunwayCreateGenerationJobRequest,
  RunwayGenerationJobResponse,
  RunwayUploadReferenceAssetRequest,
  RunwayUploadReferenceAssetResponse,
} from "../types.js";
import type { Logger } from "../utils/logger.js";
import { retry } from "../utils/retry.js";

const RUNWAY_API_VERSION = "2024-11-06";

function safeJsonParse(body: string): JsonValue | string {
  try {
    return JSON.parse(body) as JsonValue;
  } catch {
    return body;
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): URL {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\//, "");
  const url = new URL(normalizedPath, normalizedBase);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

function mapAspectRatioForModel(aspectRatio: string, model: string): string {
  const geminiRatioMap: Record<string, string> = {
    "16:9": "1344:768",
    "9:16": "768:1344",
    "1:1": "1024:1024",
    "4:3": "1184:864",
    "3:4": "864:1184",
    "21:9": "1536:672",
  };

  const runwayReferenceRatioMap: Record<string, string> = {
    "16:9": "1280:720",
    "9:16": "720:1280",
    "1:1": "1024:1024",
    "4:3": "960:720",
    "3:4": "720:960",
    "21:9": "1680:720",
  };

  const normalized = aspectRatio.trim();
  const map = model.startsWith("gemini_") ? geminiRatioMap : runwayReferenceRatioMap;
  return map[normalized] ?? normalized;
}

function normalizeTaskResponse(task: unknown): RunwayGenerationJobResponse {
  const raw = (task ?? {}) as Record<string, unknown>;
  const output = Array.isArray(raw.output) ? raw.output : [];
  const assets = output
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .map((url, index) => ({
      id: `${String(raw.id ?? "task")}-asset-${index + 1}`,
      assetId: `${String(raw.id ?? "task")}-asset-${index + 1}`,
      mediaType: "image",
      type: "image",
      url,
      outputUrl: url,
    }));

  return {
    id: String(raw.id ?? raw.taskId ?? raw.jobId ?? "unknown"),
    taskId: typeof raw.id === "string" ? raw.id : undefined,
    jobId: typeof raw.id === "string" ? raw.id : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    assets,
    output: {
      assets,
    },
    raw: raw as JsonValue,
    ...(typeof raw.failure === "string"
      ? { error: { message: raw.failure } }
      : {}),
  };
}

function buildReferenceFriendlyPrompt(prompt: string): string {
  const sanitized = prompt
    .replace(/same face and identity/gi, "same person")
    .replace(/exact same identity/gi, "same person")
    .replace(/different setup/gi, "subtle variation")
    .replace(/dramatic studio lighting/gi, "clean editorial lighting")
    .replace(/close-up portrait/gi, "editorial portrait")
    .trim();

  if (/editorial portrait/i.test(sanitized)) {
    return sanitized;
  }

  return `${sanitized}. Keep it as the same person with only a subtle angle change, clean editorial portrait realism.`;
}

export class RunwayClient implements RunwayClientContract {
  private readonly fetchFn: FetchLike;

  private requireApiKey(operation: string): string {
    const apiKey = this.config.apiKey?.trim();

    if (!apiKey) {
      throw new UnsupportedFeatureError(
        `${operation} requires RUNWAY_API_KEY (or explicit plugin config.apiKey).`,
      );
    }

    return apiKey;
  }

  constructor(
    private readonly config: RunwayAdapterConfig,
    private readonly logger: Logger,
  ) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async createGenerationJob(
    payload: RunwayCreateGenerationJobRequest,
  ): Promise<RunwayGenerationJobResponse> {
    if (payload.type === "image") {
      const hasReferences = payload.input.references.length > 0;
      const model = hasReferences ? "gen4_image_turbo" : "gemini_2.5_flash";
      const body: JsonObject = {
        model,
        promptText: hasReferences
          ? buildReferenceFriendlyPrompt(payload.input.prompt)
          : payload.input.prompt,
        ratio: mapAspectRatioForModel(payload.input.aspectRatio, model),
      };

      if (hasReferences) {
        body.referenceImages = payload.input.references.map((reference) => ({
          uri: reference.source,
        }));
      }

      const response = await this.request<{ id: string }>({
        method: "POST",
        path: "text_to_image",
        body,
      });

      return {
        id: response.data.id,
        taskId: response.data.id,
        jobId: response.data.id,
        status: "PENDING",
        raw: response.raw as JsonValue,
      };
    }

    const response = await this.request<RunwayGenerationJobResponse>({
      method: "POST",
      path: this.config.apiPaths.createGenerationJob,
      body: payload as unknown as JsonObject,
    });

    return response.data;
  }

  async getGenerationJob(providerJobId: string): Promise<RunwayGenerationJobResponse> {
    const response = await this.request<unknown>({
      method: "GET",
      path: `tasks/${providerJobId}`,
    });

    return normalizeTaskResponse(response.data);
  }

  async cancelGenerationJob(
    providerJobId: string,
  ): Promise<RunwayGenerationJobResponse> {
    const response = await this.request<RunwayGenerationJobResponse>({
      method: "POST",
      path: this.config.apiPaths.cancelGenerationJob(providerJobId),
    });

    return response.data;
  }

  async uploadReferenceAsset(
    payload: RunwayUploadReferenceAssetRequest,
  ): Promise<RunwayUploadReferenceAssetResponse> {
    if (payload.sourceType === "url") {
      return {
        id: payload.source,
        url: payload.source,
        ...(payload.label ? { label: payload.label } : {}),
      };
    }

    const body = new FormData();
    const fileResponse = await this.fetchFileLike(payload.source);
    body.set("file", new Blob([fileResponse.buffer]), fileResponse.fileName);

    const response = await this.uploadMultipart<{
      id?: string;
      uri?: string;
      url?: string;
      label?: string;
      metadata?: JsonObject;
    }>({
      path: this.config.apiPaths.uploadAsset,
      body,
    });

    const uri = response.data.uri ?? response.data.url;

    if (!uri) {
      throw new UpstreamApiError("Runway upload response did not include a uri.", 502, false);
    }

    return {
      id: response.data.id ?? uri,
      url: uri,
      ...(payload.label
        ? { label: payload.label }
        : response.data.label
          ? { label: response.data.label }
          : {}),
      ...(response.data.metadata ? { metadata: response.data.metadata } : {}),
    };
  }

  async downloadAsset(url: string): Promise<ArrayBuffer> {
    const response = await this.fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
      },
    });

    if (response.status === 404) {
      throw new NotFoundError(`Asset at ${url} was not found.`, { url });
    }

    if (!response.ok) {
      throw new UpstreamApiError(
        `Failed to download asset from ${url}.`,
        response.status,
        response.status >= 500,
        { url },
      );
    }

    return response.arrayBuffer();
  }

  async upsertCharacterMetadata(
    _profile: CharacterProfile,
  ): Promise<RunwayCharacterMetadataResponse> {
    throw new UnsupportedFeatureError(
      "Remote character metadata sync is not implemented for this MVP.",
    );
  }

  async createLiveAvatar(input: CreateLiveAvatarInput): Promise<LiveAvatarResponse> {
    const response = await this.request<LiveAvatarResponse>({
      method: "POST",
      path: "avatars",
      body: {
        name: input.name,
        referenceImage: input.referenceImage,
        personality: input.personality,
        ...(input.startScript ? { startScript: input.startScript } : {}),
        voice: {
          type: "runway-live-preset",
          presetId: input.voicePresetId,
        },
      },
    });

    return { ...response.data, raw: response.raw as JsonValue };
  }

  async getLiveAvatar(avatarId: string): Promise<LiveAvatarResponse> {
    const response = await this.request<LiveAvatarResponse>({
      method: "GET",
      path: `avatars/${avatarId}`,
    });

    return { ...response.data, raw: response.raw as JsonValue };
  }

  async createRealtimeSession(input: CreateRealtimeSessionInput): Promise<RealtimeSessionResponse> {
    const response = await this.request<RealtimeSessionResponse>({
      method: "POST",
      path: "realtime_sessions",
      body: {
        model: "gwm1_avatars",
        avatar: {
          type: "custom",
          avatarId: input.avatarId,
        },
      },
    });

    return { ...response.data, avatarId: input.avatarId, raw: response.raw as JsonValue };
  }

  async getRealtimeSession(sessionId: string): Promise<RealtimeSessionResponse> {
    const response = await this.request<RealtimeSessionResponse>({
      method: "GET",
      path: `realtime_sessions/${sessionId}`,
    });

    return { ...response.data, raw: response.raw as JsonValue };
  }

  async consumeRealtimeSession(sessionId: string, sessionKey?: string): Promise<RealtimeSessionCredentials> {
    const key = sessionKey ?? (await this.getRealtimeSession(sessionId)).sessionKey;
    if (!key) {
      throw new UnsupportedFeatureError(`Realtime session ${sessionId} is not READY or has no sessionKey.`);
    }

    const response = await this.fetchFn(buildUrl(this.config.baseUrl, `realtime_sessions/${sessionId}/consume`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": RUNWAY_API_VERSION,
      },
      body: "{}",
    });

    const responseText = await response.text();
    const parsed = responseText ? safeJsonParse(responseText) : ({} as JsonValue);
    if (!response.ok) {
      throw mapRunwayApiError(response.status, parsed, { method: "POST", path: `realtime_sessions/${sessionId}/consume` });
    }

    return { ...(parsed as RealtimeSessionCredentials), sessionId, raw: parsed };
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  private async fetchFileLike(source: string): Promise<{ buffer: ArrayBuffer; fileName: string }> {
    if (/^https?:\/\//i.test(source)) {
      const response = await this.fetchFn(source, { method: "GET" });
      if (!response.ok) {
        throw new UpstreamApiError(
          `Failed to fetch reference asset from ${source}.`,
          response.status,
          response.status >= 500,
          { source },
        );
      }
      return {
        buffer: await response.arrayBuffer(),
        fileName: source.split("/").pop() || "reference.bin",
      };
    }

    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const data = await readFile(source);
    return {
      buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      fileName: basename(source) || "reference.bin",
    };
  }

  private async uploadMultipart<TPayload>(params: { path: string; body: FormData }): Promise<RunwayApiResponse<TPayload>> {
    const apiKey = this.requireApiKey("Uploading reference assets");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const url = buildUrl(this.config.baseUrl, params.path);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": RUNWAY_API_VERSION,
        },
        body: params.body,
        signal: controller.signal,
      });

      const responseText = await response.text();
      const parsed = responseText ? safeJsonParse(responseText) : ({} as JsonValue);

      if (!response.ok) {
        throw mapRunwayApiError(response.status, parsed, {
          method: "POST",
          path: params.path,
        });
      }

      return {
        status: response.status,
        data: parsed as TPayload,
        raw: parsed,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<TPayload>(
    request: RunwayApiRequest,
  ): Promise<RunwayApiResponse<TPayload>> {
    const apiKey = this.requireApiKey(`Runway API request ${request.method} ${request.path}`);

    const execute = async (): Promise<RunwayApiResponse<TPayload>> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      const url = buildUrl(this.config.baseUrl, request.path, request.query);

      this.logger.debug("Submitting Runway API request", {
        method: request.method,
        path: request.path,
        query: request.query,
        bodyKeys:
          request.body && typeof request.body === "object"
            ? Object.keys(request.body)
            : undefined,
      });

      try {
        const response = await this.fetchFn(url, {
          method: request.method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Runway-Version": RUNWAY_API_VERSION,
          },
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
          signal: controller.signal,
        });

        const responseText = await response.text();
        const parsed = responseText ? safeJsonParse(responseText) : ({} as JsonValue);

        if (!response.ok) {
          throw mapRunwayApiError(response.status, parsed, request);
        }

        return {
          status: response.status,
          data: parsed as TPayload,
          ...(response.headers.get("x-request-id")
            ? { requestId: response.headers.get("x-request-id") ?? undefined }
            : {}),
          raw: parsed,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError(
            `Runway request ${request.method} ${request.path} timed out after ${this.config.timeoutMs}ms.`,
            { path: request.path },
          );
        }

        if (error instanceof Error && error.name === "TypeError") {
          throw new UpstreamApiError(
            `Network request to Runway failed for ${request.method} ${request.path}.`,
            502,
            true,
            { path: request.path },
          );
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    };

    return retry(execute, {
      retries: this.config.maxRetries,
      delayMs: (attempt) => attempt * 250,
      shouldRetry: (error) =>
        error instanceof UpstreamApiError ||
        error instanceof TimeoutError,
      onRetry: async (error, attempt) => {
        this.logger.warn("Retrying Runway API request", {
          attempt,
          path: request.path,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { error },
        });
      },
    });
  }
}
