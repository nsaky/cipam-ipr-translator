-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(10) NOT NULL DEFAULT 'reviewer',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "source_type" VARCHAR(10) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "source_text" TEXT NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" SERIAL NOT NULL,
    "segment_id" INTEGER NOT NULL,
    "lang" VARCHAR(5) NOT NULL,
    "machine_text" TEXT NOT NULL,
    "final_text" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" SERIAL NOT NULL,
    "en_term" VARCHAR(255) NOT NULL,
    "lang" VARCHAR(5) NOT NULL,
    "approved_term" VARCHAR(255) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_documents_user_id" ON "documents"("user_id");

-- CreateIndex
CREATE INDEX "idx_segments_document_id" ON "segments"("document_id");

-- CreateIndex
CREATE INDEX "idx_translations_segment_id" ON "translations"("segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "translations_segment_lang_unique" ON "translations"("segment_id", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_terms_lang_en_term_unique" ON "glossary_terms"("lang", "en_term");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- CHECK constraints (not expressible in schema.prisma; added by hand)
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'reviewer', 'user'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_type_check" CHECK ("source_type" IN ('docx', 'pdf', 'image'));
ALTER TABLE "translations" ADD CONSTRAINT "translations_lang_check" CHECK ("lang" IN ('hi', 'mr', 'bn', 'gu', 'ta', 'te'));
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_lang_check" CHECK ("lang" IN ('hi', 'mr', 'bn', 'gu', 'ta', 'te'));
