import { createHmac, randomBytes } from "node:crypto";
import { createServer, request } from "node:http";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export async function waitFor(label, check) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await check()) return;
    await delay(500);
  }
  throw new Error(`${label} did not become ready.`);
}

export async function healthy(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(4000) })).ok;
  } catch {
    return false;
  }
}

export function localServices(project, appUrl, run) {
  const authUrl = "http://127.0.0.1:55421";
  const db = `${project}-db`;
  const auth = `${project}-auth`;
  const password = randomBytes(20).toString("hex");
  const secret = randomBytes(32).toString("hex");
  let gateway;
  let networkCreated = false;

  function jwt(role) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, exp: Math.floor(Date.now() / 1000) + 7200 })}`;
    return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  }

  async function start() {
    run("docker", ["network", "create", project]);
    networkCreated = true;
    run("docker", [
      "run",
      "-d",
      "--name",
      db,
      "--network",
      project,
      "-p",
      "127.0.0.1:55422:5432",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "postgres:18",
    ]);
    await waitFor(
      "PostgreSQL",
      () =>
        spawnSync("docker", ["exec", db, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], {
          stdio: "ignore",
        }).status === 0,
    );
    run("docker", ["exec", db, "createdb", "-U", "postgres", "cafe_pos_test"]);
    run("docker", [
      "exec",
      db,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-c",
      "CREATE SCHEMA auth",
    ]);

    const settings = {
      GOTRUE_API_HOST: "0.0.0.0",
      GOTRUE_API_PORT: "9999",
      API_EXTERNAL_URL: authUrl,
      GOTRUE_SITE_URL: appUrl,
      GOTRUE_DB_DRIVER: "postgres",
      GOTRUE_DB_DATABASE_URL: `postgres://postgres:${password}@${db}:5432/postgres?search_path=auth,public`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_JWT_SECRET: secret,
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_MAILER_AUTOCONFIRM: "true",
    };
    run("docker", [
      "run",
      "-d",
      "--name",
      auth,
      "--network",
      project,
      "-p",
      "127.0.0.1:55424:9999",
      ...Object.entries(settings).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      "public.ecr.aws/supabase/gotrue:v2.197.0",
    ]);
    try {
      await waitFor("Supabase Auth", () => healthy("http://127.0.0.1:55424/health"));
    } catch (error) {
      run("docker", ["logs", "--tail", "20", auth]);
      throw error;
    }

    // Supabase clients use /auth/v1, while the Auth container serves at /.
    gateway = createServer((incoming, response) => {
      // Acknowledge synthetic telemetry locally so it cannot leave the test stack.
      if (incoming.url?.startsWith("/telemetry/")) {
        incoming.resume();
        response
          .writeHead(200, {
            "content-type": "application/json",
            "access-control-allow-origin": appUrl,
            "access-control-allow-headers": "content-type",
            "access-control-allow-methods": "GET, POST, OPTIONS",
          })
          .end("{}");
        return;
      }
      if (!incoming.url?.startsWith("/auth/v1/")) {
        response.writeHead(404).end();
        return;
      }
      const upstream = request(
        {
          hostname: "127.0.0.1",
          port: 55424,
          path: incoming.url.slice("/auth/v1".length),
          method: incoming.method,
          headers: incoming.headers,
        },
        (result) => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => response.writeHead(502).end());
      incoming.pipe(upstream);
    });
    await new Promise((ready, reject) => {
      gateway.once("error", reject);
      gateway.listen(55421, "127.0.0.1", ready);
    });

    return {
      DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:55422/cafe_pos_test`,
      NEXT_PUBLIC_SUPABASE_URL: authUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
      SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
    };
  }

  function stop() {
    gateway?.close();
    if (!networkCreated) return;
    networkCreated = false;
    for (const name of [auth, db]) {
      if (spawnSync("docker", ["inspect", name], { stdio: "ignore" }).status === 0) {
        run("docker", ["rm", "-f", "-v", name]);
      }
    }
    run("docker", ["network", "rm", project]);
  }

  return { start, stop };
}
