import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "./shared";

export const parseOrigins = (text: string) =>
  text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export function AllowedOriginsField({
  id,
  value,
  onChange,
  disabled,
  website,
}: {
  website?: string | null;
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Allowed origins</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={8192}
        autoComplete="off"
        spellCheck={false}
        placeholder="https://example.com, https://*.example.com"
      />
      {website && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={() => onChange(website)}
        >
          Use project website
        </Button>
      )}
      <FieldDescription>
        Optional, comma-separated. A wildcard allows subdomains, not the root domain. Leave blank
        for CLI, mobile, or server keys.
      </FieldDescription>
    </Field>
  );
}

export function KeyOriginsEditor({
  productId,
  keyInfo,
  onSaved,
  disabled,
}: {
  productId: string;
  keyInfo: { id: string; label: string; allowed_origins: string[] };
  onSaved: () => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/products/${productId}/keys/${keyInfo.id}`, "PATCH", {
        allowed_origins: parseOrigins(value),
      });
      setOpen(false);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setValue(keyInfo.allowed_origins.join(", "));
        setError("");
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`Edit allowed origins for ${keyInfo.label}`}
          />
        }
      >
        Origins
      </DialogTrigger>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Allowed origins for {keyInfo.label}</DialogTitle>
          <DialogDescription>
            Restricted keys reject requests with a missing or unmatched Origin header. These checks
            reduce browser misuse; they don’t authenticate clients.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <AllowedOriginsField
            id={`origins-${keyInfo.id}`}
            value={value}
            onChange={setValue}
            disabled={busy}
          />
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={busy} className="mt-6">
            {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {busy ? "Saving…" : "Save origins"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
