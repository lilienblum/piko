import { describe, expect, test } from "bun:test";
import { assertIsolatedE2E, e2eConfig, e2eEnvironment } from "../scripts/e2e-config";

const run = "0123456789ab";
describe("browser test isolation", () => {
  test("rejects direct runs and preview URL overrides", () => {
    const { env } = e2eEnvironment("/piko", run);
    expect(() => assertIsolatedE2E({})).toThrow("bun test:e2e");
    expect(() => assertIsolatedE2E({ ...env, PIKO_API_URL: "https://piko-api.test" })).toThrow();
    expect(() => assertIsolatedE2E({ ...env, PIKO_DASHBOARD_URL: "https://piko.test" })).toThrow();
    expect(() => assertIsolatedE2E(env)).not.toThrow();
    expect(() => e2eEnvironment("/piko", "../app")).toThrow();
  });
  test("derives isolated apps from the real configs and explicitly isolates storage and notifications", async () => {
    const setup = e2eEnvironment("/piko", run);
    const template = await Bun.file(new URL("../tako.api.toml", import.meta.url)).text();
    const config = Bun.TOML.parse(
      e2eConfig(template, setup.apiName, {
        PIKO_DATA_DIR: setup.directory,
        PIKO_CHANGE_URL: `${setup.env.PIKO_DASHBOARD_URL}/_piko/changes`,
      }),
    );
    expect(config).toMatchObject({
      name: "piko-e2e-api",
      dev: ["cargo", "run", "-p", "piko"],
      envs: { development: { route: "piko-e2e-api.test" } },
      vars: {
        development: {
          PIKO_DATA_DIR: "/piko/.tako/e2e/0123456789ab",
          PIKO_CHANGE_URL: "https://piko-e2e.test/_piko/changes",
          SSL_CERT_FILE: ".tako/dev-ca.pem",
        },
      },
    });
    expect(e2eEnvironment("/piko", "abcdef012345").directory).not.toBe(setup.directory);
  });
});
