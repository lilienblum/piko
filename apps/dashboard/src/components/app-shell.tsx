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
import {
  Add01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CommandLineIcon,
  CubeIcon,
  DashboardSquare01Icon,
  Globe02Icon,
  HelpCircleIcon,
  RefreshIcon,
  Search01Icon,
  Settings02Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ValueSelect } from "./value-select";
import { ThemeMenu } from "./theme-provider";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { api, type Product, type Source, type SourceKind } from "@/lib/api";
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
  dashboardKind: SourceKind;
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
export function ProductIcon({ kind }: { kind: string }) {
  const icon =
    kind === "website"
      ? Globe02Icon
      : kind === "tool"
        ? CommandLineIcon
        : kind === "mobile"
          ? SmartPhone01Icon
          : CubeIcon;
  return <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />;
}
export function Logo() {
  return (
    <span className="brand">
      <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <g transform="rotate(-10 20 20)" fill="currentColor">
          <rect x="7" y="19" width="7" height="17" rx="3.5" />
          <rect x="17" y="5" width="7" height="30" rx="3.5" />
          <rect x="27" y="5" width="7" height="20" rx="3.5" />
        </g>
      </svg>
      <span className="brand-word">
        piko<span className="brand-period">.</span>
      </span>
    </span>
  );
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
  const kinds = new Set(product?.sources?.map((source) => source.kind));
  const projectKind =
    kinds.size > 1 ? "generic" : (product?.sources?.[0]?.kind ?? product?.kind ?? "generic");
  const dashboardKind = source?.kind ?? projectKind;
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
  return (
    <Workspace.Provider
      value={{
        products,
        product,
        source,
        sourceId,
        dashboardKind,
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
        style={{ "--sidebar-width": "13rem", "--sidebar-width-icon": "3.5rem" } as CSSProperties}
      >
        <Navigation path={path} />
        <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
          <header className="topbar">
            <div className="topbar-left">
              <SidebarTrigger disabled={!preferencesReady} />
              <Separator orientation="vertical" className="h-5" />
              <ValueSelect
                label="Select project"
                value={product?.id ?? ""}
                disabled={!products.length}
                placeholder={
                  loading
                    ? "Loading projects…"
                    : drilldown
                      ? "Project unavailable"
                      : "No projects yet"
                }
                className="product-select"
                icon={<ProductIcon kind={projectKind} />}
                onValueChange={(value) => {
                  clearDrilldown();
                  setSelected(value);
                  savePreference("piko:product", value);
                }}
                options={products.map((p) => [p.id, p.name])}
              />
              {path !== "/settings" && (
                <ValueSelect
                  label="Select source"
                  value={sourceId ?? "all"}
                  disabled={!product || loading}
                  className="source-select"
                  onValueChange={(value) => {
                    if (!product) return;
                    clearDrilldown();
                    const id = value === "all" ? "" : value;
                    setSourceSelection((current) => ({ ...current, [product.id]: id }));
                    savePreference(`piko:source:${product.id}`, id);
                  }}
                  options={[
                    ["all", "All sources"],
                    ...(product?.sources ?? []).map((source) => [source.id, source.name] as const),
                  ]}
                />
              )}
              <div className="breadcrumbs">
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" />
                <strong>{label}</strong>
              </div>
            </div>
            <div className="topbar-controls">
              <LiveUpdates
                productId={product?.id}
                view={path}
                scopeKey={JSON.stringify([product?.id, sourceId, days, drilldown, refreshKey])}
                busy={loading || analyticsPending}
                onPending={setHasUpdates}
                onRefresh={refreshBackground}
              />
              <span className="timezone">UTC</span>
              <ValueSelect
                label="Date range"
                disabled={!preferencesReady}
                value={drilldown ? "linked" : String(days)}
                icon={<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} aria-hidden="true" />}
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
              <ThemeMenu />
            </div>
          </header>
          <div className="page-content" data-page={label.toLowerCase()}>
            {error && <ErrorState message={error} retry={refresh} />}
            {loading ? (
              <PageLoading label="Loading workspace" />
            ) : (
              (!error || products.length > 0) && <Outlet />
            )}
          </div>
          <footer className="page-footer">
            <span>Piko · Privacy-first analytics</span>
            <span>All times in UTC · Identity is optional</span>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </Workspace.Provider>
  );
}
function Navigation({ path }: { path: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-between py-0">
        <Link
          to="/"
          aria-label="Piko overview"
          className="brand-link"
          onClick={() => setOpenMobile(false)}
        >
          <Logo />
        </Link>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={() => setOpenMobile(false)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Main navigation">
              <SidebarMenu>
                {(
                  [
                    ["/", "Overview", DashboardSquare01Icon],
                    ["/explore", "Explore", Search01Icon],
                    ["/settings", "Settings", Settings02Icon],
                  ] as const
                ).map(([to, label, icon]) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={path === to} tooltip={label} size="lg">
                      <Link to={to} onClick={() => setOpenMobile(false)}>
                        <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
                        <span className="group-data-[collapsible=icon]:sr-only">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-5">
        <div className="local-note group-data-[collapsible=icon]:hidden">
          <span className="status-dot" />
          Self-hosted analytics
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Documentation">
              <a href="https://github.com/lilienblum/piko#readme" target="_blank" rel="noreferrer">
                <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} aria-hidden="true" />
                <span className="group-data-[collapsible=icon]:sr-only">Documentation</span>
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="ml-auto group-data-[collapsible=icon]:hidden"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Separator className="my-2" />
        <div className="sidebar-footer group-data-[collapsible=icon]:hidden">
          Piko <span>v0.1 · MIT</span>
        </div>
      </SidebarFooter>
    </Sidebar>
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
        <Button asChild>
          <Link to="/settings">
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-start"
            />
            Create a project
          </Link>
        </Button>
      </Empty>
    </>
  );
}
