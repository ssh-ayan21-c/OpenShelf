const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

/**
 * Get all fines for a user.
 */
async function getUserFines(userId) {
    return prisma.fine.findMany({
        where: { circulation: { userId } },
        include: {
            circulation: {
                include: { book: { select: { id: true, title: true, isbn: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Calculate overdue fines for all active (unreturned, overdue) borrows.
 * This acts as a "background job" triggered via API.
 */
async function calculateOverdueFines() {
    const now = new Date();
    const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 5;

    // Find all overdue, unreturned borrows
    const overdueCirculations = await prisma.circulation.findMany({
        where: {
            type: 'BORROW',
            returnDate: null,
            dueDate: { lt: now },
        },
        include: { fines: true, book: true },
    });

    const results = [];

    for (const circ of overdueCirculations) {
        const daysOverdue = Math.ceil((now - circ.dueDate) / (1000 * 60 * 60 * 24));
        const expectedAmount = daysOverdue * finePerDay;

        // Check if there's already an unpaid fine for this circulation
        const existingFine = circ.fines.find(f => !f.isPaid);

        if (existingFine) {
            // Update existing fine amount
            if (existingFine.amount !== expectedAmount) {
                const updated = await prisma.fine.update({
                    where: { id: existingFine.id },
                    data: { amount: expectedAmount },
                });
                results.push({ circulationId: circ.id, book: circ.book.title, daysOverdue, amount: expectedAmount, action: 'updated' });
            }
        } else {
            // Create new fine
            await prisma.fine.create({
                data: {
                    circulationId: circ.id,
                    amount: expectedAmount,
                    isPaid: false,
                },
            });
            results.push({ circulationId: circ.id, book: circ.book.title, daysOverdue, amount: expectedAmount, action: 'created' });
        }
    }

    return { processed: results.length, fines: results };
}

/**
 * Mark a fine as paid.
 */
async function payFine(fineId, userId) {
    const fine = await prisma.fine.findUnique({
        where: { id: fineId },
        include: { circulation: true },
    });

    if (!fine) throw new AppError('Fine not found.', 404);
    if (fine.circulation.userId !== userId) throw new AppError('This fine does not belong to you.', 403);
    if (fine.isPaid) throw new AppError('This fine has already been paid.', 400);

    return prisma.fine.update({
        where: { id: fineId },
        data: { isPaid: true },
    });
}

module.exports = { getUserFines, calculateOverdueFines, payFine };
