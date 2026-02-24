const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check if a user's email domain matches a premium org.
 * Returns true if the domain is whitelisted and active.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isPremiumDomain(email) {
    const domain = email.split('@')[1];
    if (!domain) return false;

    // Check database first
    const org = await prisma.org.findUnique({
        where: { domainName: domain },
    });

    if (org && org.isActive) return true;

    // Fallback: check env variable
    const envDomains = (process.env.PREMIUM_DOMAINS || '').split(',').map(d => d.trim());
    return envDomains.includes(domain);
}

module.exports = { isPremiumDomain };
