const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

/**
 * Get dashboard statistics.
 */
async function getStats() {
    const [totalBooks, totalUsers, activeBorrows, totalFinesCollected, pendingFines] =
        await Promise.all([
            prisma.book.count(),
            prisma.user.count(),
            prisma.circulation.count({ where: { type: 'BORROW', returnDate: null } }),
            prisma.fine.aggregate({ where: { isPaid: true }, _sum: { amount: true } }),
            prisma.fine.aggregate({ where: { isPaid: false }, _sum: { amount: true } }),
        ]);

    return {
        totalBooks,
        totalUsers,
        activeBorrows,
        finesCollected: totalFinesCollected._sum.amount || 0,
        finesPending: pendingFines._sum.amount || 0,
    };
}

/**
 * List all premium org domains.
 */
async function listOrgs() {
    return prisma.org.findMany({ orderBy: { domainName: 'asc' } });
}

/**
 * Add a premium org domain.
 */
async function addOrg(domainName) {
    const existing = await prisma.org.findUnique({ where: { domainName } });
    if (existing) throw new AppError('Domain already exists.', 409);

    return prisma.org.create({
        data: { domainName, isActive: true },
    });
}

module.exports = { getStats, listOrgs, addOrg };
