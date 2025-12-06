require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const environment = process.env.NODE_ENV || 'development';
const knex = require('knex')(require('./database/knexfile.js')[environment]);
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

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
// Auth Middleware
const isAuthenticated = require('./middleware/auth');

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
// app.get('/data/slack_analysis.json', ...) removed; served statically from public/data
app.use('/events', eventsRoutes);
app.use('/calendar', eventsRoutes);

// Registration Routes
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existingUser = await knex('users').where({ email }).first();
        if (existingUser) {
            return res.render('register', { error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await knex('users').insert({
            name,
            email,
            password: hashedPassword
        });

        // Auto-login - query by email since it's unique
        const newUser = await knex('users').where({ email }).first();
        req.session.user = newUser;
        res.redirect('/dashboard');

    } catch (err) {
        console.error(err);
        res.render('register', { error: 'An error occurred during registration' });
    }
});

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
        const eventsRaw = await knex('events')
            .distinct('id', 'title', 'start_time', 'source_channel', 'status');

        // Normalize channel names (trim whitespace) to ensure correct sorting/grouping
        eventsRaw.forEach(event => {
            if (event.source_channel) {
                event.source_channel = event.source_channel.trim();
            }
        });

        // Sort in JavaScript to guarantee grouping
        const events = eventsRaw.sort((a, b) => {
            const channelA = (a.source_channel || '').toLowerCase();
            const channelB = (b.source_channel || '').toLowerCase();

            if (channelA < channelB) return -1;
            if (channelA > channelB) return 1;

            // Secondary sort by date
            return new Date(a.start_time) - new Date(b.start_time);
        });

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
        // 1. Run Export (Generates ZIP)
        await slackService.runExport(channelId);

        // 2. Process the Export (Extract, AI Analyze, Save)
        const result = await slackService.processLatestExport();

        res.json({ success: true, ...result });
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
            .select('id', 'title', 'start_time', 'source_channel', 'status')
            .where('title', 'ilike', `%${query}%`)
            .orWhere('source_channel', 'ilike', `%${query}%`)
            .orderBy('start_time', 'asc');
        res.render('dashboard', { user: req.session.user, events, searchQuery: query });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});



app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') {
        console.log(`Server running on port ${PORT} (production)`);
    } else {
        console.log(`Server running on http://localhost:${PORT} (${env})`);
    }
});
