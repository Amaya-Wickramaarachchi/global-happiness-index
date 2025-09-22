require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');

// Import routes and configuration
const apiRoutes = require('./routes/api');
require('./auth/passport-config');

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- Middleware --------------------

// Security and logging
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// -------------------- Database Connection --------------------

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wellbeing-index', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// -------------------- Routes --------------------

// API routes
app.use('/api', apiRoutes);

// OAuth routes
app.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/?login=success')
);

app.get('/auth/logout', (req, res) => {
    req.logout(err => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.redirect('/');
    });
});

app.get('/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.googleId,
                name: req.user.displayName,
                email: req.user.email
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// -------------------- Frontend SPA fallback --------------------

// Serve static files first
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for any route NOT starting with /api or /auth
const indexPath = path.join(__dirname, '../client/index.html');
app.get(/^\/(?!api|auth).*$/, (req, res) => {
    res.sendFile(indexPath);
});

// -------------------- Error handlers --------------------

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler for any unmatched requests
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// -------------------- Server Start --------------------

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '../client')}`);
});
