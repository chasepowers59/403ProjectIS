require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const knex = require('knex')(require('./knexfile').development);
const bcrypt = require('bcrypt');
const path = require('path');

const slackService = require('./services/slackService');

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

// Login
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

// Create Event
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
        await knex('events').where({ event_id: id }).update({
            title,
            start_time,
            status
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
        await knex('events').where({ event_id: id }).del();
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
