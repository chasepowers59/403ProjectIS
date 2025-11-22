const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');

// GET /events/upcoming - Get sorted upcoming events
router.get('/upcoming', eventsController.getUpcomingEvents);

// GET /events/export - Export calendar as ICS (mapped to /calendar/export in server.js if needed, or here)
// User requested GET /calendar/export, so we might mount this router at / or handle it specifically.
// For simplicity, we'll expose it here as /export and mount the router appropriately.
router.get('/export', eventsController.exportCalendar);

module.exports = router;
