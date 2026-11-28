import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as validation from "../../src/lib/catalog/form-validation";

type Action = (form: FormData) => Promise<void>;

function catalogActions(resource: string) {
  const writes: unknown[] = [];
  const write = async (input: unknown) => {
    writes.push(input);
    return {};
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/prisma": {
      prisma: {
        product: { create: write, update: write },
        modifier: { create: write, update: write },
        category: { create: write, update: write },
        modifierGroup: { create: write, update: write, delete: write },
        $transaction: async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": {
      redirect: () => {
        throw new Error("redirect");
      },
    },
    "@/lib/auth/permissions": {
      PERMISSIONS: { CATALOG_MANAGE: "catalog.manage" },
    },
    "@/lib/auth/require-permission": {
      requirePermission: async () => ({ id: "admin" }),
    },
    "@/lib/catalog/form-validation": validation,
    "@/lib/kitchen/kitchen-socket": { normalizeKitchenStation: () => null },
    "@/lib/products/availability": {},
  };
  const output = ts.transpileModule(
    readFileSync(`src/app/admin/(catalog)/${resource}/actions.ts`, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: Record<string, Action> = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name],
  });
  return { actions: exports, writes };
}

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [name, value] of Object.entries(values)) result.set(name, value);
  return result;
}

test("product and modifier create/update reject invalid prices before writes", async () => {
  for (const [resource, names] of [
    ["products", ["createProduct", "updateProduct"]],
    ["modifiers", ["createModifier", "updateModifier"]],
  ] as const) {
    for (const action of names) {
      for (const price of ["-1", "NaN", "Infinity", "-Infinity"]) {
        const service = catalogActions(resource);
        await assert.rejects(
          service.actions[action](
            form({
              id: "item",
              name: "Coffee",
              price,
              productId: "product",
              productIds: "product",
              categoryId: "category",
              modifierGroupId: "group",
            }),
          ),
          /Price must be/,
        );
        assert.equal(service.writes.length, 0, `${action} ${price}`);
      }
    }
  }
});

test("category sort orders must fit the database integer field", async () => {
  for (const action of ["createCategory", "updateCategory"]) {
    for (const sortOrder of ["-1", "1.5", "NaN", "Infinity", "2147483648"]) {
      const service = catalogActions("categories");
      await assert.rejects(
        service.actions[action](
          form({ id: "category", name: "Drinks", sortOrder }),
        ),
        /Sort order must be/,
      );
      assert.equal(service.writes.length, 0);
    }
  }
});

test("modifier groups reject blank names and impossible selection limits", async () => {
  for (const action of ["createModifierGroup", "updateModifierGroup"]) {
    for (const values of [
      { name: "   ", minSelect: "0", maxSelect: "1" },
      { name: "Extras", minSelect: "2", maxSelect: "1" },
      ...["-1", "1.5", "NaN", "Infinity", "2147483648"].flatMap((value) => [
        { name: "Extras", minSelect: value, maxSelect: "1" },
        { name: "Extras", minSelect: "0", maxSelect: value },
      ]),
    ]) {
      const service = catalogActions("modifier-groups");
      await assert.rejects(
        service.actions[action](form({ id: "group", ...values })),
        /required|selections/,
      );
      assert.equal(service.writes.length, 0);
    }
  }
});

test("modifier group update/delete require an actual ID", async () => {
  for (const action of ["updateModifierGroup", "deleteModifierGroup"]) {
    const service = catalogActions("modifier-groups");
    await assert.rejects(
      service.actions[action](form({ name: "Extras" })),
      /id is required/,
    );
    assert.equal(service.writes.length, 0);
  }
});

test("valid group edits persist normalized names and matching limits", async () => {
  for (const action of ["createModifierGroup", "updateModifierGroup"]) {
    const service = catalogActions("modifier-groups");
    await assert.rejects(
      service.actions[action](
        form({
          id: "group",
          name: "  Extras  ",
          minSelect: "1",
          maxSelect: "2",
          isActive: "on",
        }),
      ),
      /redirect/,
    );
    assert.equal(service.writes.length, 1);
    const data = (
      service.writes[0] as {
        data: {
          name: string;
          minSelect: number;
          maxSelect: number;
          isActive: boolean;
        };
      }
    ).data;
    assert.equal(data.name, "Extras");
    assert.equal(data.minSelect, 1);
    assert.equal(data.maxSelect, 2);
    assert.equal(data.isActive, true);
  }
});
