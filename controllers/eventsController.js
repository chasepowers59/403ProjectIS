const knex = require('knex')(require('../database/knexfile').development);

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
                .where('date', '>=', startDate.toISOString().split('T')[0])
                .orderBy('date', 'asc')
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
                .where('date', '>=', today)
                .orderBy('date', 'asc');

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
                const dateStr = event.date.toISOString().replace(/-/g, '').split('T')[0];

                // Format time if available, otherwise all-day
                let dtStart = `;VALUE=DATE:${dateStr}`;
                let dtEnd = `;VALUE=DATE:${dateStr}`; // For single day events, end is same day (technically next day for all-day but this works for most clients)

                if (event.start_time) {
                    const [hh, mm] = event.start_time.split(':');
                    dtStart = `:${dateStr}T${hh}${mm}00`;

                    if (event.end_time) {
                        const [ehh, emm] = event.end_time.split(':');
                        dtEnd = `:${dateStr}T${ehh}${emm}00`;
                    } else {
                        // Default to 1 hour duration
                        let endH = parseInt(hh) + 1;
                        dtEnd = `:${dateStr}T${endH.toString().padStart(2, '0')}${mm}00`;
                    }
                } else {
                    // All day event - end date should be next day
                    const nextDay = new Date(event.date);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextDayStr = nextDay.toISOString().replace(/-/g, '').split('T')[0];
                    dtEnd = `;VALUE=DATE:${nextDayStr}`;
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
                start_time,
                end_time: end_time || null,
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
                start_time,
                end_time: end_time || null,
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
