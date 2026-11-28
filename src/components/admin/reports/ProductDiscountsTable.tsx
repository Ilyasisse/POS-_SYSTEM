import { Card } from "@/components/admin/shared";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { summarizeProductDiscounts } from "@/lib/reports/product-discounts";

type Props = { insights: ReturnType<typeof summarizeProductDiscounts> };

export function ProductDiscountsTable({ insights }: Props) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-black">Frequently discounted products</h2>
      <p className="mt-2 text-sm text-slate-600">
        Counts include item-level discounts on fully paid orders in this report period.
        Multiple discounts on one order count as one discounted order.
        The rate compares discounted orders with all paid orders containing that product.
      </p>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Discounted orders</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Adjustments</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {insights.products.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">No item-level discounts found in this period.</TableCell></TableRow>
          ) : insights.products.map((row) => (
            <TableRow key={row.productId}>
              <TableCell className="font-bold">{row.name}</TableCell>
              <TableCell className="text-right">{row.orders}</TableCell>
              <TableCell className="text-right">{row.discountedOrderRate}% of {row.soldOrders}</TableCell>
              <TableCell className="text-right">{row.adjustments}</TableCell>
              <TableCell className="text-right">${row.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-sm text-slate-600">
        Whole-order or unlinked discounts: {insights.unattributed.orders} orders,
        {" "}{insights.unattributed.adjustments} adjustments,
        {" "}${insights.unattributed.amount}. These are not attributed to a product.
      </p>
    </Card>
  );
}
