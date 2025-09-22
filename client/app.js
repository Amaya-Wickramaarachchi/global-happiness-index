// Global variables
let currentUser = null;
let currentCityData = null;
let searchTimeout = null;
let scoreChart = null;

// API configuration
const API_CONFIG = {
    baseURL: '',  // Empty for same origin
    apiKey: 100200300400555 // IMPORTANT: Replace this with your actual API key from .env
};

// DOM elements
const elements = {
    // Auth elements
    loginSection: document.getElementById('login-section'),
    userSection: document.getElementById('user-section'),
    userName: document.getElementById('user-name'),
    
    // Search elements
    citySearch: document.getElementById('city-search'),
    searchBtn: document.getElementById('search-btn'),
    searchSuggestions: document.getElementById('search-suggestions'),
    
    // Loading and results
    loadingSection: document.getElementById('loading-section'),
    resultsSection: document.getElementById('results-section'),
    resultCityName: document.getElementById('result-city-name'),
    saveBtn: document.getElementById('save-btn'),
    
    // Score displays
    wellbeingScore: document.getElementById('wellbeing-score'),
    scoreGrade: document.getElementById('score-grade'),
    airScore: document.getElementById('air-score'),
    tempScore: document.getElementById('temp-score'),
    popScore: document.getElementById('pop-score'),
    
    // Detail displays
    pm25Value: document.getElementById('pm25-value'),
    pm10Value: document.getElementById('pm10-value'),
    airSource: document.getElementById('air-source'),
    temperatureValue: document.getElementById('temperature-value'),
    humidityValue: document.getElementById('humidity-value'),
    weatherDesc: document.getElementById('weather-desc'),
    populationValue: document.getElementById('population-value'),
    densityValue: document.getElementById('density-value'),
    
    // Records and leaderboard
    recordsSection: document.getElementById('records-section'),
    toggleRecordsBtn: document.getElementById('toggle-records-btn'),
    recordsList: document.getElementById('records-list'),
    refreshLeaderboard: document.getElementById('refresh-leaderboard'),
    leaderboardList: document.getElementById('leaderboard-list'),
    
    // Chart
    scoreChart: document.getElementById('score-chart'),
    
    // Modals
    errorModal: document.getElementById('error-modal'),
    successModal: document.getElementById('success-modal'),
    errorMessage: document.getElementById('error-message'),
    successMessage: document.getElementById('success-message')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Global Wellbeing Index App Started');
    
    // Check authentication status
    await checkAuthStatus();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    await loadLeaderboard();
    
    // Check for login success message
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'success') {
        showSuccessMessage('Successfully logged in with Google!');
        // Remove the parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Check user authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            elements.userSection.style.display = 'flex';
            elements.loginSection.style.display = 'none';
            elements.userName.textContent = `Hello, ${data.user.name}`;
            elements.recordsSection.style.display = 'block';
        } else {
            currentUser = null;
            elements.userSection.style.display = 'none';
            elements.loginSection.style.display = 'flex';
            elements.recordsSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        elements.loginSection.style.display = 'flex';
        elements.userSection.style.display = 'none';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    elements.citySearch.addEventListener('input', handleSearchInput);
    elements.citySearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.searchBtn.addEventListener('click', handleSearch);
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.citySearch.contains(e.target) && !elements.searchSuggestions.contains(e.target)) {
            elements.searchSuggestions.style.display = 'none';
        }
    });
    
    // Save button
    elements.saveBtn.addEventListener('click', saveCurrentData);
    
    // Records toggle
    elements.toggleRecordsBtn.addEventListener('click', toggleRecords);
    
    // Leaderboard refresh
    elements.refreshLeaderboard.addEventListener('click', loadLeaderboard);
    
    // Modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModals();
        }
    });
}

// Handle search input with debouncing
function handleSearchInput() {
    const query = elements.citySearch.value.trim();
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length < 2) {
        elements.searchSuggestions.style.display = 'none';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        await getSuggestions(query);
    }, 300);
}

// Get city suggestions from GeoDB API
async function getSuggestions(query) {
    try {
        const response = await fetch(`/api/cities/search?query=${encodeURIComponent(query)}&limit=5`, {
            headers: {
                'x-api-key': API_CONFIG.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        displaySuggestions(data.cities);
        
    } catch (error) {
        console.error('Failed to get suggestions:', error);
        elements.searchSuggestions.style.display = 'none';
    }
}

// Display search suggestions
function displaySuggestions(cities) {
    if (!cities || cities.length === 0) {
        elements.searchSuggestions.style.display = 'none';
        return;
    }
    
    const suggestionsHTML = cities.map(city => `
        <div class="suggestion-item" onclick="selectCity(${city.id}, '${city.name}', '${city.country}')">
            <div class="suggestion-name">${city.name}, ${city.country}</div>
            <div class="suggestion-details">
                Population: ${formatNumber(city.population)} | 
                ${city.region}
            </div>
        </div>
    `).join('');
    
    elements.searchSuggestions.innerHTML = suggestionsHTML;
    elements.searchSuggestions.style.display = 'block';
}

// Handle city selection
async function selectCity(cityId, cityName, country) {
    elements.searchSuggestions.style.display = 'none';
    elements.citySearch.value = `${cityName}, ${country}`;
    await loadCityData(cityId);
}

// Handle search button click
async function handleSearch() {
    const query = elements.citySearch.value.trim();
    if (!query) return;
    
    // If it's a simple text search, get suggestions first
    try {
        const response = await fetch(`/api/cities/search?query=${encodeURIComponent(query)}&limit=1`, {
            headers: {
                'x-api-key': API_CONFIG.apiKey
            }
        });
        
        const data = await response.json();
        if (data.cities && data.cities.length > 0) {
            await loadCityData(data.cities[0].id);
        } else {
            showErrorMessage('City not found. Please try a different search term.');
        }
    } catch (error) {
        showErrorMessage('Search failed. Please try again.');
    }
}

// Load complete city data
async function loadCityData(cityId) {
    try {
        // Show loading
        elements.loadingSection.style.display = 'block';
        elements.resultsSection.style.display = 'none';
        
        const response = await fetch(`/api/aggregate/${cityId}`, {
            headers: {
                'x-api-key': API_CONFIG.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        currentCityData = data;
        
        // Calculate wellbeing scores
        const scores = calculateWellbeingScores(data);
        currentCityData.scores = scores;
        
        // Display results
        displayResults(data, scores);
        
    } catch (error) {
        console.error('Failed to load city data:', error);
        showErrorMessage('Failed to load city data. Please try again.');
    } finally {
        elements.loadingSection.style.display = 'none';
    }
}

// Calculate wellbeing scores
function calculateWellbeingScores(data) {
    // Air Quality Score (40%)
    let airScore = 50; // Default
    if (data.airQuality && data.airQuality.pm25 !== null) {
        const pm25 = data.airQuality.pm25;
        if (pm25 <= 5) airScore = 100;
        else if (pm25 <= 15) airScore = 80;
        else if (pm25 <= 25) airScore = 60;
        else if (pm25 <= 35) airScore = 40;
        else airScore = 20;
    }
    
    // Temperature Score (30%) - Ideal around 22.5°C
    let tempScore = 50; // Default
    if (data.weather && data.weather.temperature !== null) {
        const idealTemp = 22.5;
        const tempDiff = Math.abs(data.weather.temperature - idealTemp);
        tempScore = Math.max(0, 100 - (tempDiff * 3));
    }
    
    // Population Score (30%)
    let popScore = 50; // Default
    if (data.populationDensity) {
        if (data.populationDensity > 10000) popScore = 20;
        else if (data.populationDensity > 5000) popScore = 40;
        else if (data.populationDensity > 2000) popScore = 60;
        else if (data.populationDensity > 500) popScore = 80;
        else popScore = 100;
    } else if (data.population) {
        if (data.population > 10000000) popScore = 20;
        else if (data.population > 5000000) popScore = 40;
        else if (data.population > 1000000) popScore = 60;
        else if (data.population > 100000) popScore = 80;
        else popScore = 100;
    }
    
    // Calculate weighted total
    const totalScore = (airScore * 0.4) + (tempScore * 0.3) + (popScore * 0.3);
    
    return {
        total: Math.round(totalScore),
        air: Math.round(airScore),
        temperature: Math.round(tempScore),
        population: Math.round(popScore)
    };
}

// Display results
function displayResults(data, scores) {
    // Update city name
    elements.resultCityName.textContent = `${data.city}, ${data.country}`;
    
    // Update scores
    elements.wellbeingScore.textContent = scores.total;
    elements.scoreGrade.textContent = getScoreGrade(scores.total);
    elements.airScore.textContent = scores.air;
    elements.tempScore.textContent = scores.temperature;
    elements.popScore.textContent = scores.population;
    
    // Update air quality details
    elements.pm25Value.textContent = data.airQuality?.pm25 ? `${data.airQuality.pm25} μg/m³` : 'N/A';
    elements.pm10Value.textContent = data.airQuality?.pm10 ? `${data.airQuality.pm10} μg/m³` : 'N/A';
    elements.airSource.textContent = data.airQuality?.source || 'N/A';
    
    // Update weather details
    elements.temperatureValue.textContent = data.weather?.temperature ? `${data.weather.temperature}°C` : 'N/A';
    elements.humidityValue.textContent = data.weather?.humidity ? `${data.weather.humidity}%` : 'N/A';
    elements.weatherDesc.textContent = data.weather?.description || 'N/A';
    
    // Update population details
    elements.populationValue.textContent = formatNumber(data.population);
    elements.densityValue.textContent = data.populationDensity ? 
        `${formatNumber(data.populationDensity)} /km²` : 'N/A';
    
    // Show save button if user is authenticated
    elements.saveBtn.style.display = currentUser ? 'block' : 'none';
    
    // Create/update chart
    updateScoreChart(scores);
    
    // Show results
    elements.resultsSection.style.display = 'block';
}

// Update score chart
function updateScoreChart(scores) {
    const ctx = elements.scoreChart.getContext('2d');
    
    if (scoreChart) {
        scoreChart.destroy();
    }
    
    scoreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Air Quality (40%)', 'Temperature (30%)', 'Population (30%)'],
            datasets: [{
                data: [scores.air, scores.temperature, scores.population],
                backgroundColor: [
                    '#10b981', // Green for air quality
                    '#f59e0b', // Orange for temperature
                    '#6366f1'  // Purple for population
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}`;
                        }
                    }
                }
            }
        }
    });
}

// Save current data to database
async function saveCurrentData() {
    if (!currentUser) {
        showErrorMessage('Please login to save data.');
        return;
    }
    
    if (!currentCityData) {
        showErrorMessage('No data to save.');
        return;
    }
    
    try {
        const saveData = {
            city: currentCityData.city,
            country: currentCityData.country,
            latitude: currentCityData.latitude,
            longitude: currentCityData.longitude,
            population: currentCityData.population,
            populationDensity: currentCityData.populationDensity,
            airQuality: currentCityData.airQuality || {},
            weather: currentCityData.weather || {},
            rawData: currentCityData.rawData
        };
        
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_CONFIG.apiKey
            },
            body: JSON.stringify(saveData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Save failed');
        }
        
        const result = await response.json();
        showSuccessMessage(`Data saved successfully! Wellbeing Score: ${result.wellbeingScore.total}`);
        
        // Refresh records if they're visible
        if (elements.recordsList.style.display !== 'none') {
            await loadUserRecords();
        }
        
    } catch (error) {
        console.error('Save failed:', error);
        showErrorMessage(`Failed to save data: ${error.message}`);
    }
}

// Toggle user records display
async function toggleRecords() {
    if (elements.recordsList.style.display === 'none') {
        await loadUserRecords();
        elements.recordsList.style.display = 'block';
        elements.toggleRecordsBtn.textContent = 'Hide Records';
    } else {
        elements.recordsList.style.display = 'none';
        elements.toggleRecordsBtn.textContent = 'View My Records';
    }
}

// Load user records
async function loadUserRecords() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/records?limit=20', {
            headers: {
                'x-api-key': API_CONFIG.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        displayUserRecords(data.records);
        
    } catch (error) {
        console.error('Failed to load records:', error);
        elements.recordsList.innerHTML = '<p>Failed to load records.</p>';
    }
}

// Display user records
function displayUserRecords(records) {
    if (!records || records.length === 0) {
        elements.recordsList.innerHTML = '<p>No saved records yet. Search for a city and save some data!</p>';
        return;
    }
    
    const recordsHTML = records.map(record => `
        <div class="record-item">
            <div class="record-info">
                <div class="city-name">${record.city}, ${record.country}</div>
                <div class="city-details">
                    Saved: ${new Date(record.createdAt).toLocaleDateString()} | 
                    Population: ${formatNumber(record.population)}
                </div>
            </div>
            <div class="score-badge">${record.wellbeingScore.total}</div>
        </div>
    `).join('');
    
    elements.recordsList.innerHTML = recordsHTML;
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard?limit=10', {
            headers: {
                'x-api-key': API_CONFIG.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        displayLeaderboard(data.leaderboard);
        
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        elements.leaderboardList.innerHTML = '<p>Failed to load leaderboard.</p>';
    }
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) {
        elements.leaderboardList.innerHTML = '<p>No data available yet. Be the first to contribute!</p>';
        return;
    }
    
    const leaderboardHTML = leaderboard.map((city, index) => {
        const rank = index + 1;
        let rankClass = '';
        if (rank === 1) rankClass = 'first';
        else if (rank === 2) rankClass = 'second';
        else if (rank === 3) rankClass = 'third';
        
        return `
            <div class="leaderboard-item">
                <div style="display: flex; align-items: center;">
                    <div class="rank-badge ${rankClass}">${rank}</div>
                    <div class="city-info">
                        <div class="city-name">${city.city}, ${city.country}</div>
                        <div class="city-details">
                            Population: ${formatNumber(city.population)} | 
                            Records: ${city.recordCount}
                        </div>
                    </div>
                </div>
                <div class="score-badge">${city.wellbeingScore}</div>
            </div>
        `;
    }).join('');
    
    elements.leaderboardList.innerHTML = leaderboardHTML;
}

// Utility functions
function getScoreGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

function showErrorMessage(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.style.display = 'block';
}

function showSuccessMessage(message) {
    elements.successMessage.textContent = message;
    elements.successModal.style.display = 'block';
}

function closeModals() {
    elements.errorModal.style.display = 'none';
    elements.successModal.style.display = 'none';
}

// Make functions globally available for onclick handlers
window.selectCity = selectCity;

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (scoreChart) {
        scoreChart.resize();
    }
});

// Console log for debugging
console.log('✅ App.js loaded successfully');
console.log('📋 Available functions:', {
    checkAuthStatus,
    getSuggestions,
    loadCityData,
    saveCurrentData,
    loadLeaderboard
});