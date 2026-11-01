export {};
const token = process.env.PIKO_ADMIN_TOKEN;
if (!token) throw new Error("Set PIKO_ADMIN_TOKEN first (see .env.example)");
const env = { ...process.env, PIKO_ADMIN_TOKEN: token };
const api = Bun.spawn(["cargo", "run", "-p", "piko"], {
  env,
  stdout: "inherit",
  stderr: "inherit",
});
const dashboard = Bun.spawn(["bun", "run", "dev"], {
  cwd: "apps/dashboard",
  env,
  stdout: "inherit",
  stderr: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    api.kill(signal);
    dashboard.kill(signal);
  });
await Promise.race([api.exited, dashboard.exited]);
api.kill();
dashboard.kill();
