const authService = require('../services/authService');

async function register(req, res, next) {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ success: false, message: 'Email, password, and name are required.' });
        }
        const result = await authService.register({ email, password, name });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        const result = await authService.login({ email, password });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function getMe(req, res, next) {
    try {
        const user = await authService.getProfile(req.user.id);
        res.json({ success: true, data: user });
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login, getMe };
