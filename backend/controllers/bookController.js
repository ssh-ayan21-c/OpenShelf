const bookService = require('../services/bookService');

async function list(req, res, next) {
    try {
        const { search, status, genre, sort, page, limit } = req.query;
        const result = await bookService.listBooks({
            search,
            status,
            genre,
            sort,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
        });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function getById(req, res, next) {
    try {
        const book = await bookService.getBookById(req.params.id);
        res.json({ success: true, data: book });
    } catch (err) {
        next(err);
    }
}

async function create(req, res, next) {
    try {
        const book = await bookService.createBook(req.body);
        res.status(201).json({ success: true, data: book });
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        const book = await bookService.updateBook(req.params.id, req.body);
        res.json({ success: true, data: book });
    } catch (err) {
        next(err);
    }
}

async function remove(req, res, next) {
    try {
        await bookService.deleteBook(req.params.id);
        res.json({ success: true, message: 'Book deleted.' });
    } catch (err) {
        next(err);
    }
}

async function uploadCharity(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'PDF file is required.' });
        }

        const { isbn, title, author, genre, description } = req.body;
        if (!isbn || !title || !author) {
            return res.status(400).json({ success: false, message: 'ISBN, title, and author are required.' });
        }

        const pdfPath = `/uploads/${req.file.filename}`;
        const book = await bookService.uploadCharityBook({ isbn, title, author, genre, description, pdfPath });
        res.status(201).json({ success: true, data: book });
    } catch (err) {
        next(err);
    }
}

module.exports = { list, getById, create, update, remove, uploadCharity };
