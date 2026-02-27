import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in your environment.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ----- USERS -----
  await prisma.user.create({
    data: {
      email: "admin@cafe.com",
      fullName: "Cafe Admin",
      role: UserRole.ADMIN,
    },
  });

  // ----- CATEGORIES -----
  const drinks = await prisma.category.create({
    data: { name: "Drinks", sortOrder: 1 },
  });

  const food = await prisma.category.create({
    data: { name: "Food", sortOrder: 2 },
  });

  // ----- PRODUCTS -----
  await prisma.product.createMany({
    data: [
      { name: "Coffee", priceCents: 350, categoryId: drinks.id },
      { name: "Latte", priceCents: 450, categoryId: drinks.id },
      { name: "Cappuccino", priceCents: 500, categoryId: drinks.id },
      { name: "Croissant", priceCents: 400, categoryId: food.id },
      { name: "Sandwich", priceCents: 850, categoryId: food.id },
      { name: "Cheesecake", priceCents: 600, categoryId: food.id },
    ],
  });

  // ----- TAX -----
  await prisma.taxRate.create({
    data: {
      name: "Standard Tax",
      percent: 8,
    },
  });

  // ----- DISCOUNT -----
  await prisma.discount.create({
    data: {
      name: "10% Off",
      isPercent: true,
      value: 10,
    },
  });

  // ----- MODIFIER GROUP -----
  const milkGroup = await prisma.modifierGroup.create({
    data: {
      name: "Milk Options",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
    },
  });

  await prisma.modifier.createMany({
    data: [
      { name: "Whole Milk", modifierGroupId: milkGroup.id },
      { name: "Oat Milk", modifierGroupId: milkGroup.id, priceCents: 50 },
      { name: "Almond Milk", modifierGroupId: milkGroup.id, priceCents: 50 },
    ],
  });

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
