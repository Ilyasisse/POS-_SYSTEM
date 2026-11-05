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
  categories?: MenuCategory[];
  products: MenuProduct[];
  featuredItems: MenuProduct[];
  hasLiveData: boolean;
};