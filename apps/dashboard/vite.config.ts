import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), react()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  server: { port: 3000, proxy: { "/api": process.env.PIKO_API_URL ?? "http://127.0.0.1:3001" } },
});
