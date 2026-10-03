import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getDefaultRouteForUser } from "../../src/lib/auth/get-default-route-for-user";

type Profile = { role: string; station: string | null; isActive: boolean };

function loginRedirect(profile: Profile | null) {
  const redirects: string[] = [];
  const dependencies: Record<string, unknown> = {
    "next/navigation": {
      redirect(destination: string) {
        redirects.push(destination);
        throw new Error(`redirect:${destination}`);
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "verified-id" } },
            error: null,
          }),
        },
      }),
    },
    "@/lib/auth/app-user": {
      findAppUser: async (id: string) => {
        assert.equal(id, "verified-id");
        return profile;
      },
    },
    "@/lib/auth/get-default-route-for-user": { getDefaultRouteForUser },
  };
  const output = ts.transpileModule(
    readFileSync("src/lib/auth/redirect-authenticated-user.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: {
    redirectAuthenticatedUser?: (next?: "/customer" | null) => Promise<void>;
  } = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name],
  });
  return { run: exports.redirectAuthenticatedUser!, redirects };
}

test("inactive and missing application profiles can render the login page", async () => {
  for (const profile of [
    null,
    { role: "ADMIN", station: null, isActive: false },
    { role: "CUSTOMER", station: null, isActive: false },
  ]) {
    const login = loginRedirect(profile);
    await login.run("/customer");
    assert.deepEqual(login.redirects, []);
  }
});

test("roles without a workspace do not repeatedly redirect back to staff login", async () => {
  for (const role of ["SUPPLIER", "CLEANER", "COOK"]) {
    const login = loginRedirect({ role, station: null, isActive: true });
    await login.run();
    assert.deepEqual(login.redirects, []);
  }
});

test("active staff and customers still follow authenticated destinations", async () => {
  const staff = loginRedirect({
    role: "CASHIER",
    station: null,
    isActive: true,
  });
  await assert.rejects(staff.run("/customer"), /redirect:\/auth\/redirect/);
  assert.deepEqual(staff.redirects, ["/auth/redirect"]);
  const customer = loginRedirect({
    role: "CUSTOMER",
    station: null,
    isActive: true,
  });
  await assert.rejects(customer.run("/customer"), /redirect:\/customer/);
  assert.deepEqual(customer.redirects, ["/customer"]);
});

test("kitchen destinations follow the station used for authorization", () => {
  assert.equal(
    getDefaultRouteForUser({ role: "BARISTA", station: "FAST_FOOD" }),
    "/kitchen/fast-food",
  );
  assert.equal(
    getDefaultRouteForUser({ role: "Cabitaan", station: "BARISTA" }),
    "/kitchen/barista",
  );
  assert.equal(
    getDefaultRouteForUser({ role: "COOK", station: "CUNTO_SOOMAALI" }),
    "/kitchen/cunto-soomaali",
  );
  assert.equal(
    getDefaultRouteForUser({ role: "BARISTA", station: null }),
    "/kitchen/barista",
  );
  assert.equal(
    getDefaultRouteForUser({ role: "CLEANER", station: "BARISTA" }),
    "/staff-login",
  );
});
