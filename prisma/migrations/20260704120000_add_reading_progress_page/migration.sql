ALTER TABLE "ReadingProgress"
  ADD COLUMN "page" INTEGER,
  ADD COLUMN "totalPages" INTEGER;

ALTER TABLE "ReadingProgress"
  ADD CONSTRAINT "ReadingProgress_page_check"
  CHECK ("page" IS NULL OR ("page" >= 1 AND "page" <= 2000));

ALTER TABLE "ReadingProgress"
  ADD CONSTRAINT "ReadingProgress_totalPages_check"
  CHECK ("totalPages" IS NULL OR ("totalPages" >= 1 AND "totalPages" <= 2000));
