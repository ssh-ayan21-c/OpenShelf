-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to embeddings table (will be applied after Prisma migration)
-- This migration should be run after the initial Prisma migration creates the embeddings table
-- ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS vector vector(1536);
