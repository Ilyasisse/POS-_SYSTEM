import { CategoryChip } from "@/types/customer-order.types";
import { displayFont } from "../CustomerOrderPage";

type MenuBrowserPanelProps = {
  searchTerm: string;
  categoryChips: CategoryChip[];
  selectedCategory: string;
  onSearchChange: (searchTerm: string) => void;
  onCategorySelect: (categoryId: string) => void;
};

export default function MenuBrowserPanel({
  searchTerm,
  categoryChips,
  selectedCategory,
  onSearchChange,
  onCategorySelect,
}: MenuBrowserPanelProps) {
  return (
    <section
      data-aos="zoom-in"
      data-aos-delay="100"
      className="mt-4 rounded-[1.25rem] border border-white/80 bg-white/88 p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
            Browse by category
          </p>
          <h2
            className="mt-2 text-2xl text-stone-950 sm:text-4xl"
            style={{ fontFamily: displayFont }}
          >
            Pick a section, then tap a card to order
          </h2>
        </div>

        <div className="w-full lg:max-w-md">
          <label className="sr-only" htmlFor="menu-search">
            Search menu
          </label>
          <input
            id="menu-search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search coffee, burgers, desserts..."
            className="w-full rounded-full border border-stone-200 bg-white px-5 py-3.5 text-sm shadow-inner outline-none focus:border-amber-600"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory sm:gap-3">
        {categoryChips.map((category) => {
          const active = selectedCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategorySelect(category.id)}
              className={`min-w-28 snap-start rounded-full px-4 py-3 text-left text-sm font-semibold transition sm:min-w-32 sm:px-5 ${
                active
                  ? "bg-stone-950 text-white shadow-[0_14px_28px_rgba(28,16,10,0.22)]"
                  : "border border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50"
              }`}
            >
              <div>{category.name}</div>
              <div
                className={`mt-1 text-[11px] uppercase tracking-[0.18em] ${
                  active ? "text-stone-200" : "text-stone-500"
                }`}
              >
                {category.count} items
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
