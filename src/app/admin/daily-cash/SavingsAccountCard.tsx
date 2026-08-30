import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDailyCash } from "@/lib/daily-cash/service";
import {
  createSavingsDepositAction,
  undoSavingsDepositAction,
} from "./actions";

type DailyCashData = NonNullable<Awaited<ReturnType<typeof getDailyCash>>>;

const money = (value: number) => `$${value.toFixed(2)}`;
const recordedAtTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

export default function SavingsAccountCard({
  data,
  date,
}: {
  data: DailyCashData;
  date: string;
}) {
  const canDeposit = !data.locked && data.summary.projectedRemaining > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Savings account</CardTitle>
          <CardDescription>
            Move projected remaining cash into savings. Savings-funded payments
            do not reduce this deposit-only balance.
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Running balance</p>
          <p className="text-2xl font-bold tabular-nums">
            {money(data.savingsAccountBalance)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-0">
        {!data.locked ? (
          canDeposit ? (
            <form
              action={createSavingsDepositAction}
              className="mx-6 grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-[10rem_1fr_auto] md:items-end"
            >
              <Input type="hidden" name="date" value={date} />
              <div className="grid gap-1">
                <Label htmlFor="savings-amount">Amount</Label>
                <Input
                  id="savings-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  max={data.summary.projectedRemaining.toFixed(2)}
                  step="0.01"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="savings-note">Note</Label>
                <Input id="savings-note" name="note" maxLength={500} />
              </div>
              <Button type="submit">Move to savings</Button>
            </form>
          ) : (
            <p className="mx-6 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Pay the shown obligations before moving cash to savings.
            </p>
          )
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recorded by</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {!data.locked ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.savingsDeposits.length ? (
              data.savingsDeposits.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell>{deposit.recordedByName}</TableCell>
                  <TableCell>{recordedAtTime.format(deposit.createdAt)}</TableCell>
                  <TableCell>{deposit.note || "?"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money(deposit.amount)}
                  </TableCell>
                  {!data.locked ? (
                    <TableCell className="text-right">
                      <form action={undoSavingsDepositAction}>
                        <Input type="hidden" name="date" value={date} />
                        <Input type="hidden" name="id" value={deposit.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          aria-label={`Undo ${money(deposit.amount)} savings transfer`}
                        >
                          Undo
                        </Button>
                      </form>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={data.locked ? 4 : 5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No savings transfers have been recorded for this business day.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex justify-end px-6 text-sm">
          <span className="text-muted-foreground">Deposited this day&nbsp;</span>
          <span className="font-semibold tabular-nums">
            {money(data.dailySavingsDeposited)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
