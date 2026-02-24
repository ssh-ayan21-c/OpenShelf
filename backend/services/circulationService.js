const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');
const { updateBookStatus } = require('./bookService');

const prisma = new PrismaClient();
const DEFAULT_BORROW_DAYS = parseInt(process.env.DEFAULT_BORROW_DAYS) || 14;

/**
 * Borrow a physical book.
 */
async function borrowBook(userId, bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);

    // Check availability
    const activeBorrows = await prisma.circulation.count({
        where: { bookId, type: 'BORROW', returnDate: null },
    });

    if (activeBorrows >= book.physicalCount) {
        throw new AppError('No physical copies available. You can place a reservation instead.', 400);
    }

    // Check if user already has this book
    const alreadyBorrowed = await prisma.circulation.findFirst({
        where: { userId, bookId, type: 'BORROW', returnDate: null },
    });
    if (alreadyBorrowed) throw new AppError('You already have this book borrowed.', 400);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_BORROW_DAYS);

    const circulation = await prisma.circulation.create({
        data: {
            userId,
            bookId,
            type: 'BORROW',
            dueDate,
        },
        include: { book: true },
    });

    await updateBookStatus(bookId);
    return circulation;
}

/**
 * Return a borrowed book. Automatically checks for overdue fines.
 */
async function returnBook(userId, circulationId) {
    const circulation = await prisma.circulation.findUnique({
        where: { id: circulationId },
        include: { book: true },
    });

    if (!circulation) throw new AppError('Circulation record not found.', 404);
    if (circulation.userId !== userId) throw new AppError('This is not your circulation record.', 403);
    if (circulation.returnDate) throw new AppError('This book has already been returned.', 400);

    const now = new Date();

    // Check for overdue fine
    let fine = null;
    if (circulation.dueDate && now > circulation.dueDate) {
        const daysOverdue = Math.ceil((now - circulation.dueDate) / (1000 * 60 * 60 * 24));
        const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 5;
        const amount = daysOverdue * finePerDay;

        fine = await prisma.fine.create({
            data: {
                circulationId: circulation.id,
                amount,
                isPaid: false,
            },
        });
    }

    // Update circulation
    const updated = await prisma.circulation.update({
        where: { id: circulationId },
        data: { returnDate: now },
        include: { book: true },
    });

    await updateBookStatus(circulation.bookId);

    // Check if there's a pending reservation to fulfill
    const nextReservation = await prisma.reservation.findFirst({
        where: { bookId: circulation.bookId, status: 'PENDING' },
        orderBy: { position: 'asc' },
    });

    return { circulation: updated, fine, nextReservation };
}

/**
 * Rent a digital book.
 */
async function rentBook(userId, bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);
    if (!book.isDigital) throw new AppError('This book is not available digitally.', 400);
    if (!book.rentPrice) throw new AppError('This book is not available for rent.', 400);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_BORROW_DAYS);

    const circulation = await prisma.circulation.create({
        data: {
            userId,
            bookId,
            type: 'RENT',
            dueDate,
        },
        include: { book: true },
    });

    return circulation;
}

/**
 * Buy a digital book.
 */
async function buyBook(userId, bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);
    if (!book.isDigital) throw new AppError('This book is not available digitally.', 400);
    if (!book.price) throw new AppError('This book is not available for purchase.', 400);

    // Check if already purchased
    const alreadyBought = await prisma.circulation.findFirst({
        where: { userId, bookId, type: 'BUY' },
    });
    if (alreadyBought) throw new AppError('You already own this book.', 400);

    const circulation = await prisma.circulation.create({
        data: {
            userId,
            bookId,
            type: 'BUY',
            // No dueDate for purchases
        },
        include: { book: true },
    });

    return circulation;
}

/**
 * Get all circulation records for a user.
 */
async function getUserCirculations(userId) {
    return prisma.circulation.findMany({
        where: { userId },
        include: { book: true, fines: true },
        orderBy: { borrowDate: 'desc' },
    });
}

module.exports = { borrowBook, returnBook, rentBook, buyBook, getUserCirculations };
