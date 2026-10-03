// Minimal provider-compatible stream for deterministic, install-free tests.
export class TestStream {
  events: any[] = [];
  waiters: Array<() => void> = [];
  done = false;
  final: Promise<any>;
  resolve!: (message: any) => void;
  constructor() { this.final = new Promise(resolve => { this.resolve = resolve; }); }
  push(event: any) {
    this.events.push(event);
    if (event.type === "done" || event.type === "error") {
      this.done = true;
      this.resolve(event.message ?? event.error);
    }
    this.waiters.splice(0).forEach(wake => wake());
  }
  end() { this.done = true; this.waiters.splice(0).forEach(wake => wake()); }
  result() { return this.final; }
  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.events.length) yield this.events.shift();
      else if (this.done) return;
      else await new Promise<void>(resolve => this.waiters.push(resolve));
    }
  }
}
export function successStream() {
  const stream = new TestStream();
  stream.push({ type: "done", reason: "stop", message: { role: "assistant", content: [], stopReason: "stop" } });
  stream.end();
  return stream;
}
