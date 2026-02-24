const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');
const { updateBookStatus } = require('./bookService');

const prisma = new PrismaClient();

/**
 * Place a hold / reservation on a book that is currently borrowed.
 */
async function createReservation(userId, bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);

    // Check if user already has a pending reservation for this book
    const existing = await prisma.reservation.findFirst({
        where: { userId, bookId, status: 'PENDING' },
    });
    if (existing) throw new AppError('You already have a pending reservation for this book.', 400);

    // Determine queue position
    const lastReservation = await prisma.reservation.findFirst({
        where: { bookId, status: 'PENDING' },
        orderBy: { position: 'desc' },
    });
    const position = lastReservation ? lastReservation.position + 1 : 1;

    const reservation = await prisma.reservation.create({
        data: {
            userId,
            bookId,
            position,
            status: 'PENDING',
        },
        include: { book: true },
    });

    await updateBookStatus(bookId);
    return reservation;
}

/**
 * Get user's reservations.
 */
async function getUserReservations(userId) {
    return prisma.reservation.findMany({
        where: { userId },
        include: { book: true },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Cancel a reservation.
 */
async function cancelReservation(reservationId, userId) {
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new AppError('Reservation not found.', 404);
    if (reservation.userId !== userId) throw new AppError('This reservation does not belong to you.', 403);
    if (reservation.status !== 'PENDING') throw new AppError('Only pending reservations can be cancelled.', 400);

    const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'CANCELLED' },
    });

    // Re-order remaining reservations
    await reorderQueue(reservation.bookId);
    await updateBookStatus(reservation.bookId);
    return updated;
}

/**
 * Process (fulfill) the next reservation in queue for a book.
 * Called by admin after a book is returned.
 */
async function processNextReservation(bookId) {
    const next = await prisma.reservation.findFirst({
        where: { bookId, status: 'PENDING' },
        orderBy: { position: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } }, book: true },
    });

    if (!next) throw new AppError('No pending reservations for this book.', 404);

    const fulfilled = await prisma.reservation.update({
        where: { id: next.id },
        data: { status: 'FULFILLED' },
        include: { user: { select: { id: true, name: true, email: true } }, book: true },
    });

    // Re-order remaining queue
    await reorderQueue(bookId);
    await updateBookStatus(bookId);
    return fulfilled;
}

/**
 * Re-order queue positions after a cancellation or fulfillment.
 */
async function reorderQueue(bookId) {
    const pending = await prisma.reservation.findMany({
        where: { bookId, status: 'PENDING' },
        orderBy: { position: 'asc' },
    });

    for (let i = 0; i < pending.length; i++) {
        if (pending[i].position !== i + 1) {
            await prisma.reservation.update({
                where: { id: pending[i].id },
                data: { position: i + 1 },
            });
        }
    }
}

module.exports = { createReservation, getUserReservations, cancelReservation, processNextReservation };
