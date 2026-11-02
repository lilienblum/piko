import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readPreference, savePreference } from "@/lib/preferences";
import { validTimeZone } from "@/lib/display-time";

const key = "piko:timezone";
const shortcutsKey = "piko:date-shortcuts";
const DisplayPreferences = createContext({
  timeZone: "UTC",
  setTimeZone: (_: string) => {},
  dateShortcuts: true,
  setDateShortcuts: (_: boolean) => {},
});

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [timeZone, setZone] = useState("UTC");
  const [dateShortcuts, setShortcuts] = useState(true);
  useEffect(() => {
    const read = () => {
      setZone(validTimeZone(readPreference(key)));
      setShortcuts(readPreference(shortcutsKey) !== "off");
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === shortcutsKey || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <DisplayPreferences.Provider
      value={{
        timeZone,
        dateShortcuts,
        setDateShortcuts: (enabled) => {
          setShortcuts(enabled);
          savePreference(shortcutsKey, enabled ? "on" : "off");
        },
        setTimeZone: (value) => {
          const zone = validTimeZone(value);
          setZone(zone);
          savePreference(key, zone);
        },
      }}
    >
      {children}
    </DisplayPreferences.Provider>
  );
}

export function useDisplayPreferences() {
  return useContext(DisplayPreferences);
}
