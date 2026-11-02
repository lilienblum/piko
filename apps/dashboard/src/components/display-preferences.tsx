import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readPreference, savePreference } from "@/lib/preferences";
import { validTimeZone } from "@/lib/display-time";

const key = "piko:timezone";
const DisplayPreferences = createContext({ timeZone: "UTC", setTimeZone: (_: string) => {} });

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [timeZone, setZone] = useState("UTC");
  useEffect(() => {
    const read = () => setZone(validTimeZone(readPreference(key)));
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <DisplayPreferences.Provider
      value={{
        timeZone,
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
