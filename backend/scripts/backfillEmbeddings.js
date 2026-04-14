require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { indexBookEmbeddings } = require('../services/ragService');

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      pdfUrl: true,
      isDigital: true,
      digitalCount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    const isLikelyDigital = !!book.pdfUrl || !!book.isDigital || Number(book.digitalCount || 0) > 0;
    if (!isLikelyDigital) {
      skipped += 1;
      continue;
    }

    try {
      const result = await indexBookEmbeddings({
        bookId: book.id,
        title: book.title,
        author: book.author,
        description: book.description || '',
        pdfUrl: book.pdfUrl || '',
        forceReindex: false,
      });

      if (result?.skipped) {
        skipped += 1;
      } else {
        indexed += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`Failed for book ${book.id}:`, err.message);
    }
  }

  console.log(`Embedding backfill complete. Indexed: ${indexed}, Skipped: ${skipped}, Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
