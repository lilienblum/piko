import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Consistent composition for the dashboard's single-value selects. */
export function ValueSelect({
  value,
  onValueChange,
  options,
  id,
  label,
  placeholder,
  disabled,
  className,
  contentClassName,
  icon,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly (readonly [string, string, ReactNode?])[];
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <Select
      // A value picker must not remove the page scrollbar. Enclosing dialogs own their scroll lock.
      modal={false}
      items={options.map(([value, label]) => ({ value, label }))}
      value={options.some(([key]) => key === value) ? value : null}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder}>
          {icon}
          <span className="truncate">
            {options.find(([key]) => key === value)?.[1] ?? placeholder}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className={contentClassName}>
        <SelectGroup>
          {options.map(([key, text, optionIcon]) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-2">
                {optionIcon}
                {text}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
