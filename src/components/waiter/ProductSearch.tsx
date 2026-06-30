import { Input } from "@/components/ui/input";
type ProductSearchProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

export default function ProductSearch({
  searchTerm,
  onSearchTermChange,
}: ProductSearchProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-muted-foreground">
        Raadi magaca dalabka ama SKU
      </span>
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="Raadi dalab..."
        className="h-11 w-full rounded-lg border border-border px-3 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}
