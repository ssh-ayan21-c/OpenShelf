const adminService = require('../services/adminService');

async function stats(req, res, next) {
    try {
        const data = await adminService.getStats();
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

async function listOrgs(req, res, next) {
    try {
        const orgs = await adminService.listOrgs();
        res.json({ success: true, data: orgs });
    } catch (err) {
        next(err);
    }
}

async function addOrg(req, res, next) {
    try {
        const { domainName } = req.body;
        if (!domainName) {
            return res.status(400).json({ success: false, message: 'domainName is required.' });
        }
        const org = await adminService.addOrg(domainName);
        res.status(201).json({ success: true, data: org });
    } catch (err) {
        next(err);
    }
}

module.exports = { stats, listOrgs, addOrg };
