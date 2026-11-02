import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Tick02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  calendarDays,
  periodLabels,
  presetRange,
  rangeStep,
  shiftRange,
  type DatePeriod,
  type DatePreset,
  DAY_MS,
  parseDay,
  rangeError,
  rangeFromDays,
  rangeLabel,
  type AnalyticsRange,
} from "@/lib/date-range";

export function DateRangePicker({
  range,
  days,
  period,
  onPreset,
  fixed,
  disabled,
  onApply,
}: {
  range: AnalyticsRange;
  days: 7 | 30 | 90;
  period?: DatePeriod;
  onPreset: (preset: DatePreset) => void;
  fixed: boolean;
  disabled: boolean;
  onApply: (range: AnalyticsRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [draft, setDraft] = useState(() => calendarDays(range));
  const [month, setMonth] = useState(() => new Date(range.from));
  const mobile = useIsMobile();
  const today = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const from = parseDay(draft.start);
  const to = parseDay(draft.end);
  const error = draft.start && draft.end ? rangeError(draft.start, draft.end, today) : undefined;
  const complete = !!from && !!to && !error;
  const label = fixed ? rangeLabel(range) : period ? periodLabels[period] : `Last ${days} days`;
  const navigable = fixed || (period && period !== "12months");
  const now = Date.now();
  const step = rangeStep(range, fixed ? undefined : period);
  function move(direction: -1 | 1) {
    const next = shiftRange(range, direction, now, fixed ? undefined : period);
    if (!next) return;
    const current =
      step === "day" ? "today" : step === "month" ? "month" : step === "year" ? "year" : undefined;
    if (current && next.from === presetRange(current, now).from) onPreset(current);
    else onApply(next);
  }
  function periodArrow(direction: -1 | 1) {
    if (!navigable) return null;
    return (
      <Button
        variant="outline"
        size="icon"
        className="date-period-arrow"
        disabled={disabled || !shiftRange(range, direction, now, fixed ? undefined : period)}
        aria-label={direction === -1 ? "Previous period" : "Next period"}
        onClick={() => move(direction)}
      >
        <HugeiconsIcon
          icon={direction === -1 ? ArrowLeft01Icon : ArrowRight01Icon}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Button>
    );
  }
  const count = complete ? Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1 : 0;
  const message =
    error ??
    (complete
      ? `${count} ${count === 1 ? "day" : "days"} selected`
      : from
        ? "Choose an end date."
        : "Choose a start date.");
  function changeOpen(next: boolean) {
    if (next) {
      setCalendar(false);
      setDraft(calendarDays(range));
      setMonth(new Date(range.from));
    }
    setOpen(next);
  }
  return (
    <fieldset className="date-period-control" aria-label="Reporting period">
      {periodArrow(-1)}
      <Popover open={open} onOpenChange={changeOpen} modal={false}>
        <PopoverTrigger
          render={<Button variant="outline" className="date-range-trigger" disabled={disabled} />}
          aria-label="Choose date range"
          aria-description={`${label}, UTC`}
          data-fixed={fixed || undefined}
          title={fixed ? `${rangeLabel(range)} · UTC` : undefined}
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            strokeWidth={2}
            data-icon="inline-start"
            aria-hidden="true"
          />
          <span className="date-range-label">{label}</span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          sideOffset={8}
          className={calendar ? "date-range-popover" : "date-period-popover"}
          initialFocus={!calendar}
        >
          {!calendar ? (
            <>
              <PopoverTitle className="sr-only">Date range</PopoverTitle>
              <ToggleGroup
                aria-label="Date range"
                orientation="vertical"
                spacing={1}
                className="date-period-options"
                value={fixed ? [] : [period ?? String(days)]}
              >
                {(
                  [
                    "today",
                    "yesterday",
                    7,
                    30,
                    90,
                    "month",
                    "last-month",
                    "year",
                    "12months",
                  ] as const
                ).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={String(value)}
                    onClick={() => {
                      onPreset(value);
                      setOpen(false);
                    }}
                  >
                    <span>
                      {typeof value === "number" ? `Last ${value} days` : periodLabels[value]}
                    </span>
                    {!fixed && value === (period ?? days) && (
                      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" />
                    )}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button
                variant="ghost"
                className="date-custom-option"
                onClick={() => setCalendar(true)}
              >
                Custom range
                {fixed && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" />}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="date-range-back"
                onClick={() => setCalendar(false)}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />
                Preset periods
              </Button>
              <PopoverHeader className="date-range-heading">
                <PopoverTitle>Date range</PopoverTitle>
                <PopoverDescription>
                  Select days on the calendar or enter dates. All dates are UTC.
                </PopoverDescription>
              </PopoverHeader>
              <FieldGroup className="date-range-fields">
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="range-start">Start date</FieldLabel>
                  <Input
                    id="range-start"
                    placeholder="YYYY-MM-DD"
                    autoComplete="off"
                    value={draft.start}
                    aria-invalid={!!error}
                    aria-describedby="range-feedback"
                    onChange={(event) => {
                      const start = event.target.value;
                      setDraft((previous) => ({ ...previous, start }));
                      const date = parseDay(start);
                      if (date && start >= "1970-01-01" && start <= today) setMonth(date);
                    }}
                  />
                </Field>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="range-end">End date</FieldLabel>
                  <Input
                    id="range-end"
                    placeholder="YYYY-MM-DD"
                    autoComplete="off"
                    value={draft.end}
                    aria-invalid={!!error}
                    aria-describedby="range-feedback"
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, end: event.target.value }))
                    }
                  />
                </Field>
              </FieldGroup>
              <Calendar
                className="date-range-calendar"
                mode="range"
                timeZone="UTC"
                weekStartsOn={1}
                selected={from ? { from, to } : undefined}
                onSelect={(selected) =>
                  setDraft({
                    start: selected?.from?.toISOString().slice(0, 10) ?? "",
                    end: selected?.to?.toISOString().slice(0, 10) ?? "",
                  })
                }
                resetOnSelect
                autoFocus
                fixedWeeks
                showOutsideDays={false}
                numberOfMonths={mobile ? 1 : 2}
                month={month}
                onMonthChange={setMonth}
                startMonth={new Date("1970-01-01T00:00:00Z")}
                endMonth={todayDate}
                disabled={[{ before: new Date("1970-01-01T00:00:00Z") }, { after: todayDate }]}
              />
              <div className="date-range-footer">
                <span
                  id="range-feedback"
                  role="status"
                  className={error ? "date-range-error" : undefined}
                >
                  {message}
                </span>
                <div className="date-range-actions">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!complete}
                    onClick={() => {
                      if (!complete) return;
                      onApply(rangeFromDays(draft.start, draft.end));
                      setOpen(false);
                    }}
                  >
                    Apply range
                  </Button>
                </div>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
      {periodArrow(1)}
    </fieldset>
  );
}
