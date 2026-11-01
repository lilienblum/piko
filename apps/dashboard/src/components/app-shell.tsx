import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Box,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Command,
  Globe2,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
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
import { api, type Product } from "@/lib/api";
import { ErrorState, Loading } from "./shared";

type Context = {
  products: Product[];
  product?: Product;
  reload: (select?: string) => Promise<void>;
  range: { from: string; to: string };
  refresh: () => void;
};
const Workspace = createContext<Context | null>(null);
export function useWorkspace() {
  const value = useContext(Workspace);
  if (!value) throw new Error("Missing workspace");
  return value;
}
export function ProductIcon({ kind }: { kind: string }) {
  return kind === "website" ? <Globe2 /> : kind === "tool" ? <Command /> : <Box />;
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
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [days, setDays] = useState(30);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    setSidebarOpen(localStorage.getItem("piko:sidebar") !== "collapsed");
    setSelected(localStorage.getItem("piko:product") ?? "");
    const saved = Number(localStorage.getItem("piko:days"));
    if ([7, 30, 90].includes(saved)) setDays(saved);
    const controller = new AbortController();
    api<Product[]>("/products", "GET", undefined, controller.signal)
      .then(setProducts)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  async function reload(select?: string) {
    const result = await api<Product[]>("/products");
    setProducts(result);
    if (select) {
      setSelected(select);
      localStorage.setItem("piko:product", select);
    }
    setError("");
  }
  const product = products.find((p) => p.id === selected) ?? products[0];
  const range = useMemo(() => {
    const end = new Date(now);
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - days + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days, now]);
  const refresh = () => {
    setNow(Date.now());
    if (error) void reload().catch((e) => setError(e.message));
  };
  if (error && !products.length)
    return (
      <main className="initial-loading">
        <ErrorState message={error} retry={() => window.location.reload()} />
      </main>
    );
  if (loading)
    return (
      <main className="initial-loading">
        <Logo />
        <p>Opening your workspace…</p>
      </main>
    );
  const label = path === "/explore" ? "Explore" : path === "/settings" ? "Settings" : "Overview";
  return (
    <Workspace.Provider value={{ products, product, reload, range, refresh }}>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open);
          localStorage.setItem("piko:sidebar", open ? "expanded" : "collapsed");
        }}
        style={{ "--sidebar-width": "14rem", "--sidebar-width-icon": "3.5rem" } as CSSProperties}
      >
        <Navigation path={path} />
        <SidebarInset className="min-w-0">
          <header className="topbar">
            <div className="topbar-left">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-5" />
              <ValueSelect
                label="Select product"
                value={product?.id ?? ""}
                disabled={!products.length}
                placeholder="No products yet"
                className="product-select"
                icon={<ProductIcon kind={product?.kind ?? "generic"} />}
                onValueChange={(value) => {
                  setSelected(value);
                  localStorage.setItem("piko:product", value);
                }}
                options={products.map((p) => [p.id, p.name])}
              />
              <div className="breadcrumbs">
                <ChevronRight />
                <strong>{label}</strong>
              </div>
            </div>
            <div className="topbar-controls">
              <span className="timezone">UTC</span>
              <ValueSelect
                label="Date range"
                value={String(days)}
                icon={<CalendarDays />}
                className="date-select"
                onValueChange={(value) => {
                  setDays(Number(value));
                  localStorage.setItem("piko:days", value);
                  setNow(Date.now());
                }}
                options={[
                  ["7", "Last 7 days"],
                  ["30", "Last 30 days"],
                  ["90", "Last 90 days"],
                ]}
              />
              <Button variant="ghost" size="icon" aria-label="Refresh analytics" onClick={refresh}>
                <RefreshCw />
              </Button>
              <ThemeMenu />
            </div>
          </header>
          <div className="page-content">
            {error && <ErrorState message={error} retry={refresh} />}
            <Outlet />
          </div>
          <footer className="page-footer">
            <span>
              <Sparkles />A little data. A clearer picture.
            </span>
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
      <SidebarHeader className="flex-row items-center justify-between py-7">
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
            <X />
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
                    ["/", "Overview", LayoutDashboard],
                    ["/explore", "Explore", Search],
                    ["/settings", "Settings", Settings2],
                  ] as const
                ).map(([to, label, Icon]) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={path === to} tooltip={label} size="lg">
                      <Link to={to} onClick={() => setOpenMobile(false)}>
                        <Icon />
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
          Self-hosted workspace
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Documentation">
              <a href="https://github.com/lilienblum/piko#readme" target="_blank" rel="noreferrer">
                <CircleHelp />
                <span className="group-data-[collapsible=icon]:sr-only">Documentation</span>
                <ArrowUpRight className="ml-auto group-data-[collapsible=icon]:hidden" />
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
        <div className="eyebrow">PRODUCT ANALYTICS</div>
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
        title="Make room for your first product"
        description="Websites, CLIs, and everything you’re building."
      />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>One workspace for every product</EmptyTitle>
          <EmptyDescription>
            Create a product to get its own analytics and ingestion keys.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild>
          <Link to="/settings">
            <Plus data-icon="inline-start" />
            Create a product
          </Link>
        </Button>
      </Empty>
    </>
  );
}
export { Loading };
