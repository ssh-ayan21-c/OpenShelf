const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');

const prisma = new PrismaClient();

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
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found.', 404);

    // If no query vector is provided, fall back to text search
    if (!queryVector || queryVector.length === 0) {
        const textResults = await prisma.embedding.findMany({
            where: {
                bookId,
                content: { contains: question, mode: 'insensitive' },
            },
            take: topK,
        });

        return {
            book: { id: book.id, title: book.title },
            question,
            method: 'text_search',
            results: textResults.map(e => ({ id: e.id, content: e.content })),
        };
    }

    // Vector similarity search via pgvector
    const vectorStr = `[${queryVector.join(',')}]`;
    const results = await prisma.$queryRawUnsafe(
        `SELECT id, content, vector <=> $1::vector AS distance
     FROM embeddings
     WHERE book_id = $2
     AND vector IS NOT NULL
     ORDER BY distance ASC
     LIMIT $3`,
        vectorStr,
        bookId,
        topK
    );

    return {
        book: { id: book.id, title: book.title },
        question,
        method: 'vector_similarity',
        results: results.map(r => ({
            id: r.id,
            content: r.content,
            distance: r.distance,
        })),
    };
}

/**
 * Placeholder: generate embeddings for text.
 * Replace with actual API call (OpenAI, Cohere, etc.)
 */
async function generateEmbedding(text) {
    // TODO: Integrate with your chosen AI provider
    // Example with OpenAI:
    //   const response = await openai.embeddings.create({
    //     model: 'text-embedding-3-small',
    //     input: text,
    //   });
    //   return response.data[0].embedding;

    console.warn('⚠️  generateEmbedding() is a placeholder. Integrate an AI provider for real embeddings.');
    return []; // Return empty vector
}

module.exports = { storeEmbeddings, askQuestion, generateEmbedding };
