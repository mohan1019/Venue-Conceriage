import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import API_ENDPOINTS from '../config/api';

interface Venue {
  id: string;
  name: string;
  city: string;
  pricePerHour: number;
}

const Inquiry: React.FC = () => {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    eventDate: '',
    hours: '',
    guests: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (venueId) {
      fetchVenue();
    }
  }, [venueId]);

  const fetchVenue = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.VENUE_DETAIL(venueId!));
      if (response.ok) {
        const data = await response.json();
        setVenue(data);
      }
    } catch (error) {
      console.error('Error fetching venue:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.eventDate) newErrors.eventDate = 'Event date is required';
    else {
      const eventDate = new Date(formData.eventDate);
      if (eventDate <= new Date()) {
        newErrors.eventDate = 'Event date must be in the future';
      }
    }
    if (!formData.hours) newErrors.hours = 'Duration is required';
    else if (parseInt(formData.hours) <= 0) {
      newErrors.hours = 'Duration must be positive';
    }
    if (!formData.guests) newErrors.guests = 'Number of guests is required';
    else if (parseInt(formData.guests) <= 0) {
      newErrors.guests = 'Number of guests must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(API_ENDPOINTS.INQUIRIES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venueId,
          ...formData,
          hours: parseInt(formData.hours),
          guests: parseInt(formData.guests)
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to submit inquiry');
      }
    } catch (error) {
      setError('Failed to submit inquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (!venue) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Venue not found</h1>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Inquiry Submitted!</h1>
          <p className="text-gray-600 mb-8">
            Thank you for your interest in <strong>{venue.name}</strong>. 
            We'll get back to you within 24 hours with availability and pricing details.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to={`/venue/${venueId}`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Back to Venue
            </Link>
            <Link
              to="/results"
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Browse More Venues
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/venue/${venueId}`}
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to venue
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Book {venue.name}</h1>
        <p className="text-gray-600">
          {venue.city} • Starting from ${venue.pricePerHour}/hour
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Your full name"
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
                Event Date *
              </label>
              <input
                type="date"
                id="eventDate"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleInputChange}
                min={minDate}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.eventDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.eventDate && (
                <p className="text-red-600 text-sm mt-1">{errors.eventDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-2">
                Duration (hours) *
              </label>
              <input
                type="number"
                id="hours"
                name="hours"
                value={formData.hours}
                onChange={handleInputChange}
                min="1"
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.hours ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="4"
              />
              {errors.hours && (
                <p className="text-red-600 text-sm mt-1">{errors.hours}</p>
              )}
            </div>

            <div>
              <label htmlFor="guests" className="block text-sm font-medium text-gray-700 mb-2">
                Expected Guests *
              </label>
              <input
                type="number"
                id="guests"
                name="guests"
                value={formData.guests}
                onChange={handleInputChange}
                min="1"
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.guests ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="50"
              />
              {errors.guests && (
                <p className="text-red-600 text-sm mt-1">{errors.guests}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Tell us about your event, special requirements, or questions..."
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              By submitting this inquiry, you agree to be contacted by the venue representative. 
              This is not a booking confirmation - you'll receive availability details and next steps via email.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Inquiry'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Inquiry;