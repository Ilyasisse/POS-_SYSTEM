BEGIN;

-- Prisma's implicit relation: A references Modifier, B references Product.
CREATE TABLE "_ModifierToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ModifierToProduct_AB_pkey" PRIMARY KEY ("A", "B"),
    CONSTRAINT "_ModifierToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Modifier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ModifierToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "_ModifierToProduct_B_index" ON "_ModifierToProduct"("B");
ALTER TABLE "_ModifierToProduct" ENABLE ROW LEVEL SECURITY;

-- Hold catalog writes until the backfill and removal of the old ownership column finish.
LOCK TABLE "Modifier" IN ACCESS EXCLUSIVE MODE;
INSERT INTO "_ModifierToProduct" ("A", "B")
SELECT "id", "productId" FROM "Modifier";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Modifier" m
        LEFT JOIN "_ModifierToProduct" link
          ON link."A" = m."id" AND link."B" = m."productId"
        WHERE link."A" IS NULL
    ) THEN
        RAISE EXCEPTION 'Modifier backfill did not preserve every product assignment';
    END IF;
END $$;

-- PostgreSQL removes this column's own foreign key and index; other dependencies must fail safely.
ALTER TABLE "Modifier" DROP COLUMN "productId";

COMMIT;
