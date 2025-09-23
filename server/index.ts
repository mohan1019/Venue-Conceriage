import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Import database initialization
import { initializeDatabase, importVenuesData, cleanupCache } from './db/init.js';

// Import routes
import healthRoute from './routes/health.js';
import venuesRoute from './routes/venues.js';
import inquiriesRoute from './routes/inquiries.js';
import quoteRoute from './routes/quote.js';
import adsRoute from './routes/ads.js';
import adRoute from './routes/ad.js';
import agentRoute from './routes/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        console.log('CORS Origin:', origin);
        // Allow specific domains and bolt.host subdomains
        const allowedOrigins = [
          'https://aghori1019-venue-bac-kv2k.bolt.host',
          'https://venue-concierge-full-zlxe.bolt.host',
          'localhost:5173'
        ];
        console.log("ORIGIN CHECK",origin)
        if (!origin ||
            allowedOrigins.includes(origin) ||
            (origin && origin.endsWith('.bolt.host')) ||
            (origin && origin.includes('bolt.host')) ||
            (origin && origin.includes('onrender.com'))) {
          console.log('CORS: Allowing origin', origin);
          callback(null, true);
        } else {
          console.log('CORS: Blocking origin', origin);
          callback(new Error('Not allowed by CORS'));
        }
      }
    : ['http://localhost:5173', 'http://localhost:3000'], // Allow specific development origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve public static files (like adClient.js)
app.use(express.static(join(__dirname, '../public')));

// API routes
app.use('/api/health', healthRoute);
app.use('/api/venues', venuesRoute);
app.use('/api/inquiries', inquiriesRoute);
app.use('/api/ai/quote', quoteRoute);
app.use('/api/ads', adsRoute);
app.use('/ad', adRoute);
app.use('/api/agent', agentRoute);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '../../dist/client');
  app.use(express.static(clientPath));
  
  app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(join(clientPath, 'index.html'));
  });
}

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔄 Starting server initialization...');

    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error('Failed to initialize database');
    }

    // Import venues data
    const dataImported = await importVenuesData();
    if (!dataImported) {
      console.warn('⚠️  Failed to import venues data, but continuing...');
    }

    // Start cleanup interval for cache
    setInterval(cleanupCache, 5 * 60 * 1000); // Every 5 minutes

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: Connected and initialized`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;