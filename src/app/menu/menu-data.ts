// Defines the shape/type of one menu product item
export type MenuProduct = {
  // Unique product ID
  id: string;

  // Product name shown to the customer
  name: string;

  // Product description shown on the menu card
  description: string;

  // Product price as a number
  price: number;

  // Human-readable category name like "Coffee"
  categoryName: string;

  // URL-safe category name like "coffee"
  categorySlug: string;

  // Product image URL, or null if no image exists
  imageUrl: string | null;

  // Marks product as popular
  isPopular: boolean;

  // Used to rank best-selling products
  bestSellerScore: number;
};

// Defines the shape/type of one menu category
export type MenuCategory = {
  // Unique category ID
  id: string;

  // Category name shown to customers
  name: string;

  // URL-safe category name
  slug: string;

  // Products inside this category
  products: MenuProduct[];
};

// Defines the full menu data structure
export type MenuData = {
  // Cafe name shown on the menu page
  cafeName: string;

  // Hero background image for menu page
  heroImage: string;

  // All menu categories
  categories: MenuCategory[];

  // All menu products
  products: MenuProduct[];

  // Products shown in featured section
  featuredItems: MenuProduct[];

  // Tells if data came from database or fallback
  hasLiveData: boolean;
};

// Controls the display order of categories
const CATEGORY_ORDER = [
  "Coffee",
  "Tea",
  "Fast Food",
  "Cunto Soomaali",
  "Desserts",
  "Drinks",
] as const;

// Creates a lookup map to quickly find category order number
const CATEGORY_ORDER_LOOKUP = new Map(
  CATEGORY_ORDER.map((name, index) => [name.toLowerCase(), index]),
);

// Stores the hero image path
const heroImage = "/menu-hero-bg.png";

// Backup menu items used if database data is unavailable
const placeholderItems: Array<{
  id: string;
  name: string;
  description: string;
  price: number;
  categoryName: string;
  isPopular: boolean;
}> = [
  {
    id: "sample-cappuccino",
    name: "Cappuccino",
    description: "Rich espresso with steamed milk and a silky foam finish.",
    price: 2.5,
    categoryName: "Coffee",
    isPopular: true,
  },
  {
    id: "sample-iced-latte",
    name: "Iced Latte",
    description: "Smooth espresso poured over ice with chilled milk.",
    price: 2.75,
    categoryName: "Coffee",
    isPopular: true,
  },
  {
    id: "sample-caramel-latte",
    name: "Caramel Latte",
    description: "House espresso, caramel syrup, and creamy steamed milk.",
    price: 2.9,
    categoryName: "Coffee",
    isPopular: true,
  },
  {
    id: "sample-masala-tea",
    name: "Masala Tea",
    description: "Traditional spiced tea brewed fresh with warming notes.",
    price: 1.5,
    categoryName: "Tea",
    isPopular: true,
  },
  {
    id: "sample-green-tea",
    name: "Mint Green Tea",
    description: "Light green tea with mint leaves and a clean finish.",
    price: 1.8,
    categoryName: "Tea",
    isPopular: false,
  },
  {
    id: "sample-beef-burger",
    name: "Beef Burger",
    description: "Juicy beef patty with cheese, lettuce, and house sauce.",
    price: 4.5,
    categoryName: "Fast Food",
    isPopular: true,
  },
  {
    id: "sample-fries",
    name: "French Fries",
    description: "Golden fries served hot with a crisp outer finish.",
    price: 2.3,
    categoryName: "Fast Food",
    isPopular: true,
  },
  {
    id: "sample-samosa",
    name: "Samosa (2pcs)",
    description: "Crisp pastry triangles with a savory filling and dip.",
    price: 1.8,
    categoryName: "Fast Food",
    isPopular: false,
  },
  {
    id: "sample-bariis-hilib",
    name: "Bariis & Hilib",
    description: "Traditional Somali rice served with tender meat and spices.",
    price: 6,
    categoryName: "Cunto Soomaali",
    isPopular: true,
  },
  {
    id: "sample-suqaar",
    name: "Suqaar Plate",
    description: "Seasoned beef cubes with vegetables and fresh flatbread.",
    price: 5.8,
    categoryName: "Cunto Soomaali",
    isPopular: false,
  },
  {
    id: "sample-chocolate-cake",
    name: "Chocolate Cake",
    description: "Moist chocolate cake layered with a rich cocoa filling.",
    price: 2.8,
    categoryName: "Desserts",
    isPopular: true,
  },
  {
    id: "sample-cheesecake",
    name: "Vanilla Cheesecake",
    description: "Creamy cheesecake with a smooth vanilla finish.",
    price: 3.2,
    categoryName: "Desserts",
    isPopular: false,
  },
  {
    id: "sample-mango-juice",
    name: "Mango Juice",
    description: "Fresh mango juice blended cold and served naturally sweet.",
    price: 2.2,
    categoryName: "Drinks",
    isPopular: true,
  },
  {
    id: "sample-berry-smoothie",
    name: "Berry Smoothie",
    description: "Mixed berries blended to a bright and creamy finish.",
    price: 2.9,
    categoryName: "Drinks",
    isPopular: true,
  },
  {
    id: "sample-milkshake",
    name: "Chocolate Milkshake",
    description: "Cold chocolate shake topped with whipped cream.",
    price: 3.2,
    categoryName: "Drinks",
    isPopular: true,
  },
];

// Escapes special characters so text is safe inside SVG
function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Converts raw SVG code into a browser-usable image URL
function svgToDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\s+/g, " ").trim(),
  )}`;
}

// Converts category/product text into a clean slug
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Gets the sorting rank for a category
function categoryRank(name: string) {
  const normalized = name.trim().toLowerCase();
  return CATEGORY_ORDER_LOOKUP.get(normalized) ?? CATEGORY_ORDER.length + 1;
}

// Makes sure image URLs are valid
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

// Builds fallback SVG artwork for a product when no real image exists
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

// Groups products into their categories
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

// Builds backup menu data when database data is unavailable
function buildFallbackMenuData(): MenuData {
  const products = placeholderItems.map((item, index) => {
    const categorySlug = slugify(item.categoryName);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      categoryName: item.categoryName,
      categorySlug,
      imageUrl: buildCategoryArt(item.categoryName, item.name),
      isPopular: item.isPopular,
      bestSellerScore: placeholderItems.length - index,
    } satisfies MenuProduct;
  });

  const categories = groupCategories(products);

  return {
    cafeName: "Maash Allah Cafe",
    heroImage,
    categories,
    products,
    featuredItems: products.filter((product) => product.isPopular).slice(0, 4),
    hasLiveData: false,
  };
}

// Loads real menu data from the database using Prisma
async function loadLiveMenuData(): Promise<MenuData | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    const [categoriesResult, bestSellerRows] = await Promise.all([
      prisma.category.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              isActive: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          products: {
            where: {
              isActive: true,
            },
            orderBy: [{ isPopular: "desc" }, { name: "asc" }],
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

    const bestSellerMap = new Map(
      bestSellerRows.map((row) => [row.productId, Number(row._sum.qty ?? 0)]),
    );

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

    const categories = groupCategories(products);

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

// Main function exported to the menu page
export async function getMenuData(): Promise<MenuData> {
  const liveData = await loadLiveMenuData();

  return liveData ?? buildFallbackMenuData();
}
