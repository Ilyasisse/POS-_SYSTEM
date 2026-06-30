import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/types";

type CategoryFilterProps = {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  showAllCategoryButton: boolean;
};

export default function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  showAllCategoryButton,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {showAllCategoryButton ? (
        <Button
          type="button"
          onClick={() => onSelectCategory("All")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 ${
            selectedCategory === "All"
              ? "bg-blue-600 text-white"
              : "bg-card text-foreground hover:bg-blue-100"
          }`}
        >
          All
        </Button>
      ) : null}

      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          onClick={() => onSelectCategory(category.id)}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 ${
            selectedCategory === category.id
              ? "bg-blue-600 text-white"
              : "bg-card text-foreground hover:bg-blue-100"
          }`}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
