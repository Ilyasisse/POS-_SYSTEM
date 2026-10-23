-- Staff-maintained allergen notes are optional; an empty note does not mean allergen-free.
ALTER TABLE "Product" ADD COLUMN "allergenInfo" VARCHAR(240);
