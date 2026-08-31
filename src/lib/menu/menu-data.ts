import { availableForSaleWhere } from "@/lib/products/availability";

// Used for: The product cards, featured items, filtering, and sorting on /menu.
// What it does: Defines the shape of one product shown on the menu page.
// Like you are 10: This is the checklist every food or drink item must follow.
export type MenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryName: string;
  categorySlug: string;
  imageUrl: string | null;
  isPopular: boolean;
  bestSellerScore: number;
};

// Used for: Grouping menu products into category sections/tabs on /menu.
// What it does: Defines one menu category and the products inside it.
// Like you are 10: This is one menu shelf with items on it.
export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  products: MenuProduct[];
};

// Used for: The full data payload passed from the server page to MenuShowcase.
// What it does: Defines all data the menu page needs to render.
// Like you are 10: This is the full lunchbox the menu page opens.
export type MenuData = {
  cafeName: string;
  heroImage: string;
  categories: MenuCategory[];
  products: MenuProduct[];
  featuredItems: MenuProduct[];
  hasLiveData: boolean;
};

// Used for: Keeping familiar categories in a predictable display order.
// What it does: Controls the preferred display order for known categories.
// Like you are 10: This tells the shelves which order to stand in.
const CATEGORY_ORDER = [
  "Coffee",
  "Tea",
  "Fast Food",
  "Cunto Soomaali",
  "Desserts",
  "Drinks",
] as const;

// Used for: Fast category sorting without scanning CATEGORY_ORDER repeatedly.
// What it does: Lets categoryRank find a category's display position quickly.
// Like you are 10: This is a quick lookup list for shelf order.
const CATEGORY_ORDER_LOOKUP = new Map(
  CATEGORY_ORDER.map((name, index) => [name.toLowerCase(), index]),
);

// Used for: The /menu hero image in both live-data and empty-data states.
// What it does: Stores the hero image path used by live and empty menu states.
// Like you are 10: This is the top picture the menu keeps using.
const heroImage = "/menu-hero-bg.png";

// Used for: Safely inserting category/product names into generated SVG fallback art.
// What it does: Escapes special characters so text is safe inside generated SVG art.
// Like you are 10: This stops weird letters from breaking the backup picture.
function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Used for: Returning generated SVG fallback art as a normal image URL string.
// What it does: Converts raw SVG code into an image URL the browser can show.
// Like you are 10: This turns drawing instructions into a picture card.
function svgToDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\s+/g, " ").trim(),
  )}`;
}

// Used for: Category ids, tab ids, and product grouping keys in the menu UI.
// What it does: Converts text into a clean slug used by menu tabs and grouping.
// Like you are 10: This turns "Fast Food" into "fast-food" for the computer.
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Used for: Sorting grouped categories after live products are loaded.
// What it does: Gets the sorting rank for a category name.
// Like you are 10: This decides which shelf should come first.
function categoryRank(name: string) {
  const normalized = name.trim().toLowerCase();

  return CATEGORY_ORDER_LOOKUP.get(normalized) ?? CATEGORY_ORDER.length + 1;
}

// Used for: Normalizing database image paths before rendering product images.
// What it does: Makes database image paths safe for browser use.
// Like you are 10: This fixes picture addresses so the browser can find them.
function resolveAssetUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return value.startsWith("/") ? value : `/${value}`;
}

// Used for: Giving products a visual fallback when no uploaded product image exists.
// What it does: Builds generated artwork when a product has no uploaded image.
// Like you are 10: If there is no food photo, this draws a backup picture.
function buildCategoryArt(categoryName: string, productName: string) {
  const palettes: Record<string, [string, string, string]> = {
    coffee: ["#3a1f12", "#b9783b", "#f3d6b3"],
    tea: ["#3b2616", "#9d5c2e", "#efe0c5"],
    "fast food": ["#462012", "#df8d2f", "#f6e5c5"],
    "cunto soomaali": ["#5a2416", "#bc6a38", "#f7dfc3"],
    desserts: ["#4b2018", "#b86a42", "#ffe4c9"],
    drinks: ["#352012", "#d98b38", "#ffe2b8"],
  };

  const [primary, secondary, highlight] = palettes[
    categoryName.trim().toLowerCase()
  ] ?? ["#352012", "#ba7437", "#f4dcc0"];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
        <radialGradient id="shine" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="${highlight}" stop-opacity="0.85" />
          <stop offset="100%" stop-color="${highlight}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" rx="48" fill="url(#card)" />
      <circle cx="620" cy="130" r="170" fill="url(#shine)" />
      <ellipse cx="405" cy="465" rx="250" ry="75" fill="#20110d" fill-opacity="0.45" />
      <ellipse cx="400" cy="455" rx="165" ry="56" fill="#f2dec4" />
      <ellipse cx="400" cy="455" rx="132" ry="42" fill="#6d3e20" />
      <ellipse cx="400" cy="460" rx="116" ry="33" fill="#9a5d31" />
      <path d="M315 452 C 355 404, 395 404, 425 452 C 455 500, 495 500, 535 452" stroke="#fff6ea" stroke-width="7" fill="none" stroke-linecap="round" />
      <path d="M348 462 C 377 425, 401 425, 418 462 C 436 493, 461 493, 489 462" stroke="#fff6ea" stroke-width="5" fill="none" stroke-linecap="round" />
      <path d="M245 454 C 240 548, 560 548, 555 454 C 551 394, 249 394, 245 454 Z" fill="#efe1cc" />
      <path d="M555 448 C 607 448, 626 510, 582 538" stroke="#efe1cc" stroke-width="22" fill="none" stroke-linecap="round" />
      <text x="60" y="86" fill="#fdf6ef" font-size="28" font-family="Trebuchet MS, Segoe UI, sans-serif" letter-spacing="4">${escapeSvgText(
        categoryName.toUpperCase(),
      )}</text>
      <text x="60" y="530" fill="#fff7ee" font-size="58" font-family="Georgia, serif">${escapeSvgText(
        productName,
      )}</text>
    </svg>
  `;

  return svgToDataUri(svg);
}

// Used for: Converting the flat product list into the category data MenuShowcase expects.
// What it does: Groups the flat product list into menu categories for the UI.
// Like you are 10: This puts each item back onto the right shelf.
function groupCategories(products: MenuProduct[]) {
  const groups = new Map<string, MenuCategory>();

  for (const product of products) {
    const key = product.categorySlug;
    const existing = groups.get(key);

    if (existing) {
      existing.products.push(product);
      continue;
    }
    

    groups.set(key, {
      id: key,
      name: product.categoryName,
      slug: key,
      products: [product],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    const rankDiff = categoryRank(left.name) - categoryRank(right.name);

    if (rankDiff !== 0) {
      return rankDiff;
    }
   
    return left.name.localeCompare(right.name);
  });
}

// Used for: Loading the live database-backed data for the public /menu page.
// What it does: Loads active categories, products, and bestseller data from the database.
// Like you are 10: This asks the kitchen computer what should be on the menu.
async function loadLiveMenuData(): Promise<MenuData | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    // categoriesResult fetches active menu categories and only the product fields
    // needed by /menu. The explicit select avoids unused database columns breaking
    // the public menu if Prisma/client schema drift happens again.
    // bestSellerRows reads OrderItem sales history to rank featured products.
    const [categoriesResult, bestSellerRows] = await Promise.all([
      prisma.category.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              isActive: true,
              ...availableForSaleWhere(),
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          products: {
            where: {
              isActive: true,
              ...availableForSaleWhere(),
            },
            orderBy: [{ isPopular: "desc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
              isPopular: true,
            },
          },
        },
      }),

      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: {
          qty: true,
        },
        orderBy: {
          _sum: {
            qty: "desc",
          },
        },
        take: 8,
      }),
    ]);

    // Used for quick productId -> sold quantity lookup while building MenuProduct.
    const bestSellerMap = new Map(
      bestSellerRows.map((row) => [row.productId, Number(row._sum.qty ?? 0)]),
    );

    // Flattens category/product query results into the exact shape the menu UI uses.
    const products = categoriesResult
      .flatMap((category) =>
        category.products.map((product) => {
          const categorySlug = slugify(category.name);

          return {
            id: product.id,
            name: product.name,
            description: product.description?.trim() || "NOTHING FOUND",
            price: Number(product.price),
            categoryName: category.name,
            categorySlug,
            imageUrl:
              resolveAssetUrl(product.imageUrl) ??
              buildCategoryArt(category.name, product.name),
            isPopular: product.isPopular,
            bestSellerScore: bestSellerMap.get(product.id) ?? 0,
          } satisfies MenuProduct;
        }),
      )
      .sort((left, right) => {
        if (right.bestSellerScore !== left.bestSellerScore) {
          return right.bestSellerScore - left.bestSellerScore;
        }

        if (right.isPopular !== left.isPopular) {
          return Number(right.isPopular) - Number(left.isPopular);
        }

        return left.name.localeCompare(right.name);
      });

    if (products.length === 0) {
      return null;
    }

    // Rebuilds category sections from the sorted flat product list.
    const categories = groupCategories(products);

    // Featured items prefer real best sellers, then manually popular products,
    // then all products when there is no sales/popularity signal yet.
    const featuredSource = products.some(
      (product) => product.bestSellerScore > 0,
    )
      ? products.filter((product) => product.bestSellerScore > 0)
      : products.some((product) => product.isPopular)
        ? products.filter((product) => product.isPopular)
        : products;

    return {
      cafeName: "Maash Allah Cafe",
      heroImage,
      categories,
      products,
      featuredItems: featuredSource.slice(0, 4),
      hasLiveData: true,
    };
  } catch (error) {
    console.error("Failed to load live menu data", error);
    return null;
  }
}

// Used for: Returning a safe empty state when live menu data cannot be loaded.
// What it does: Builds the empty menu response when live POS data cannot load.
// Like you are 10: This gives the page an empty lunchbox instead of nothing.
function buildEmptyMenuData(): MenuData {
  return {
    cafeName: "Maash Allah Cafe",
    heroImage,
    categories: [],
    products: [],
    featuredItems: [],
    hasLiveData: false,
  };
}

// Used for: The server page at src/app/menu/page.tsx.
// What it does: Exports the main function the menu page calls for its data.
// Like you are 10: This is the main helper that brings food data to the page.
export async function getMenuData(): Promise<MenuData> {
  const liveData = await loadLiveMenuData();

  return liveData ?? buildEmptyMenuData();
}
