import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CubeIcon } from "@hugeicons/core-free-icons";
import type { Product } from "@/lib/api";

export function ProjectIcon({ product }: { product?: Product }) {
  const [failed, setFailed] = useState<string>();
  const src = product?.favicon_version
    ? `/api/products/${encodeURIComponent(product.id)}/favicon?v=${encodeURIComponent(product.favicon_version)}`
    : undefined;
  return src && failed !== src ? (
    <img
      src={src}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      className="size-4 shrink-0 object-contain"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  ) : (
    <HugeiconsIcon icon={CubeIcon} strokeWidth={2} aria-hidden="true" />
  );
}
