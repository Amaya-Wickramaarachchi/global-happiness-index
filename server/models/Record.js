const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    // User information
    userId: {
        type: String,
        required: true,
        index: true
    },
    userEmail: {
        type: String,
        required: true
    },
    
    // Location data
    city: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    
    // Population data (from GeoDB)
    population: {
        type: Number,
        required: true
    },
    populationDensity: {
        type: Number,
        default: null
    },
    
    // Air quality data (from OpenAQ)
    airQuality: {
        pm25: {
            type: Number,
            default: null
        },
        pm10: {
            type: Number,
            default: null
        },
        no2: {
            type: Number,
            default: null
        },
        so2: {
            type: Number,
            default: null
        },
        o3: {
            type: Number,
            default: null
        },
        co: {
            type: Number,
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        },
        source: {
            type: String,
            default: null
        }
    },
    
    // Weather data (from OpenWeatherMap)
    weather: {
        temperature: {
            type: Number,
            required: true
        },
        humidity: {
            type: Number,
            required: true
        },
        pressure: {
            type: Number,
            default: null
        },
        visibility: {
            type: Number,
            default: null
        },
        windSpeed: {
            type: Number,
            default: null
        },
        description: {
            type: String,
            default: null
        }
    },
    
    // Calculated scores - Make these NOT required initially
    wellbeingScore: {
        total: {
            type: Number,
            min: 0,
            max: 100,
            default: 0  // Add default value
        },
        airQualityScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0  // Add default value
        },
        temperatureScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0  // Add default value
        },
        populationScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0  // Add default value
        }
    },
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    // API response raw data (for debugging)
    rawData: {
        geodb: mongoose.Schema.Types.Mixed,
        openaq: mongoose.Schema.Types.Mixed,
        openweather: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
recordSchema.index({ userId: 1, createdAt: -1 });
recordSchema.index({ city: 1, country: 1 });
recordSchema.index({ 'wellbeingScore.total': -1 });

// Virtual for formatted location
recordSchema.virtual('location').get(function() {
    return `${this.city}, ${this.country}`;
});

// Method to calculate wellbeing scores
recordSchema.methods.calculateWellbeingScore = function() {
    console.log('🔢 Calculating wellbeing scores...');
    
    // Air Quality Score (40%)
    let airScore = 50; // Default if no data
    if (this.airQuality && this.airQuality.pm25 !== null && this.airQuality.pm25 !== undefined) {
        const pm25 = parseFloat(this.airQuality.pm25);
        if (pm25 <= 5) airScore = 100;
        else if (pm25 <= 15) airScore = 80;
        else if (pm25 <= 25) airScore = 60;
        else if (pm25 <= 35) airScore = 40;
        else airScore = 20;
        console.log(`Air quality PM2.5: ${pm25}, Score: ${airScore}`);
    } else {
        console.log('No air quality data, using default score: 50');
    }
    
    // Temperature Score (30%) - Ideal around 20-25°C
    let tempScore = 50; // Default if no data
    if (this.weather && this.weather.temperature !== null && this.weather.temperature !== undefined) {
        const idealTemp = 22.5;
        const temp = parseFloat(this.weather.temperature);
        const tempDiff = Math.abs(temp - idealTemp);
        tempScore = Math.max(0, 100 - (tempDiff * 3));
        console.log(`Temperature: ${temp}°C, Ideal: ${idealTemp}°C, Diff: ${tempDiff}, Score: ${tempScore}`);
    } else {
        console.log('No temperature data, using default score: 50');
    }
    
    // Population Score (30%) - Less crowded is better
    let popScore = 50; // Default
    if (this.populationDensity && this.populationDensity > 0) {
        const density = parseFloat(this.populationDensity);
        if (density > 10000) popScore = 20;
        else if (density > 5000) popScore = 40;
        else if (density > 2000) popScore = 60;
        else if (density > 500) popScore = 80;
        else popScore = 100;
        console.log(`Population density: ${density}/km², Score: ${popScore}`);
    } else if (this.population && this.population > 0) {
        const pop = parseFloat(this.population);
        if (pop > 10000000) popScore = 20;
        else if (pop > 5000000) popScore = 40;
        else if (pop > 1000000) popScore = 60;
        else if (pop > 100000) popScore = 80;
        else popScore = 100;
        console.log(`Population: ${pop}, Score: ${popScore}`);
    } else {
        console.log('No population data, using default score: 50');
    }
    
    // Calculate weighted total
    const totalScore = (airScore * 0.4) + (tempScore * 0.3) + (popScore * 0.3);
    
    // Update the record with calculated scores
    this.wellbeingScore = {
        total: Math.round(totalScore),
        airQualityScore: Math.round(airScore),
        temperatureScore: Math.round(tempScore),
        populationScore: Math.round(popScore)
    };
    
    console.log(`✅ Final wellbeing scores calculated:`, this.wellbeingScore);
    return this.wellbeingScore;
};

// Pre-save middleware to ensure wellbeing score is calculated
recordSchema.pre('save', function(next) {
    console.log('🔄 Pre-save middleware triggered');
    
    // Always calculate the wellbeing score before saving
    this.calculateWellbeingScore();
    
    console.log('✅ Wellbeing score set:', this.wellbeingScore);
    next();
});

module.exports = mongoose.model('Record', recordSchema);