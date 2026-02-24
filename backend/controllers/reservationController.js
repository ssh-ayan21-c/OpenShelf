const reservationService = require('../services/reservationService');

async function create(req, res, next) {
    try {
        const { bookId } = req.body;
        if (!bookId) return res.status(400).json({ success: false, message: 'bookId is required.' });
        const reservation = await reservationService.createReservation(req.user.id, bookId);
        res.status(201).json({ success: true, data: reservation });
    } catch (err) {
        next(err);
    }
}

async function myReservations(req, res, next) {
    try {
        const reservations = await reservationService.getUserReservations(req.user.id);
        res.json({ success: true, data: reservations });
    } catch (err) {
        next(err);
    }
}

async function cancel(req, res, next) {
    try {
        const reservation = await reservationService.cancelReservation(req.params.id, req.user.id);
        res.json({ success: true, data: reservation });
    } catch (err) {
        next(err);
    }
}

async function processNext(req, res, next) {
    try {
        const result = await reservationService.processNextReservation(req.params.bookId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = { create, myReservations, cancel, processNext };
