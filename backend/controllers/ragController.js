const ragService = require('../services/ragService');

async function embed(req, res, next) {
    try {
        const { bookId, chunks } = req.body;
        if (!bookId || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'bookId and chunks[] (array of { content, vector? }) are required.',
            });
        }
        const result = await ragService.storeEmbeddings(bookId, chunks);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function ask(req, res, next) {
    try {
        const { bookId, question, queryVector, topK } = req.body;
        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'question is required.',
            });
        }

        // If no queryVector provided, generate one via configured embedding model.
        let vector = queryVector;
        if (!vector || vector.length === 0) {
            vector = await ragService.generateEmbedding(question);
        }

        const retrieval = await ragService.askQuestion(bookId || null, question, vector, topK || 5);
        const answer = await ragService.generateAnswer(question, retrieval);

        res.json({ success: true, answer, data: { ...retrieval, answer } });
    } catch (err) {
        next(err);
    }
}

module.exports = { embed, ask };
