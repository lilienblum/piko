import { Fragment, useEffect, useId, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useDisplayPreferences } from "./display-preferences";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
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

const presetGroups = [
  [
    { value: "today", key: "d" },
    { value: "yesterday", key: "e" },
  ],
  [
    { value: "24h", key: "h" },
    { value: 7, key: "w" },
    { value: 30, key: "f" },
    { value: 90, key: "n" },
  ],
  [
    { value: "month", key: "m" },
    { value: "last-month", key: "p" },
  ],
  [
    { value: "year", key: "y" },
    { value: "12months", key: "l" },
  ],
] as const;
const presets = presetGroups.flat();

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
  const { dateShortcuts } = useDisplayPreferences();
  const controlRef = useRef<HTMLFieldSetElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();
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
  const navigable = fixed || (period && period !== "12months" && period !== "24h");
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
        variant="ghost"
        size="icon"
        className="date-period-arrow"
        disabled={disabled || !shiftRange(range, direction, now, fixed ? undefined : period)}
        aria-label={direction === -1 ? "Previous period" : "Next period"}
        aria-keyshortcuts={dateShortcuts ? (direction === -1 ? "[" : "]") : undefined}
        title={`${direction === -1 ? "Previous" : "Next"} period${dateShortcuts ? (direction === -1 ? " ([)" : " (])") : ""}`}
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
  function showCalendar() {
    triggerRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    setDraft(calendarDays(range));
    setMonth(new Date(range.from));
    setOpen(false);
    setCalendar(true);
  }
  function selectPreset(value: DatePreset) {
    onPreset(value);
    setOpen(false);
  }
  useEffect(() => {
    if (!dateShortcuts || disabled || calendar) return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        target.isContentEditable ||
        target.closest(
          "input, textarea, select, [role=textbox], [role=combobox], [role=slider], [role=spinbutton]",
        )
      )
        return;
      // Let other overlays own their keyboard navigation and typeahead.
      if (
        !menuRef.current?.contains(target) &&
        Array.from(
          document.querySelectorAll(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
          ),
        ).some((popup) => !popup.closest("[hidden], [data-closed], [data-ending-style]"))
      )
        return;
      const key = event.key.toLowerCase();
      const preset = presets.find((item) => item.key === key);
      const direction = key === "[" ? -1 : key === "]" ? 1 : undefined;
      if (!preset && key !== "c" && !(direction && navigable)) return;
      event.preventDefault();
      event.stopPropagation();
      if (preset) selectPreset(preset.value);
      else if (direction) move(direction);
      else showCalendar();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  });
  return (
    <fieldset
      ref={controlRef}
      className="date-period-control"
      aria-label="Reporting period"
      data-open={open || calendar || undefined}
    >
      {periodArrow(-1)}
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (calendar) setCalendar(false);
          else setOpen(next);
        }}
        modal={false}
      >
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button variant="ghost" className="date-range-trigger" disabled={disabled} />}
          aria-label="Choose date range"
          aria-description={`${label}, UTC`}
          aria-expanded={open || calendar}
          aria-haspopup={calendar ? "dialog" : "menu"}
          {...(calendar ? { "aria-controls": calendarId } : {})}
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
        </DropdownMenuTrigger>
        <DropdownMenuContent
          ref={menuRef}
          anchor={controlRef}
          aria-label="Date range"
          className="date-period-menu"
          sideOffset={8}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          finalFocus={calendar ? false : triggerRef}
        >
          <DropdownMenuRadioGroup value={fixed ? "custom" : (period ?? days)}>
            {presetGroups.map((group, index) => (
              <Fragment key={group[0].value}>
                {index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  {group.map(({ value, key }) => (
                    <DropdownMenuRadioItem
                      key={value}
                      value={value}
                      closeOnClick
                      className="date-period-item"
                      onClick={() => selectPreset(value)}
                      aria-keyshortcuts={dateShortcuts ? key.toUpperCase() : undefined}
                      label={typeof value === "number" ? `Last ${value} days` : periodLabels[value]}
                    >
                      <span>
                        {typeof value === "number" ? `Last ${value} days` : periodLabels[value]}
                      </span>
                      {dateShortcuts && <Kbd aria-hidden="true">{key.toUpperCase()}</Kbd>}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              </Fragment>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuRadioItem
                value="custom"
                closeOnClick
                className="date-period-item"
                onClick={showCalendar}
                aria-keyshortcuts={dateShortcuts ? "C" : undefined}
                label="Custom range"
              >
                <span>Custom range</span>
                {dateShortcuts && <Kbd aria-hidden="true">C</Kbd>}
              </DropdownMenuRadioItem>
            </DropdownMenuGroup>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {periodArrow(1)}
      <Popover open={calendar} onOpenChange={setCalendar} modal={false}>
        <PopoverContent
          id={calendarId}
          anchor={controlRef}
          align="start"
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          sideOffset={8}
          className="date-range-popover"
          initialFocus={false}
          finalFocus={open ? false : triggerRef}
        >
          <Button
            variant="ghost"
            size="sm"
            className="date-range-back"
            onClick={() => {
              setCalendar(false);
              setOpen(true);
            }}
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
              <Button variant="ghost" onClick={() => setCalendar(false)}>
                Cancel
              </Button>
              <Button
                disabled={!complete}
                onClick={() => {
                  if (!complete) return;
                  onApply(rangeFromDays(draft.start, draft.end));
                  setCalendar(false);
                }}
              >
                Apply range
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </fieldset>
  );
}
