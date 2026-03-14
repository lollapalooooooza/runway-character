import {
  AdapterError,
  AuthError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  UpstreamApiError,
} from "../errors.js";
import type {
  JsonObject,
  NormalizedAdapterError,
  RunwayApiRequest,
} from "../types.js";

function extractMessage(body: unknown): string | undefined {
  if (typeof body === "string" && body.trim() !== "") {
    return body;
  }

  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    const nestedError = record.error;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof nestedError === "object" && nestedError !== null) {
      const errorRecord = nestedError as Record<string, unknown>;

      if (typeof errorRecord.message === "string") {
        return errorRecord.message;
      }
    }
  }

  return undefined;
}

function extractCode(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;

    if (typeof record.code === "string") {
      return record.code;
    }

    if (typeof record.error === "object" && record.error !== null) {
      const errorRecord = record.error as Record<string, unknown>;

      if (typeof errorRecord.code === "string") {
        return errorRecord.code;
      }
    }
  }

  return undefined;
}

function extractDetails(body: unknown): JsonObject | undefined {
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    return body as JsonObject;
  }

  return undefined;
}

export function mapRunwayApiError(
  status: number,
  body: unknown,
  request: RunwayApiRequest,
): AdapterError {
  const message =
    extractMessage(body) ??
    `Runway request ${request.method} ${request.path} failed with status ${status}.`;
  const code = extractCode(body);
  const details = {
    requestPath: request.path,
    requestMethod: request.method,
    ...(code ? { upstreamCode: code } : {}),
    ...(extractDetails(body) ? { response: extractDetails(body) } : {}),
  };

  if (status === 401 || status === 403) {
    return new AuthError(message, status, details);
  }

  if (status === 404) {
    return new NotFoundError(message, details);
  }

  if (status === 429) {
    return new RateLimitError(message, details);
  }

  if (status >= 500) {
    return new UpstreamApiError(message, status, true, details);
  }

  return new UpstreamApiError(message, status, false, details);
}

export function normalizeAdapterError(error: unknown): NormalizedAdapterError {
  if (error instanceof AdapterError) {
    return error.toJSON();
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new TimeoutError("The request to Runway timed out.").toJSON();
  }

  if (error instanceof Error) {
    return {
      code: "UNEXPECTED_ERROR",
      message: error.message,
      retryable: false,
      details: {
        name: error.name,
      },
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    message: "An unexpected error occurred.",
    retryable: false,
  };
}
