import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server/index.js';

describe('API Integration Tests', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeDefined();
  });

  it('should return venues list', async () => {
    const response = await request(app)
      .get('/api/venues')
      .expect(200);

    expect(response.body.venues).toBeDefined();
    expect(Array.isArray(response.body.venues)).toBe(true);
    expect(response.body.total).toBeDefined();
    expect(response.body.displayed).toBeDefined();
  });

  it('should filter venues by city', async () => {
    const response = await request(app)
      .get('/api/venues?city=New York')
      .expect(200);

    expect(response.body.venues).toBeDefined();
    response.body.venues.forEach((venue: any) => {
      expect(venue.city).toBe('New York');
    });
  });

  it('should return specific venue by id', async () => {
    const response = await request(app)
      .get('/api/venues/1')
      .expect(200);

    expect(response.body.id).toBe('1');
    expect(response.body.name).toBeDefined();
    expect(response.body.city).toBeDefined();
    expect(response.body.capacity).toBeDefined();
    expect(response.body.pricePerHour).toBeDefined();
  });

  it('should return 404 for non-existent venue', async () => {
    const response = await request(app)
      .get('/api/venues/999')
      .expect(404);

    expect(response.body.error).toBe('Venue not found');
  });

  it('should generate quote for venue', async () => {
    const response = await request(app)
      .get('/api/ai/quote?venueId=1&hours=4&guests=50&eventDate=2025-03-03')
      .expect(200);

    expect(response.body.venueId).toBe('1');
    expect(response.body.subtotal).toBeDefined();
    expect(response.body.total).toBeDefined();
    expect(Array.isArray(response.body.fees)).toBe(true);
    expect(Array.isArray(response.body.notes)).toBe(true);
  });

  it('should return ads based on context', async () => {
    const response = await request(app)
      .get('/api/ads?context=search&tags=wedding')
      .expect(200);

    expect(response.body.ads).toBeDefined();
    expect(Array.isArray(response.body.ads)).toBe(true);
    expect(response.body.context).toBe('search');
  });

  it('should handle agent relay (mock response)', async () => {
    const response = await request(app)
      .post('/api/agent/relay')
      .send({
        sessionId: 'test_session',
        message: 'Hello, I need help finding a venue'
      })
      .expect(200);

    expect(response.body.reply).toBeDefined();
    expect(response.body.toolResults).toBeDefined();
  });

  it('should create inquiry', async () => {
    const inquiryData = {
      venueId: '1',
      name: 'John Doe',
      email: 'john@example.com',
      eventDate: '2025-03-15',
      hours: 4,
      guests: 50,
      notes: 'Birthday party'
    };

    const response = await request(app)
      .post('/api/inquiries')
      .send(inquiryData)
      .expect(201);

    expect(response.body.message).toBe('Inquiry submitted successfully');
    expect(response.body.inquiry.id).toBeDefined();
    expect(response.body.inquiry.status).toBe('pending');
  });

  it('should validate inquiry data', async () => {
    const invalidData = {
      venueId: '1',
      name: '',
      email: 'invalid-email',
      eventDate: '2024-01-01', // Past date
      hours: 0,
      guests: 0
    };

    const response = await request(app)
      .post('/api/inquiries')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toBeDefined();
  });
});