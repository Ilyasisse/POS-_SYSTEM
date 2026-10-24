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
          variant="outline"
          aria-pressed={selectedCategory === "All"}
          onClick={() => onSelectCategory("All")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 ${
            selectedCategory === "All"
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90"
              : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card dark:hover:bg-accent"
          }`}
        >
          All
        </Button>
      ) : null}

      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          variant="outline"
          aria-pressed={selectedCategory === category.id}
          onClick={() => onSelectCategory(category.id)}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 ${
            selectedCategory === category.id
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90"
              : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card dark:hover:bg-accent"
          }`}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
