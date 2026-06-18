/**
 * Builds a query string from filter params while omitting the current page number.
 *
 * @param params - The query params to include, except page.
 * @returns A query string beginning with ? when params exist, or an empty string.
 *
 * @remarks Used by the products, modifiers, and categories admin pages before passing
 * the result to Pagination.
 */
export function queryStringWithoutPage(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) {
      query.set(key, value);
    }
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}
