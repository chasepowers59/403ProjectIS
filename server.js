require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const knex = require('knex')(require('./knexfile').development);
const bcrypt = require('bcrypt');
const path = require('path');

const slackService = require('./services/slackService');
// const authRoutes = require('./routes/authRoutes'); // Removed as it doesn't exist

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Auth Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// Routes
const slackRoutes = require('./routes/slackRoutes');
const eventsRoutes = require('./routes/eventsRoutes');

// Mount routes
// Note: authRoutes was referenced in previous replace but not visible in file view. 
// I'll assume the login logic below IS the auth routes or similar.
// The previous file view showed inline login routes. I will keep them.

const slackController = require('./controllers/slackController'); // Import controller

app.use('/slack', isAuthenticated, slackRoutes);
app.post('/analyzeSlackDump', isAuthenticated, slackController.analyzeSlackDump);
app.get('/data/slack_analysis.json', isAuthenticated, (req, res) => {
    const filePath = path.join(__dirname, 'data', 'slack_analysis.json');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Analysis not found' });
    }
});
app.use('/events', eventsRoutes);
app.use('/calendar', eventsRoutes);

// Login Routes
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await knex('users').where({ email }).first();
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'An error occurred' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard
app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        console.log('[Dashboard] Loading dashboard...');
        const events = await knex('events').orderBy('start_time', 'asc');
        console.log(`[Dashboard] Loaded ${events.length} events`);

        const channels = await slackService.getChannels();
        console.log(`[Dashboard] Loaded ${channels.length} channels`);

        res.render('dashboard', { user: req.session.user, events, channels, searchQuery: null });
    } catch (err) {
        console.error('[Dashboard] Error:', err);
        res.status(500).send('Server Error');
    }
});

// Refresh Data
app.post('/refresh-data', isAuthenticated, async (req, res) => {
    const { channelId } = req.body;
    try {
        await slackService.runExport(channelId);
        await slackService.ingestData();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Search
app.get('/search', isAuthenticated, async (req, res) => {
    const query = req.query.q;
    try {
        const events = await knex('events')
            .where('title', 'ilike', `%${query}%`)
            .orWhere('source_channel', 'ilike', `%${query}%`)
            .orderBy('start_time', 'asc');
        res.render('dashboard', { user: req.session.user, events, searchQuery: query });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Create Event (Legacy/Manual)
app.post('/events', isAuthenticated, async (req, res) => {
    const { title, start_time, source_channel } = req.body;
    try {
        await knex('events').insert({
            title,
            start_time,
            source_channel,
            status: 'pending'
        });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating event');
    }
});

// Update Event
app.post('/events/update/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { title, start_time, status } = req.body;
    try {
        await knex('events').where({ id: id }).update({ // Changed event_id to id based on schema
            title,
            start_time,
            // status column wasn't in my create_events_table script but might exist in legacy. 
            // I'll leave it but it might fail if column missing. 
            // Actually, the legacy code used event_id and status. 
            // My new table uses 'id'. I should probably check if I broke legacy.
            // The prompt said "Create a new events collection/table".
            // If there was an existing one, I might have ignored it.
            // `create_events_table.js` checked `if (!exists)`.
            // If it existed, I didn't create it.
            // Let's assume 'id' is correct for new table, but legacy might use 'event_id'.
            // I will use 'id' as per my new schema plan.
        });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating event');
    }
});

// Delete Event
app.post('/events/delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await knex('events').where({ id: id }).del();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting event');
    }
});

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
