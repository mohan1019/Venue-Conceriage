import React, { useState } from 'react';
import { Calculator, DollarSign, Calendar, Users } from 'lucide-react';
import API_ENDPOINTS from '../config/api';

interface Venue {
  id: string;
  name: string;
  pricePerHour: number;
}

interface QuoteWidgetProps {
  venue: Venue;
}

interface Quote {
  subtotal: number;
  fees: { name: string; amount: number }[];
  total: number;
  notes: string[];
}

const QuoteWidget: React.FC<QuoteWidgetProps> = ({ venue }) => {
  const [hours, setHours] = useState('4');
  const [guests, setGuests] = useState('50');
  const [eventDate, setEventDate] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const calculateQuote = async () => {
    if (!hours || !guests || !eventDate) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        venueId: venue.id,
        hours,
        guests,
        eventDate
      });

      const response = await fetch(`${API_ENDPOINTS.QUOTE}?${params}`);
      if (response.ok) {
        const data = await response.json();
        setQuote(data);
      }
    } catch (error) {
      console.error('Error calculating quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = () => {
    setQuote(null); // Reset quote when inputs change
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <Calculator className="w-5 h-5 mr-2 text-primary-600" />
        Get Quote
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value);
                handleInputChange();
              }}
              min={minDate}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (hours)
          </label>
          <input
            type="number"
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              handleInputChange();
            }}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="4"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Guests
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              value={guests}
              onChange={(e) => {
                setGuests(e.target.value);
                handleInputChange();
              }}
              min="1"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="50"
            />
          </div>
        </div>

        <button
          onClick={calculateQuote}
          disabled={loading || !hours || !guests || !eventDate}
          className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white py-2 rounded-lg font-medium transition-colors"
        >
          {loading ? 'Calculating...' : 'Calculate Quote'}
        </button>

        {quote && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-3">Quote Breakdown</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Base Price ({hours}h × ${venue.pricePerHour})</span>
                <span>${quote.subtotal}</span>
              </div>
              
              {quote.fees.map((fee, index) => (
                <div key={index} className="flex justify-between text-gray-600">
                  <span>{fee.name}</span>
                  <span>${fee.amount}</span>
                </div>
              ))}
              
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary-600">${quote.total}</span>
              </div>
            </div>

            {quote.notes.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h5 className="text-sm font-medium text-blue-800 mb-1">Notes:</h5>
                <ul className="text-xs text-blue-700 space-y-1">
                  {quote.notes.map((note, index) => (
                    <li key={index}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3">
              Quote valid for 7 days. Final pricing may vary based on specific requirements.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteWidget;