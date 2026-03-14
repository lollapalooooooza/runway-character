import type { NormalizedAdapterError } from "./types.js";

const SECRET_KEY_PATTERN = /(authorization|api[-_]?key|token|secret|password)/i;

export class AdapterError extends Error implements NormalizedAdapterError {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: string;
      retryable: boolean;
      statusCode?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
    this.details = options.details ? sanitizeDetails(options.details) : undefined;
  }

  toJSON(): NormalizedAdapterError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.statusCode !== undefined ? { statusCode: this.statusCode } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class ConfigError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "CONFIG_ERROR",
      retryable: false,
      details,
    });
  }
}

export class ValidationError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "VALIDATION_ERROR",
      retryable: false,
      statusCode: 400,
      details,
    });
  }
}

export class AuthError extends AdapterError {
  constructor(message: string, statusCode = 401, details?: Record<string, unknown>) {
    super(message, {
      code: "AUTH_ERROR",
      retryable: false,
      statusCode,
      details,
    });
  }
}

export class TimeoutError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "TIMEOUT_ERROR",
      retryable: true,
      statusCode: 408,
      details,
    });
  }
}

export class RateLimitError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "RATE_LIMIT_ERROR",
      retryable: true,
      statusCode: 429,
      details,
    });
  }
}

export class UpstreamApiError extends AdapterError {
  constructor(
    message: string,
    statusCode = 502,
    retryable = true,
    details?: Record<string, unknown>,
  ) {
    super(message, {
      code: "UPSTREAM_API_ERROR",
      retryable,
      statusCode,
      details,
    });
  }
}

export class JobFailedError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "JOB_FAILED",
      retryable: false,
      statusCode: 502,
      details,
    });
  }
}

export class NotFoundError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "NOT_FOUND",
      retryable: false,
      statusCode: 404,
      details,
    });
  }
}

export class StorageError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(message, {
      code: "STORAGE_ERROR",
      retryable: false,
      details,
      cause,
    });
  }
}

export class MappingError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "MAPPING_ERROR",
      retryable: false,
      details,
    });
  }
}

export class UnsupportedFeatureError extends AdapterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "UNSUPPORTED_FEATURE",
      retryable: false,
      details,
    });
  }
}

export function sanitizeDetails(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeDetails(item as Record<string, unknown>)
          : item,
      );
      continue;
    }

    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
