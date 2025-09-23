import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { MapPin, Users, Star, Calendar, CheckCircle, MessageCircle, ChevronRight, Sparkles, Award, TrendingUp, Home, ArrowLeft, Phone, Mail, Globe } from 'lucide-react';
import EnquireWidget from '../components/EnquireWidget';
import AskAI from '../components/AskAI';
import EnquiryForm from '../components/EnquiryForm';
import API_ENDPOINTS, { API_BASE_URL } from '../config/api';

// Global type declaration for AdClient
declare global {
  interface Window {
    AdClient?: {
      loadAds: () => void;
      forceReload: () => void;
      trackClick: (impressionId: string) => void;
      getTelemetry: () => any;
      getStatus: () => { isLoading: boolean; containersFound: number; scriptLoaded: boolean; };
      toggleDebug: () => void;
    };
  }
}

interface Venue {
  venue_id: string;
  name: string;
  city: string;
  state: string;
  capacity: number;
  pricePerHour?: number;
  price_per_day?: number; // For production API compatibility
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
  tags?: string;
}


const VenueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [adScriptLoaded, setAdScriptLoaded] = useState(false);

  // Load ad client script
  useEffect(() => {
    if (!window.AdClient && !adScriptLoaded) {
      console.log('Loading AdClient script...');
      const script = document.createElement('script');
      script.src = `${API_BASE_URL}/adClient.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        console.log('AdClient script loaded successfully');
        console.log('window.AdClient after load:', window.AdClient);
        setAdScriptLoaded(true);
      };
      script.onerror = (error) => {
        console.error('Failed to load AdClient script:', error);
        setAdScriptLoaded(false);
      };
      document.head.appendChild(script);
      console.log('AdClient script element added to head');
    }
  }, [adScriptLoaded]);

  useEffect(() => {
    if (id) {
      fetchVenue();
    }
  }, [id]);

  // Always load ads when component mounts or when script loads
  useEffect(() => {
    if (adScriptLoaded && window.AdClient?.loadAds && venue) {
      console.log('VenueDetail: Loading ads on page visit, script loaded:', adScriptLoaded, 'venue:', venue.name);
      // Always call loadAds regardless of loading state
      const loadAds = () => {
        try {
          window.AdClient?.loadAds();
        } catch (error) {
          console.error('Error loading ads:', error);
        }
      };

      // Load immediately if not loading, or with delay if still loading
      if (loading) {
        setTimeout(loadAds, 500);
      } else {
        setTimeout(loadAds, 100);
      }
    }
  }, [adScriptLoaded, venue?.venue_id]); // Depend on venue_id to reload when venue changes

  // Force reload ads when returning to page (page visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && adScriptLoaded && window.AdClient?.loadAds) {
        console.log('VenueDetail: Page became visible, reloading ads');
        setTimeout(() => {
          try {
            window.AdClient?.loadAds();
          } catch (error) {
            console.error('Error reloading ads on visibility change:', error);
          }
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [adScriptLoaded]);

  // Reload ads when route changes (when navigating back to VenueDetail page)
  useEffect(() => {
    if (adScriptLoaded && window.AdClient?.forceReload) {
      console.log('VenueDetail: Route changed, force reloading ads');
      setTimeout(() => {
        try {
          window.AdClient?.forceReload();
        } catch (error) {
          console.error('Error force reloading ads on route change:', error);
        }
      }, 300);
    }
  }, [location.pathname, location.search, adScriptLoaded]);

  const fetchVenue = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.VENUE_DETAIL(id!));
      if (response.ok) {
        const data = await response.json();
        // Add pricePerHour if missing (for production API compatibility)
        if (!data.pricePerHour && data.price_per_day) {
          data.pricePerHour = Math.round(data.price_per_day / 8);
        }
        setVenue(data);
      } else {
        console.error('Venue not found:', response.status);
      }
    } catch (error) {
      console.error('Error fetching venue:', error);
    } finally {
      setLoading(false);
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
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Amenities & Features */}
              {(() => {
                const amenities = Array.isArray(venue.amenities) ? venue.amenities : venue.amenities?.split?.(',').filter(Boolean) || [];
                const tags = venue.tags ? venue.tags.split(',').map(tag => tag.trim().replace(/_/g, ' ')) : [];
                const allFeatures = [...amenities, ...tags].filter(Boolean);

                return allFeatures.length > 0 ? (
                  <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">Amenities & Features</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allFeatures.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-700/30 rounded-xl border border-gray-600/30 hover:border-green-500/30 transition-colors">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <span className="text-gray-300">{feature.trim().replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

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
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center space-x-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <span>Recommended Services</span>
              </h3>
              <div data-ad-slot="sidebar" className="mb-8 min-h-[300px]">
                {/* AdClient will populate this container */}
                <div className="text-center text-gray-400 text-sm py-8">
                  <div className="animate-pulse">
                    <div className="w-16 h-16 bg-gray-700/30 rounded-full mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-700/30 rounded w-32 mx-auto mb-2"></div>
                    <div className="h-3 bg-gray-700/30 rounded w-24 mx-auto"></div>
                  </div>
                </div>
              </div>
            </div>

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