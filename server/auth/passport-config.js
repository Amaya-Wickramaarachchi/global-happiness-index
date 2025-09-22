const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');

// Simple user model for OAuth
const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    avatar: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

module.exports = (passport) => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user already exists
            let existingUser = await User.findOne({ googleId: profile.id });
            
            if (existingUser) {
                // User exists, update their info
                existingUser.displayName = profile.displayName;
                existingUser.email = profile.emails[0].value;
                existingUser.avatar = profile.photos[0].value;
                await existingUser.save();
                return done(null, existingUser);
            }
            
            // Create new user
            const newUser = new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value
            });
            
            await newUser.save();
            return done(null, newUser);
            
        } catch (error) {
            console.error('OAuth error:', error);
            return done(error, null);
        }
    }));
    
    passport.serializeUser((user, done) => {
        done(null, user._id);
    });
    
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};