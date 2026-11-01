export interface ChangeEnvelope {
  version: 1;
  products: string[] | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChangeEnvelope(value: unknown): ChangeEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    body.version !== 1 ||
    Object.keys(body).some((key) => key !== "version" && key !== "products")
  )
    return null;
  if (body.products === null) return { version: 1, products: null };
  if (!Array.isArray(body.products) || body.products.length < 1 || body.products.length > 64)
    return null;
  if (!body.products.every((id) => typeof id === "string" && uuid.test(id))) return null;
  return {
    version: 1,
    products: [...new Set(body.products.map((id: string) => id.toLowerCase()))],
  };
}
