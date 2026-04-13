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
        format: book.format ?? (book.isDigital ? 'digital' : 'physical'),
        shelfLocation: book.shelfLocation ?? book.shelf_location ?? null,
        availableCopies: book.availableCopies ?? book.available_copies ?? book.physicalCount ?? 0,
        isPremium: book.isPremium ?? book.is_premium ?? false,
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
        format: data.format,
        shelf_location: data.shelfLocation ?? data.shelf_location,
        available_copies: data.availableCopies ?? data.available_copies,
        is_premium: data.isPremium ?? data.is_premium,
        embedding: data.embedding ?? null,
    };
}

async function insertBookWithSchemaFallback(basePayload) {
    let payload = { ...basePayload };
    const triedMissingColumns = new Set();

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data, error } = await supabaseAdmin
            .from('books')
            .insert(payload)
            .select('*')
            .single();

        if (!error) return data;

        const match = /Could not find the '([^']+)' column of 'books' in the schema cache/.exec(error.message || '');
        if (!match) {
            throw new AppError(`Failed to insert book: ${error.message}`, 500);
        }

        const missingColumn = match[1];
        if (!Object.prototype.hasOwnProperty.call(payload, missingColumn) || triedMissingColumns.has(missingColumn)) {
            throw new AppError(`Failed to insert book: ${error.message}`, 500);
        }

        triedMissingColumns.add(missingColumn);
        delete payload[missingColumn];
    }

    throw new AppError('Failed to insert book: schema mismatch could not be resolved.', 500);
}

function normalizePdfStoragePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const trimmed = rawPath.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const marker = '/pdfs/';
        const markerIndex = trimmed.indexOf(marker);
        if (markerIndex === -1) return null;
        return decodeURIComponent(trimmed.slice(markerIndex + marker.length));
    }

    return trimmed.replace(/^\/+/, '').replace(/^pdfs\//, '');
}

function resolveSubscriptionTier(userRow) {
    if (!userRow) return 'free';
    const tier = userRow.subscription_tier ?? userRow.subscriptionTier;
    if (tier === 'premium' || tier === 'free') return tier;
    return userRow.isPremium ? 'premium' : 'free';
}

async function hasActiveRental(userId, bookId) {
    const nowIso = new Date().toISOString();

    // Preferred snake_case schema
    const snake = await supabaseAdmin
        .from('rentals')
        .select('id')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .gt('expires_at', nowIso)
        .limit(1)
        .maybeSingle();

    if (!snake.error) return !!snake.data;

    // Backward-compatible camelCase fallback
    const camel = await supabaseAdmin
        .from('rentals')
        .select('id')
        .eq('userId', userId)
        .eq('bookId', bookId)
        .gt('expiresAt', nowIso)
        .limit(1)
        .maybeSingle();

    if (camel.error) {
        throw new AppError(`Failed to verify active rental: ${camel.error.message}`, 500);
    }

    return !!camel.data;
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
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

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

        const inserted = await insertBookWithSchemaFallback({
            title,
            author,
            pdfUrl: pdfStoragePath,
            coverUrl: coverPublicUrl,
            thumbnailUrl: coverPublicUrl,
            format: 'digital',
            available_copies: 0,
            is_premium: false,
            embedding: embeddingValue,
        });

        return normalizeBook(inserted);
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

/**
 * Authorize and return a short-lived signed URL for reading a digital/hybrid PDF.
 */
async function getDigitalReadUrl(bookId, userId) {
    const book = await getBookById(bookId);
    const bookFormat = book.format;

    if (!['digital', 'hybrid'].includes(bookFormat)) {
        throw new AppError('This book is not available for digital reading.', 400);
    }

    const pdfPath = normalizePdfStoragePath(book.pdfUrl);
    if (!pdfPath) {
        throw new AppError('No readable PDF is available for this book.', 400);
    }

    const isPremiumBook = !!book.isPremium;

    if (isPremiumBook) {
        const snakeUser = await supabaseAdmin
            .from('users')
            .select('id, subscription_tier, isPremium')
            .eq('id', userId)
            .maybeSingle();

        let userRow = snakeUser.data;
        let userError = snakeUser.error;

        if (userError) {
            const camelUser = await supabaseAdmin
                .from('users')
                .select('id, subscriptionTier, isPremium')
                .eq('id', userId)
                .maybeSingle();

            userRow = camelUser.data;
            userError = camelUser.error;
        }

        if (userError) {
            throw new AppError(`Failed to verify user subscription: ${userError.message}`, 500);
        }
        if (!userRow) {
            throw new AppError('User profile not found.', 404);
        }

        const tier = resolveSubscriptionTier(userRow);
        if (tier !== 'premium') {
            const activeRental = await hasActiveRental(userId, bookId);
            if (!activeRental) {
                throw new AppError('Access denied. Please rent this digital copy or upgrade to Premium.', 403);
            }
        }
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from('pdfs')
        .createSignedUrl(pdfPath, 15 * 60);

    if (signedError || !signedData?.signedUrl) {
        throw new AppError(`Failed to generate read URL: ${signedError?.message || 'Unknown storage error.'}`, 500);
    }

    return {
        signedUrl: signedData.signedUrl,
        expiresIn: 15 * 60,
    };
}

/**
 * Create a temporary rental access row for a digital/hybrid book.
 */
async function rentDigitalAccess(bookId, userId) {
    const book = await getBookById(bookId);
    const bookFormat = book.format;

    if (!['digital', 'hybrid'].includes(bookFormat)) {
        throw new AppError('This book is not available for digital rental.', 400);
    }

    const now = Date.now();
    const expiresAt = new Date(now + (7 * 24 * 60 * 60 * 1000)).toISOString();

    const snakeInsert = await supabaseAdmin
        .from('rentals')
        .insert({
            user_id: userId,
            book_id: bookId,
            expires_at: expiresAt,
        })
        .select('*')
        .single();

    if (!snakeInsert.error) {
        return {
            rental: snakeInsert.data,
            expiresAt,
        };
    }

    const camelInsert = await supabaseAdmin
        .from('rentals')
        .insert({
            userId,
            bookId,
            expiresAt,
        })
        .select('*')
        .single();

    if (camelInsert.error) {
        throw new AppError(`Failed to create rental access: ${camelInsert.error.message}`, 500);
    }

    return {
        rental: camelInsert.data,
        expiresAt,
    };
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
    getDigitalReadUrl,
    rentDigitalAccess,
};
