import { describe, it, expect } from 'vitest';

// Quote calculation logic (extracted for testing)
function calculateQuote(pricePerHour: number, hours: number, guests: number, eventDate: string) {
  let base = pricePerHour * hours;
  const fees: { name: string; amount: number }[] = [];
  const notes: string[] = [];

  // Cleaning fee for large events
  if (guests > 120) {
    fees.push({ name: 'Large Event Cleaning Fee', amount: 200 });
    notes.push('Additional cleaning fee applies for events over 120 guests');
  }

  // Weekend surcharge
  const eventDateObj = new Date(eventDate);
  const dayOfWeek = eventDateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
    const weekendSurcharge = base * 0.1;
    fees.push({ name: 'Weekend Surcharge (10%)', amount: weekendSurcharge });
    base = base * 1.1;
    notes.push('Weekend events include a 10% surcharge');
  }

  const subtotal = base;
  const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const total = Math.round(subtotal + totalFees);

  return {
    subtotal: Math.round(subtotal),
    fees,
    total,
    notes
  };
}

describe('Quote Calculation', () => {
  it('should calculate basic quote without fees', () => {
    const result = calculateQuote(100, 4, 50, '2025-03-03'); // Monday
    
    expect(result.subtotal).toBe(400);
    expect(result.fees).toHaveLength(0);
    expect(result.total).toBe(400);
    expect(result.notes).toHaveLength(0);
  });

  it('should add cleaning fee for large events', () => {
    const result = calculateQuote(100, 4, 150, '2025-03-03'); // Monday, 150 guests
    
    expect(result.subtotal).toBe(400);
    expect(result.fees).toHaveLength(1);
    expect(result.fees[0].name).toBe('Large Event Cleaning Fee');
    expect(result.fees[0].amount).toBe(200);
    expect(result.total).toBe(600);
    expect(result.notes).toContain('Additional cleaning fee applies for events over 120 guests');
  });

  it('should add weekend surcharge for Saturday', () => {
    const result = calculateQuote(100, 4, 50, '2025-03-01'); // Saturday
    
    expect(result.subtotal).toBe(440); // 400 * 1.1
    expect(result.fees).toHaveLength(1);
    expect(result.fees[0].name).toBe('Weekend Surcharge (10%)');
    expect(result.fees[0].amount).toBe(40);
    expect(result.total).toBe(440);
    expect(result.notes).toContain('Weekend events include a 10% surcharge');
  });

  it('should add weekend surcharge for Sunday', () => {
    const result = calculateQuote(100, 4, 50, '2025-03-02'); // Sunday
    
    expect(result.subtotal).toBe(440); // 400 * 1.1
    expect(result.fees).toHaveLength(1);
    expect(result.fees[0].name).toBe('Weekend Surcharge (10%)');
    expect(result.total).toBe(440);
  });

  it('should combine multiple fees correctly', () => {
    const result = calculateQuote(100, 4, 150, '2025-03-01'); // Saturday, 150 guests
    
    expect(result.subtotal).toBe(440); // 400 * 1.1 for weekend
    expect(result.fees).toHaveLength(2);
    expect(result.fees.find(f => f.name === 'Weekend Surcharge (10%)')?.amount).toBe(40);
    expect(result.fees.find(f => f.name === 'Large Event Cleaning Fee')?.amount).toBe(200);
    expect(result.total).toBe(640); // 440 + 200
    expect(result.notes).toHaveLength(2);
  });

  it('should handle edge case of exactly 120 guests', () => {
    const result = calculateQuote(100, 4, 120, '2025-03-03'); // Monday, exactly 120 guests
    
    expect(result.fees).toHaveLength(0); // No cleaning fee for exactly 120
    expect(result.total).toBe(400);
  });
});