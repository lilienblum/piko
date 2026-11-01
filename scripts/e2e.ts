import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { e2eConfig, e2eEnvironment } from "./e2e-config";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const setup = e2eEnvironment(root, run);
if (!Bun.which("tako"))
  throw new Error("Install Tako, then initialize local development with bun dev.");
if (!(await Bun.file(setup.env.SSL_CERT_FILE).exists()))
  throw new Error("Initialize local TLS and the notification secret once with bun dev.");

const templates: { name: string; template: string; vars: Record<string, string> }[] = [
  {
    name: setup.apiName,
    template: "tako.api.toml",
    vars: {
      PIKO_DATA_DIR: setup.directory,
      PIKO_CHANGE_URL: `${setup.env.PIKO_DASHBOARD_URL}/_piko/changes`,
    },
  },
  {
    name: setup.name,
    template: "tako.dashboard.toml",
    vars: {
      PIKO_API_URL: setup.env.PIKO_API_URL,
      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: `${setup.name}.tako,${setup.name}.test`,
    },
  },
];
const configs = templates.map((config) => ({
  ...config,
  path: `${root}.tako-e2e-${run}-${config.name}.toml`,
}));

let child: ReturnType<typeof Bun.spawn> | undefined;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    interrupted = true;
    child?.kill(signal);
  });
async function command(args: string[], env = process.env) {
  child = Bun.spawn(args, { cwd: root, env, stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  child = undefined;
  return code;
}

async function runningApps(): Promise<{ name: string; config: string }[]> {
  const listing = Bun.spawn(["tako", "dev", "list", "--json"], {
    cwd: root,
    stdout: "pipe",
    stderr: "inherit",
  });
  const result = await new Response(listing.stdout).json();
  if ((await listing.exited) !== 0 || !result.ok || !Array.isArray(result.apps))
    throw new Error("Could not inspect running Tako apps");
  return result.apps;
}

async function restoreApps(configs: string[]) {
  const running = new Set((await runningApps()).map((app) => app.config));
  for (const config of configs) {
    if (
      !running.has(config) &&
      (await command(["tako", "-c", config, "dev", "--background", "--json"])) !== 0
    )
      throw new Error(`Could not restore Tako app ${config}`);
  }
}

// Stable hostnames avoid issuing new local TLS certificates on every run.
await mkdir(`${root}.tako/e2e`, { recursive: true });
const lock = `${root}.tako/e2e/runner.lock`;
await mkdir(lock).catch(() => {
  throw new Error(
    `E2E runner is locked. If a previous run was force-killed, stop its piko-e2e apps and remove ${lock}.`,
  );
});
let previous: Awaited<ReturnType<typeof runningApps>> = [];
let exitCode = 1;
const attempted: typeof configs = [];
try {
  previous = await runningApps();
  if (previous.some((app) => [setup.name, setup.apiName].includes(app.name)))
    throw new Error("A previous piko-e2e app is still running; stop it before another test run.");
  await mkdir(setup.directory, { recursive: true });
  for (const config of configs) {
    if (interrupted) throw new Error("E2E startup interrupted");
    const template = await Bun.file(`${root}${config.template}`).text();
    await Bun.write(config.path, e2eConfig(template, config.name, config.vars));
    // Record before startup: the daemon may register an app even if readiness fails.
    attempted.push(config);
    if ((await command(["tako", "-c", config.path, "dev", "--background", "--json"])) !== 0)
      throw new Error(`Could not start ${config.name}`);
  }
  // The first addition of a TLS name can restart Tako's daemon. Restore any
  // registrations it dropped, including the API started just before the dashboard.
  await restoreApps([...previous.map((app) => app.config), ...configs.map((app) => app.path)]);
  if (interrupted) throw new Error("E2E startup interrupted");
  console.log(`Disposable E2E workspace: ${setup.env.PIKO_DASHBOARD_URL}`);
  exitCode = await command(
    ["bun", "node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { ...process.env, ...setup.env },
  );
} catch (error) {
  console.error(error);
} finally {
  for (const config of attempted.slice().reverse()) {
    // Do not remove open databases, even when the tests or app startup failed.
    await command(["tako", "-c", config.path, "dev", "stop", "--json"]);
  }
  await restoreApps(previous.map((app) => app.config));
  const remaining = new Set((await runningApps()).map((app) => app.config));
  const stopped = attempted.every((config) => !remaining.has(config.path));
  if (stopped) {
    await rm(setup.directory, { recursive: true, force: true });
    for (const config of configs) await rm(config.path, { force: true });
    await rm(lock, { recursive: true });
    console.log("E2E apps stopped and their temporary databases removed.");
  } else {
    console.error(`E2E stop failed; isolated data retained at ${setup.directory}.`);
    exitCode = 1;
  }
}
process.exitCode = interrupted ? 130 : exitCode;
