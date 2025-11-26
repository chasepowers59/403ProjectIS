const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');

// GET /events/upcoming - Get sorted upcoming events
router.get('/upcoming', eventsController.getUpcomingEvents);

// GET /calendar (mounted at /calendar via server.js, so this handles the root)
router.get('/', eventsController.getCalendarPage);

// GET /events/export - Export calendar as ICS (mapped to /calendar/export in server.js if needed, or here)
// User requested GET /calendar/export, so we might mount this router at / or handle it specifically.
// For simplicity, we'll expose it here as /export and mount the router appropriately.
router.get('/export', eventsController.exportCalendar);

// POST /events - Create new event
router.post('/', eventsController.createEvent);

// POST /events/update/:id - Update event
router.post('/update/:id', eventsController.updateEvent);

// POST /events/delete/:id - Delete event
router.post('/delete/:id', eventsController.deleteEvent);

module.exports = router;
