import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function pollingFixture() {
  const effects: (() => (() => void) | undefined)[] = [];
  const state: unknown[] = [];
  const requests: ((response: { ok: boolean; json: () => Promise<unknown> }) => void)[] = [];
  const callbacks = new Map<string, () => void>();
  let initial: () => void = () => undefined;
  let interval: () => void = () => undefined;
  const exports: Record<string, (props: unknown) => unknown> = {};
  const output = ts.transpileModule(
    readFileSync("src/components/customer/CustomerCheckoutPageClient.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const dependencies: Record<string, unknown> = {
    react: {
      useState: (value: unknown) => {
        const index = state.push(value) - 1;
        return [value, (next: unknown) => {
          state[index] = typeof next === "function" ? next(state[index]) : next;
        }];
      },
      useRef: (value: unknown) => ({ current: value }),
      useCallback: (callback: unknown) => callback,
      useMemo: (calculate: () => unknown) => calculate(),
      useEffect: (effect: (typeof effects)[number]) => effects.push(effect),
    },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "next/navigation": { useRouter: () => ({}) },
    "@/components/ui/toast": { useToast: () => ({ toast: () => undefined }) },
    "@/lib/payments/customer-ussd": { isAndroidDevice: () => false },
  };
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    fetch: () => new Promise(resolve => requests.push(resolve)),
    navigator: { userAgent: "test" },
    window: {
      setTimeout: (callback: () => void) => { initial = callback; return 1; },
      setInterval: (callback: () => void) => { interval = callback; return 2; },
      clearTimeout: () => undefined,
      clearInterval: () => undefined,
      addEventListener: (name: string, callback: () => void) => callbacks.set(name, callback),
      removeEventListener: () => undefined,
    },
    document: {
      visibilityState: "visible",
      addEventListener: (name: string, callback: () => void) => callbacks.set(name, callback),
      removeEventListener: () => undefined,
    },
  });
  exports.default({ checkoutId: "checkout" });
  const cleanup = effects[0]();
  return {
    state,
    requests,
    start: () => initial(),
    poll: () => interval(),
    focus: () => callbacks.get("focus")?.(),
    cleanup,
  };
}

async function flushResponse() {
  for (let index = 0; index < 6; index++) await Promise.resolve();
}

test("slow checkout polling and focus changes share one request and accept its result", async () => {
  const f = pollingFixture();
  f.start();
  f.poll();
  f.poll();
  f.focus();
  assert.equal(f.requests.length, 1);
  const checkout = { id: "checkout", status: "PAID", stage: "READY" };
  f.requests[0]({ ok: true, json: async () => ({ checkout }) });
  await flushResponse();
  assert.equal(f.state[0], checkout);
  assert.equal(f.state[1], false);
  f.poll();
  assert.equal(f.requests.length, 2);
  f.cleanup?.();
});

test("checkout cleanup prevents a pending response from updating an unmounted page", async () => {
  const f = pollingFixture();
  f.start();
  f.cleanup?.();
  f.requests[0]({ ok: true, json: async () => ({ checkout: { id: "old" } }) });
  await flushResponse();
  assert.equal(f.state[0], null);
  assert.equal(f.state[1], true);
});

test("a failed checkout request clears its pending slot so the next poll can retry", async () => {
  const f = pollingFixture();
  f.start();
  f.requests[0]({ ok: false, json: async () => ({ error: "Unavailable" }) });
  await flushResponse();
  assert.equal(f.state[1], false);
  assert.equal(f.state[2], "Unavailable");
  f.poll();
  assert.equal(f.requests.length, 2);
  f.cleanup?.();
});
