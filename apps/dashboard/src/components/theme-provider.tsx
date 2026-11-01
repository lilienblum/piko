import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "auto";
const storageKey = "piko:theme";
const mediaQuery = "(prefers-color-scheme: dark)";
const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "auto";
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    return isTheme(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}
function applyTheme(theme: Theme) {
  const resolved = theme === "auto" ? (matchMedia(mediaQuery).matches ? "dark" : "light") : theme;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}
// Runs in the document head before styles paint, including when React is still loading.
export const themeScript = `(function(){var t='auto';try{t=localStorage.getItem('piko:theme')||'auto'}catch(e){}var r=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(r);e.style.colorScheme=r})()`;
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("auto");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    const media = matchMedia(mediaQuery);
    const update = () => {
      if (theme === "auto") applyTheme("auto");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, mounted]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setThemeState(readTheme());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function setTheme(next: Theme) {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep themes usable with storage disabled. */
    }
    applyTheme(next);
    setThemeState(next);
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function ThemeMenu() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Missing theme provider");
  const { theme, setTheme } = context;
  const icon = theme === "auto" ? ComputerIcon : theme === "dark" ? Moon02Icon : Sun03Icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance" title={`Appearance: ${theme}`}>
          <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isTheme(value)) setTheme(value);
          }}
        >
          <DropdownMenuRadioItem value="light">
            <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="auto">
            <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} aria-hidden="true" />
            Auto
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
