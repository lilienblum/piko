import { describe, expect, test } from "bun:test";
import { parseChangeEnvelope } from "../apps/dashboard/src/lib/change-envelope";
import { readBoundedBody } from "../apps/dashboard/src/server/request-body";

describe("change notification validation", () => {
  test("only bounded UUID hints or explicit global invalidation are accepted", () => {
    const id = crypto.randomUUID();
    expect(parseChangeEnvelope({ version: 1, products: null })).toEqual({
      version: 1,
      products: null,
    });
    expect(parseChangeEnvelope({ version: 1, products: [id] })).toEqual({
      version: 1,
      products: [id],
    });
    for (const value of [
      null,
      {},
      { version: 2, products: null },
      { version: 1, products: [] },
      { version: 1, products: ["not-an-id"] },
      { version: 1, products: Array.from({ length: 65 }, () => crypto.randomUUID()) },
    ])
      expect(parseChangeEnvelope(value)).toBeNull();
  });
  test("streamed payloads are bounded even without Content-Length", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(5));
        controller.close();
      },
    });
    try {
      await readBoundedBody(new Request("http://localhost/changes", { method: "POST", body }), 8);
      throw new Error("Expected oversized body to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(413);
    }
  });
});

test("body deadline cancels a stalled upload without awaiting its cleanup", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2));
    },
    cancel() {
      cancelled = true;
      return new Promise(() => {});
    },
  });
  await expect(
    readBoundedBody(
      new Request("http://localhost/changes", { method: "POST", body }),
      8,
      AbortSignal.timeout(20),
    ),
  ).rejects.toThrow();
  expect(cancelled).toBe(true);
});

test("oversized body rejection does not wait for stream cancellation", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(9));
    },
    cancel() {
      return new Promise(() => {});
    },
  });
  const result = readBoundedBody(
    new Request("http://localhost/changes", { method: "POST", body }),
    8,
  );
  await expect(result).rejects.toMatchObject({ status: 413 });
});
