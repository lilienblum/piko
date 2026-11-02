import { useId, useMemo, type ReactNode } from "react";
import { defineChart, type ChartPoint } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { Chart } from "@tanstack/charts/react";
import { tooltip } from "@tanstack/charts/tooltip";
import { Skeleton as MeasuredSkeleton } from "skullet/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { number } from "@/lib/api";
import type { DistributionSlice } from "@/lib/overview-widgets";

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

export function DonutChart({
  data,
  label,
  value,
  detail,
  percentage = false,
}: {
  data: DistributionSlice[];
  label: string;
  value: string;
  detail: string;
  percentage?: boolean;
}) {
  const definition = useMemo(() => {
    const rows = data.filter((row) => row.value > 0);
    return defineChart({
      marks: [
        polar({
          inset: 6,
          marks: [
            radialArc(pie(rows, { value: "value" }), {
              key: "id",
              color: "id",
              innerRadius: ({ radius }) => radius * 0.76,
              stroke: "var(--card)",
              strokeWidth: rows.length > 1 ? 2 : 0,
            }),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: { x: null, y: null },
      color: { domain: rows.map((row) => row.id), range: rows.map((row) => row.color) },
      margin: 0,
      svgAnimation: false,
      focusRing: false,
      tooltip: {
        use: tooltip,
        motion: false,
        content: (points: readonly ChartPoint[]) => {
          const row = rows[points[0]?.datumIndex];
          return {
            rows: row
              ? [
                  {
                    label: row.label,
                    value: `${number(row.value, percentage ? 1 : 0)}${percentage ? "%" : " events"}`,
                    color: row.color,
                  },
                ]
              : [],
          };
        },
      },
      theme: {
        foreground: "var(--foreground)",
        muted: "var(--muted-foreground)",
        background: "transparent",
      },
    });
  }, [data, percentage]);
  return (
    <div className="widget-donut" data-chart-library="tanstack" data-chart-kind="donut">
      <Chart
        definition={definition}
        className="analytics-plot"
        style={{ height: "100%", touchAction: "pan-y pinch-zoom" }}
        ariaLabel={label}
        ariaDescription="Use arrow keys to inspect categories and Escape to dismiss. Exact values are also listed below."
        onRender={({ svg, interaction }) => {
          svg.onkeydown = (event) => {
            if (event.key === "Escape") interaction.setControlledFocus(null);
          };
        }}
      />
      <div className="donut-total">
        <strong>{value}</strong>
        <span className="donut-detail">{detail}</span>
      </div>
    </div>
  );
}
