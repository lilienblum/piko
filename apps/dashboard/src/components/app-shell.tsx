import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type FormEvent,
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
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { api, type Product } from "@/lib/api";
import { ErrorState, Loading } from "./shared";
import { cn } from "@/lib/utils";
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
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      piko<span className="brand-period">.</span>
    </span>
  );
}
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { token });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-brand">
        <Logo />
        <span>Small footprint. Clear picture.</span>
      </div>
      <Card className="login-card">
        <CardHeader>
          <span className="eyebrow">YOUR PRODUCTS, IN FOCUS</span>
          <CardTitle>Welcome to Piko</CardTitle>
          <CardDescription>Sign in to your private analytics workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
                <Input
                  id="admin-token"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  autoFocus
                />
                <FieldDescription>
                  Use the PIKO_ADMIN_TOKEN configured on your server.
                </FieldDescription>
              </Field>
              {error && <ErrorState message={error} />}
              <Button disabled={busy || !token} type="submit">
                {busy ? "Signing in…" : "Open workspace"}
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <p className="login-note">
        <ShieldCheck />
        Self-hosted. Your data stays with you.
      </p>
    </main>
  );
}
export function AppShell() {
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [days, setDays] = useState(30);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    setSelected(localStorage.getItem("piko:product") ?? "");
    const saved = Number(localStorage.getItem("piko:days"));
    if ([7, 30, 90].includes(saved)) setDays(saved);
    const unauthorized = () => setAuthenticated(false);
    window.addEventListener("piko:unauthorized", unauthorized);
    api("/session")
      .then(() => setAuthenticated(true))
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
        else setAuthenticated(false);
      });
    return () => window.removeEventListener("piko:unauthorized", unauthorized);
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
  useEffect(() => {
    if (authenticated)
      api<Product[]>("/products")
        .then(setProducts)
        .catch((e) => setError(e.message));
  }, [authenticated]);
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
  if (error && authenticated === undefined)
    return (
      <main className="login">
        <ErrorState message={error} retry={() => window.location.reload()} />
      </main>
    );
  if (authenticated === undefined)
    return (
      <main className="initial-loading">
        <Logo />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!authenticated)
    return (
      <Login
        onSuccess={() => {
          setError("");
          setAuthenticated(true);
        }}
      />
    );
  const label = path === "/explore" ? "Explore" : path === "/settings" ? "Settings" : "Overview";
  return (
    <Workspace.Provider value={{ products, product, reload, range, refresh }}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" aria-label="Piko overview">
            <Logo />
          </Link>
          <div className="workspace-label">
            WORKSPACE <Badge variant="outline">Personal</Badge>
          </div>
          <div className="product-switch">
            <span className={cn("product-symbol", product?.kind)}>
              <ProductIcon kind={product?.kind ?? "generic"} />
            </span>
            <div>
              <span className="micro-label">Current product</span>
              <NativeSelect
                aria-label="Select product"
                value={product?.id ?? ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  localStorage.setItem("piko:product", e.target.value);
                }}
              >
                {products.length ? (
                  products.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))
                ) : (
                  <NativeSelectOption value="">No products yet</NativeSelectOption>
                )}
              </NativeSelect>
            </div>
          </div>
          <nav aria-label="Main navigation">
            <Link to="/" className={cn("nav-item", path === "/" && "active")}>
              <LayoutDashboard />
              Overview
            </Link>
            <Link to="/explore" className={cn("nav-item", path === "/explore" && "active")}>
              <Search />
              Explore
            </Link>
            <Link to="/settings" className={cn("nav-item", path === "/settings" && "active")}>
              <Settings2 />
              Settings
            </Link>
          </nav>
          <div className="sidebar-bottom">
            <div className="local-note">
              <span className="status-dot" />
              <span>Self-hosted workspace</span>
            </div>
            <a
              href="https://github.com/lilienblum/piko#readme"
              target="_blank"
              rel="noreferrer"
              className="nav-item"
            >
              <CircleHelp />
              Documentation
              <ArrowUpRight />
            </a>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await api("/session", "DELETE");
                  setAuthenticated(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
            <div className="sidebar-footer">
              Piko <span>v0.1 · MIT</span>
            </div>
          </div>
        </aside>
        <div className="main-area">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>Workspace</span>
              <ChevronRight />
              <strong>{label}</strong>
            </div>
            <div className="topbar-controls">
              <span className="timezone">UTC</span>
              <CalendarDays />
              <NativeSelect
                aria-label="Date range"
                value={days}
                onChange={(e) => {
                  setDays(Number(e.target.value));
                  localStorage.setItem("piko:days", e.target.value);
                  setNow(Date.now());
                }}
              >
                <NativeSelectOption value={7}>Last 7 days</NativeSelectOption>
                <NativeSelectOption value={30}>Last 30 days</NativeSelectOption>
                <NativeSelectOption value={90}>Last 90 days</NativeSelectOption>
              </NativeSelect>
              <Button variant="ghost" size="icon" aria-label="Refresh analytics" onClick={refresh}>
                <RefreshCw />
              </Button>
            </div>
          </header>
          <main className="page-content">
            {error && <ErrorState message={error} retry={refresh} />}
            <Outlet />
          </main>
          <footer className="page-footer">
            <span>
              <Sparkles />A little data. A clearer picture.
            </span>
            <span>All times in UTC · Identity is optional</span>
          </footer>
        </div>
      </div>
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
