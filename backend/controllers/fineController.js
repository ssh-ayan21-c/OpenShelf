const fineService = require('../services/fineService');

async function myFines(req, res, next) {
    try {
        const fines = await fineService.getUserFines(req.user.id);
        res.json({ success: true, data: fines });
    } catch (err) {
        next(err);
    }
}

async function calculate(req, res, next) {
    try {
        const result = await fineService.calculateOverdueFines();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function pay(req, res, next) {
    try {
        const fine = await fineService.payFine(req.params.id, req.user.id);
        res.json({ success: true, data: fine });
    } catch (err) {
        next(err);
    }
}

module.exports = { myFines, calculate, pay };
