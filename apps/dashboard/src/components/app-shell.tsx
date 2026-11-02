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
import { Link, Outlet, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Calendar03Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ValueSelect } from "./value-select";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { api, type Product, type Source } from "@/lib/api";
import { readPreference, savePreference } from "@/lib/preferences";
import { ErrorState } from "./shared";
import { PageLoading } from "./loading";
import { Spinner } from "@/components/ui/spinner";
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
  hasUpdates: boolean;
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
  const [days, setDays] = useState(30);
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasUpdates, setHasUpdates] = useState(false);
  const refreshBackground = useCallback(() => setNow(Date.now()), []);
  const [error, setError] = useState("");
  const path = useLocation({ select: (l) => l.pathname });
  const [rangePath, setRangePath] = useState(path);
  // Mount the next view with a current rolling interval, before its queries start.
  if (rangePath !== path) {
    setRangePath(path);
    setNow(Date.now());
  }
  const navigate = useNavigate();
  const exploreSearch = useSearch({ from: "/explore", shouldThrow: false });
  const drilldown = exploreSearch?.drilldown;
  const linkedProductId = drilldown?.productId;
  useEffect(() => {
    if (linkedProductId && products.some((p) => p.id === linkedProductId)) {
      setSelected(linkedProductId);
      savePreference("piko:product", linkedProductId);
    }
  }, [linkedProductId, products]);
  const clearDrilldown = () => {
    if (path === "/explore") void navigate({ to: "/explore", search: {} });
  };
  useEffect(() => {
    setSidebarOpen(readPreference("piko:sidebar") !== "collapsed");
    setSelected(readPreference("piko:product") ?? "");
    const saved = Number(readPreference("piko:days"));
    if ([7, 30, 90].includes(saved)) setDays(saved);
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
    }
    setError("");
  }
  const product = drilldown
    ? products.find((p) => p.id === drilldown.productId)
    : (products.find((p) => p.id === selected) ?? products[0]);
  const requestedSource = drilldown
    ? (drilldown.sourceId ?? "")
    : (sourceSelection[product?.id ?? ""] ?? "");
  const source = product?.sources?.find((source) => source.id === requestedSource);
  const sourceId = source?.id;
  const defaultRange = useMemo(() => {
    const end = new Date(now);
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - days + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days, now]);
  const range = drilldown ? { from: drilldown.from, to: drilldown.to } : defaultRange;
  const refresh = () => {
    setNow(Date.now());
    setRefreshKey((key) => key + 1);
    if (error) void reload().catch((e) => setError(e.message));
  };
  const label = path === "/explore" ? "Explore" : path === "/settings" ? "Settings" : "Overview";
  const projectPicker = (
    <ValueSelect
      label="Select project"
      value={product?.id ?? ""}
      disabled={!products.length}
      placeholder={
        loading ? "Loading projects…" : drilldown ? "Project unavailable" : "No projects yet"
      }
      className="product-select"
      contentClassName="min-w-56 max-w-[calc(100vw-32px)]"
      icon={<ProjectIcon product={product} />}
      onValueChange={(value) => {
        clearDrilldown();
        setSelected(value);
        savePreference("piko:product", value);
        setNow(Date.now());
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
        hasUpdates,
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
          path={path}
          product={product}
          sourceId={sourceId}
          picker={projectPicker}
          loading={loading}
          onSourceChange={(id) => {
            if (!product) return;
            clearDrilldown();
            setSourceSelection((current) => ({ ...current, [product.id]: id }));
            savePreference(`piko:source:${product.id}`, id);
            setNow(Date.now());
            if (path === "/settings") void navigate({ to: "/" });
          }}
        />
        <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
          <LiveUpdates
            productId={product?.id}
            view={path}
            scopeKey={JSON.stringify([product?.id, sourceId, days, drilldown, refreshKey])}
            busy={loading || analyticsPending}
            onPending={setHasUpdates}
            onRefresh={refreshBackground}
          />
          <div className="page-content" data-page={label.toLowerCase()}>
            <div className="workspace-toolbar">
              <div className="workspace-toolbar-navigation">
                <SidebarTrigger disabled={!preferencesReady} />
                <div className="mobile-project-picker">{projectPicker}</div>
                <span className="workspace-source-name">{source?.name ?? "All sources"}</span>
              </div>
              {path !== "/settings" && (
                <div className="workspace-toolbar-actions">
                  <ValueSelect
                    label="Date range"
                    disabled={!preferencesReady}
                    value={drilldown ? "linked" : String(days)}
                    icon={
                      <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} aria-hidden="true" />
                    }
                    className="date-select"
                    onValueChange={(value) => {
                      if (value === "linked") return;
                      clearDrilldown();
                      setDays(Number(value));
                      savePreference("piko:days", value);
                      setNow(Date.now());
                    }}
                    options={[
                      ...(drilldown ? [["linked", "Fixed dates"] as const] : []),
                      ["7", "Last 7 days"],
                      ["30", "Last 30 days"],
                      ["90", "Last 90 days"],
                    ]}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh analytics"
                    onClick={refresh}
                    disabled={loading || analyticsPending}
                    aria-busy={loading || analyticsPending}
                  >
                    {loading || analyticsPending ? (
                      <Spinner aria-hidden="true" />
                    ) : (
                      <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} aria-hidden="true" />
                    )}
                  </Button>
                </div>
              )}
            </div>
            {error && <ErrorState message={error} retry={refresh} />}
            {loading ? (
              <>
                <PageHeader title={label} description="Your project analytics" />
                <PageLoading label="Loading workspace" />
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
