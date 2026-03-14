import { ValidationError } from "../errors.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ValidationError(`${label} must be an object.`);
  }

  return value;
}

export function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${label} must be a non-empty string.`);
  }

  return value;
}

export function readOptionalString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be a string when provided.`);
  }

  return value;
}

export function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${label} must be a number.`);
  }

  return value;
}

export function readOptionalNumber(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readNumber(value, label);
}

export function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} must be a boolean.`);
  }

  return value;
}

export function readOptionalBoolean(
  value: unknown,
  label: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readBoolean(value, label);
}

export function readArray<T>(
  value: unknown,
  label: string,
  mapper: (item: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be an array.`);
  }

  return value.map((item, index) => mapper(item, index));
}

export function readStringArray(value: unknown, label: string): string[] {
  return readArray(value, label, (item, index) =>
    readString(item, `${label}[${index}]`),
  );
}

export function readOptionalStringArray(
  value: unknown,
  label: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readStringArray(value, label);
}

export function readEnum<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): T {
  const parsed = readString(value, label) as T;

  if (!allowed.includes(parsed)) {
    throw new ValidationError(
      `${label} must be one of: ${allowed.join(", ")}.`,
      { [label]: parsed },
    );
  }

  return parsed;
}

export function readOptionalEnum<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readEnum(value, label, allowed);
}
