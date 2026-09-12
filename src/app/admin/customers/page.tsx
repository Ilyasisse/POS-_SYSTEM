import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import {
  AdminPage,
  Button,
  DataTableCard,
  MetricCard,
  PaginationBar,
  SearchToolbar,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { queryStringWithoutPage } from "@/components/admin/shared/ui/queryStringWithoutPage";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const date = (value: Date | null | undefined) =>
  value ? value.toLocaleDateString("en-US", { dateStyle: "medium" }) : "No visits";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.REPORT_CUSTOMER_VIEW);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const currentPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = 20;
  const where = {
    role: "CUSTOMER" as const,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phoneNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [customers, totalCustomers, paidSummary] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.order.aggregate({
      where: { customerId: { not: null }, status: "PAID" },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  const customerIds = customers.map((customer) => customer.id);
  const customerStats = customerIds.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, status: "PAID" },
        _count: true,
        _sum: { total: true },
        _max: { closedAt: true },
      })
    : [];
  const statsByCustomer = new Map(
    customerStats.map((row) => [row.customerId, row]),
  );
  const totalPages = Math.max(Math.ceil(totalCustomers / pageSize), 1);

  return (
    <AdminPage
      title="Customers"
      description="Understand registered guests, visit history, and identified spending."
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Registered customers" value={totalCustomers} />
        <MetricCard label="Identified paid orders" value={paidSummary._count} />
        <MetricCard
          label="Identified revenue"
          value={money(paidSummary._sum.total)}
          helper="Excludes anonymous walk-in orders"
        />
      </section>

      <DataTableCard
        footer={
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${customers.length} of ${totalCustomers} customers`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <SearchToolbar
          placeholder="Search name, email, or phone"
          defaultValue={q}
          hasActiveFilters={Boolean(q)}
          clearHref="/admin/customers"
        />
        {customers.length ? (
          <Table>
            <thead>
              <tr>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Last visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const stats = statsByCustomer.get(customer.id);
                return (
                  <tr key={customer.id} className="border-b">
                    <TableCell>
                      <p className="font-semibold">{customer.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {date(customer.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{customer.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.phoneNumber ?? "No phone number"}
                      </p>
                    </TableCell>
                    <TableCell>{stats?._count ?? 0}</TableCell>
                    <TableCell>{money(stats?._sum.total)}</TableCell>
                    <TableCell>{date(stats?._max.closedAt)}</TableCell>
                    <TableCell>
                      <ToneBadge tone={customer.isActive ? "green" : "slate"}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/customers/${customer.id}`}>View profile</Link>
                      </Button>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={UserRoundSearch}
            title="No customers found"
            description={q ? "Try another name, email, or phone number." : "Customer profiles appear after guests create an account."}
            className="m-4"
          />
        )}
      </DataTableCard>
    </AdminPage>
  );
}
