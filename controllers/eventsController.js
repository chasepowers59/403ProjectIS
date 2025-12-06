require('dotenv').config();
const environment = process.env.NODE_ENV || 'development';
const knex = require('knex')(require('../database/knexfile')[environment]);

/**
 * Events Controller
 * Handles event retrieval and calendar export
 */
const eventsController = {
    /**
     * GET /events/upcoming
     * Retrieve upcoming events with optional filters
     */
    getUpcomingEvents: async (req, res) => {
        try {
            const { channel, limit = 50, from } = req.query;

            // Default start date is today if not specified
            const startDate = from ? new Date(from) : new Date();
            startDate.setHours(0, 0, 0, 0);

            let query = knex('events')
                .select('*')
                .where('start_time', '>=', startDate)
                .orderBy('start_time', 'asc');

            if (channel) {
                query = query.where('source_channel', channel);
            }

            if (limit) {
                query = query.limit(parseInt(limit));
            }

            const events = await query;
            res.json(events);

        } catch (error) {
            console.error('[EventsController] Error fetching events:', error);
            res.status(500).json({ error: 'Failed to fetch events' });
        }
    },

    /**
     * GET /calendar/export
     * Generate ICS file for all future events
     */
    exportCalendar: async (req, res) => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const events = await knex('events')
                .where('start_time', '>=', today)
                .orderBy('start_time', 'asc');

            // Generate ICS content manually to avoid extra dependencies
            let icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//SlackDump//Events//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH'
            ].join('\r\n');

            events.forEach(event => {
                // Format date: YYYYMMDD
                const dateObj = new Date(event.start_time);
                const dateStr = dateObj.toISOString().replace(/-/g, '').split('T')[0];
                const timeStr = dateObj.toISOString().split('T')[1].replace(/:/g, '').substring(0, 6);

                // Format time
                let dtStart = `:${dateStr}T${timeStr}`;

                // Default end time (1 hour later)
                const endDateObj = new Date(dateObj.getTime() + 60 * 60 * 1000);
                const endDateStr = endDateObj.toISOString().replace(/-/g, '').split('T')[0];
                const endTimeStr = endDateObj.toISOString().split('T')[1].replace(/:/g, '').substring(0, 6);
                let dtEnd = `:${endDateStr}T${endTimeStr}`;

                if (event.end_time) {
                    // If end_time existed (it doesn't in DB currently), we would use it.
                    // For now, default to 1 hour.
                }

                const description = event.description ? event.description.replace(/\n/g, '\\n') : '';
                const summary = event.title;
                const uid = `event-${event.id}@slackdump`;
                const created = event.created_at.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                icsContent += '\r\n' + [
                    'BEGIN:VEVENT',
                    `UID:${uid}`,
                    `DTSTAMP:${created}`,
                    `DTSTART${dtStart}`,
                    `DTEND${dtEnd}`,
                    `SUMMARY:${summary}`,
                    `DESCRIPTION:${description} (Channel: #${event.source_channel})`,
                    'END:VEVENT'
                ].join('\r\n');
            });

            icsContent += '\r\nEND:VCALENDAR';

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', 'attachment; filename="slack-events.ics"');
            res.send(icsContent);

        } catch (error) {
            console.error('[EventsController] Error exporting calendar:', error);
            res.status(500).json({ error: 'Failed to export calendar' });
        }
    },

    /**
     * POST /events
     * Create a new event manually
     */
    createEvent: async (req, res) => {
        const { title, start_time, source_channel, description, end_time } = req.body;
        try {
            await knex('events').insert({
                title,
                start_time: start_time,
                source_channel,
                description: description || '',
                status: 'pending'
            });
            res.redirect('/dashboard');
        } catch (err) {
            console.error('[EventsController] Error creating event:', err);
            res.status(500).send('Error creating event');
        }
    },

    /**
     * POST /events/update/:id
     * Update an existing event
     */
    updateEvent: async (req, res) => {
        const { id } = req.params;
        const { title, start_time, end_time, description, source_channel, status } = req.body;
        try {
            await knex('events').where({ id: id }).update({
                title,
                start_time: start_time,
                description: description || '',
                source_channel: source_channel || '',
                status: status || 'pending'
            });
            res.redirect('/dashboard');
        } catch (err) {
            console.error('[EventsController] Error updating event:', err);
            res.status(500).send('Error updating event');
        }
    },

    /**
     * POST /events/delete/:id
     * Delete an event
     */
    deleteEvent: async (req, res) => {
        const { id } = req.params;
        try {
            await knex('events').where({ id: id }).del();
            res.redirect('/dashboard');
        } catch (err) {
            console.error('[EventsController] Error deleting event:', err);
            res.status(500).send('Error deleting event');
        }
    },

    /**
     * GET /calendar
     * Render the calendar page
     */
    getCalendarPage: async (req, res) => {
        try {
            const slackService = require('../services/slackService');
            const channels = await slackService.getChannels();
            res.render('calendar', {
                user: req.session.user,
                channels
            });
        } catch (error) {
            console.error('[EventsController] Error rendering calendar:', error);
            res.status(500).send('Server Error');
        }
    }
};

module.exports = eventsController;
