"use client";

import dynamic from "next/dynamic";

type ChartPoint = {
  label: string;
  value: number;
};

type TooltipPayload = {
  payload?: ChartPoint;
  value?: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const Area = dynamic(() => import("recharts").then((mod) => mod.Area), {
  ssr: false,
});
const AreaChart = dynamic(
  () => import("recharts").then((mod) => mod.AreaChart),
  { ssr: false },
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false },
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});

function formatMoney(value: number) {
  return currencyFormatter.format(value);
}

function SalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg shadow-slate-200/80">
      <p className="text-xs font-bold text-slate-500">{point.label}</p>
      <p className="text-sm font-black text-slate-950">
        {formatMoney(point.value)}
      </p>
    </div>
  );
}

export default function SalesChartCard({ points }: { points: ChartPoint[] }) {
  const hasSales = points.some((point) => point.value > 0);

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-slate-100 bg-linear-to-b from-white to-slate-50 px-2 py-4 sm:h-72 sm:px-3">
      {!hasSales && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-center text-sm font-semibold text-slate-500 backdrop-blur-sm">
          No sales recorded this week yet.
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{
            top: hasSales ? 10 : 34,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="weeklySalesFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#e2e8f0"
            strokeDasharray="4 4"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            tickLine={false}
            tickMargin={8}
            width={56}
            tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }}
          />
          <Tooltip content={<SalesTooltip />} cursor={{ stroke: "#bfdbfe" }} />
          <Area
            activeDot={{
              r: 6,
              fill: "#2563eb",
              stroke: "#dbeafe",
              strokeWidth: 4,
            }}
            animationDuration={900}
            animationEasing="ease-out"
            dataKey="value"
            dot={{
              r: 4,
              fill: "#2563eb",
              stroke: "#dbeafe",
              strokeWidth: 3,
            }}
            fill="url(#weeklySalesFill)"
            isAnimationActive
            name="Sales"
            stroke="#2563eb"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
