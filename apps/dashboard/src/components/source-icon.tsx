import { HugeiconsIcon } from "@hugeicons/react";
import {
  AndroidIcon,
  AppleIcon,
  CodeIcon,
  CommandLineIcon,
  ComputerIcon,
  CubeIcon,
  GameController03Icon,
  Globe02Icon,
  PackageIcon,
  ServerStack01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { resolveSourceIcon, sourceIcons, type SourceIconId } from "@/lib/source-icons";
import { ValueSelect } from "./value-select";

const icons = {
  website: Globe02Icon,
  ios: AppleIcon,
  android: AndroidIcon,
  mobile: SmartPhone01Icon,
  terminal: CommandLineIcon,
  desktop: ComputerIcon,
  server: ServerStack01Icon,
  code: CodeIcon,
  package: PackageIcon,
  game: GameController03Icon,
  generic: CubeIcon,
};
export function SourceIcon({ name, icon }: { name: string; icon?: SourceIconId | null }) {
  const resolved = resolveSourceIcon({ name, icon });
  return (
    <HugeiconsIcon
      icon={icons[resolved]}
      strokeWidth={2}
      aria-hidden="true"
      data-source-icon={resolved}
    />
  );
}
export function SourceIconPicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: SourceIconId | null;
  onChange: (icon: SourceIconId | null) => void;
  disabled?: boolean;
}) {
  const automatic = resolveSourceIcon({ name });
  return (
    <ValueSelect
      id="source-icon"
      label="Icon"
      value={value ?? "auto"}
      onValueChange={(icon) => onChange(icon === "auto" ? null : (icon as SourceIconId))}
      disabled={disabled}
      icon={<SourceIcon name={name} icon={value} />}
      options={[
        [
          "auto",
          `Automatic · ${sourceIcons.find(([id]) => id === automatic)?.[1]}`,
          <SourceIcon key="auto" name={name} />,
        ],
        ...sourceIcons.map(
          ([id, label]) => [id, label, <SourceIcon key={id} name="" icon={id} />] as const,
        ),
      ]}
    />
  );
}
