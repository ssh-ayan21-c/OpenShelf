const multer = require('multer');
const { AppError } = require('./errorHandler');

const storage = multer.memoryStorage();

const pdfFilter = (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new AppError('Only PDF files are allowed.', 400), false);
    }
};

const imageFilter = (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new AppError('Only image files are allowed.', 400), false);
    }
};

const upload = multer({
    storage,
    fileFilter: pdfFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const uploadImage = multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for images
});

const mixedFileFilter = (_req, file, cb) => {
    if (file.fieldname === 'pdf') return pdfFilter(_req, file, cb);
    if (file.fieldname === 'cover') return imageFilter(_req, file, cb);
    return cb(new AppError(`Unexpected file field: ${file.fieldname}`, 400), false);
};

const uploadBookAssets = multer({
    storage,
    fileFilter: mixedFileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 2,
    },
}).fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
]);

module.exports = { upload, uploadImage, uploadBookAssets };
