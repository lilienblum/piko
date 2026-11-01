import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { tako } from "tako.sh/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

function browserTracker(): Plugin {
  const moduleId = "\0virtual:piko-tracker";
  return {
    name: "piko-browser-tracker",
    resolveId(id) {
      if (id === "virtual:piko-tracker") return moduleId;
    },
    async load(id) {
      if (id !== moduleId) return;
      const entry = new URL("../../sdk/typescript/browser.ts", import.meta.url).pathname;
      this.addWatchFile(entry);
      this.addWatchFile(new URL("../../sdk/typescript/client.ts", import.meta.url).pathname);
      const result = await Bun.build({
        entrypoints: [entry],
        target: "browser",
        format: "esm",
        minify: true,
      });
      if (!result.success) throw new AggregateError(result.logs, "Browser tracker build failed");
      return `export default ${JSON.stringify(await result.outputs[0].text())};`;
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), browserTracker(), tanstackStart(), react(), tako()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  // Tako reads channel metadata through this internal development hostname.
  server: { port: 3000, allowedHosts: ["piko.tako"] },
});
