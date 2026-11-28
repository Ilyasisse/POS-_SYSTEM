import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

type FixtureOptions = {
  signedIn?: boolean;
  active?: boolean;
  canManage?: boolean;
  uploadError?: string;
};

function fixture(options: FixtureOptions = {}) {
  const originalPath = "product/original-latte.webm";
  const originalAudio = Buffer.from("original recording");
  const recordings = new Map<string, Buffer>([[originalPath, originalAudio]]);
  const uploads: { path: string; content: Buffer; options: unknown }[] = [];
  const removals: string[][] = [];
  const permissionChecks: string[] = [];
  const storage = {
    upload: async (path: string, content: Buffer, uploadOptions: unknown) => {
      uploads.push({ path, content, options: uploadOptions });
      if (options.uploadError)
        return { error: { message: options.uploadError } };
      recordings.set(path, content);
      return { error: null };
    },
    getPublicUrl: (path: string) => ({
      data: {
        publicUrl: `https://storage.example.test/storage/v1/object/public/pronunciations/${path}`,
      },
    }),
    remove: async (paths: string[]) => {
      removals.push(paths);
      paths.forEach((path) => recordings.delete(path));
      return { error: null };
    },
  };
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: options.signedIn === false ? null : { id: "staff" } },
      }),
    },
    storage: { from: () => storage },
  };
  let sequence = 0;
  const modules: Record<string, unknown> = {
    "node:crypto": { randomUUID: () => `recording-${++sequence}` },
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
      },
    },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/prisma": {
      prisma: {
        staff: {
          findUnique: async () => ({
            id: "staff",
            role: "ADMIN",
            isActive: options.active !== false,
          }),
        },
      },
    },
    "@/lib/auth/permissions": {
      PERMISSIONS: { CATALOG_MANAGE: "catalog.manage" },
      hasPermission: (_actor: unknown, permission: string) => {
        permissionChecks.push(permission);
        return options.canManage !== false;
      },
    },
  };
  const output = ts.transpileModule(
    readFileSync("src/app/api/admin/pronunciations/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {} as { POST: (request: Request) => Promise<Response> };
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    File,
    Buffer,
    process: { env: {} },
    console: { error: () => undefined },
  });
  return {
    post: exports.POST,
    uploads,
    removals,
    recordings,
    originalPath,
    originalAudio,
    permissionChecks,
  };
}

function request(fields: Record<string, string> = {}, file?: File) {
  const data = new FormData();
  data.set("entityType", "product");
  data.set("label", "Iced Latte");
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  data.set(
    "file",
    file ?? new File(["new recording"], "latte.webm", { type: "audio/webm" }),
  );
  return new Request("https://app.example.test/api/admin/pronunciations", {
    method: "POST",
    body: data,
  });
}

test("replacement uploads leave original audio available when the editor is cancelled", async () => {
  for (const previousUrl of [
    "https://storage.example.test/storage/v1/object/public/pronunciations/product/original-latte.webm",
    "/uploads/pronunciations/original-latte.webm",
    "https://storage.example.test/storage/v1/object/public/pronunciations/modifier/shared.webm",
  ]) {
    const state = fixture();
    const response = await state.post(request({ previousUrl }));
    assert.equal(response.status, 200);
    assert.equal(state.uploads.length, 1);
    assert.equal(state.removals.length, 0);
    assert.equal(state.recordings.get(state.originalPath), state.originalAudio);
    assert.equal(state.recordings.size, 2);
    assert.match(
      (await response.json()).url,
      /product\/recording-1-iced-latte\.webm$/,
    );
    assert.deepEqual(state.permissionChecks, ["catalog.manage"]);
    assert.deepEqual(
      { ...(state.uploads[0].options as object) },
      { contentType: "audio/webm", upsert: false },
    );
  }
});

test("repeated recordings use separate objects without replacing shared audio", async () => {
  const state = fixture();
  const first = await state.post(
    request({ entityType: "modifier", label: "Whole milk" }),
  );
  const second = await state.post(
    request({ entityType: "modifier", label: "Whole milk" }),
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.notEqual((await first.json()).url, (await second.json()).url);
  assert.ok(
    state.uploads.every((upload) => upload.path.startsWith("modifier/")),
  );
  assert.equal(state.removals.length, 0);
  assert.equal(state.recordings.get(state.originalPath), state.originalAudio);
});

test("invalid entity types are rejected before uploading", async () => {
  for (const entityType of ["", "category", "../../other-bucket", "PRODUCT"]) {
    const state = fixture();
    const response = await state.post(request({ entityType }));
    assert.equal(response.status, 400);
    assert.equal(state.uploads.length, 0);
    assert.match((await response.json()).error, /product or modifier/);
  }
});

test("pronunciation uploads retain authentication and catalog permission checks", async () => {
  for (const options of [
    { signedIn: false },
    { active: false },
    { canManage: false },
  ]) {
    const state = fixture(options);
    const response = await state.post(request());
    assert.equal(response.status, 403);
    assert.equal(state.uploads.length, 0);
  }
});

test("invalid recordings and oversized labels are rejected before storage", async () => {
  for (const file of [
    new File([], "empty.webm", { type: "audio/webm" }),
    new File(["text"], "note.txt", { type: "text/plain" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.webm", {
      type: "audio/webm",
    }),
  ]) {
    const state = fixture();
    assert.equal((await state.post(request({}, file))).status, 400);
    assert.equal(state.uploads.length, 0);
  }
  const state = fixture();
  assert.equal(
    (await state.post(request({ label: "a".repeat(121) }))).status,
    400,
  );
  assert.equal(state.uploads.length, 0);
});

test("a failed replacement upload preserves original audio", async () => {
  const state = fixture({ uploadError: "Storage unavailable" });
  const response = await state.post(
    request({
      previousUrl:
        "https://storage.example.test/storage/v1/object/public/pronunciations/product/original-latte.webm",
    }),
  );
  assert.equal(response.status, 500);
  assert.equal(state.recordings.size, 1);
  assert.equal(state.recordings.get(state.originalPath), state.originalAudio);
  assert.equal(state.removals.length, 0);
});
