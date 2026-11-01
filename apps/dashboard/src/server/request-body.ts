export async function readBoundedBody(
  request: Request,
  limit: number,
  signal = AbortSignal.any([request.signal, AbortSignal.timeout(13_000)]),
): Promise<Uint8Array<ArrayBuffer>> {
  signal.throwIfAborted();
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > limit)
    throw new Response("Request body too large", { status: 413 });
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const cancel = () => {
    // Cancellation itself may wait on the underlying stream; never wait for it here.
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        cancel();
        throw new Response("Request body too large", { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
