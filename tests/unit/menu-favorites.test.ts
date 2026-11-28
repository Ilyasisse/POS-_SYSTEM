import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MENU_FAVORITES,
  parseMenuFavorites,
  toggleMenuFavorite,
} from "../../src/lib/customer/menu-favorites";

test("saved menu IDs tolerate damaged or stale device storage", () => {
  assert.deepEqual(parseMenuFavorites("not JSON"), []);
  assert.deepEqual(parseMenuFavorites('{"product":"1"}'), []);
  assert.deepEqual(parseMenuFavorites('["1","1",null,"2",""]'), ["1", "2"]);
  assert.equal(
    parseMenuFavorites(
      JSON.stringify(Array.from({ length: 150 }, (_, i) => String(i))),
    ).length,
    MAX_MENU_FAVORITES,
  );
});

test("saving and removing favorites preserves order and enforces the limit", () => {
  assert.deepEqual(toggleMenuFavorite(["a", "b"], "a"), ["b"]);
  assert.deepEqual(toggleMenuFavorite(["a", "b"], "c"), ["a", "b", "c"]);
  const full = Array.from({ length: MAX_MENU_FAVORITES }, (_, i) => String(i));
  assert.deepEqual(toggleMenuFavorite(full, "extra"), full);
});
