import React, { useState } from 'react';
import { X, Send, Mail, User, Calendar, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_ENDPOINTS from '../config/api';

interface EnquiryFormProps {
  venueId: string;
  venueName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EnquiryData {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  eventEndDate: string;
  guestCount: string;
  eventType: string;
  requirements: string;
}

const EnquiryForm: React.FC<EnquiryFormProps> = ({
  venueId,
  venueName,
  onClose,
  onSuccess
}) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState<EnquiryData>({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    eventDate: '',
    eventEndDate: '',
    guestCount: '',
    eventType: '',
    requirements: ''
  });
  const [errors, setErrors] = useState<Partial<EnquiryData>>({});

  const eventTypes = [
    'Wedding', 'Corporate Event', 'Conference', 'Birthday Party',
    'Anniversary', 'Baby Shower', 'Graduation', 'Holiday Party',
    'Networking Event', 'Product Launch', 'Other'
  ];

  const validateForm = (): boolean => {
    const newErrors: Partial<EnquiryData> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.eventDate) newErrors.eventDate = 'Event date is required';
    if (!formData.guestCount) newErrors.guestCount = 'Guest count is required';
    if (!formData.eventType) newErrors.eventType = 'Event type is required';
    if (!formData.requirements.trim()) newErrors.requirements = 'Please describe your requirements';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const enquiryPayload = {
        venue_id: venueId,
        venue_name: venueName,
        user_id: user?.id || null,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        event_date: formData.eventDate,
        guest_count: parseInt(formData.guestCount),
        event_type: formData.eventType,
        requirements: formData.requirements,
        status: 'pending'
      };


      const response = await fetch(API_ENDPOINTS.INQUIRIES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enquiryPayload)
      });

      if (!response.ok) {
        throw new Error('Failed to submit enquiry');
      }

      const result = await response.json();
      console.log('Enquiry submitted:', result);

      setStep('success');
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      alert('Failed to submit enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof EnquiryData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleViewEnquiries = () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/my-enquiries' } } });
    } else {
      navigate('/my-enquiries');
    }
    onClose();
  };

  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Enquiry Submitted!</h3>
            <p className="text-gray-600 mb-6">
              Thank you for your enquiry about <strong>{venueName}</strong>.
              We will review your requirements and get back to you within 24 hours.
            </p>

            <div className="space-y-3">
              <button
                onClick={onClose}
                className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Make an Enquiry</h2>
            <p className="text-gray-600">{venueName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>


        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Your full name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="your.email@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Event Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Event Start Date *
              </label>
              <input
                type="date"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.eventDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Event End Date
              </label>
              <input
                type="date"
                name="eventEndDate"
                value={formData.eventEndDate}
                onChange={handleChange}
                min={formData.eventDate || new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Guest Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Number of Guests *
              </label>
              <input
                type="number"
                name="guestCount"
                value={formData.guestCount}
                onChange={handleChange}
                min="1"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.guestCount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g. 50"
              />
              {errors.guestCount && <p className="text-red-500 text-xs mt-1">{errors.guestCount}</p>}
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type *
              </label>
              <select
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.eventType ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select event type</option>
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.eventType && <p className="text-red-500 text-xs mt-1">{errors.eventType}</p>}
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Event Requirements & Details *
            </label>
            <textarea
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.requirements ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Please describe your event requirements, preferred timing, catering needs, setup preferences, budget range, and any other important details..."
            />
            {errors.requirements && <p className="text-red-500 text-xs mt-1">{errors.requirements}</p>}
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Submit Enquiry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnquiryForm;