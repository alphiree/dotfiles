import type { AssistantMessageEvent, AssistantMessageEventStream, ProviderStreams } from "@earendil-works/pi-ai";

/** Own dispatch through terminal settlement, independently of agent/compaction hooks.
 * Never race the dispatched stream against abort: the transport must settle first.
 */
export function createOwnedStream(
  delegate: ProviderStreams["streamSimple"],
  createStream: () => AssistantMessageEventStream,
  prepare: (model: Parameters<ProviderStreams["streamSimple"]>[0], signal?: AbortSignal) => Promise<() => void>,
): ProviderStreams["streamSimple"] {
  return (model, context, options) => {
    const stream = createStream();
    void (async () => {
      let release: (() => void) | undefined;
      let terminal: AssistantMessageEvent | undefined;
      try {
        options?.signal?.throwIfAborted();
        release = await prepare(model, options?.signal);
        options?.signal?.throwIfAborted();
        const inner = delegate(model, context, options);
        for await (const event of inner) {
          if (event.type === "done" || event.type === "error") terminal = event;
          else stream.push(event);
        }
        if (!terminal) throw new Error("Local provider stream ended without a terminal event");
      } catch (error) {
        const reason = options?.signal?.aborted ? "aborted" : "error";
        terminal = {
          type: "error", reason,
          error: {
            role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: reason, errorMessage: error instanceof Error ? error.message : String(error), timestamp: Date.now(),
          },
        };
      } finally {
        // Release before publishing the result: a result-only consumer may
        // immediately dispatch compaction or retry without iterating our stream.
        release?.();
      }
      stream.push(terminal!);
      stream.end();
    })();
    return stream;
  };
}
