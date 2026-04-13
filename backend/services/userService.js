const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middlewares/errorHandler');
const { isPremiumDomain } = require('../middlewares/premiumDomain');
const { supabaseAdmin } = require('../config/supabaseClient');

const prisma = new PrismaClient();

async function getAllUsers() {
    return prisma.user.findMany({
        select: {
            id: true, email: true, name: true, role: true, isPremium: true,
            phone: true, address: true, fineBalance: true, totalFinesPaid: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

async function addUser(data) {
    const { email, password, name, phone, address } = data;
    if (!email || !password || !name) throw new AppError('Email, password, and name are required.', 400);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
    });
    if (error || !created?.user) throw new AppError(error?.message || 'Failed to create auth user.', 500);

    const premium = await isPremiumDomain(email);
    return prisma.user.upsert({
        where: { id: created.user.id },
        update: { email, name, phone, address, role: 'USER', isPremium: premium },
        create: { id: created.user.id, email, name, phone, address, role: 'USER', isPremium: premium },
        select: { id: true, email: true, name: true, role: true, phone: true, address: true, createdAt: true },
    });
}

async function addAdmin(data) {
    const { email, password, name, phone, address } = data;
    if (!email || !password || !name) throw new AppError('Email, password, and name are required.', 400);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
    });
    if (error || !created?.user) throw new AppError(error?.message || 'Failed to create auth user.', 500);

    const premium = await isPremiumDomain(email);
    return prisma.user.upsert({
        where: { id: created.user.id },
        update: { email, name, phone, address, role: 'ADMIN', isPremium: premium },
        create: { id: created.user.id, email, name, phone, address, role: 'ADMIN', isPremium: premium },
        select: { id: true, email: true, name: true, role: true, phone: true, address: true, createdAt: true },
    });
}

async function ensureUserProfileFromAuth(authUser, profile = {}) {
    if (!authUser?.id) throw new AppError('Invalid auth user.', 400);

    const email = authUser.email || profile.email;
    if (!email) throw new AppError('Email is required to sync user profile.', 400);

    const nameFromAuth = authUser.user_metadata?.name;
    const name = profile.name || nameFromAuth || email.split('@')[0];
    const premium = await isPremiumDomain(email);
    const existing = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { role: true, isPremium: true },
    });
    const role = profile.role || existing?.role || 'USER';

    return prisma.user.upsert({
        where: { id: authUser.id },
        update: {
            email,
            name,
            role,
            phone: profile.phone,
            address: profile.address,
            isPremium: existing?.isPremium ?? premium,
        },
        create: {
            id: authUser.id,
            email,
            name,
            role,
            phone: profile.phone || null,
            address: profile.address || null,
            isPremium: premium,
        },
        select: {
            id: true, email: true, name: true, role: true, isPremium: true,
            phone: true, address: true, fineBalance: true, totalFinesPaid: true, avatarUrl: true, createdAt: true,
        },
    });
}

async function getProfileByAuthId(authUserId) {
    const user = await prisma.user.findUnique({
        where: { id: authUserId },
        select: {
            id: true, email: true, name: true, role: true, isPremium: true,
            phone: true, address: true, fineBalance: true, totalFinesPaid: true, avatarUrl: true, createdAt: true,
        },
    });
    if (!user) throw new AppError('User profile not found. Please complete profile sync.', 404);
    return user;
}

async function updateProfile(userId, data) {
    const { name, phone, address, avatarUrl } = data;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    return prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true, email: true, name: true, role: true, isPremium: true,
            phone: true, address: true, fineBalance: true, totalFinesPaid: true, avatarUrl: true
        },
    });
}

module.exports = {
    getAllUsers,
    addUser,
    addAdmin,
    updateProfile,
    ensureUserProfileFromAuth,
    getProfileByAuthId,
};
