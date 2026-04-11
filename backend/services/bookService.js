const { PrismaClient } = require('@prisma/client');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../middlewares/errorHandler');
const { supabaseAdmin } = require('../config/supabaseClient');
const { generateEmbedding } = require('./ragService');

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
 * Upload a cover image for a book.
 */
async function uploadCoverBook(id, coverFile) {
    if (!coverFile?.buffer) {
        throw new AppError('Cover image buffer is required.', 400);
    }

    const coverStoragePath = buildStoragePath('book-covers', coverFile.originalname);
    const coverUpload = await supabaseAdmin.storage
        .from('book-covers')
        .upload(coverStoragePath, coverFile.buffer, {
            contentType: coverFile.mimetype,
            upsert: false,
        });

    if (coverUpload.error) {
        throw new AppError(`Failed to upload cover image: ${coverUpload.error.message}`, 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
        .from('book-covers')
        .getPublicUrl(coverStoragePath);

    const { data, error } = await supabaseAdmin
        .from('books')
        .update({ cover_url: publicUrlData.publicUrl })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        await deleteObjectIfExists('book-covers', coverStoragePath);

        if (error.code === 'PGRST116') {
            throw new AppError('Book not found.', 404);
        }
        throw new AppError(`Failed to update cover URL: ${error.message}`, 500);
    }

    return data;
}

function buildStoragePath(prefix, originalName = '') {
    const ext = path.extname(originalName).toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    return `${prefix}/${Date.now()}-${crypto.randomUUID()}${safeExt}`;
}

async function deleteObjectIfExists(bucket, objectPath) {
    if (!objectPath) return;

    await supabaseAdmin.storage.from(bucket).remove([objectPath]);
}

function toVectorLiteral(vector) {
    return `[${vector.join(',')}]`;
}

/**
 * Upload PDF + optional cover to Supabase Storage and create a books record.
 */
async function uploadCharityBookToSupabase({ title, author, description, pdfFile, coverFile }) {
    if (!pdfFile?.buffer) {
        throw new AppError('PDF file is required.', 400);
    }

    const pdfStoragePath = buildStoragePath('charity-pdfs', pdfFile.originalname);
    let coverStoragePath;

    const pdfUpload = await supabaseAdmin.storage
        .from('pdfs')
        .upload(pdfStoragePath, pdfFile.buffer, {
            contentType: pdfFile.mimetype,
            upsert: false,
        });

    if (pdfUpload.error) {
        throw new AppError(`Failed to upload PDF: ${pdfUpload.error.message}`, 500);
    }

    let coverPublicUrl = null;

    if (coverFile?.buffer) {
        coverStoragePath = buildStoragePath('covers', coverFile.originalname);
        const coverUpload = await supabaseAdmin.storage
            .from('book-covers')
            .upload(coverStoragePath, coverFile.buffer, {
                contentType: coverFile.mimetype,
                upsert: false,
            });

        if (coverUpload.error) {
            await deleteObjectIfExists('pdfs', pdfStoragePath);
            throw new AppError(`Failed to upload cover image: ${coverUpload.error.message}`, 500);
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('book-covers')
            .getPublicUrl(coverStoragePath);
        coverPublicUrl = publicUrlData.publicUrl;
    }

    try {
        const embeddingInput = [title, author, description].filter(Boolean).join(' ').trim();
        const embedding = embeddingInput ? await generateEmbedding(embeddingInput) : [];
        const embeddingValue = Array.isArray(embedding) && embedding.length > 0 ? toVectorLiteral(embedding) : null;

        const { data, error } = await supabaseAdmin
            .from('books')
            .insert({
                title,
                author,
                pdf_url: pdfStoragePath,
                cover_url: coverPublicUrl,
                embedding: embeddingValue,
            })
            .select('*')
            .single();

        if (error) throw new AppError(`Failed to insert book: ${error.message}`, 500);

        return data;
    } catch (err) {
        await Promise.all([
            deleteObjectIfExists('pdfs', pdfStoragePath),
            deleteObjectIfExists('book-covers', coverStoragePath),
        ]);
        throw err;
    }
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
    uploadCharityBookToSupabase,
    updateBookStatus,
    uploadCoverBook,
};
