import { join } from "node:path";

export function e2eEnvironment(root: string, run: string) {
  if (!/^[a-f0-9]{12}$/.test(run)) throw new Error("Invalid E2E run ID");
  const name = "piko-e2e";
  return {
    name,
    apiName: `${name}-api`,
    directory: join(root, ".tako", "e2e", run),
    env: {
      PIKO_E2E_RUN: run,
      PIKO_API_URL: `https://${name}-api.test`,
      PIKO_DASHBOARD_URL: `https://${name}.test`,
      PIKO_REALTIME: "1",
      SSL_CERT_FILE: join(root, ".tako", "dev-ca.pem"),
    },
  };
}

export function assertIsolatedE2E(env: Record<string, string | undefined>) {
  const run = env.PIKO_E2E_RUN;
  if (!run || !/^[a-f0-9]{12}$/.test(run))
    throw new Error("Run browser tests with bun test:e2e; direct runs can pollute preview data.");
  const expected = e2eEnvironment(".", run).env;
  if (
    env.PIKO_API_URL !== expected.PIKO_API_URL ||
    env.PIKO_DASHBOARD_URL !== expected.PIKO_DASHBOARD_URL
  )
    throw new Error("Browser tests must use their disposable E2E apps, never the preview.");
}

export function e2eConfig(template: string, name: string, vars: Record<string, string>) {
  const config = Bun.TOML.parse(template) as {
    name: string;
    envs: { development: { route: string } };
    vars: { development: Record<string, string> };
  };
  config.name = name;
  config.envs.development.route = `${name}.test`;
  Object.assign(config.vars.development, vars);
  return Bun.TOML.stringify(config);
}
