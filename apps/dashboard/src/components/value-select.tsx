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
  icon?: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder}>
          {icon}
          {options.find(([key]) => key === value)?.[1]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
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
