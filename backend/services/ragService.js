const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini';
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || 'http://localhost:5173';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'OpenShelf';

function hasOpenRouterKey() {
    return !!process.env.OPENROUTER_API_KEY;
}

async function callOpenRouter(path, body) {
    if (!hasOpenRouterKey()) {
        throw new AppError('OPENROUTER_API_KEY is not configured.', 500);
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': OPENROUTER_SITE_URL,
            'X-Title': OPENROUTER_APP_NAME,
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || `OpenRouter request failed with status ${response.status}`;
        throw new AppError(message, 502);
    }

    return payload;
}

/**
 * Store text chunks (and optionally embeddings) for a book.
 * In production, you'd call an embedding API (OpenAI, Cohere, etc.) here.
 *
 * @param {string} bookId
 * @param {Array<{content: string, vector?: number[]}>} chunks
 */
async function storeEmbeddings(bookId, chunks) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);

    const results = [];

    for (const chunk of chunks) {
        // Create the embedding record (text content)
        const embedding = await prisma.embedding.create({
            data: {
                bookId,
                content: chunk.content,
            },
        });

        // If a vector is provided, store it via raw SQL (pgvector)
        if (chunk.vector && Array.isArray(chunk.vector)) {
            const vectorStr = `[${chunk.vector.join(',')}]`;
            try {
                await prisma.$executeRawUnsafe(
                    `UPDATE embeddings SET vector = $1::vector WHERE id = $2`,
                    vectorStr,
                    embedding.id
                );
            } catch (_err) {
                // Some environments don't have pgvector column yet.
                // Keep the text chunk row so RAG can still use text/catalog fallback.
            }
        }

        results.push(embedding);
    }

    return { stored: results.length, embeddings: results };
}

function splitIntoChunks(text, chunkSize = 900, overlap = 120) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= chunkSize) return [clean];

    const chunks = [];
    let start = 0;
    while (start < clean.length) {
        const end = Math.min(start + chunkSize, clean.length);
        chunks.push(clean.slice(start, end));
        if (end >= clean.length) break;
        start = Math.max(0, end - overlap);
    }
    return chunks;
}

async function indexBookEmbeddings({ bookId, title, author, description, pdfUrl, forceReindex = false }) {
    if (!bookId) throw new AppError('bookId is required for indexing.', 400);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);

    if (forceReindex) {
        await prisma.embedding.deleteMany({ where: { bookId } });
    } else {
        const existingCount = await prisma.embedding.count({ where: { bookId } });
        if (existingCount > 0) {
            return { stored: 0, skipped: true, reason: 'already_indexed' };
        }
    }

    const sourceText = [
        `Title: ${title || book.title || ''}`,
        `Author: ${author || book.author || ''}`,
        description ? `Description: ${description}` : '',
        pdfUrl ? `PDF Path: ${pdfUrl}` : '',
    ].filter(Boolean).join('\n');

    const chunkTexts = splitIntoChunks(sourceText);
    if (chunkTexts.length === 0) {
        return { stored: 0, skipped: true, reason: 'no_text' };
    }

    const chunks = [];
    for (const content of chunkTexts) {
        const vector = await generateEmbedding(content);
        chunks.push({ content, vector });
    }

    const stored = await storeEmbeddings(bookId, chunks);
    return { ...stored, skipped: false };
}

/**
 * Query the vector store for a specific book.
 * Performs pgvector similarity search filtered by book_id.
 *
 * @param {string} bookId
 * @param {string} question - The user's question (text)
 * @param {number[]} queryVector - Pre-computed embedding vector for the question
 * @param {number} topK - Number of results to return
 */
async function askQuestion(bookId, question, queryVector, topK = 5) {
    let book = null;
    if (bookId) {
        book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book) throw new AppError('Book not found.', 404);
    }

    const safeTopK = Math.max(1, Math.min(Number(topK) || 5, 12));
    const runTextSearch = async () => {
        const where = bookId
            ? { bookId, content: { contains: question, mode: 'insensitive' } }
            : { content: { contains: question, mode: 'insensitive' } };

        const textResults = await prisma.embedding.findMany({
            where,
            include: { book: { select: { id: true, title: true, author: true } } },
            take: safeTopK,
        });

        const mapped = textResults.map(e => ({
            id: e.id,
            content: e.content,
            book: e.book ? { id: e.book.id, title: e.book.title, author: e.book.author } : null,
        }));

        // If embeddings table has no useful rows, fall back to lightweight book catalog search.
        if (mapped.length === 0) {
            const catalogWhere = bookId
                ? { id: bookId }
                : {
                    OR: [
                        { title: { contains: question, mode: 'insensitive' } },
                        { author: { contains: question, mode: 'insensitive' } },
                        { description: { contains: question, mode: 'insensitive' } },
                    ],
                };

            const catalogBooks = await prisma.book.findMany({
                where: catalogWhere,
                select: { id: true, title: true, author: true, description: true, genre: true },
                take: safeTopK,
            });

            const catalogResults = catalogBooks.map((b) => ({
                id: `book-${b.id}`,
                content: [b.title, b.author, b.genre, b.description].filter(Boolean).join(' | '),
                book: { id: b.id, title: b.title, author: b.author },
            }));

            return {
                book: book ? { id: book.id, title: book.title } : null,
                question,
                method: 'catalog_search',
                results: catalogResults,
            };
        }

        return {
            book: book ? { id: book.id, title: book.title } : null,
            question,
            method: 'text_search',
            results: mapped,
        };
    };

    // If no query vector is provided, fall back to text search
    if (!queryVector || queryVector.length === 0) {
        return runTextSearch();
    }

    try {
        // Vector similarity search via pgvector
        const vectorStr = `[${queryVector.join(',')}]`;
        const vectorResults = bookId
            ? await prisma.$queryRawUnsafe(
                `SELECT e.id, e.content, e."bookId" AS "bookId", b.title AS "bookTitle", b.author AS "bookAuthor", e.vector <=> $1::vector AS distance
                 FROM embeddings e
                 LEFT JOIN books b ON b.id = e."bookId"
                 WHERE e."bookId" = $2
                 AND e.vector IS NOT NULL
                 ORDER BY distance ASC
                 LIMIT $3`,
                vectorStr,
                bookId,
                safeTopK
            )
            : await prisma.$queryRawUnsafe(
                `SELECT e.id, e.content, e."bookId" AS "bookId", b.title AS "bookTitle", b.author AS "bookAuthor", e.vector <=> $1::vector AS distance
                 FROM embeddings e
                 LEFT JOIN books b ON b.id = e."bookId"
                 WHERE e.vector IS NOT NULL
                 ORDER BY distance ASC
                 LIMIT $2`,
                vectorStr,
                safeTopK
            );

        return {
            book: book ? { id: book.id, title: book.title } : null,
            question,
            method: 'vector_similarity',
            results: vectorResults.map(r => ({
                id: r.id,
                content: r.content,
                distance: r.distance,
                book: r.bookId ? { id: r.bookId, title: r.bookTitle, author: r.bookAuthor } : null,
            })),
        };
    } catch (_err) {
        // If pgvector column/query is unavailable, gracefully fall back.
        return runTextSearch();
    }
}

async function generateAnswer(question, retrievalResult) {
    const contextChunks = retrievalResult?.results || [];
    const contextText = contextChunks
        .map((item, index) => {
            const label = item.book?.title ? `${item.book.title}` : 'Unknown book';
            return `[Chunk ${index + 1} | ${label}] ${item.content}`;
        })
        .join('\n\n');

    if (!hasOpenRouterKey()) {
        if (contextChunks.length === 0) {
            return 'AI answer is unavailable because OPENROUTER_API_KEY is not configured.';
        }
        return `I found relevant context, but OPENROUTER_API_KEY is not configured.\n\nTop context:\n${contextText.slice(0, 1200)}`;
    }

    if (contextChunks.length === 0) {
        const completion = await callOpenRouter('/chat/completions', {
            model: OPENROUTER_CHAT_MODEL,
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content: 'You are OpenShelf assistant. The internal index has no direct match, so give a helpful general answer and mention this briefly.',
                },
                {
                    role: 'user',
                    content: question,
                },
            ],
        });
        return completion?.choices?.[0]?.message?.content?.trim() || 'No answer generated.';
    }

    const completion = await callOpenRouter('/chat/completions', {
        model: OPENROUTER_CHAT_MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'You are OpenShelf RAG assistant. Answer only from provided context. If context is insufficient, clearly say so.',
            },
            {
                role: 'user',
                content: `Question:\n${question}\n\nContext:\n${contextText}\n\nAnswer in concise bullet points when useful.`,
            },
        ],
    });

    return completion?.choices?.[0]?.message?.content?.trim() || 'No answer generated.';
}

/**
 * Placeholder: generate embeddings for text.
 * Replace with actual API call (OpenAI, Cohere, etc.)
 */
async function generateEmbedding(text) {
    const input = (text || '').trim();
    if (!input) return [];

    if (!hasOpenRouterKey()) {
        return [];
    }

    const payload = await callOpenRouter('/embeddings', {
        model: OPENROUTER_EMBEDDING_MODEL,
        input,
    });

    const vector = payload?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector : [];
}

module.exports = { storeEmbeddings, askQuestion, generateEmbedding, generateAnswer, indexBookEmbeddings };
