import { useEffect, useState, type FormEvent } from "react";
import { Check, Code2, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, type Product } from "@/lib/api";
import { PageHeader, useWorkspace } from "./app-shell";
import { ErrorState } from "./shared";
type KeyInfo = { id: string; label: string; prefix: string; created_at: string; revoked: boolean };
function ProductFields({
  value,
  onChange,
  prefix,
}: {
  value: { name: string; kind: string; retention_days: number };
  onChange: (v: typeof value) => void;
  prefix: string;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${prefix}-name`}>Product name</FieldLabel>
        <Input
          id={`${prefix}-name`}
          value={value.name}
          maxLength={80}
          required
          placeholder="e.g. Orbit CLI"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-kind`}>Product type</FieldLabel>
        <NativeSelect
          id={`${prefix}-kind`}
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value })}
        >
          <NativeSelectOption value="website">Website</NativeSelectOption>
          <NativeSelectOption value="tool">Developer tool</NativeSelectOption>
          <NativeSelectOption value="generic">Generic product</NativeSelectOption>
        </NativeSelect>
        <FieldDescription>
          Sets dashboard defaults. Every type can receive events from any source.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-retention`}>Retention (days)</FieldLabel>
        <Input
          id={`${prefix}-retention`}
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
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api<Product>("/products", "POST", draft);
      await reload(p.id);
      setOpen(false);
      setDraft({ name: "", kind: "website", retention_days: 90 });
    } catch (e) {
      setError((e as Error).message);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus data-icon="inline-start" />
              New product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a product</DialogTitle>
              <DialogDescription>
                A separate space for events and ingestion keys. No URL required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create}>
              <ProductFields value={draft} onChange={setDraft} prefix="create" />
              {error && <ErrorState message={error} />}
              <Button type="submit" disabled={busy} className="mt-6">
                {busy ? "Creating…" : "Create product"}
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
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [integration, setIntegration] = useState(product.kind === "tool" ? "rust" : "browser");
  const [copied, setCopied] = useState(false);
  const [revoke, setRevoke] = useState<KeyInfo | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<KeyInfo[]>(`/products/${product.id}/keys`, "GET", undefined, controller.signal)
      .then(setKeys)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [product.id]);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
      {error && <ErrorState message={error} />}{" "}
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
                void action(async () => {
                  await api(`/products/${product.id}`, "PATCH", draft);
                  await reload();
                  setNotice("Product changes saved.");
                });
              }}
            >
              <ProductFields value={draft} onChange={setDraft} prefix="edit" />
              <div className="settings-save">
                <code title={product.id}>{product.id.slice(0, 8)}…</code>
                <Button type="submit" disabled={busy}>
                  Save changes
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
            <div className="key-list">
              {keys.length ? (
                keys.map((k) => (
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
                        onClick={() => setRevoke(k)}
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
                void action(async () => {
                  const result = await api<{ key: string }>(
                    `/products/${product.id}/keys`,
                    "POST",
                    { label },
                  );
                  setNewKey(result.key);
                  setLabel("");
                  setKeys(await api(`/products/${product.id}/keys`));
                });
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="key-label">New key label</FieldLabel>
                  <Input
                    id="key-label"
                    required
                    maxLength={80}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Production website"
                  />
                </Field>
                <Button type="submit" variant="outline" disabled={busy}>
                  <Plus data-icon="inline-start" />
                  Create ingestion key
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
            <NativeSelect
              aria-label="Integration language"
              value={integration}
              onChange={(e) => setIntegration(e.target.value)}
            >
              <NativeSelectOption value="browser">Browser tracker</NativeSelectOption>
              <NativeSelectOption value="typescript">TypeScript client</NativeSelectOption>
              <NativeSelectOption value="rust">Rust CLI</NativeSelectOption>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      <Dialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {revoke?.label}?</DialogTitle>
            <DialogDescription>
              Future requests with this key will be rejected. Events already accepted remain
              available.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!revoke) return;
                  await api(`/products/${product.id}/keys/${revoke.id}`, "DELETE");
                  setKeys(await api(`/products/${product.id}/keys`));
                  setNewKey("");
                  setRevoke(null);
                  setNotice("Ingestion key revoked.");
                })
              }
            >
              Revoke key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
