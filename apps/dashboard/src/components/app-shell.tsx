import { presetRange } from "@/lib/date-range";
import { DateRangePicker } from "./date-range-picker";
import { workspaceTarget, workspaceView } from "@/lib/workspace-route";
import { ProjectIcon } from "./project-icon";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ValueSelect } from "./value-select";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { api, type Product, type Source } from "@/lib/api";
import { readPreference, savePreference } from "@/lib/preferences";
import { ErrorState } from "./shared";
import { PageLoading } from "./loading";
import { LiveUpdates } from "./live-updates";

type Context = {
  products: Product[];
  product?: Product;
  source?: Source;
  sourceId?: string;
  reload: (select?: string) => Promise<void>;
  range: { from: string; to: string };
  refresh: () => void;
  refreshKey: number;
  now: number;
  setAnalyticsPending: (pending: boolean) => void;
};
const Workspace = createContext<Context | null>(null);
export function useWorkspace() {
  const value = useContext(Workspace);
  if (!value) throw new Error("Missing workspace");
  return value;
}
export function useAnalyticsPending(pending: boolean) {
  const { setAnalyticsPending } = useWorkspace();
  useEffect(() => {
    setAnalyticsPending(pending);
    return () => setAnalyticsPending(false);
  }, [pending, setAnalyticsPending]);
}
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsPending, setAnalyticsPending] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [sourceSelection, setSourceSelection] = useState<Record<string, string>>({});
  const [savedDays, setSavedDays] = useState<7 | 30 | 90>(30);
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshBackground = useCallback(() => {
    setNow(Date.now());
    // Fixed-date drilldowns also need invalidation when late events arrive.
    setRefreshKey((key) => key + 1);
  }, []);
  const [error, setError] = useState("");
  const path = useLocation({ select: (l) => l.pathname });
  const view = workspaceView(path);
  const { projectSlug } = useParams({ strict: false });
  const navigate = useNavigate();
  const search = useSearch({ from: "__root__" });
  const currentSearch = useSearch({ strict: false });
  const drilldown = view === "/explore" ? currentSearch.drilldown : undefined;
  const requestedProject = projectSlug ?? search.project;
  const days = search.days ?? (requestedProject ? 30 : savedDays);
  useEffect(() => {
    setSidebarOpen(readPreference("piko:sidebar") !== "collapsed");
    setSelected(readPreference("piko:product") ?? "");
    const saved = Number(readPreference("piko:days"));
    if ([7, 30, 90].includes(saved)) setSavedDays(saved as 7 | 30 | 90);
    setPreferencesReady(true);
    const controller = new AbortController();
    api<Product[]>("/products", "GET", undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProducts(result);
          setSourceSelection(
            Object.fromEntries(
              result.map((product) => [
                product.id,
                readPreference(`piko:source:${product.id}`) ?? "",
              ]),
            ),
          );
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useLayoutEffect(() => {
    if (preferencesReady) delete document.documentElement.dataset.sidebarInitial;
  }, [preferencesReady]);
  async function reload(select?: string) {
    const result = await api<Product[]>("/products");
    setProducts(result);
    if (select) {
      setSelected(select);
      savePreference("piko:product", select);
      const project = result.find((p) => p.id === select);
      if (project)
        await navigate({
          ...workspaceTarget(view, project.slug),
          search: {
            source: "all",
            days,
            period: search.period,
            snapshot: search.snapshot,
            from: search.from,
            to: search.to,
          },
          resetScroll: false,
        });
    }
    setError("");
  }
  const product = search.invalidWorkspace
    ? undefined
    : requestedProject
      ? products.find((p) => p.slug === requestedProject)
      : drilldown?.productId
        ? products.find((p) => p.id === drilldown.productId)
        : (products.find((p) => p.id === selected) ?? products[0]);
  const requestedSource = drilldown
    ? (drilldown.sourceId ?? "all")
    : (search.source ?? (requestedProject ? "all" : (sourceSelection[product?.id ?? ""] ?? "all")));
  const source = product?.sources?.find((source) => source.id === requestedSource);
  const sourceId = source?.id;
  const missingSource = !!requestedSource && requestedSource !== "all" && !source;
  const selectionError =
    !loading &&
    (search.invalidWorkspace ||
      (requestedProject && !product) ||
      (product && drilldown?.productId && product.id !== drilldown.productId) ||
      (!drilldown && search.source && missingSource));
  const resolvingProject =
    !!product && !projectSlug && !selectionError && !(drilldown && missingSource);
  useEffect(() => {
    if (!preferencesReady || loading || !product || selectionError || (drilldown && missingSource))
      return;
    savePreference("piko:product", product.id);
    savePreference("piko:days", String(days));
    savePreference(`piko:source:${product.id}`, sourceId ?? "");
    if (
      projectSlug !== product.slug ||
      search.project !== undefined ||
      search.source !== (sourceId ?? "all") ||
      search.days !== days
    )
      void navigate({
        ...workspaceTarget(view, product.slug),
        search: (previous) => ({
          ...previous,
          project: undefined,
          source: sourceId ?? "all",
          days,
        }),
        replace: true,
        resetScroll: false,
      });
  }, [
    preferencesReady,
    loading,
    product,
    selectionError,
    drilldown,
    missingSource,
    days,
    sourceId,
    projectSlug,
    view,
    search.project,
    search.source,
    search.days,
    navigate,
  ]);
  const rangeIdentity = JSON.stringify([
    view,
    product?.id,
    sourceId,
    days,
    search.period,
    search.snapshot,
    search.from,
    search.to,
    drilldown,
  ]);
  const [rangePath, setRangePath] = useState(rangeIdentity);
  // Canonicalizing a bare URL does not restart queries; changing actual scope does.
  if (rangePath !== rangeIdentity) {
    setRangePath(rangeIdentity);
    setNow(Date.now());
  }
  const defaultRange = useMemo(() => {
    if (search.from && search.to) return { from: search.from, to: search.to };
    if (search.period) return presetRange(search.period, now);
    const end = new Date(search.snapshot ?? now);
    const start = new Date(end);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - days + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days, now, search.period, search.snapshot, search.from, search.to]);
  const range = drilldown ? { from: drilldown.from, to: drilldown.to } : defaultRange;
  const refresh = () => {
    refreshBackground();
    if (error) void reload().catch((e) => setError(e.message));
  };
  const label = view === "/explore" ? "Explore" : view === "/settings" ? "Settings" : "Overview";
  const projectPicker = (
    <ValueSelect
      label="Select project"
      value={product?.id ?? ""}
      disabled={!products.length}
      placeholder={
        loading
          ? "Loading projects…"
          : drilldown || requestedProject || selectionError
            ? "Project unavailable"
            : "No projects yet"
      }
      className="product-select"
      contentClassName="min-w-56 max-w-[calc(100vw-32px)]"
      icon={<ProjectIcon product={product} />}
      onValueChange={(value) => {
        const project = products.find((p) => p.id === value);
        if (project)
          void navigate({
            ...workspaceTarget(view, project.slug),
            search: {
              source: "all",
              days,
              period: search.period,
              snapshot: search.snapshot,
              from: search.from,
              to: search.to,
            },
            resetScroll: false,
          });
      }}
      options={products.map((p) => [p.id, p.name, <ProjectIcon key={p.id} product={p} />])}
    />
  );
  return (
    <Workspace.Provider
      value={{
        products,
        product,
        source,
        sourceId,
        reload,
        range,
        refresh,
        refreshKey,
        now,
        setAnalyticsPending,
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open);
          savePreference("piko:sidebar", open ? "expanded" : "collapsed");
        }}
        style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as CSSProperties}
      >
        <WorkspaceSidebar
          path={view}
          product={product}
          sourceId={sourceId}
          picker={projectPicker}
          loading={loading}
          navigationReady={preferencesReady}
          onSourceChange={(id) => {
            if (!product) return;
            void navigate({
              ...workspaceTarget(view === "/settings" ? "/" : view, product.slug),
              search: {
                project: undefined,
                source: id || "all",
                days,
                period: search.period,
                snapshot: search.snapshot,
                from: search.from,
                to: search.to,
              },
              resetScroll: false,
            });
          }}
        />
        <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
          <LiveUpdates
            productId={selectionError ? undefined : product?.id}
            view={view}
            scopeKey={JSON.stringify([
              product?.id,
              sourceId,
              days,
              drilldown,
              search.period,
              search.snapshot,
              search.from,
              search.to,
              view,
            ])}
            busy={loading || resolvingProject || analyticsPending}
            onRefresh={refreshBackground}
          />
          <div
            className="page-content"
            data-page={label.toLowerCase()}
            aria-busy={loading || resolvingProject || analyticsPending}
          >
            <div className="workspace-toolbar-navigation">
              <SidebarTrigger disabled={!preferencesReady} />
              <div className="mobile-project-picker">{projectPicker}</div>
              <span className="workspace-source-name">{source?.name ?? "All sources"}</span>
            </div>
            {view !== "/settings" && (
              <div className="workspace-toolbar">
                <div className="workspace-toolbar-actions">
                  <DateRangePicker
                    days={days}
                    period={search.period}
                    onPreset={(preset) => {
                      void navigate({
                        ...workspaceTarget(view, product?.slug),
                        search: (previous) => ({
                          ...previous,
                          days: typeof preset === "number" ? preset : days,
                          period: typeof preset === "string" ? preset : undefined,
                          snapshot: undefined,
                          from: undefined,
                          to: undefined,
                          drilldown: undefined,
                          invalidDrilldown: undefined,
                          page: undefined,
                        }),
                        resetScroll: false,
                      });
                    }}
                    range={range}
                    fixed={!!(drilldown || search.snapshot || search.from)}
                    disabled={!preferencesReady || !product || !!selectionError}
                    onApply={(next) => {
                      void navigate({
                        ...workspaceTarget(view, product?.slug),
                        search: (previous) => ({
                          ...previous,
                          period: undefined,
                          from: next.from,
                          to: next.to,
                          snapshot: undefined,
                          drilldown: previous.drilldown
                            ? { ...previous.drilldown, ...next }
                            : undefined,
                          page: undefined,
                        }),
                        resetScroll: false,
                      });
                    }}
                  />
                </div>
              </div>
            )}
            {error && <ErrorState message={error} retry={refresh} />}
            {loading || resolvingProject ? (
              <>
                <PageHeader title={label} description="Your project analytics" />
                <PageLoading label="Loading workspace" />
              </>
            ) : selectionError ? (
              <>
                <PageHeader
                  title="This selection is unavailable"
                  description="The link contains an invalid date range, or its project or source is not in this workspace."
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigate({
                      to: "/",
                      search: {
                        project: undefined,
                        source: undefined,
                        days: undefined,
                        snapshot: undefined,
                        from: undefined,
                        to: undefined,
                        invalidWorkspace: undefined,
                      },
                    })
                  }
                >
                  Clear selection
                </Button>
              </>
            ) : (
              (!error || products.length > 0) && <Outlet />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Workspace.Provider>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function NoProduct() {
  return (
    <>
      <PageHeader
        title="Create your first project"
        description="Websites, CLIs, and everything you’re building."
      />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>One workspace for every project</EmptyTitle>
          <EmptyDescription>
            Create a project to get its own analytics and ingestion keys.
          </EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} role="link" render={<Link to="/settings" />}>
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={2}
            aria-hidden="true"
            data-icon="inline-start"
          />
          Create a project
        </Button>
      </Empty>
    </>
  );
}
