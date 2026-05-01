import type { Category, ModifierGroup, Product } from "@/lib/types";

const PLACEHOLDER_CATEGORY_NAMES = [
  "Coffee",
  "Tea",
  "Fast Food",
  "Desserts",
  "Drinks",
] as const;

function categoryIdFromName(name: string) {
  return `placeholder-category-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeCategoryName(name: string) {
  return name.trim().toLowerCase();
}

function buildSvgPlaceholder(
  title: string,
  subtitle: string,
  accentA: string,
  accentB: string,
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
      </defs>
      <rect width="600" height="420" rx="42" fill="url(#bg)" />
      <circle cx="510" cy="90" r="84" fill="rgba(255,255,255,0.16)" />
      <circle cx="110" cy="340" r="96" fill="rgba(255,255,255,0.12)" />
      <rect x="56" y="56" width="206" height="34" rx="17" fill="rgba(255,255,255,0.18)" />
      <text x="56" y="196" fill="#ffffff" font-size="48" font-family="Trebuchet MS, Segoe UI, sans-serif" font-weight="800">${title}</text>
      <text x="56" y="246" fill="rgba(255,255,255,0.88)" font-size="24" font-family="Trebuchet MS, Segoe UI, sans-serif">${subtitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function sampleCategory(name: string, sortOrder: number): Category {
  return {
    id: categoryIdFromName(name),
    name,
    sortOrder,
    isActive: true,
    iconUrl: null,
    station:
      name === "Coffee"
        ? "BARISTA"
        : name === "Fast Food"
          ? "FAST_FOOD"
          : name === "Drinks"
            ? "CABITAAN"
            : null,
  };
}

function sampleProduct(
  id: string,
  name: string,
  price: number,
  description: string,
  category: Category,
): Product {
  return {
    id,
    name,
    price,
    cost: null,
    isActive: true,
    sku: null,
    description,
    trackStock: false,
    stockQty: 0,
    imageUrl: null,
    pronunciationAudioUrl: null,
    isPopular: true,
    modifierGroups: [],
    category: {
      id: category.id,
      name: category.name,
      station: category.station ?? null,
    },
  };
}

export function getCustomerCategories(
  categories: Category[],
  products: Product[],
): Category[] {
  if (categories.length > 0) {
    return categories;
  }

  const derivedCategories = Array.from(
    new Map(
      products
        .map((product) => product.category)
        .filter((category): category is NonNullable<Product["category"]> =>
          Boolean(category?.id && category?.name),
        )
        .map((category, index) => [
          category.id,
          {
            id: category.id,
            name: category.name,
            sortOrder: index,
            isActive: true,
            iconUrl: null,
            station: category.station ?? null,
          } satisfies Category,
        ]),
    ).values(),
  );

  if (derivedCategories.length > 0) {
    return derivedCategories;
  }

  return PLACEHOLDER_CATEGORY_NAMES.map((name, index) =>
    sampleCategory(name, index),
  );
}

export function getCustomerProducts(
  products: Product[],
  categories: Category[],
): Product[] {
  if (products.length > 0) {
    return products.map((product) => ({
      ...product,
      price: Number(product.price) || 0,
    }));
  }

  const categoryMap = new Map(
    categories.map((category) => [normalizeCategoryName(category.name), category]),
  );

  const coffee = categoryMap.get("coffee") ?? sampleCategory("Coffee", 0);
  const tea = categoryMap.get("tea") ?? sampleCategory("Tea", 1);
  const fastFood =
    categoryMap.get("fast food") ?? sampleCategory("Fast Food", 2);
  const desserts =
    categoryMap.get("desserts") ?? sampleCategory("Desserts", 3);
  const drinks = categoryMap.get("drinks") ?? sampleCategory("Drinks", 4);

  return [
    sampleProduct(
      "sample__cappuccino",
      "Cappuccino",
      3.5,
      "Espresso, milk foam, and a bold coffee finish.",
      coffee,
    ),
    sampleProduct(
      "sample__espresso",
      "Double Espresso",
      3.1,
      "Rich espresso with a deep roast aroma and a smooth finish.",
      coffee,
    ),
    sampleProduct(
      "sample__iced_latte",
      "Iced Latte",
      4.25,
      "Cold espresso with milk over ice.",
      coffee,
    ),
    sampleProduct(
      "sample__shaah",
      "Spiced Tea",
      2.75,
      "House tea brewed with warming spices.",
      tea,
    ),
    sampleProduct(
      "sample__hibiscus_tea",
      "Hibiscus Tea",
      3.1,
      "Bright floral tea served hot or chilled.",
      tea,
    ),
    sampleProduct(
      "sample__beef_burger",
      "Beef Burger",
      6.5,
      "Grilled beef burger with crisp toppings.",
      fastFood,
    ),
    sampleProduct(
      "sample__chicken_wrap",
      "Chicken Wrap",
      5.95,
      "Seasoned chicken, lettuce, and house sauce in a warm wrap.",
      fastFood,
    ),
    sampleProduct(
      "sample__fries",
      "Crispy Fries",
      2.5,
      "Golden fries with a light seasoning.",
      fastFood,
    ),
    sampleProduct(
      "sample__cheesecake",
      "Cheesecake Slice",
      3.95,
      "Creamy cheesecake with a biscuit base.",
      desserts,
    ),
    sampleProduct(
      "sample__chocolate_cake",
      "Chocolate Cake",
      4.5,
      "Moist chocolate cake finished with a glossy ganache layer.",
      desserts,
    ),
    sampleProduct(
      "sample__mango_juice",
      "Mango Juice",
      3,
      "Fresh mango blend served chilled.",
      drinks,
    ),
    sampleProduct(
      "sample__berry_smoothie",
      "Berry Smoothie",
      4.6,
      "Mixed berries blended with yogurt for a refreshing finish.",
      drinks,
    ),
  ];
}

export function isSampleProduct(product: Product) {
  return product.id.startsWith("sample__");
}

export function getCustomerModifierGroups(product: Product): ModifierGroup[] {
  if (Array.isArray(product.modifierGroups) && product.modifierGroups.length > 0) {
    return product.modifierGroups;
  }

  const categoryName = normalizeCategoryName(product.category?.name ?? "");
  const isDrink =
    categoryName.includes("coffee") ||
    categoryName.includes("tea") ||
    categoryName.includes("drink") ||
    product.category?.station === "BARISTA" ||
    product.category?.station === "CABITAAN";

  if (isDrink) {
    return [
      {
        id: "placeholder__size",
        name: "Size",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        multiple: false,
        options: [
          { id: "placeholder__size_small", name: "Small", price: 0 },
          { id: "placeholder__size_medium", name: "Medium", price: 0.5 },
          { id: "placeholder__size_large", name: "Large", price: 1 },
        ],
      },
      {
        id: "placeholder__sugar",
        name: "Sugar Level",
        required: false,
        minSelect: 0,
        maxSelect: 1,
        multiple: false,
        options: [
          { id: "placeholder__sugar_none", name: "No Sugar", price: 0 },
          { id: "placeholder__sugar_less", name: "Less Sugar", price: 0 },
          { id: "placeholder__sugar_regular", name: "Regular", price: 0 },
        ],
      },
      {
        id: "placeholder__extras",
        name: "Extras",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        multiple: true,
        options: [
          { id: "placeholder__extra_milk", name: "Extra Milk", price: 0.35 },
          { id: "placeholder__extra_shot", name: "Extra Shot", price: 0.75 },
          { id: "placeholder__extra_cream", name: "Whipped Cream", price: 0.4 },
        ],
      },
    ];
  }

  return [
    {
      id: "placeholder__addons",
      name: "Add-ons",
      required: false,
      minSelect: 0,
      maxSelect: 3,
      multiple: true,
      options: [
        { id: "placeholder__addon_cheese", name: "Cheese", price: 0.6 },
        { id: "placeholder__addon_sauce", name: "Extra Sauce", price: 0.25 },
        { id: "placeholder__addon_salad", name: "Side Salad", price: 1.2 },
      ],
    },
    {
      id: "placeholder__portion",
      name: "Portion",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      multiple: false,
      options: [
        { id: "placeholder__portion_regular", name: "Regular", price: 0 },
        { id: "placeholder__portion_large", name: "Large", price: 1.5 },
      ],
    },
  ];
}

export function getCustomerProductImage(product: Product) {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const categoryName = product.category?.name ?? "Cafe";
  const isDrink =
    normalizeCategoryName(categoryName).includes("coffee") ||
    normalizeCategoryName(categoryName).includes("tea") ||
    normalizeCategoryName(categoryName).includes("drink");

  return buildSvgPlaceholder(
    product.name,
    categoryName,
    isDrink ? "#7c2d12" : "#1f2937",
    isDrink ? "#f59e0b" : "#fb923c",
  );
}
