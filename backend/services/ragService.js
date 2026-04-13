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
            await prisma.$executeRawUnsafe(
                `UPDATE embeddings SET vector = $1::vector WHERE id = $2`,
                vectorStr,
                embedding.id
            );
        }

        results.push(embedding);
    }

    return { stored: results.length, embeddings: results };
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

    // If no query vector is provided, fall back to text search
    if (!queryVector || queryVector.length === 0) {
        const where = bookId
            ? { bookId, content: { contains: question, mode: 'insensitive' } }
            : { content: { contains: question, mode: 'insensitive' } };

        const textResults = await prisma.embedding.findMany({
            where,
            include: { book: { select: { id: true, title: true, author: true } } },
            take: safeTopK,
        });

        return {
            book: book ? { id: book.id, title: book.title } : null,
            question,
            method: 'text_search',
            results: textResults.map(e => ({
                id: e.id,
                content: e.content,
                book: e.book ? { id: e.book.id, title: e.book.title, author: e.book.author } : null,
            })),
        };
    }

    // Vector similarity search via pgvector
    const vectorStr = `[${queryVector.join(',')}]`;
    const vectorResults = bookId
        ? await prisma.$queryRawUnsafe(
            `SELECT e.id, e.content, e.book_id, b.title AS book_title, b.author AS book_author, e.vector <=> $1::vector AS distance
             FROM embeddings e
             LEFT JOIN books b ON b.id = e.book_id
             WHERE e.book_id = $2
             AND e.vector IS NOT NULL
             ORDER BY distance ASC
             LIMIT $3`,
            vectorStr,
            bookId,
            safeTopK
        )
        : await prisma.$queryRawUnsafe(
            `SELECT e.id, e.content, e.book_id, b.title AS book_title, b.author AS book_author, e.vector <=> $1::vector AS distance
             FROM embeddings e
             LEFT JOIN books b ON b.id = e.book_id
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
            book: r.book_id ? { id: r.book_id, title: r.book_title, author: r.book_author } : null,
        })),
    };
}

async function generateAnswer(question, retrievalResult) {
    const contextChunks = retrievalResult?.results || [];

    if (contextChunks.length === 0) {
        return 'I could not find relevant context in the indexed library content for that question yet.';
    }

    const contextText = contextChunks
        .map((item, index) => {
            const label = item.book?.title ? `${item.book.title}` : 'Unknown book';
            return `[Chunk ${index + 1} | ${label}] ${item.content}`;
        })
        .join('\n\n');

    if (!hasOpenRouterKey()) {
        return `I found relevant context, but OPENROUTER_API_KEY is not configured.\n\nTop context:\n${contextText.slice(0, 1200)}`;
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
        console.warn('⚠️  OPENROUTER_API_KEY is not configured. Returning empty embedding.');
        return [];
    }

    const payload = await callOpenRouter('/embeddings', {
        model: OPENROUTER_EMBEDDING_MODEL,
        input,
    });

    const vector = payload?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector : [];
}

module.exports = { storeEmbeddings, askQuestion, generateEmbedding, generateAnswer };
