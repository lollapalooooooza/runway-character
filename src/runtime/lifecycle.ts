import { UnsupportedFeatureError } from "../errors.js";

type CloseHandler = () => Promise<void> | void;

export class AdapterLifecycle {
  private closed = false;
  private readonly closeHandlers: CloseHandler[] = [];

  registerCloseHandler(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  assertOpen(): void {
    if (this.closed) {
      throw new UnsupportedFeatureError(
        "The Runway character adapter has already been closed.",
      );
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const handler of [...this.closeHandlers].reverse()) {
      await handler();
    }
  }
}
