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
        const pdfFile = req.files?.pdf?.[0];
        const coverFile = req.files?.cover?.[0];

        if (!pdfFile) {
            return res.status(400).json({ success: false, message: 'PDF file is required.' });
        }

        const { title, author, description } = req.body;
        if (!title || !author) {
            return res.status(400).json({ success: false, message: 'Title and author are required.' });
        }

        const book = await bookService.uploadCharityBookToSupabase({
            title,
            author,
            description,
            pdfFile,
            coverFile,
        });

        res.status(201).json({ success: true, data: book });
    } catch (err) {
        next(err);
    }
}

async function uploadCover(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Cover image is required.' });
        }

        const book = await bookService.uploadCoverBook(req.params.id, req.file);
        res.json({ success: true, data: book, message: 'Cover uploaded successfully!' });
    } catch (err) {
        next(err);
    }
}

module.exports = { list, getById, create, update, remove, uploadCharity, uploadCover };
