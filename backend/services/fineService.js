const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');
const { createTransaction } = require('./transactionService');

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
 * Mark a fine as paid (by the user themselves).
 */
async function payFine(fineId, userId) {
    const fine = await prisma.fine.findUnique({
        where: { id: fineId },
        include: { circulation: { include: { book: true } } },
    });

    if (!fine) throw new AppError('Fine not found.', 404);
    if (fine.circulation.userId !== userId) throw new AppError('This fine does not belong to you.', 403);
    if (fine.isPaid) throw new AppError('This fine has already been paid.', 400);

    const updated = await prisma.fine.update({
        where: { id: fineId },
        data: { isPaid: true },
    });

    // Update user balance
    await prisma.user.update({
        where: { id: userId },
        data: {
            fineBalance: { decrement: fine.amount },
            totalFinesPaid: { increment: fine.amount },
        },
    });

    try {
        await createTransaction({
            type: 'FINE_PAYMENT',
            userId,
            bookId: fine.circulation.bookId || null,
            amount: fine.amount,
            paymentStatus: 'COMPLETED',
            description: `Fine paid for "${fine.circulation.book?.title || 'book'}"`,
            metadata: { fineId: fine.id, circulationId: fine.circulationId },
        });
    } catch (err) {
        console.error('Failed to record FINE_PAYMENT transaction:', err);
    }

    return updated;
}

/**
 * Get all fines (admin).
 */
async function getAllFines() {
    const fines = await prisma.fine.findMany({
        include: {
            circulation: {
                include: {
                    book: { select: { id: true, title: true, isbn: true, author: true } },
                    user: { select: { id: true, name: true, email: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Also get users with outstanding balances
    const usersWithFines = await prisma.user.findMany({
        where: { fineBalance: { gt: 0 } },
        select: { id: true, name: true, email: true, fineBalance: true, totalFinesPaid: true },
    });

    return { fines, usersWithFines };
}

/**
 * Admin marks a fine as paid.
 */
async function markFinePaid(fineId, adminId) {
    const fine = await prisma.fine.findUnique({
        where: { id: fineId },
        include: { circulation: { include: { book: true } } },
    });

    if (!fine) throw new AppError('Fine not found.', 404);
    if (fine.isPaid) throw new AppError('This fine has already been paid.', 400);

    const updated = await prisma.fine.update({
        where: { id: fineId },
        data: { isPaid: true },
    });

    // Update user balance
    await prisma.user.update({
        where: { id: fine.circulation.userId },
        data: {
            fineBalance: { decrement: fine.amount },
            totalFinesPaid: { increment: fine.amount },
        },
    });

    try {
        await createTransaction({
            type: 'FINE_PAYMENT',
            userId: fine.circulation.userId,
            bookId: fine.circulation.bookId || null,
            amount: fine.amount,
            paymentMethod: 'CASH',
            paymentStatus: 'COMPLETED',
            processedById: adminId,
            description: `Fine marked paid for "${fine.circulation.book?.title || 'book'}"`,
            metadata: { fineId: fine.id, circulationId: fine.circulationId, markedByAdmin: true },
        });
    } catch (err) {
        console.error('Failed to record admin FINE_PAYMENT transaction:', err);
    }

    return updated;
}

/**
 * Rapid fine generation: For demonstration/testing.
 * Deducts 1 INR every 10 seconds after a book is borrowed.
 */
async function processRapidFines() {
    const now = new Date();

    const activeCirculations = await prisma.circulation.findMany({
        where: {
            type: 'BORROW',
            returnDate: null,
            fineHalted: false,
        },
        include: { fines: true, book: true },
    });

    const results = [];
    const AUTO_HALT_LIMIT = 100;

    for (const circ of activeCirculations) {
        const elapsedSeconds = Math.floor((now - circ.borrowDate) / 1000);
        const totalGeneratedPenalty = Math.floor(elapsedSeconds / 10) * 1;
        const totalPaidAmount = circ.fines.filter(f => f.isPaid).reduce((sum, f) => sum + f.amount, 0);
        let expectedCurrentFine = totalGeneratedPenalty - totalPaidAmount;

        let needsHalt = false;
        if (expectedCurrentFine >= AUTO_HALT_LIMIT) {
            expectedCurrentFine = AUTO_HALT_LIMIT;
            needsHalt = true;
        }

        if (expectedCurrentFine > 0) {
            const existingFine = circ.fines.find(f => !f.isPaid);

            if (existingFine) {
                if (existingFine.amount !== expectedCurrentFine) {
                    await prisma.fine.update({
                        where: { id: existingFine.id },
                        data: { amount: expectedCurrentFine },
                    });
                    results.push({ circulationId: circ.id, amount: expectedCurrentFine, action: 'updated' });
                }
            } else {
                await prisma.fine.create({
                    data: {
                        circulationId: circ.id,
                        amount: expectedCurrentFine,
                        isPaid: false,
                    },
                });
                results.push({ circulationId: circ.id, amount: expectedCurrentFine, action: 'created' });
            }
        }
        
        if (needsHalt) {
            await prisma.circulation.update({
                where: { id: circ.id },
                data: { fineHalted: true }
            });
        }
    }
    
    return { processed: results.length, details: results };
}

/**
 * Manually halt further fines for a circulation
 */
async function haltFine(circulationId) {
    const circulation = await prisma.circulation.findUnique({
        where: { id: circulationId }
    });
    
    if (!circulation) throw new AppError('Circulation not found.', 404);
    if (circulation.fineHalted) throw new AppError('Fines are already halted for this item.', 400);

    return prisma.circulation.update({
        where: { id: circulationId },
        data: { fineHalted: true }
    });
}

module.exports = { getUserFines, calculateOverdueFines, payFine, getAllFines, markFinePaid, processRapidFines, haltFine };
