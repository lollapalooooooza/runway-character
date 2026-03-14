const SECRET_KEY_PATTERN = /(authorization|api[-_]?key|token|secret|password)/i;

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  debug?: boolean;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (typeof value === "object" && value !== null) {
    const next: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      next[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(entry);
    }

    return next;
  }

  return value;
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(redact(context))}`;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { error };
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const debug = options.debug ?? false;

  return {
    debug(message, context) {
      if (!debug) {
        return;
      }

      console.debug(`[runway-character-adapter] ${message}${formatContext(context)}`);
    },
    info(message, context) {
      console.info(`[runway-character-adapter] ${message}${formatContext(context)}`);
    },
    warn(message, context) {
      console.warn(`[runway-character-adapter] ${message}${formatContext(context)}`);
    },
    error(message, context) {
      console.error(`[runway-character-adapter] ${message}${formatContext(context)}`);
    },
  };
}
