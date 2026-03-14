import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { NotFoundError, StorageError } from "../errors.js";
import type { EntityStore } from "../types.js";

function sortByTimestamp<T extends { createdAt?: string; updatedAt?: string; id: string }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "1970-01-01T00:00:00.000Z");
    const rightTime = Date.parse(
      right.updatedAt ?? right.createdAt ?? "1970-01-01T00:00:00.000Z",
    );

    return rightTime - leftTime || left.id.localeCompare(right.id);
  });
}

export class FileStore<T extends { id: string; createdAt?: string; updatedAt?: string }>
  implements EntityStore<T>
{
  constructor(private readonly directory: string) {}

  protected get fileExtension(): string {
    return ".json";
  }

  protected resolvePath(id: string): string {
    return path.join(this.directory, `${id}${this.fileExtension}`);
  }

  protected async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async create(entity: T): Promise<T> {
    const target = this.resolvePath(entity.id);
    await this.ensureDirectory();

    if (await this.exists(target)) {
      throw new StorageError(`Record "${entity.id}" already exists.`, {
        id: entity.id,
        directory: this.directory,
      });
    }

    return this.save(entity);
  }

  async save(entity: T): Promise<T> {
    const target = this.resolvePath(entity.id);
    await this.ensureDirectory();

    try {
      await writeFile(target, JSON.stringify(entity, null, 2), "utf8");
      return entity;
    } catch (error) {
      throw new StorageError(
        `Failed to persist record "${entity.id}" to ${this.directory}.`,
        { id: entity.id, directory: this.directory },
        error,
      );
    }
  }

  async getById(id: string): Promise<T | null> {
    const target = this.resolvePath(id);

    try {
      const content = await readFile(target, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw new StorageError(
        `Failed to read record "${id}" from ${this.directory}.`,
        { id, directory: this.directory },
        error,
      );
    }
  }

  async update(id: string, updater: (current: T) => T): Promise<T> {
    const current = await this.getById(id);

    if (!current) {
      throw new NotFoundError(`Record "${id}" was not found.`, {
        id,
        directory: this.directory,
      });
    }

    const updated = updater(current);
    await this.save(updated);
    return updated;
  }

  async list(): Promise<T[]> {
    await this.ensureDirectory();

    try {
      const entries = await readdir(this.directory);
      const jsonFiles = entries.filter((entry) => entry.endsWith(this.fileExtension));
      const items = await Promise.all(
        jsonFiles.map(async (entry) => {
          const content = await readFile(path.join(this.directory, entry), "utf8");
          return JSON.parse(content) as T;
        }),
      );

      return sortByTimestamp(items);
    } catch (error) {
      throw new StorageError(
        `Failed to list records from ${this.directory}.`,
        { directory: this.directory },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const target = this.resolvePath(id);

    try {
      await rm(target, { force: true });
    } catch (error) {
      throw new StorageError(
        `Failed to delete record "${id}" from ${this.directory}.`,
        { id, directory: this.directory },
        error,
      );
    }
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await stat(target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}
