/**
 * Centralized error-handling middleware.
 * Must be registered AFTER all routes in Express.
 */
function errorHandler(err, _req, res, _next) {
    console.error('❌ Error:', err.message || err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}

/**
 * Helper to throw errors with a status code.
 */
class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

module.exports = { errorHandler, AppError };
