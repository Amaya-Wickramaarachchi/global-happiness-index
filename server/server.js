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
