-- An empty modifier note means allergen information was not entered.
ALTER TABLE "Modifier" ADD COLUMN "allergenInfo" VARCHAR(240);
