import { useId, type ReactNode } from "react";
import { Skeleton as MeasuredSkeleton } from "skullet/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function OverviewWidget({
  title,
  controls,
  children,
  footer,
  className = "",
  error,
  retry,
}: {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  error?: string;
  retry: () => void;
}) {
  const id = useId();
  return (
    <section className={`overview-widget ${className}`} aria-labelledby={id}>
      <header className="widget-header">
        <h2 id={id}>{title}</h2>
        {controls}
      </header>
      <div className="widget-body">{children}</div>
      <footer className="widget-footer">
        {error ? (
          <div className="widget-error" role="alert">
            <span className="widget-error-message">{error}</span>
            <Button variant="ghost" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        ) : (
          footer
        )}
      </footer>
    </section>
  );
}

export function WidgetValue({
  value,
  label,
  loading,
  detail,
}: {
  value: string;
  label: string;
  loading: boolean;
  detail?: ReactNode;
}) {
  return (
    <div className="widget-measurement">
      <div className="widget-value">
        <MeasuredSkeleton loading={loading}>
          <span>{loading ? "12,345" : value}</span>
        </MeasuredSkeleton>
      </div>
      <span className="widget-measure-label">{label}</span>
      {detail && <span className="widget-measure-detail">{detail}</span>}
    </div>
  );
}

export function WidgetContent({
  loading,
  empty,
  label,
  children,
}: {
  loading: boolean;
  empty?: string;
  label: string;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="widget-placeholder" role="status" aria-label={`Loading ${label}`}>
        <Skeleton className="h-full w-full" />
        <span className="sr-only">Loading {label}…</span>
      </div>
    );
  if (empty)
    return (
      <div className="widget-empty" role="status">
        <p>{empty}</p>
      </div>
    );
  return children;
}
