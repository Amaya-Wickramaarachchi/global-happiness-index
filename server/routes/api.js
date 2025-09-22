const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const Record = require('../models/Record');
const router = express.Router();

// API Key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required in x-api-key header' });
    }
    
    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
    next();
};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Validation schema for save data
const saveDataSchema = Joi.object({
    city: Joi.string().required().trim().min(1).max(100),
    country: Joi.string().required().trim().min(1).max(100),
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    population: Joi.number().min(0).default(0),
    populationDensity: Joi.number().min(0).allow(null).default(null),
    airQuality: Joi.object({
        pm25: Joi.number().allow(null).default(null),
        pm10: Joi.number().allow(null).default(null),
        no2: Joi.number().allow(null).default(null),
        so2: Joi.number().allow(null).default(null),
        o3: Joi.number().allow(null).default(null),
        co: Joi.number().allow(null).default(null),
        lastUpdated: Joi.date().allow(null).default(null),
        source: Joi.string().allow(null).default('Unknown')
    }).default({}),
    weather: Joi.object({
        temperature: Joi.number().default(0),
        humidity: Joi.number().min(0).max(100).default(0),
        pressure: Joi.number().allow(null).default(null),
        visibility: Joi.number().allow(null).default(null),
        windSpeed: Joi.number().allow(null).default(null),
        description: Joi.string().allow(null).default('Unknown')
    }).default({}),
    rawData: Joi.object().optional()
});

// 1. Get city suggestions from GeoDB API
router.get('/cities/search', validateApiKey, async (req, res) => {
    try {
        const { query, limit = 5 } = req.query;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters long' });
        }
        
        const response = await axios.get('https://wft-geo-db.p.rapidapi.com/v1/geo/cities', {
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
            },
            params: {
                namePrefix: query.trim(),
                limit: Math.min(limit, 10),
                sort: '-population'
            }
        });
        
        const cities = response.data.data.map(city => ({
            id: city.id,
            name: city.name,
            country: city.country,
            region: city.region,
            latitude: city.latitude,
            longitude: city.longitude,
            population: city.population
        }));
        
        res.json({ cities, total: response.data.metadata.totalCount });
        
    } catch (error) {
        console.error('GeoDB API error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch city suggestions',
            details: error.response?.data?.message || error.message
        });
    }
});

// 2. Get detailed city data from GeoDB API
router.get('/cities/:cityId', validateApiKey, async (req, res) => {
    try {
        const { cityId } = req.params;
        
        const response = await axios.get(`https://wft-geo-db.p.rapidapi.com/v1/geo/cities/${cityId}`, {
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
            }
        });
        
        const city = response.data.data;
        const cityData = {
            id: city.id,
            name: city.name,
            country: city.country,
            region: city.region,
            latitude: city.latitude,
            longitude: city.longitude,
            population: city.population,
            populationDensity: city.populationDensity,
            timezone: city.timezone
        };
        
        res.json(cityData);
        
    } catch (error) {
        console.error('GeoDB city details error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch city details',
            details: error.response?.data?.message || error.message
        });
    }
});

// 3. Get air quality data from OpenAQ API
router.get('/air-quality', validateApiKey, async (req, res) => {
    try {
        const { latitude, longitude, radius = 25000 } = req.query; // radius in meters
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        // First, find locations near the coordinates
        const locationsResponse = await axios.get('https://api.openaq.org/v3/locations', {
            headers: {
                'X-API-Key': process.env.OPENAQ_API_KEY
            },
            params: {
                coordinates: `${longitude},${latitude}`,
                radius: radius,
                limit: 10,
                'order_by': 'distance'
            }
        });
        
        if (!locationsResponse.data.results || locationsResponse.data.results.length === 0) {
            return res.json({ 
                airQuality: null, 
                message: 'No air quality data available for this location',
                searchRadius: radius 
            });
        }
        
        // Get the closest location
        const location = locationsResponse.data.results[0];
        
        // Get recent measurements for this location
        const measurementsResponse = await axios.get('https://api.openaq.org/v3/latest', {
            headers: {
                'X-API-Key': process.env.OPENAQ_API_KEY
            },
            params: {
                locations_id: location.id,
                limit: 100
            }
        });
        
        const measurements = measurementsResponse.data.results || [];
        
        // Process measurements into a clean format
        const airQualityData = {
            pm25: null,
            pm10: null,
            no2: null,
            so2: null,
            o3: null,
            co: null,
            lastUpdated: null,
            source: location.name || 'OpenAQ'
        };
        
        measurements.forEach(measurement => {
            const param = measurement.parameter.toLowerCase();
            if (airQualityData.hasOwnProperty(param)) {
                airQualityData[param] = measurement.value;
                if (!airQualityData.lastUpdated || new Date(measurement.datetime) > new Date(airQualityData.lastUpdated)) {
                    airQualityData.lastUpdated = measurement.datetime;
                }
            }
        });
        
        res.json({ 
            airQuality: airQualityData,
            location: {
                name: location.name,
                distance: location.distance,
                coordinates: location.coordinates
            },
            measurementsCount: measurements.length
        });
        
    } catch (error) {
        console.error('OpenAQ API error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch air quality data',
            details: error.response?.data?.message || error.message
        });
    }
});

// 4. Get weather data from OpenWeatherMap API
router.get('/weather', validateApiKey, async (req, res) => {
    try {
        const { latitude, longitude } = req.query;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: {
                lat: latitude,
                lon: longitude,
                appid: process.env.OPENWEATHER_API_KEY,
                units: 'metric' // Get temperature in Celsius
            }
        });
        
        const weather = response.data;
        const weatherData = {
            temperature: weather.main.temp,
            humidity: weather.main.humidity,
            pressure: weather.main.pressure,
            visibility: weather.visibility ? weather.visibility / 1000 : null, // Convert to km
            windSpeed: weather.wind?.speed || null,
            description: weather.weather[0]?.description || null,
            icon: weather.weather[0]?.icon || null,
            location: weather.name
        };
        
        res.json(weatherData);
        
    } catch (error) {
        console.error('OpenWeatherMap API error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch weather data',
            details: error.response?.data?.message || error.message
        });
    }
});

// 5. Aggregate all data for a city (convenience endpoint)
router.get('/aggregate/:cityId', validateApiKey, async (req, res) => {
    try {
        const { cityId } = req.params;
        
        // Get city details from GeoDB
        const cityResponse = await axios.get(`https://wft-geo-db.p.rapidapi.com/v1/geo/cities/${cityId}`, {
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
            }
        });
        
        const city = cityResponse.data.data;
        const { latitude, longitude } = city;
        
        // Get air quality and weather data in parallel
        const [airQualityRes, weatherRes] = await Promise.allSettled([
            axios.get('http://localhost:3000/api/air-quality', {
                headers: { 'x-api-key': process.env.API_KEY },
                params: { latitude, longitude }
            }),
            axios.get('http://localhost:3000/api/weather', {
                headers: { 'x-api-key': process.env.API_KEY },
                params: { latitude, longitude }
            })
        ]);
        
        // Prepare aggregated data
        const aggregatedData = {
            city: city.name,
            country: city.country,
            latitude: city.latitude,
            longitude: city.longitude,
            population: city.population,
            populationDensity: city.populationDensity,
            airQuality: airQualityRes.status === 'fulfilled' 
                ? airQualityRes.value.data.airQuality 
                : { pm25: null, pm10: null, no2: null, so2: null, o3: null, co: null, lastUpdated: null, source: null },
            weather: weatherRes.status === 'fulfilled' 
                ? weatherRes.value.data 
                : { temperature: null, humidity: null, pressure: null, visibility: null, windSpeed: null, description: null },
            rawData: {
                geodb: city,
                openaq: airQualityRes.status === 'fulfilled' ? airQualityRes.value.data : null,
                openweather: weatherRes.status === 'fulfilled' ? weatherRes.value.data : null
            }
        };
        
        res.json(aggregatedData);
        
    } catch (error) {
        console.error('Aggregation error:', error.message);
        res.status(500).json({ 
            error: 'Failed to aggregate city data',
            details: error.message
        });
    }
});

// 6. Save wellbeing data to database (IMPROVED VERSION)
router.post('/save', [validateApiKey, requireAuth], async (req, res) => {
    try {
        console.log('📥 Received save request:', req.body);
        
        // Validate request data with detailed error reporting
        const { error, value } = saveDataSchema.validate(req.body, { 
            abortEarly: false, // Show all validation errors
            allowUnknown: true // Allow extra fields
        });
        
        if (error) {
            console.log('❌ Validation failed:', error.details);
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message,
                    value: d.context?.value
                }))
            });
        }
        
        // Ensure required fields have default values
        const recordData = {
            ...value,
            userId: req.user.googleId,
            userEmail: req.user.email,
            
            // Ensure airQuality object has structure
            airQuality: {
                pm25: value.airQuality?.pm25 || null,
                pm10: value.airQuality?.pm10 || null,
                no2: value.airQuality?.no2 || null,
                so2: value.airQuality?.so2 || null,
                o3: value.airQuality?.o3 || null,
                co: value.airQuality?.co || null,
                lastUpdated: value.airQuality?.lastUpdated || null,
                source: value.airQuality?.source || 'Unknown'
            },
            
            // Ensure weather object has required fields
            weather: {
                temperature: value.weather?.temperature || 0,
                humidity: value.weather?.humidity || 0,
                pressure: value.weather?.pressure || null,
                visibility: value.weather?.visibility || null,
                windSpeed: value.weather?.windSpeed || null,
                description: value.weather?.description || 'Unknown'
            },
            
            // Default population values
            population: value.population || 0,
            populationDensity: value.populationDensity || null
        };
        
        console.log('💾 Saving record data:', recordData);
        
        // Create new record
        const record = new Record(recordData);
        
        // The wellbeing score will be calculated automatically by the pre-save middleware
        
        // Save to database
        await record.save();
        
        console.log('✅ Record saved successfully:', record._id);
        
        res.status(201).json({ 
            message: 'Data saved successfully',
            recordId: record._id,
            wellbeingScore: record.wellbeingScore,
            city: record.city,
            country: record.country
        });
        
    } catch (error) {
        console.error('❌ Save data error:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                error: 'Database validation failed',
                details: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message
        });
    }
});
// 7. Get saved records
router.get('/records', [validateApiKey, requireAuth], async (req, res) => {
    try {
        const { 
            limit = 10, 
            page = 1, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            city,
            country 
        } = req.query;
        
        // Build query
        const query = { userId: req.user.googleId };
        if (city) query.city = new RegExp(city, 'i');
        if (country) query.country = new RegExp(country, 'i');
        
        // Execute query with pagination
        const records = await Record.find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(Math.min(limit, 50))
            .skip((page - 1) * limit)
            .select('-rawData -__v') // Exclude raw data and version key
            .lean();
        
        const total = await Record.countDocuments(query);
        
        res.json({ 
            records,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Get records error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch records',
            details: error.message
        });
    }
});

// 8. Get leaderboard (top cities by wellbeing score)
router.get('/leaderboard', validateApiKey, async (req, res) => {
    try {
        const { limit = 20, minRecords = 1 } = req.query;
        
        // Aggregate data to get average scores by city
        const leaderboard = await Record.aggregate([
            {
                $group: {
                    _id: { city: '$city', country: '$country' },
                    avgWellbeingScore: { $avg: '$wellbeingScore.total' },
                    avgAirScore: { $avg: '$wellbeingScore.airQualityScore' },
                    avgTempScore: { $avg: '$wellbeingScore.temperatureScore' },
                    avgPopScore: { $avg: '$wellbeingScore.populationScore' },
                    recordCount: { $sum: 1 },
                    lastUpdated: { $max: '$createdAt' },
                    population: { $first: '$population' }
                }
            },
            {
                $match: { recordCount: { $gte: parseInt(minRecords) } }
            },
            {
                $sort: { avgWellbeingScore: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    city: '$_id.city',
                    country: '$_id.country',
                    wellbeingScore: { $round: ['$avgWellbeingScore', 1] },
                    airQualityScore: { $round: ['$avgAirScore', 1] },
                    temperatureScore: { $round: ['$avgTempScore', 1] },
                    populationScore: { $round: ['$avgPopScore', 1] },
                    recordCount: 1,
                    lastUpdated: 1,
                    population: 1,
                    _id: 0
                }
            }
        ]);
        
        res.json({ 
            leaderboard,
            total: leaderboard.length,
            generatedAt: new Date()
        });
        
    } catch (error) {
        console.error('Leaderboard error:', error.message);
        res.status(500).json({ 
            error: 'Failed to generate leaderboard',
            details: error.message
        });
    }
});

// 9. Delete a record
router.delete('/records/:recordId', [validateApiKey, requireAuth], async (req, res) => {
    try {
        const { recordId } = req.params;
        
        const record = await Record.findOneAndDelete({
            _id: recordId,
            userId: req.user.googleId // Ensure user can only delete their own records
        });
        
        if (!record) {
            return res.status(404).json({ error: 'Record not found or unauthorized' });
        }
        
        res.json({ message: 'Record deleted successfully' });
        
    } catch (error) {
        console.error('Delete record error:', error.message);
        res.status(500).json({ 
            error: 'Failed to delete record',
            details: error.message
        });
    }
});

// 10. Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

//  debug route 
router.get('/debug/database-info', validateApiKey, async (req, res) => {
    try {
        const dbName = mongoose.connection.db.databaseName;
        const collections = await mongoose.connection.db.listCollections().toArray();
        const recordsCount = await Record.countDocuments();
        
        res.json({
            currentDatabase: dbName,
            availableCollections: collections.map(c => c.name),
            recordsCount: recordsCount,
            connectionString: process.env.MONGODB_URI ? 'Set' : 'Not Set'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;