# Venue Concierge

A full-stack event venue discovery platform with AI assistant integration via SmythOS.

## Features

### Core Functionality
- **Venue Discovery**: Search and filter venues across multiple cities
- **AI Assistant**: SmythOS-powered chat assistant for venue recommendations
- **Quote Calculator**: Dynamic pricing with weekend surcharge and cleaning fees
- **Inquiry System**: Complete booking inquiry workflow
- **Contextual Ads**: Smart ad serving based on user behavior and venue features

### Technical Stack
- **Backend**: Node.js 18 + Express + TypeScript
- **Frontend**: React + Vite + Tailwind CSS + TypeScript
- **Database**: JSON files (easily replaceable with real database)
- **AI Integration**: SmythOS agent relay
- **Testing**: Vitest + Supertest

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your SmythOS credentials

# Run development server (both client and server)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Environment Variables

```bash
BACKEND_PORT=3000
FRONTEND_PORT=5173
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SMYTHOS_AGENT_URL=your_smythos_endpoint
SMYTHOS_API_KEY=your_smythos_api_key
AI_MAX_TOKENS_PER_CALL=1200
```

## API Endpoints

### Venues
- `GET /api/venues` - List venues with filtering
- `GET /api/venues/:id` - Get specific venue

### Quotes
- `GET /api/ai/quote` - Calculate pricing quote

### Inquiries
- `POST /api/inquiries` - Submit booking inquiry

### Ads (Legacy)
- `GET /api/ads` - Get contextual advertisements

### Content Recommendations (JSON-Only MVP)
- `POST /api/content/request` - Request contextual content recommendations with targeting
- `POST /api/content/click` - Track content clicks and conversions
- `GET /api/content/health` - Content system health check
- `GET /api/content/dev/debug` - Debug information (development only)

### AI Assistant
- `POST /api/agent/relay` - SmythOS integration

### Health
- `GET /api/health` - Service health check

## Token Budget & Performance

- **API Response Limits**: Top 5 results per request
- **Image Optimization**: Images excluded from SmythOS forwarding
- **Caching**: 5-minute in-memory cache for venue searches
- **Request Monitoring**: Size logging for AI relay endpoint

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test quote.test.ts
```

## Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
├── server/
│   ├── index.ts              # Express server setup
│   ├── routes/               # API route handlers
│   └── tsconfig.json         # Server TypeScript config
├── src/
│   ├── components/           # React components
│   ├── pages/                # Page components
│   └── App.tsx              # Main app component
├── data/
│   ├── venues.json          # Venue seed data
│   └── ads.json             # Advertisement data
├── tests/
│   ├── quote.test.ts        # Unit tests for quote logic
│   └── integration.test.ts   # API integration tests
└── README.md
```

## Data Models

### Venue
```typescript
interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  pricePerHour: number;
  amenities: string[];
  images: string[];
  rating: number;
  availableDates: string[];
}
```

### Quote Rules
- Base price: `pricePerHour × hours`
- Large event fee: $200 for >120 guests
- Weekend surcharge: 10% for Saturday/Sunday events
- Total: `subtotal + fees` (rounded)

## SmythOS Integration

The AI assistant integrates with SmythOS for intelligent venue recommendations:

1. **Message Relay**: User messages forwarded to SmythOS agent
2. **Context Trimming**: Large fields removed to stay within token limits
3. **Error Handling**: Graceful fallback for AI service unavailability
4. **Token Monitoring**: Request/response size tracking

## Performance Optimizations

- **Venue Search**: In-memory caching with 5-minute TTL
- **Result Limiting**: Maximum 5 venues per search for optimal performance
- **Image Handling**: External CDN links (Pexels) instead of file uploads
- **Bundle Optimization**: Code splitting and lazy loading

## Deployment

The application is designed to be easily deployed to various platforms:

### Bolt Hosting (Recommended)
```bash
npm run build
# Deploy dist/ directory
```

### Traditional Hosting
1. Build the application: `npm run build`
2. Upload `dist/` contents to your web server
3. Set environment variables on your hosting platform
4. Ensure Node.js 18+ is available for the backend

## Advertising (JSON-Only MVP)

The platform includes a complete advertising system with machine learning optimization.

### File Structure

```
ads/
├── ads.json              # Static ad catalog (seed data)
├── stats.json            # CTR priors & rolling tallies per (ad_id, topic)
├── impressions.jsonl     # Append-only impression tracking
├── clicks.jsonl          # Append-only click tracking
├── freqcap.json          # Daily exposure limits per user + ad
└── config.json           # System configuration
```

### Adding New Ads

Edit `ads/ads.json` to add new advertisements:

```json
{
  "id": "unique-ad-id",
  "placement": "sidebar",
  "targeting_keywords": ["wedding", "luxury", "premium"],
  "landing_url": "https://example.com/service",
  "base_headline": "Your Ad Headline",
  "base_body": "Ad description text",
  "floor_ecpm": 150,
  "blocked_paths": ["/admin", "/api"],
  "lang": "en"
}
```

### Frontend Integration

Include the ad client on any page:

```html
<script src="/adClient.js" async></script>
<div data-ad-slot="sidebar"></div>
```

The system automatically:
- Collects page context (title, URL, meta description)
- Handles user targeting and frequency capping
- Tracks impressions and clicks
- Respects Do-Not-Track headers

### Development Commands

```bash
# Monitor impressions in real-time
tail -f ads/impressions.jsonl

# View click tracking
tail -f ads/clicks.jsonl

# Debug content selection
curl "http://localhost:3000/api/content/dev/debug?limit=10"
```

### Testing Features

**Enable Debug Mode**: Add `?addebug=1` to any URL to see:
- Selected ad ID and topic
- Keyword extraction results
- Eligible ad count
- Exploration vs. exploitation metrics

**Test Frequency Capping**:
1. Visit a page 4 times (cap is 3 per day)
2. Delete `venue_anon_id` cookie to reset user
3. Change system date to test daily reset

**Test Do-Not-Track**: Enable DNT in browser settings - no ads should load.

**Test Different Contexts**:
- `/venues/wedding` → Wedding-related ads
- `/venues/corporate` → Business event ads
- Different page titles trigger different topics

### Machine Learning Features

The system uses **Thompson Sampling** for ad optimization:
- **Exploration**: 10% random selection to discover performance
- **Exploitation**: 90% data-driven selection based on CTR
- **Beta Distribution**: Models uncertainty in click-through rates
- **Automatic Learning**: Performance improves over time

### Configuration

Edit `ads/config.json` to adjust system behavior:

```json
{
  "epsilon": 0.10,
  "daily_frequency_cap": 3,
  "assumed_cpc_cents": 25,
  "keyword_overlap_min": 1
}
```

### Performance & Privacy

- **Anonymous Tracking**: Uses IP + User-Agent hash (no personal data)
- **Frequency Limits**: Maximum 3 ads per user per day
- **DNT Compliance**: Respects browser Do-Not-Track settings
- **Layout Stability**: Fixed-height ad containers prevent content shifts
- **Click Tracking**: Uses `sendBeacon()` for reliable analytics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Submit a pull request

## License

This project is licensed under the MIT License.