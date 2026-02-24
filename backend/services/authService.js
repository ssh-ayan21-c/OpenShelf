const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../middlewares/errorHandler');
const { isPremiumDomain } = require('../middlewares/premiumDomain');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

/**
 * Register a new user.
 * Auto-grants premium if email domain is whitelisted.
 */
async function register({ email, password, name }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already registered.', 409);

    const hashedPassword = await bcrypt.hash(password, 10);
    const premium = await isPremiumDomain(email);

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            isPremium: premium,
        },
    });

    const token = generateToken(user);
    return { user: sanitizeUser(user), token };
}

/**
 * Login with email + password. Returns JWT.
 */
async function login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials.', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid credentials.', 401);

    // Re-check premium status on login
    const premium = await isPremiumDomain(email);
    if (premium && !user.isPremium) {
        await prisma.user.update({ where: { id: user.id }, data: { isPremium: true } });
        user.isPremium = true;
    }

    const token = generateToken(user);
    return { user: sanitizeUser(user), token };
}

/**
 * Get user profile by ID.
 */
async function getProfile(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found.', 404);
    return sanitizeUser(user);
}

// --- Helpers ---

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, isPremium: user.isPremium },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function sanitizeUser(user) {
    const { password, ...safe } = user;
    return safe;
}

module.exports = { register, login, getProfile };
