import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Code2, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ValueSelect } from "./value-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api, type Product } from "@/lib/api";
import { PageHeader, useWorkspace } from "./app-shell";
import { ErrorState } from "./shared";
type KeyInfo = { id: string; label: string; prefix: string; created_at: string; revoked: boolean };
function ProductFields({
  value,
  onChange,
  prefix,
  disabled = false,
}: {
  value: { name: string; kind: string; retention_days: number };
  onChange: (v: typeof value) => void;
  prefix: string;
  disabled?: boolean;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${prefix}-name`}>Product name</FieldLabel>
        <Input
          id={`${prefix}-name`}
          disabled={disabled}
          value={value.name}
          maxLength={80}
          required
          placeholder="e.g. Orbit CLI"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-kind`}>Product type</FieldLabel>
        <ValueSelect
          id={`${prefix}-kind`}
          disabled={disabled}
          value={value.kind}
          onValueChange={(kind) => onChange({ ...value, kind })}
          options={[
            ["website", "Website"],
            ["tool", "Developer tool"],
            ["generic", "Generic product"],
          ]}
        />
        <FieldDescription>
          Sets dashboard defaults. Every type can receive events from any source.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-retention`}>Retention (days)</FieldLabel>
        <Input
          id={`${prefix}-retention`}
          disabled={disabled}
          type="number"
          min={1}
          max={3650}
          required
          value={value.retention_days}
          onChange={(e) => onChange({ ...value, retention_days: Number(e.target.value) })}
        />
        <FieldDescription>
          Events older than this are deleted by the hourly cleanup job.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
export function Settings() {
  const { product, reload } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "website", retention_days: 90 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<Product>();
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let saved = createdProduct;
    try {
      saved ??= await api<Product>("/products", "POST", draft);
      setCreatedProduct(saved);
      await reload(saved.id);
      setOpen(false);
      setDraft({ name: "", kind: "website", retention_days: 90 });
      setCreatedProduct(undefined);
    } catch (e) {
      setError(
        saved
          ? `Product created. Could not refresh the workspace. ${(e as Error).message}`
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="A home for your products"
        description="Manage what you measure, how you collect it, and how long it stays."
      >
        <Dialog
          open={open}
          onOpenChange={(value) => {
            if (!busy) setOpen(value);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus data-icon="inline-start" />
              New product
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!busy}>
            <DialogHeader>
              <DialogTitle>Create a product</DialogTitle>
              <DialogDescription>
                A separate space for events and ingestion keys. No URL required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} aria-busy={busy}>
              <ProductFields
                value={draft}
                onChange={setDraft}
                prefix="create"
                disabled={busy || !!createdProduct}
              />
              {error && <ErrorState message={error} />}
              <Button type="submit" disabled={busy} className="mt-6">
                {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {busy
                  ? createdProduct
                    ? "Loading product…"
                    : "Creating…"
                  : createdProduct
                    ? "Retry loading product"
                    : "Create product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      {product ? (
        <ProductSettings key={product.id} product={product} />
      ) : (
        <Alert>
          <AlertTitle>Create your first product</AlertTitle>
          <AlertDescription>
            Use New product to connect a website, CLI, or any other application.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
function ProductSettings({ product }: { product: Product }) {
  const { reload } = useWorkspace();
  const [draft, setDraft] = useState({
    name: product.name,
    kind: product.kind as string,
    retention_days: product.retention_days,
  });
  const [keyState, setKeyState] = useState<
    | { status: "loading" }
    | { status: "ready"; keys: KeyInfo[] }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [label, setLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<{ id: string; key: string } | null>(null);
  const newKey = createdKey?.key ?? "";
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"save" | "create-key" | "revoke" | null>(null);
  const busy = pending !== null;
  const [integration, setIntegration] = useState(product.kind === "tool" ? "rust" : "browser");
  const [copied, setCopied] = useState(false);
  const [revoke, setRevoke] = useState<KeyInfo | null>(null);
  const [revokeError, setRevokeError] = useState("");
  const loadKeys = useCallback(
    async (signal?: AbortSignal, savedMessage = "") => {
      setKeyState({ status: "loading" });
      try {
        const keys = await api<KeyInfo[]>(`/products/${product.id}/keys`, "GET", undefined, signal);
        if (!signal?.aborted) setKeyState({ status: "ready", keys });
      } catch (e) {
        if (!signal?.aborted) {
          setKeyState({ status: "error", message: `${savedMessage}${(e as Error).message}` });
        }
      }
    },
    [product.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadKeys(controller.signal);
    return () => controller.abort();
  }, [loadKeys]);
  async function action(kind: NonNullable<typeof pending>, task: () => Promise<void>) {
    if (busy) return;
    setPending(kind);
    if (kind === "revoke") setRevokeError("");
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      if (kind === "revoke") setRevokeError((e as Error).message);
      else setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  const key = newKey || "YOUR_INGESTION_KEY";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://piko.example.com";
  const snippet =
    integration === "browser"
      ? `<script type="module">\n  import { startBrowserTracker } from "${origin}/tracker.js";\n\n  const tracker = startBrowserTracker({\n    endpoint: "${origin}",\n    key: "${key}",\n    identity: "persistent", // explicit opt-in\n    identityScope: "${product.id}",\n  });\n\n  tracker.track("signup", { plan: "pro", trial: true, seats: 3 });\n</script>`
      : integration === "typescript"
        ? `import { Piko } from "./sdk/typescript/client";\n\nconst piko = new Piko({\n  endpoint: "${origin}",\n  key: "${key}",\n  timeoutMs: 800,\n});\n\nawait piko.send({\n  name: "build_complete", source: "server",\n  properties: { duration_ms: 142, success: true, version: "1.2.0" },\n});`
        : `PIKO_ENDPOINT="${origin}" \\\nPIKO_INGESTION_KEY="${key}" \\\nPIKO_INSTALLATION_ID="optional-random-id" \\\ncargo run -p piko --example cli -- build\n\n// The CLI example uses a bounded background queue,\n// an 800 ms request timeout, and a 900 ms shutdown deadline.\n// See apps/api/examples/cli.rs.`;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard unavailable. Select the snippet and copy it manually.");
    }
  }
  return (
    <>
      {error && !revoke && <ErrorState message={error} />}
      {notice && (
        <Alert>
          <Check />
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      )}
      <div className="settings-grid">
        <Card>
          <CardHeader>
            <CardTitle>Product details</CardTitle>
            <CardDescription>Give this product a name and set its defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action("save", async () => {
                  await api(`/products/${product.id}`, "PATCH", draft);
                  setNotice("Product changes saved.");
                  try {
                    await reload();
                  } catch (e) {
                    setError(
                      `Changes saved. Could not refresh the workspace. ${(e as Error).message}`,
                    );
                  }
                });
              }}
            >
              <ProductFields value={draft} onChange={setDraft} prefix="edit" disabled={busy} />
              <div className="settings-save">
                <code title={product.id}>{product.id.slice(0, 8)}…</code>
                <Button type="submit" disabled={busy} aria-busy={pending === "save"}>
                  {pending === "save" && <Spinner data-icon="inline-start" aria-hidden="true" />}
                  {pending === "save" ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="card-heading">
              <div>
                <CardTitle>Ingestion keys</CardTitle>
                <CardDescription>Write-only keys, scoped to this product.</CardDescription>
              </div>
              <KeyRound className="quiet-icon" />
            </div>
          </CardHeader>
          <CardContent>
            {newKey && (
              <Alert className="mb-5">
                <ShieldCheck />
                <AlertTitle>Copy your new key</AlertTitle>
                <AlertDescription>
                  This is the only time the full key is shown.
                  <code className="new-key">{newKey}</code>
                  <Button variant="outline" size="sm" onClick={() => void copy(newKey)}>
                    <Copy data-icon="inline-start" />
                    {copied ? "Copied" : "Copy key"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="key-list" aria-busy={keyState.status === "loading"}>
              {keyState.status === "loading" ? (
                <div role="status" aria-label="Loading ingestion keys">
                  <span className="sr-only">Loading ingestion keys…</span>
                  {[1, 2].map((n) => (
                    <div key={n} className="key-row" aria-hidden="true">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="size-8" />
                    </div>
                  ))}
                </div>
              ) : keyState.status === "error" ? (
                <ErrorState message={keyState.message} retry={() => void loadKeys()} />
              ) : keyState.keys.length ? (
                keyState.keys.map((k) => (
                  <div className="key-row" key={k.id}>
                    <div>
                      <strong>{k.label}</strong>
                      <code>{k.prefix}••••</code>
                    </div>
                    {k.revoked ? (
                      <Badge variant="outline">Revoked</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Revoke ${k.label}`}
                        disabled={busy}
                        onClick={() => {
                          setRevokeError("");
                          setRevoke(k);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="quiet">No keys yet. Create one to start sending events.</p>
              )}
            </div>
            <form
              className="key-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (keyState.status !== "ready") return;
                void action("create-key", async () => {
                  const result = await api<{ id: string; key: string }>(
                    `/products/${product.id}/keys`,
                    "POST",
                    { label },
                  );
                  setCreatedKey(result);
                  setLabel("");
                  setNotice("Ingestion key created.");
                  await loadKeys(
                    undefined,
                    "The key was created. Could not refresh the key list. ",
                  );
                });
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="key-label">New key label</FieldLabel>
                  <Input
                    id="key-label"
                    disabled={busy || keyState.status !== "ready"}
                    required
                    maxLength={80}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Production website"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || keyState.status !== "ready"}
                  aria-busy={pending === "create-key"}
                >
                  {pending === "create-key" ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <Plus data-icon="inline-start" />
                  )}
                  {pending === "create-key" ? "Creating key…" : "Create ingestion key"}
                </Button>
              </FieldGroup>
            </form>
            <p className="key-note">
              Browser keys are public identifiers. They can send events, but can’t read data or
              manage your product.
            </p>
          </CardContent>
        </Card>
      </div>
      <Tabs value={integration} onValueChange={setIntegration}>
        <Card className="integration-card">
          <CardHeader>
            <div className="card-heading">
              <div>
                <CardTitle>
                  <Code2 />
                  Connect your product
                </CardTitle>
                <CardDescription>A small snippet. A useful starting point.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsList aria-label="Integration language" className="mb-4 w-full sm:w-auto">
              <TabsTrigger value="browser">Browser</TabsTrigger>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="rust">Rust CLI</TabsTrigger>
            </TabsList>
            <TabsContent value={integration} key={integration}>
              <div className="code-toolbar">
                <span>
                  {integration === "browser"
                    ? "index.html"
                    : integration === "rust"
                      ? "terminal"
                      : "analytics.ts"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void copy(snippet)}>
                  <Copy data-icon="inline-start" />
                  {copied ? "Copied" : "Copy snippet"}
                </Button>
              </div>
              <pre className="integration-code">
                <code>{snippet}</code>
              </pre>
              <p className="quiet">
                {integration === "browser"
                  ? "Persistent identity is opt-in: a random visitor ID per product key, plus a session that expires after 30 minutes of inactivity. Set identity to none for anonymous collection."
                  : "Identity is optional. Send an explicit anonymous installation ID to measure active installations. No IP or user-agent fingerprinting."}
              </p>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
      <AlertDialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setRevoke(null);
            setRevokeError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revoke?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future requests with this key will be rejected. Events already accepted remain
              available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t revoke this key</AlertTitle>
              <AlertDescription>{revokeError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void action("revoke", async () => {
                  if (!revoke) return;
                  await api(`/products/${product.id}/keys/${revoke.id}`, "DELETE");
                  if (createdKey?.id === revoke.id) setCreatedKey(null);
                  setRevoke(null);
                  setNotice("Ingestion key revoked.");
                  await loadKeys(
                    undefined,
                    "The key was revoked. Could not refresh the key list. ",
                  );
                });
              }}
            >
              {pending === "revoke" && <Spinner data-icon="inline-start" aria-hidden="true" />}
              {pending === "revoke" ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
