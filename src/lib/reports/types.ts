export type SerializedMoney = string;
export type DataCoverage = { completeRecords: number; totalRecords: number; percentage: string | null; earliestReliableAt: string | null; limitations: string[] };
export type ReportPeriod = { start: string; end: string; timezone: "Africa/Nairobi"; currency: "USD" };
export type KpiValue = { value: SerializedMoney | number | null; comparisonValue?: SerializedMoney | number | null; changePercent?: string | null; available: boolean; explanation?: string };
