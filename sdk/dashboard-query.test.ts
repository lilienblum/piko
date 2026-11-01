import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { api, queryProduct } from "../apps/dashboard/src/lib/api";

afterEach(() => mock.restore());
const busy = (retryAfter?: string) =>
  Response.json(
    { error: "Capacity exhausted" },
    { status: 503, headers: retryAfter === undefined ? {} : { "retry-after": retryAfter } },
  );

test("queries retry one advertised capacity delay with unchanged typed filters", async () => {
  const fetch = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(busy("0"))
    .mockResolvedValueOnce(Response.json({ summary: { total: 4 } }));
  const body = { filters: [{ property: "success", op: "eq", value: true }] };
  await expect(queryProduct("project", body, new AbortController().signal)).resolves.toMatchObject({
    summary: { total: 4 },
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1]);
  expect(JSON.parse(fetch.mock.calls[1][1]?.body as string)).toEqual(body);
});

test("query backpressure retries are bounded and unadvertised or long waits surface errors", async () => {
  for (const retryAfter of ["0", undefined, "30", "invalid"]) {
    const fetch = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(busy(retryAfter))
      .mockResolvedValueOnce(busy(retryAfter));
    await expect(queryProduct("project", {}, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetch).toHaveBeenCalledTimes(retryAfter === "0" ? 2 : 1);
    fetch.mockRestore();
  }
});

test("cancelling a query interrupts its capacity backoff without another request", async () => {
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(busy("5"));
  const controller = new AbortController();
  const result = queryProduct("project", {}, controller.signal);
  const timer = setTimeout(() => controller.abort(), 10);
  try {
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    clearTimeout(timer);
  }
});

test("management mutations are never automatically retried", async () => {
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(busy("0"));
  await expect(api("/products", "POST", { name: "Project" })).rejects.toMatchObject({
    status: 503,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
