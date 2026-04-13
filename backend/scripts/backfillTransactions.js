require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function txKey(type, id) {
  return `${type}:${id}`;
}

async function main() {
  const existing = await prisma.transaction.findMany({
    select: { type: true, metadata: true },
  });

  const existingKeys = new Set();
  for (const tx of existing) {
    const circulationId = tx.metadata?.circulationId;
    const fineId = tx.metadata?.fineId;
    if (circulationId) existingKeys.add(txKey(tx.type, circulationId));
    if (fineId) existingKeys.add(txKey(tx.type, fineId));
  }

  let created = 0;

  const circulations = await prisma.circulation.findMany({
    include: { book: { select: { id: true, title: true, price: true } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const circ of circulations) {
    if (circ.type === 'BORROW') {
      const borrowKey = txKey('BORROW', circ.id);
      if (!existingKeys.has(borrowKey)) {
        await prisma.transaction.create({
          data: {
            type: 'BORROW',
            userId: circ.userId,
            bookId: circ.bookId,
            description: `Borrowed "${circ.book?.title || 'book'}"`,
            metadata: { circulationId: circ.id, backfilled: true },
            createdAt: circ.borrowDate || circ.createdAt,
          },
        });
        existingKeys.add(borrowKey);
        created += 1;
      }

      if (circ.returnDate) {
        const returnKey = txKey('RETURN', circ.id);
        if (!existingKeys.has(returnKey)) {
          await prisma.transaction.create({
            data: {
              type: 'RETURN',
              userId: circ.userId,
              bookId: circ.bookId,
              description: `Returned "${circ.book?.title || 'book'}"`,
              metadata: { circulationId: circ.id, backfilled: true },
              createdAt: circ.returnDate,
            },
          });
          existingKeys.add(returnKey);
          created += 1;
        }
      }

      if (circ.renewalCount > 0 && circ.renewedAt) {
        const renewalKey = txKey('RENEWAL', circ.id);
        if (!existingKeys.has(renewalKey)) {
          await prisma.transaction.create({
            data: {
              type: 'RENEWAL',
              userId: circ.userId,
              bookId: circ.bookId,
              description: `Renewed "${circ.book?.title || 'book'}"`,
              metadata: { circulationId: circ.id, backfilled: true },
              createdAt: circ.renewedAt,
            },
          });
          existingKeys.add(renewalKey);
          created += 1;
        }
      }
    }

    if (circ.type === 'BUY') {
      const purchaseKey = txKey('BOOK_PURCHASE', circ.id);
      if (!existingKeys.has(purchaseKey)) {
        await prisma.transaction.create({
          data: {
            type: 'BOOK_PURCHASE',
            userId: circ.userId,
            bookId: circ.bookId,
            amount: Number(circ.book?.price || 0),
            description: `Purchased "${circ.book?.title || 'book'}"`,
            metadata: { circulationId: circ.id, backfilled: true },
            createdAt: circ.createdAt,
          },
        });
        existingKeys.add(purchaseKey);
        created += 1;
      }
    }
  }

  const paidFines = await prisma.fine.findMany({
    where: { isPaid: true },
    include: { circulation: { include: { book: { select: { title: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const fine of paidFines) {
    const fineKey = txKey('FINE_PAYMENT', fine.id);
    if (existingKeys.has(fineKey)) continue;

    await prisma.transaction.create({
      data: {
        type: 'FINE_PAYMENT',
        userId: fine.circulation.userId,
        bookId: fine.circulation.bookId,
        amount: fine.amount,
        paymentStatus: 'COMPLETED',
        description: `Fine paid for "${fine.circulation.book?.title || 'book'}"`,
        metadata: { fineId: fine.id, circulationId: fine.circulationId, backfilled: true },
        createdAt: fine.createdAt,
      },
    });

    existingKeys.add(fineKey);
    created += 1;
  }

  console.log(`Backfill complete. Created ${created} missing transactions.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
