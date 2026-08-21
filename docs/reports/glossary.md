# Reporting glossary and business rules

All authoritative financial calculations use Prisma Decimal values. Numbers are converted to JavaScript numbers only at visual chart boundaries.

## Reporting calendar

- Currency: USD.
- Timezone: Africa/Nairobi (UTC+03:00).
- Business day: 7:00 AM through 5:00 AM the next calendar day.
- Revenue date: the business day containing the paid order's `closedAt` timestamp.
- Week: Saturday through Friday business dates.
- Month: business dates whose 7:00 AM start occurs in the calendar month.

## Definitions

- **Gross sales:** item and modifier snapshot value before adjustments.
- **Net sales:** gross sales minus discounts and refunds.
- **Average order value:** net sales divided by fully paid, non-voided orders.
- **COGS:** sold quantity multiplied by the cost snapshot stored on the order line. A refund does not reverse prepared-food COGS.
- **Gross profit:** net sales minus covered COGS.
- **Gross-profit margin:** gross profit divided by net sales.
- **Food-cost percentage:** food COGS divided by food net sales.
- **Labour-cost percentage:** approved labour cost divided by net sales.
- **Settlement variance:** money handed in minus expected waiter settlement. This is not labelled cash variance because the POS currently records mobile-money methods only.
- **Inventory variance:** physical stock minus expected stock.
- **Net profit:** net sales minus COGS, labour, and operating expenses. Owner withdrawals are excluded.
- **Break-even sales:** fixed costs divided by the contribution-margin ratio.

Division by zero produces an unavailable value, never infinity or a fabricated zero. Historical profit remains unavailable when a cost snapshot does not exist.
