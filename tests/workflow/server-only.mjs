import { registerHooks } from "node:module";

// Next handles this marker at build time. These tests already run in Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: new URL("./server-marker.cjs", import.meta.url).href,
        format: "commonjs",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
