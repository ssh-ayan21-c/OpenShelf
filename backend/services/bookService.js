const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

/**
 * List books with optional search, filter, sort, and pagination.
 */
async function listBooks({ search, status, genre, sort, page = 1, limit = 20 }) {
    const where = {};

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { author: { contains: search, mode: 'insensitive' } },
            { isbn: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (status) where.status = status;
    if (genre) where.genre = { contains: genre, mode: 'insensitive' };

    // Sort options
    let orderBy = { createdAt: 'desc' };
    if (sort === 'title') orderBy = { title: 'asc' };
    else if (sort === 'author') orderBy = { author: 'asc' };
    else if (sort === 'quantity') orderBy = { physicalCount: 'desc' };
    else if (sort === 'dateAdded') orderBy = { createdAt: 'desc' };

    const skip = (page - 1) * limit;
    const [books, total] = await Promise.all([
        prisma.book.findMany({ where, orderBy, skip, take: limit }),
        prisma.book.count({ where }),
    ]);

    return { books, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Get single book by ID.
 */
async function getBookById(id) {
    const book = await prisma.book.findUnique({
        where: { id },
        include: {
            circulations: { where: { returnDate: null }, select: { id: true, userId: true, type: true, dueDate: true } },
            reservations: { where: { status: 'PENDING' }, orderBy: { position: 'asc' } },
        },
    });
    if (!book) throw new AppError('Book not found.', 404);
    return book;
}

/**
 * Create a new book (Admin only).
 */
async function createBook(data) {
    const existing = await prisma.book.findUnique({ where: { isbn: data.isbn } });
    if (existing) throw new AppError('A book with this ISBN already exists.', 409);

    // Determine initial status
    if (data.physicalCount === 0 && data.isDigital) {
        data.status = 'DIGITAL_ONLY';
    } else if (data.physicalCount > 0) {
        data.status = 'AVAILABLE';
    }

    return prisma.book.create({ data });
}

/**
 * Update a book (Admin only).
 */
async function updateBook(id, data) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw new AppError('Book not found.', 404);
    return prisma.book.update({ where: { id }, data });
}

/**
 * Delete a book (Admin only).
 */
async function deleteBook(id) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw new AppError('Book not found.', 404);
    return prisma.book.delete({ where: { id } });
}

/**
 * Upload a charity book (PDF with metadata).
 */
async function uploadCharityBook({ isbn, title, author, genre, description, pdfPath }) {
    const book = await prisma.book.create({
        data: {
            isbn,
            title,
            author,
            genre,
            description,
            isDigital: true,
            digitalCount: 1,
            physicalCount: 0,
            pdfUrl: pdfPath,
            status: 'DIGITAL_ONLY',
        },
    });
    return book;
}

/**
 * Recalculate book availability status based on physical count and active borrows.
 */
async function updateBookStatus(bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return;

    const activeBorrows = await prisma.circulation.count({
        where: { bookId, type: 'BORROW', returnDate: null },
    });

    const pendingReservations = await prisma.reservation.count({
        where: { bookId, status: 'PENDING' },
    });

    let newStatus = 'AVAILABLE';
    if (book.physicalCount === 0 && book.isDigital) {
        newStatus = 'DIGITAL_ONLY';
    } else if (activeBorrows >= book.physicalCount) {
        newStatus = pendingReservations > 0 ? 'RESERVED' : 'BORROWED';
    }

    await prisma.book.update({ where: { id: bookId }, data: { status: newStatus } });
}

module.exports = {
    listBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook,
    uploadCharityBook,
    updateBookStatus,
};
