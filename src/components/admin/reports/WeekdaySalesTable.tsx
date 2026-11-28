import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WeekdaySalesRow } from "@/lib/reports/weekday-sales";

export default function WeekdaySalesTable({ rows }: { rows: WeekdaySalesRow[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-black">Sales by weekday</h2>
      <p className="text-sm text-muted-foreground">
        Totals for the selected period, grouped by payment completion date in café time (UTC+3).
        Longer periods may contain different numbers of each weekday.
      </p>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Weekday</TableHead>
          <TableHead className="text-right">Paid orders</TableHead>
          <TableHead className="text-right">Net sales</TableHead>
          <TableHead className="text-right">Average order</TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((row) => (
          <TableRow key={row.day}>
            <TableCell className="font-medium">{row.day}</TableCell>
            <TableCell className="text-right">{row.paidOrders}</TableCell>
            <TableCell className="text-right">${row.netSales}</TableCell>
            <TableCell className="text-right">{row.averageOrderValue === null ? "—" : `$${row.averageOrderValue}`}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </Card>
  );
}
