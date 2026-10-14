-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" UUID NOT NULL,
    "work_start" TEXT NOT NULL,
    "work_end" TEXT NOT NULL,
    "lunch_start" TEXT,
    "lunch_end" TEXT,
    "work_days" INTEGER[],
    "monthly_late_allowance_min" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radius_m" INTEGER NOT NULL DEFAULT 150,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "office_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_locations_is_active_deleted_at_idx" ON "office_locations"("is_active", "deleted_at");
