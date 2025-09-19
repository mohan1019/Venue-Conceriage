import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Import routes
import healthRoute from './routes/health.js';
import venuesRoute from './routes/venues.js';
import inquiriesRoute from './routes/inquiries.js';
import quoteRoute from './routes/quote.js';
import adsRoute from './routes/ads.js';
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
    ? (origin, callback) => {
        // Allow all origins ending with bolt.host or onrender.com
        if (!origin ||
            origin.endsWith('.bolt.host') ||
            origin.endsWith('.onrender.com') ||
            origin === 'https://venue-concierge-full-zlxe.bolt.host') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/health', healthRoute);
app.use('/api/venues', venuesRoute);
app.use('/api/inquiries', inquiriesRoute);
app.use('/api/ai/quote', quoteRoute);
app.use('/api/ads', adsRoute);
app.use('/api/agent', agentRoute);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '../../dist/client');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
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
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;