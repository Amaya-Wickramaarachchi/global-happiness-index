// ==================== DEPENDENCIES ====================
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ==================== IMPORT ROUTES AND CONFIG ====================
const apiRoutes = require('./routes/api');
const passportConfig = require('./auth/passport-config');

// ==================== EXPRESS SETUP ====================
const app = express();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));

// CORS - Allow all origins for development
app.use(cors({
    origin: true, // Allow all origins for now
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport);

// ==================== DATABASE CONNECTION ====================
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/global-happiness-index';
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.warn('⚠️  Continuing without database - some features may not work');
        // Don't exit in development, just log the error
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

connectDB();

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// OAuth routes - only if Google OAuth is configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
} else {
    // Fallback routes when OAuth is not configured
    app.get('/auth/google', (req, res) => {
        res.json({ error: 'OAuth not configured', message: 'Google OAuth credentials not found' });
    });

    app.get('/auth/google/callback', (req, res) => {
        res.redirect('/?error=oauth-not-configured');
    });

    app.get('/auth/logout', (req, res) => {
        res.redirect('/');
    });
}

app.get('/auth/user', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
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

// ==================== STATIC FILES & SPA FALLBACK ====================

// Serve static files first
app.use(express.static(path.join(__dirname, '../client'), {
    setHeaders: (res, path) => {
        // Set proper MIME types for static assets
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve index.html for any route NOT starting with /api or /auth
const indexPath = path.join(__dirname, '../client/index.html');
app.get(/^\/(?!api|auth).*$/, (req, res) => {
    res.sendFile(indexPath);
});

// ==================== ERROR HANDLERS ====================

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

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, '../client')}`);
});
