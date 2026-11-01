import { useState, type FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { api, type Product, type Source } from "@/lib/api";
import { useWorkspace } from "./app-shell";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";
import { SourceIcon, SourceIconPicker } from "./source-icon";
import type { SourceIconId } from "@/lib/source-icons";
import { ErrorState } from "./shared";

export function SourceSettings({ product }: { product: Product }) {
  const { reload } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Source>();
  const [draft, setDraft] = useState<{ name: string; icon: SourceIconId | null }>({
    name: "",
    icon: null,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  function show(source?: Source) {
    setEditing(source);
    setDraft(source ? { name: source.name, icon: source.icon } : { name: "", icon: null });
    setSaved(false);
    setError("");
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let committed = saved;
    try {
      if (!committed) {
        await api(
          `/products/${product.id}/sources${editing ? `/${editing.id}` : ""}`,
          editing ? "PATCH" : "POST",
          draft,
        );
        committed = true;
        setSaved(true);
      }
      await reload();
      setOpen(false);
    } catch (error) {
      setError(
        `${committed ? "Source saved. Could not refresh the workspace. " : ""}${(error as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="sources-card">
      <CardHeader>
        <div className="card-heading">
          <div>
            <CardTitle>Sources</CardTitle>
            <CardDescription>
              Websites, mobile apps, and tools feeding one project. Each source has its own keys.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => show()}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} aria-hidden="true" />
            Add source
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="source-list">
          {(product.sources ?? []).map((source) => (
            <div className="source-row" key={source.id}>
              <span className="source-mark">
                <SourceIcon name={source.name} icon={source.icon} />
              </span>
              <div className="source-copy">
                <strong>{source.name}</strong>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit source ${source.name}`}
                onClick={() => show(source)}
              >
                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} aria-hidden="true" />
                Edit
              </Button>
            </div>
          ))}
        </div>
        <p className="quiet">
          Use All sources for a combined view, or select one in Overview and Explore. Retention
          belongs to the project.
        </p>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit source" : "Add a source"}</DialogTitle>
            <DialogDescription>
              A named integration within {product.name}. No URL or device identity required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} aria-busy={busy}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="source-name">Source name</FieldLabel>
                <Input
                  id="source-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Website, iOS app, CLI"
                  required
                  maxLength={80}
                  disabled={busy || saved}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="source-icon">Icon</FieldLabel>
                <SourceIconPicker
                  name={draft.name}
                  value={draft.icon}
                  onChange={(icon) => setDraft({ ...draft, icon })}
                  disabled={busy || saved}
                />
                <FieldDescription>
                  Automatic follows the source name. Icons only change its appearance.
                </FieldDescription>
              </Field>
            </FieldGroup>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="mt-6" disabled={busy}>
              {busy && <Spinner aria-hidden="true" />}
              {busy
                ? "Saving…"
                : saved
                  ? "Retry loading source"
                  : editing
                    ? "Save source"
                    : "Create source"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
