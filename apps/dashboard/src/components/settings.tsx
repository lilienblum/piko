import { useDisplayPreferences } from "./display-preferences";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Copy01Icon,
  Delete02Icon,
  Key01Icon,
  SecurityCheckIcon,
  SourceCodeIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
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
import { SourceSettings } from "./source-settings";
import { SourceIcon } from "./source-icon";
type KeyInfo = {
  source_id: string;
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  revoked: boolean;
};
function ProductFields({
  value,
  onChange,
  prefix,
  disabled = false,
}: {
  value: { name: string; retention_days: number };
  onChange: (v: typeof value) => void;
  prefix: string;
  disabled?: boolean;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${prefix}-name`}>Project name</FieldLabel>
        <Input
          id={`${prefix}-name`}
          disabled={disabled}
          value={value.name}
          maxLength={80}
          required
          placeholder="e.g. Orbit"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
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
          Automatic cleanup runs hourly. Choose the shortest useful retention window.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
export function Settings() {
  const { product, reload } = useWorkspace();
  const { timeZone, setTimeZone } = useDisplayPreferences();
  const timeZones = Array.from(new Set(["UTC", timeZone, ...Intl.supportedValuesOf("timeZone")]));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", retention_days: 30 });
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
      setDraft({ name: "", retention_days: 30 });
      setCreatedProduct(undefined);
    } catch (e) {
      setError(
        saved
          ? `Project created. Could not refresh the workspace. ${(e as Error).message}`
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Project settings"
        description="Manage collection, ingestion keys, and retention."
      >
        <Dialog
          open={open}
          onOpenChange={(value) => {
            if (!busy) setOpen(value);
          }}
        >
          <DialogTrigger render={<Button />}>
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-start"
            />
            New project
          </DialogTrigger>
          <DialogContent showCloseButton={!busy}>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
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
                    ? "Loading project…"
                    : "Creating…"
                  : createdProduct
                    ? "Retry loading project"
                    : "Create project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <Card className="display-settings">
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Preferences for this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="event-timezone">Event timezone</FieldLabel>
            <ValueSelect
              id="event-timezone"
              label="Event timezone"
              value={timeZone}
              onValueChange={setTimeZone}
              options={timeZones.map((zone) => [zone, zone.replaceAll("_", " ")])}
            />
            <FieldDescription>
              Used for event times and inspection. Charts and date ranges use UTC calendar buckets;
              stored timestamps and exports remain UTC.
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>
      {product ? (
        <ProductSettings key={product.id} product={product} />
      ) : (
        <Alert>
          <AlertTitle>Create your first project</AlertTitle>
          <AlertDescription>
            Use New project to connect a website, CLI, or any other application.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
function ProductSettings({ product }: { product: Product }) {
  const { reload, sourceId } = useWorkspace();
  const [keySourceId, setKeySourceId] = useState(
    sourceId ?? product.sources?.[0]?.id ?? product.id,
  );
  const keySource = product.sources?.find((source) => source.id === keySourceId);
  const [draft, setDraft] = useState({
    name: product.name,
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
  const [integration, setIntegration] = useState("browser");
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
      ? `<script type="module" referrerpolicy="no-referrer">\n  import { startBrowserTracker } from "${origin}/tracker.js";\n\n  const tracker = startBrowserTracker({\n    endpoint: "${origin}",\n    key: "${key}",\n    identity: "none",\n  });\n\n  tracker.track("signup", { plan: "pro", trial: true, seats: 3 });\n</script>`
      : integration === "http"
        ? `POST ${origin}/api/ingest\nAuthorization: Bearer ${key}\nContent-Type: application/json\n\n${JSON.stringify({ event_id: "GENERATE_A_UUID_ONCE", name: "screen_view", source: "mobile", timestamp: "UTC_ISO_TIMESTAMP", properties: { screen: "home", version: "1.0.0", subscribed: false } }, null, 2)}`
        : integration === "typescript"
          ? `import { Piko } from "./sdk/typescript/client";\n\nconst piko = new Piko({\n  endpoint: "${origin}",\n  key: "${key}",\n  timeoutMs: 800,\n});\n\nawait piko.send({\n  name: "build_complete", source: "server",\n  properties: { duration_ms: 142, success: true, version: "1.2.0" },\n});`
          : `PIKO_TELEMETRY=1 \\\nPIKO_ENDPOINT="${origin}" \\\nPIKO_INGESTION_KEY="${key}" \\\ncargo run -p piko --example cli -- build\n\n# Explicit telemetry opt-in; no installation ID is sent.\n# DO_NOT_TRACK=1 disables collection.\n# Delivery has an 800 ms timeout and 900 ms shutdown deadline.`;
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
          <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} aria-hidden="true" />
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      )}
      <SourceSettings product={product} />
      <div className="settings-grid">
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
            <CardDescription>One name and retention policy for all your sources.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action("save", async () => {
                  await api(`/products/${product.id}`, "PATCH", draft);
                  setNotice("Project changes saved.");
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
                <CardDescription>
                  Write-only keys bound to one source. The key determines where events arrive.
                </CardDescription>
              </div>
              <HugeiconsIcon
                icon={Key01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className="quiet-icon"
              />
            </div>
          </CardHeader>
          <CardContent>
            {newKey && (
              <Alert className="mb-5">
                <HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} aria-hidden="true" />
                <AlertTitle>Copy your new key</AlertTitle>
                <AlertDescription>
                  This is the only time the full key is shown.
                  <code className="new-key">{newKey}</code>
                  <Button variant="outline" size="sm" onClick={() => void copy(newKey)}>
                    <HugeiconsIcon
                      icon={Copy01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
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
                      <span className="quiet">
                        {product.sources?.find((source) => source.id === k.source_id)?.name ??
                          "Initial source"}
                      </span>
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
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} aria-hidden="true" />
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
                    { label, source_id: keySourceId },
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
                  <FieldLabel htmlFor="key-source">Key source</FieldLabel>
                  <ValueSelect
                    id="key-source"
                    value={keySourceId}
                    disabled={busy}
                    icon={<SourceIcon name={keySource?.name ?? ""} icon={keySource?.icon} />}
                    options={(product.sources ?? []).map((source) => [
                      source.id,
                      source.name,
                      <SourceIcon key={source.id} name={source.name} icon={source.icon} />,
                    ])}
                    onValueChange={(id) => {
                      setKeySourceId(id);
                      setCreatedKey(null);
                      setCopied(false);
                    }}
                  />
                </Field>
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
                    <HugeiconsIcon
                      icon={Add01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                  )}
                  {pending === "create-key" ? "Creating key…" : "Create ingestion key"}
                </Button>
              </FieldGroup>
            </form>
            <p className="key-note">
              Browser keys are public identifiers. They can send events, but can’t read data or
              manage your project.
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
                  <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} aria-hidden="true" />
                  Connect {keySource?.name ?? "a source"}
                </CardTitle>
                <CardDescription>
                  Use a key for this source. Identity is off by default; no users are linked
                  automatically.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsList
              variant="line"
              aria-label="Integration language"
              className="mb-4 w-full sm:w-auto"
            >
              <TabsTrigger value="browser">Browser</TabsTrigger>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="rust">Rust CLI</TabsTrigger>
              <TabsTrigger value="http">HTTP / Mobile</TabsTrigger>
            </TabsList>
            <TabsContent value={integration} key={integration}>
              <div className="code-toolbar">
                <span>
                  {integration === "browser"
                    ? "index.html"
                    : integration === "rust"
                      ? "terminal"
                      : integration === "http"
                        ? "HTTP request"
                        : "analytics.ts"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void copy(snippet)}>
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    strokeWidth={2}
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  {copied ? "Copied" : "Copy snippet"}
                </Button>
              </div>
              <pre className="integration-code">
                <code>{snippet}</code>
              </pre>
              <p className="quiet">
                {integration === "browser"
                  ? "No cookies or stored visitor IDs. Campaign capture is off, and DNT/GPC stop collection. Map private routes before collecting page views."
                  : integration === "rust"
                    ? "Telemetry requires explicit opt-in. No installation ID is created, and unknown command names are reported as other. Never send arguments or output."
                    : integration === "http"
                      ? "Send this request from your native app’s HTTP client after opt-in. Generate an event ID and UTC timestamp once, and reuse both on retries. Omit advertising IDs, device fingerprints, and personal data."
                      : "Send only the properties your project needs. No identity is added automatically. Keep emails, credentials, and private content out of events."}
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
