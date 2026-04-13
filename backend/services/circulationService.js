const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');
const { updateBookStatus } = require('./bookService');
const { createTransaction } = require('./transactionService');

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

    try {
        await createTransaction({
            type: 'BORROW',
            userId,
            bookId,
            description: `Borrowed "${book.title}"`,
            metadata: { circulationId: circulation.id, dueDate: circulation.dueDate },
        });
    } catch (err) {
        console.error('Failed to record BORROW transaction:', err);
    }

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

    try {
        await createTransaction({
            type: 'RETURN',
            userId: circulation.userId,
            bookId: circulation.bookId,
            description: `Returned "${circulation.book?.title || 'book'}"`,
            metadata: { circulationId: circulation.id, fineId: fine?.id || null, fineAmount: fine?.amount || 0 },
        });
    } catch (err) {
        console.error('Failed to record RETURN transaction:', err);
    }

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

    try {
        await createTransaction({
            type: 'BOOK_PURCHASE',
            userId,
            bookId,
            amount: Number(book.price || 0),
            description: `Purchased "${book.title}"`,
            metadata: { circulationId: circulation.id },
        });
    } catch (err) {
        console.error('Failed to record BOOK_PURCHASE transaction:', err);
    }

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

/**
 * Renew a borrowed book (extend due date). Max 1 renewal.
 */
async function renewBook(userId, circulationId) {
    const circulation = await prisma.circulation.findUnique({
        where: { id: circulationId },
        include: { book: true },
    });

    if (!circulation) throw new AppError('Circulation record not found.', 404);
    if (circulation.userId !== userId) throw new AppError('This is not your circulation record.', 403);
    if (circulation.type !== 'BORROW') throw new AppError('Only borrow records can be renewed.', 400);
    if (circulation.returnDate) throw new AppError('Book has already been returned.', 400);

    const now = new Date();
    if (circulation.dueDate && now > circulation.dueDate) {
        throw new AppError('Cannot renew overdue books. Please return the book and pay any fines.', 400);
    }

    if (circulation.renewalCount >= 1) {
        throw new AppError('Book has already been renewed once. Maximum renewals reached.', 400);
    }

    // Check for active reservations
    const activeReservation = await prisma.reservation.findFirst({
        where: { bookId: circulation.bookId, status: 'PENDING' },
    });
    if (activeReservation) {
        throw new AppError('Cannot renew. This book has been reserved by another user.', 400);
    }

    const newDueDate = new Date(circulation.dueDate);
    newDueDate.setDate(newDueDate.getDate() + DEFAULT_BORROW_DAYS);

    const renewed = await prisma.circulation.update({
        where: { id: circulationId },
        data: { dueDate: newDueDate, renewalCount: { increment: 1 }, renewedAt: now },
        include: { book: true },
    });

    try {
        await createTransaction({
            type: 'RENEWAL',
            userId: circulation.userId,
            bookId: circulation.bookId,
            description: `Renewed "${circulation.book?.title || 'book'}"`,
            metadata: { circulationId: circulation.id, newDueDate },
        });
    } catch (err) {
        console.error('Failed to record RENEWAL transaction:', err);
    }

    return renewed;
}

/**
 * Admin borrows a book on behalf of a user (by email).
 */
async function adminBorrowBook(email, bookId) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found.', 404);

    if (user.fineBalance > 0) {
        throw new AppError(`Cannot borrow. User has outstanding fine of ₹${user.fineBalance.toFixed(2)}.`, 403);
    }

    return borrowBook(user.id, bookId);
}

/**
 * Admin returns a book (by circulation ID).
 */
async function adminReturnBook(circulationId) {
    const circulation = await prisma.circulation.findUnique({
        where: { id: circulationId },
        include: { book: true },
    });

    if (!circulation) throw new AppError('Circulation record not found.', 404);
    if (circulation.returnDate) throw new AppError('This book has already been returned.', 400);

    const now = new Date();
    let fine = null;

    if (circulation.dueDate && now > circulation.dueDate) {
        const daysOverdue = Math.ceil((now - circulation.dueDate) / (1000 * 60 * 60 * 24));
        const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 5;
        const amount = daysOverdue * finePerDay;

        fine = await prisma.fine.create({
            data: { circulationId: circulation.id, amount, isPaid: false },
        });

        // Update user fine balance
        await prisma.user.update({
            where: { id: circulation.userId },
            data: { fineBalance: { increment: amount } },
        });
    }

    const updated = await prisma.circulation.update({
        where: { id: circulationId },
        data: { returnDate: now },
        include: { book: true, user: { select: { id: true, name: true, email: true } } },
    });

    await updateBookStatus(circulation.bookId);

    try {
        await createTransaction({
            type: 'RETURN',
            userId: circulation.userId,
            bookId: circulation.bookId,
            description: `Returned "${circulation.book?.title || 'book'}"`,
            metadata: { circulationId: circulation.id, fineId: fine?.id || null, fineAmount: fine?.amount || 0 },
        });
    } catch (err) {
        console.error('Failed to record admin RETURN transaction:', err);
    }

    return { circulation: updated, fine };
}

/**
 * Admin extends due date for a specific user's book.
 */
async function extendDueDate(email, bookId, days) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found with this email.', 404);

    const circulation = await prisma.circulation.findFirst({
        where: { userId: user.id, bookId, type: 'BORROW', returnDate: null },
        include: { book: true },
    });

    if (!circulation) throw new AppError('No active borrow found for this user and book.', 404);

    const newDueDate = new Date(circulation.dueDate);
    newDueDate.setDate(newDueDate.getDate() + days);

    return prisma.circulation.update({
        where: { id: circulation.id },
        data: { dueDate: newDueDate, renewalCount: { increment: 1 }, renewedAt: new Date() },
        include: { book: true, user: { select: { id: true, name: true, email: true } } },
    });
}

/**
 * Get all active circulations (admin).
 */
async function getAllActiveCirculations() {
    return prisma.circulation.findMany({
        where: { type: 'BORROW', returnDate: null },
        include: {
            book: true,
            user: { select: { id: true, name: true, email: true } },
            fines: true,
        },
        orderBy: { borrowDate: 'desc' },
    });
}

module.exports = {
    borrowBook, returnBook, rentBook, buyBook, getUserCirculations,
    renewBook, adminBorrowBook, adminReturnBook, extendDueDate, getAllActiveCirculations,
};
