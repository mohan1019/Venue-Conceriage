import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, MessageSquare, Phone, Mail, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_ENDPOINTS from '../config/api';

interface Enquiry {
  id: string;
  venue_id: string;
  venue_name: string;
  name: string;
  email: string;
  phone: string;
  event_date: string;
  guest_count: number;
  event_type: string;
  requirements: string;
  status: 'pending' | 'confirmed' | 'declined' | 'negotiating';
  createdAt: string;
  updatedAt: string;
  agent_response?: string;
  venue_owner_response?: string;
  negotiation_history: Array<{
    timestamp: string;
    type: 'agent' | 'venue_owner';
    message: string;
  }>;
}

const MyEnquiries: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: { pathname: '/my-enquiries' } }} replace />;
  }

  useEffect(() => {
    fetchEnquiries();
  }, [user]);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (user?.id) {
        params.append('user_id', user.id);
      } else if (user?.email) {
        params.append('email', user.email);
      }

      const response = await fetch(`${API_ENDPOINTS.INQUIRIES}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch enquiries');
      }

      const data = await response.json();
      setEnquiries(data.enquiries || []);
    } catch (err) {
      console.error('Error fetching enquiries:', err);
      setError('Failed to load enquiries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'negotiating':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'declined':
        return <XCircle className="w-4 h-4" />;
      case 'negotiating':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6 w-1/3"></div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-300 rounded mb-4 w-1/2"></div>
                <div className="h-4 bg-gray-300 rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Enquiries</h1>
        <p className="text-gray-600">Track your venue enquiries and responses</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {enquiries.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No enquiries yet</h3>
          <p className="text-gray-600 mb-6">
            Start exploring venues and make your first enquiry to see it here.
          </p>
          <Link
            to="/"
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Browse Venues
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enquiries List */}
          <div className="lg:col-span-2 space-y-4">
            {enquiries.map((enquiry) => (
              <div
                key={enquiry.id}
                className={`bg-white rounded-lg shadow-lg p-6 border-l-4 cursor-pointer transition-all duration-200 hover:shadow-xl ${
                  selectedEnquiry?.id === enquiry.id ? 'ring-2 ring-primary-500 border-l-primary-500' : 'border-l-gray-300'
                }`}
                onClick={() => setSelectedEnquiry(enquiry)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {enquiry.venue_name}
                    </h3>
                    <div className="flex items-center text-gray-600 text-sm">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{new Date(enquiry.event_date).toLocaleDateString()}</span>
                      <span className="mx-2">•</span>
                      <Users className="w-4 h-4 mr-1" />
                      <span>{enquiry.guest_count} guests</span>
                    </div>
                  </div>
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(enquiry.status)}`}>
                    {getStatusIcon(enquiry.status)}
                    <span className="capitalize">{enquiry.status}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                    {enquiry.event_type}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Submitted {new Date(enquiry.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center space-x-2">
                    {enquiry.agent_response && (
                      <span className="text-blue-600 flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Agent responded
                      </span>
                    )}
                    {enquiry.venue_owner_response && (
                      <span className="text-green-600 flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Venue responded
                      </span>
                    )}
                    <button className="text-primary-600 hover:text-primary-700 flex items-center">
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enquiry Details Panel */}
          <div className="lg:col-span-1">
            {selectedEnquiry ? (
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Enquiry Details</h3>
                  <Link
                    to={`/venue/${selectedEnquiry.venue_id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    View Venue
                  </Link>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Event Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{new Date(selectedEnquiry.event_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        <span>{selectedEnquiry.guest_count} guests</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span>{selectedEnquiry.event_type}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        <span>{selectedEnquiry.email}</span>
                      </div>
                      {selectedEnquiry.phone && (
                        <div className="flex items-center text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          <span>{selectedEnquiry.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Requirements</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {selectedEnquiry.requirements}
                    </p>
                  </div>

                  {/* Responses */}
                  {(selectedEnquiry.agent_response || selectedEnquiry.venue_owner_response || selectedEnquiry.negotiation_history.length > 0) && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Responses</h4>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedEnquiry.negotiation_history.map((item, index) => (
                          <div key={index} className={`p-3 rounded-lg text-sm ${
                            item.type === 'agent' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-green-50 border-l-4 border-green-500'
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">
                                {item.type === 'agent' ? 'AI Assistant' : 'Venue Owner'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-700">{item.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      Last updated: {new Date(selectedEnquiry.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Select an enquiry to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyEnquiries;