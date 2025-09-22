# Global Happiness & Wellbeing Index

A web application to discover the world's most liveable cities based on air quality, weather comfort, and population density.

![Application Screenshot](https://github.com/user-attachments/assets/09eb598c-2672-4da1-9426-e4b35265ddf8)

## Features

- **City Search**: Search for cities worldwide and get wellbeing scores
- **Live Data**: Integration with GeoDB, OpenAQ, and OpenWeatherMap APIs  
- **Interactive Dashboard**: Beautiful UI with real-time data visualization
- **Leaderboard**: See top-rated cities globally
- **Google OAuth**: User authentication for saving personal records
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Backend**: Node.js with Express
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js with Google OAuth 2.0
- **Deployment**: Vercel serverless functions

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd global-happiness-index
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/global-happiness-index

# External APIs
OPENWEATHER_API_KEY=your_openweather_key
RAPIDAPI_KEY=your_rapidapi_key  
OPENAQ_API_KEY=your_openaq_key

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Security
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key
SESSION_SECRET=your_session_secret

# Server
PORT=3000
NODE_ENV=development
```

## Deployment

The application is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## API Endpoints

- `GET /api/leaderboard` - Get top cities worldwide
- `GET /api/cities/search` - Search for cities
- `GET /api/cities/:cityId` - Get city details
- `GET /api/aggregate/:cityId` - Get comprehensive city data
- `POST /api/save` - Save city record (authenticated)
- `GET /api/records` - Get user records (authenticated)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.