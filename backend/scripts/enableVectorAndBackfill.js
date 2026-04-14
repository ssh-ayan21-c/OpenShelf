require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { generateEmbedding } = require('../services/ragService');

const prisma = new PrismaClient();

async function ensureVectorColumn() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  await prisma.$executeRawUnsafe('ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS vector vector(1536);');
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);'
  );
}

async function verifyVectorColumn() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_name = 'embeddings' AND column_name = 'vector'
    LIMIT 1
  `);
  return rows?.[0] || null;
}

async function backfillMissingVectors() {
  let updated = 0;
  let skipped = 0;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, content
    FROM embeddings
    WHERE vector IS NULL
    ORDER BY id ASC
  `);

  for (const row of rows) {
    const text = (row.content || '').trim();
    if (!text) {
      skipped += 1;
      continue;
    }

    const embedding = await generateEmbedding(text);
    if (!Array.isArray(embedding) || embedding.length === 0) {
      skipped += 1;
      continue;
    }

    const vectorLiteral = `[${embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      'UPDATE embeddings SET vector = $1::vector WHERE id = $2',
      vectorLiteral,
      row.id
    );
    updated += 1;
  }

  return { updated, skipped, total: rows.length };
}

async function main() {
  console.log('Ensuring pgvector extension + embeddings.vector column...');
  await ensureVectorColumn();

  const column = await verifyVectorColumn();
  console.log('Vector column:', column ? `${column.column_name} (${column.udt_name})` : 'NOT FOUND');

  console.log('Backfilling missing vectors from existing embedding content...');
  const stats = await backfillMissingVectors();
  console.log(`Backfill complete. Updated: ${stats.updated}, Skipped: ${stats.skipped}, Total scanned: ${stats.total}`);
}

main()
  .catch((err) => {
    console.error('enableVectorAndBackfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
