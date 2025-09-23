import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Users, Star, Calendar, CheckCircle, MessageCircle, ChevronRight, Sparkles, Award, TrendingUp, Home, ArrowLeft, Phone, Mail, Globe } from 'lucide-react';
import EnquireWidget from '../components/EnquireWidget';
import AskAI from '../components/AskAI';
import EnquiryForm from '../components/EnquiryForm';
import API_ENDPOINTS from '../config/api';

// Load ad client script from backend server
if (typeof window !== 'undefined' && !window.AdClient) {
  const script = document.createElement('script');
  script.src = 'https://venue-backend-1.onrender.com/adClient.js';
  script.async = true;
  document.head.appendChild(script);
}

interface Venue {
  venue_id: string;
  name: string;
  city: string;
  state: string;
  capacity: number;
  pricePerHour?: number;
  rating?: number;
  main_image?: string;
  hero_image?: string;
  images?: string[];
  amenities: string;
  availableDates?: string[];
  brand?: string;
  type?: string;
  total_meeting_area_sqft?: number;
  largest_space_sqft?: number;
  diamond_level?: string;
  preferred_rating?: string;
}

interface Ad {
  id: string;
  title: string;
  kind: string;
  imageUrl: string;
  clickUrl: string;
}

const VenueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showAskAI, setShowAskAI] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchVenue();
      fetchAds();
    }
  }, [id]);

  const fetchVenue = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.VENUE_DETAIL(id!));
      if (response.ok) {
        const data = await response.json();
        setVenue(data);
      }
    } catch (error) {
      console.error('Error fetching venue:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAds = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADS}?context=detail&venueId=${id}`);
      const data = await response.json();
      setAds(data.ads || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 relative overflow-hidden">
        {/* Global Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")"}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700/50 rounded-xl mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-96 bg-gray-800/50 rounded-2xl"></div>
                <div className="space-y-4">
                  <div className="h-6 bg-gray-700/50 rounded-xl"></div>
                  <div className="h-4 bg-gray-700/50 rounded-xl w-3/4"></div>
                  <div className="h-4 bg-gray-700/50 rounded-xl w-1/2"></div>
                </div>
              </div>
              <div className="h-64 bg-gray-800/50 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-gray-900 relative overflow-hidden">
        {/* Global Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")"}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-12 border border-gray-700/50 shadow-2xl">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Home className="w-12 h-12 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Venue not found</h1>
            <p className="text-gray-400 mb-8">The venue you're looking for doesn't exist or has been removed.</p>
            <Link
              to="/results"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Browse Venues</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")"}}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Breadcrumb */}
        <nav className="mb-8">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <ol className="flex items-center space-x-3 text-sm">
              <li>
                <Link to="/" className="flex items-center space-x-1 text-gray-400 hover:text-purple-400 transition-colors">
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </Link>
              </li>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <li>
                <Link to="/results" className="text-gray-400 hover:text-purple-400 transition-colors">Venues</Link>
              </li>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <li className="text-white font-medium">{venue.name}</li>
            </ol>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Main Content */}
          <div className="lg:col-span-2">
            {/* Enhanced Image Gallery */}
            <div className="mb-8">
              <div className="relative h-96 rounded-3xl overflow-hidden mb-6 group">
                <img
                  src={selectedImage === 0 ? venue.main_image || venue.hero_image || '/placeholder-venue.jpg' : venue.hero_image || venue.main_image || '/placeholder-venue.jpg'}
                  alt={venue.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

                {/* Image overlay with venue type badge */}
                {venue.brand && (
                  <div className="absolute top-6 left-6">
                    <div className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                      {venue.brand} {venue.type}
                    </div>
                  </div>
                )}

                {/* Rating badge */}
                {venue.preferred_rating && (
                  <div className="absolute top-6 right-6">
                    <div className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span>{venue.preferred_rating.replace('_', ' ')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Image thumbnails */}
              {venue.main_image && venue.hero_image && venue.main_image !== venue.hero_image && (
                <div className="flex space-x-4 overflow-x-auto">
                  <button
                    onClick={() => setSelectedImage(0)}
                    className={`flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden transition-all duration-200 ${
                      selectedImage === 0 ? 'ring-2 ring-purple-500 scale-105' : 'hover:scale-105'
                    }`}
                  >
                    <img
                      src={venue.main_image}
                      alt={`${venue.name} main`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    onClick={() => setSelectedImage(1)}
                    className={`flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden transition-all duration-200 ${
                      selectedImage === 1 ? 'ring-2 ring-purple-500 scale-105' : 'hover:scale-105'
                    }`}
                  >
                    <img
                      src={venue.hero_image}
                      alt={`${venue.name} hero`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Enhanced Venue Info */}
            <div className="space-y-8">
              {/* Header Section */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                <h1 className="text-4xl font-bold text-white mb-6">{venue.name}</h1>

                <div className="flex flex-wrap items-center gap-6 text-gray-300 mb-6">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-purple-400" />
                    <span>{venue.city}, {venue.state}</span>
                  </div>
                  {venue.capacity && (
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      <span>Up to {venue.capacity} guests</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    <span>Premium Venue</span>
                  </div>
                </div>

                {/* Space Information */}
                {venue.total_meeting_area_sqft && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-700/30 rounded-2xl p-6 border border-gray-600/30">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Total Meeting Space</p>
                          <p className="text-xl font-bold text-white">{venue.total_meeting_area_sqft.toLocaleString()} sq ft</p>
                        </div>
                      </div>
                    </div>
                    {venue.largest_space_sqft && (
                      <div className="bg-gray-700/30 rounded-2xl p-6 border border-gray-600/30">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                            <Award className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Largest Space</p>
                            <p className="text-xl font-bold text-white">{venue.largest_space_sqft.toLocaleString()} sq ft</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing Section */}
                {venue.pricePerHour && (
                  <div className="bg-gradient-to-r from-purple-800/30 to-pink-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          ${venue.pricePerHour}
                        </span>
                        <span className="text-gray-300 ml-2">per hour</span>
                        <p className="text-sm text-gray-400 mt-1">Professional venue rental rate</p>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setShowEnquiryForm(true)}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 inline-flex items-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105 transform"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span>Make Enquiry</span>
                        </button>
                        <Link
                          to={`/inquiry/${venue.venue_id}`}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Amenities */}
              {venue.amenities && (
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Amenities & Features</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(Array.isArray(venue.amenities) ? venue.amenities : venue.amenities?.split?.(',') || []).map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-xl border border-gray-600/30 hover:border-green-500/30 transition-colors">
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">{amenity.trim().replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhanced Available Dates */}
              {venue.availableDates && venue.availableDates.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Available Dates</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {venue.availableDates.slice(0, 8).map((date) => (
                      <div key={date} className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-200">
                        <Calendar className="w-6 h-6 text-green-400 mx-auto mb-2" />
                        <span className="text-sm font-medium text-green-300">
                          {new Date(date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Enhanced Enquire Widget */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50">
              <EnquireWidget venue={venue} onEnquire={() => setShowEnquiryForm(true)} />
            </div>

            {/* Enhanced Contact Information */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-purple-400" />
                <span>Get in Touch</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-xl">
                  <Phone className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Call for availability</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-xl">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300">Email inquiries</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-xl">
                  <Globe className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-300">Virtual tours available</span>
                </div>
              </div>
            </div>

            {/* Enhanced Ad Space */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50">
              <div data-ad-slot="sidebar" className="min-h-[140px]">
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-8 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Premium recommendations loading...</p>
                </div>
              </div>
            </div>

            {/* Enhanced Featured Services */}
            {ads.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span>Featured Services</span>
                </h3>
                <div className="space-y-4">
                  {ads.slice(0, 3).map((ad) => (
                    <a
                      key={ad.id}
                      href={ad.clickUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gray-700/30 hover:bg-gray-700/50 p-4 rounded-xl transition-all duration-200 border border-gray-600/30 hover:border-purple-500/30 hover:scale-105 transform"
                    >
                      <div className="flex space-x-3">
                        <img
                          src={ad.imageUrl}
                          alt={ad.title}
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white mb-1">
                            {ad.title}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">{ad.kind}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Enquiry Form Modal */}
        {showEnquiryForm && venue && (
          <EnquiryForm
            venueId={venue.venue_id}
            venueName={venue.name}
            onClose={() => setShowEnquiryForm(false)}
            onSuccess={() => {
              console.log('Enquiry submitted successfully');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default VenueDetail;