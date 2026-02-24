const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

/**
 * Middleware: Verify JWT token from Authorization header.
 * Sets req.user = { id, email, role, isPremium }
 */
function authenticate(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required. Please provide a valid token.', 401);
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err instanceof AppError) return next(err);
        next(new AppError('Invalid or expired token.', 401));
    }
}

/**
 * Middleware: Require ADMIN role.
 * Must be used AFTER authenticate().
 */
function requireAdmin(req, _res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        return next(new AppError('Admin access required.', 403));
    }
    next();
}

module.exports = { authenticate, requireAdmin };
