export const MENU_FAVORITES_KEY = "mashallah:menu-favorites:v1";
export const MAX_MENU_FAVORITES = 100;

export function parseMenuFavorites(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0 && id.length <= 128,
        ),
      ),
    ).slice(0, MAX_MENU_FAVORITES);
  } catch {
    return [];
  }
}

export function toggleMenuFavorite(ids: readonly string[], productId: string) {
  if (ids.includes(productId)) return ids.filter((id) => id !== productId);
  if (ids.length >= MAX_MENU_FAVORITES) return [...ids];
  return [...ids, productId];
}
