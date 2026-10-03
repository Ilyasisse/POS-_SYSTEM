// Isolate service tests from Next's server-only marker and the live database.
exports.prisma = globalThis.supplierBillTestPrisma;
