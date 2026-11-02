import { SkeletonBox } from "skullet/react";
import { cn } from "@/lib/utils";

/** Skullet's shared shimmer for fixed-size placeholders; text uses measured Skeletons. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("overflow-hidden rounded-sm", className)} {...props}>
      <SkeletonBox width="100%" height="100%" radius="3px" />
    </div>
  );
}
export { Skeleton };
