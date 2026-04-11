const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../middlewares/errorHandler');
const { supabaseAdmin } = require('../config/supabaseClient');
const { generateEmbedding } = require('./ragService');

function normalizeBook(book) {
    if (!book) return null;

    return {
        ...book,
        coverUrl: book.coverUrl ?? book.cover_url ?? null,
        thumbnailUrl: book.thumbnailUrl ?? book.thumbnail_url ?? null,
        pdfUrl: book.pdfUrl ?? book.pdf_url ?? null,
        embedding: book.embedding ?? null,
    };
}

function pickBookFields(data = {}) {
    return {
        title: data.title,
        author: data.author,
        coverUrl: data.coverUrl ?? data.cover_url ?? null,
        thumbnailUrl: data.thumbnailUrl ?? data.thumbnail_url ?? null,
        pdfUrl: data.pdfUrl ?? data.pdf_url ?? null,
        embedding: data.embedding ?? null,
    };
}

/**
 * List books with optional search, filter, sort, and pagination.
 */
async function listBooks({ search, status, genre, sort, page = 1, limit = 20 }) {
    let query = supabaseAdmin.from('books').select('*', { count: 'exact' });

    if (search) {
        const escaped = search.replace(/"/g, '""');
        query = query.or(`title.ilike.%${escaped}%,author.ilike.%${escaped}%`);
    }

    if (sort === 'author') {
        query = query.order('author', { ascending: true });
    } else {
        query = query.order('title', { ascending: true });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
        throw new AppError(`Failed to load books: ${error.message}`, 500);
    }

    const books = (data || []).map(normalizeBook);
    const total = count || 0;

    return { books, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Get single book by ID.
 */
async function getBookById(id) {
    const { data, error } = await supabaseAdmin
        .from('books')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw new AppError(`Failed to load book: ${error.message}`, 500);
    }

    if (!data) throw new AppError('Book not found.', 404);
    return normalizeBook(data);
}

/**
 * Create a new book (Admin only).
 */
async function createBook(data) {
    const payload = pickBookFields(data);

    if (!payload.title || !payload.author) {
        throw new AppError('Title and author are required.', 400);
    }

    const { data: created, error } = await supabaseAdmin
        .from('books')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        throw new AppError(`Failed to create book: ${error.message}`, 500);
    }

    return normalizeBook(created);
}

/**
 * Update a book (Admin only).
 */
async function updateBook(id, data) {
    const payload = pickBookFields(data);
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const { data: updated, error } = await supabaseAdmin
        .from('books')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        throw new AppError(`Failed to update book: ${error.message}`, 500);
    }

    if (!updated) throw new AppError('Book not found.', 404);
    return normalizeBook(updated);
}

/**
 * Delete a book (Admin only).
 */
async function deleteBook(id) {
    const { data, error } = await supabaseAdmin
        .from('books')
        .delete()
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        throw new AppError(`Failed to delete book: ${error.message}`, 500);
    }

    if (!data) throw new AppError('Book not found.', 404);
    return normalizeBook(data);
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
        .update({
            coverUrl: publicUrlData.publicUrl,
            thumbnailUrl: publicUrlData.publicUrl,
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        await deleteObjectIfExists('book-covers', coverStoragePath);

        if (error.code === 'PGRST116') {
            throw new AppError('Book not found.', 404);
        }
        throw new AppError(`Failed to update cover URL: ${error.message}`, 500);
    }

    return normalizeBook(data);
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
                pdfUrl: pdfStoragePath,
                coverUrl: coverPublicUrl,
                thumbnailUrl: coverPublicUrl,
                embedding: embeddingValue,
            })
            .select('*')
            .single();

        if (error) throw new AppError(`Failed to insert book: ${error.message}`, 500);

        return normalizeBook(data);
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
    const { data, error } = await supabaseAdmin
        .from('books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle();

    if (error || !data) return null;
    return normalizeBook(data);
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
