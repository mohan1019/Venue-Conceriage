import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Users, Star, Search, Send, MessageCircle, Sparkles, Bot, ChevronRight, Filter, Clock, TrendingUp } from 'lucide-react';
import EnquiryForm from '../components/EnquiryForm';
import API_ENDPOINTS from '../config/api';

// Global type declaration for AdClient
declare global {
  interface Window {
    AdClient?: {
      loadAds: () => void;
      trackClick: (impressionId: string) => void;
      getTelemetry: () => any;
      toggleDebug: () => void;
    };
  }
}

interface Venue {
  venue_id?: string;
  id?: string;
  name: string;
  city: string;
  capacity?: number;
  pricePerHour?: number;
  rating?: number;
  images?: string[];
  main_image?: string;
  hero_image?: string;
  amenities: string[] | string;
}

interface Ad {
  id: string;
  title: string;
  kind: string;
  imageUrl: string;
  clickUrl: string;
}

const Results: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchDetails, setSearchDetails] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [replyText, setReplyText] = useState<string>('');
  const [selectedEnquiryVenue, setSelectedEnquiryVenue] = useState<{venue_id: string, name: string} | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [userSpecifiedLimit, setUserSpecifiedLimit] = useState(false);
  const [adScriptLoaded, setAdScriptLoaded] = useState(false);

  const query = searchParams.get('query') || '';

  // Load ad client script
  useEffect(() => {
    if (!window.AdClient && !adScriptLoaded) {
      console.log('Loading AdClient script...');
      const script = document.createElement('script');
      script.src = 'https://venue-backend-1.onrender.com/adClient.js';
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

  // Function to clean and format the search query for display
  const formatDisplayQuery = (rawQuery: string): string => {
    if (!rawQuery) return '';

    let cleaned = rawQuery.replace(/\.\s*Additional details:\s*/gi, '. ');
    cleaned = cleaned.replace(/\bt\s*o\s*(\d+)/gi, 'to $1');
    cleaned = cleaned.replace(/change\s*it\s*to/gi, 'for');
    cleaned = cleaned.replace(/change\s*to/gi, 'for');

    const capacityMatches = cleaned.match(/(\d+)\s*people/gi);
    if (capacityMatches && capacityMatches.length > 1) {
      const lastCapacity = capacityMatches[capacityMatches.length - 1];
      cleaned = cleaned.replace(/\d+\s*people/gi, '');
      cleaned = cleaned.replace(/for\s*\./gi, '');
      cleaned = `${cleaned.trim()} for ${lastCapacity}`;
    }

    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\.+/g, '.');
    cleaned = cleaned.replace(/\.\s*\./g, '.');
    cleaned = cleaned.replace(/\.\s*$/, '');
    cleaned = cleaned.trim();

    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  };

  useEffect(() => {
    setCurrentOffset(0);
    setHasMore(true);
    setVenues([]);

    const hasLimitInQuery = query.toLowerCase().includes('limit');
    setUserSpecifiedLimit(hasLimitInQuery);

    Promise.all([
      fetchVenues(true),
      fetchAds(),
      fetchReplyText()
    ]).catch(error => {
      console.error('Error loading page data:', error);
    });
  }, [searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore || userSpecifiedLimit) return;

      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollTop + windowHeight >= docHeight - 1000) {
        fetchVenues(false, currentOffset);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, userSpecifiedLimit, currentOffset]);

  useEffect(() => {
    if (adScriptLoaded && window.AdClient?.loadAds && !loading) {
      console.log('React: Loading ads, script loaded:', adScriptLoaded, 'venues count:', venues.length);
      setTimeout(() => {
        try {
          window.AdClient?.loadAds();
        } catch (error) {
          console.error('Error loading ads:', error);
        }
      }, 100);
    }
  }, [adScriptLoaded, loading]);

  const fetchVenues = async (isInitialLoad = false, offset = 0) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const searchQuery = query || 'Show me venues';
      let requestQuery = searchQuery;
      if (!isInitialLoad && !userSpecifiedLimit) {
        requestQuery = `${searchQuery}. Load more results starting from offset ${offset} with limit 6.`;
      }

      const response = await fetch(`${API_ENDPOINTS.VENUES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_request: requestQuery,
          offset : offset
        })
      });
      const data = await response.json();

      if (isInitialLoad) {
        setVenues(data.venues || []);
        setCurrentOffset(6);
      } else {
        setVenues(prev => [...prev, ...(data.venues || [])]);
        setCurrentOffset(prev => prev + 6);
      }

      setHasMore(data.has_more || (data.venues && data.venues.length === 6));

    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const fetchAds = async () => {
    try {
      const tags = query;
      const response = await fetch(`${API_ENDPOINTS.ADS}?context=search&tags=${tags}`);
      const data = await response.json();
      setAds(data.ads || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
    }
  };

  const fetchReplyText = async () => {
    if (!query) {
      setReplyText('All Venues');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.VENUES_REPLY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_text: query
        })
      });

      const data = await response.json();
      if (data.success && data.agent_reply) {
        setReplyText(data.agent_reply);
      } else {
        setReplyText(`Results for "${formatDisplayQuery(query)}"`);
      }
    } catch (error) {
      console.error('Error fetching reply:', error);
      setReplyText(`Results for "${formatDisplayQuery(query)}"`);
    }
  };

  const handleDetailedSearch = async () => {
    if (!searchDetails.trim()) return;

    setIsSearching(true);
    setLoading(true);

    try {
      const baseQuery = query || 'Show me venues';
      const combinedQuery = `${baseQuery}. Improvement details: ${searchDetails}`;

      const [venuesResponse, replyResponse] = await Promise.all([
        fetch(`${API_ENDPOINTS.VENUES}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            venue_request: combinedQuery
          })
        }),
        fetch(API_ENDPOINTS.VENUES_REPLY, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_text: combinedQuery
          })
        })
      ]);

      if (!venuesResponse.ok) {
        throw new Error(`Venues API error! status: ${venuesResponse.status}`);
      }

      const venuesData = await venuesResponse.json();

      if (replyResponse.ok) {
        const replyData = await replyResponse.json();
        if (replyData.success && replyData.agent_reply) {
          setReplyText(replyData.agent_reply);
        }
      }

      setVenues([]);
      setTimeout(() => {
        setVenues(venuesData.venues || []);
      }, 50);

      const params = new URLSearchParams();
      params.set('query', combinedQuery);
      setSearchParams(params);

      setSearchDetails('');

    } catch (error) {
      console.error('Error performing detailed search:', error);
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDetailedSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/svg%3E\")"}}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced AI Response Header */}
        <div className="mb-12">
          <div className="relative bg-gradient-to-r from-purple-800/20 to-pink-800/20 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/20 shadow-2xl overflow-hidden">
            {/* Header Background Effects */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-pink-400/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-r from-cyan-400/8 to-transparent rounded-full blur-xl animate-pulse"></div>

            <div className="relative">
              {/* AI Badge */}
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-4 py-2 text-sm mb-4">
                <Bot className="w-4 h-4 text-purple-400 animate-pulse" />
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span className="text-purple-300 font-medium">AI Venue Concierge</span>
              </div>

              {/* Main AI Response */}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {replyText || (query ? `Results for "${formatDisplayQuery(query)}"` : 'All Venues')}
              </h1>

              {/* Stats Bar */}
              <div className="flex flex-wrap items-center gap-6 text-gray-300">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="font-medium">
                    {loading ? 'Searching...' : `${venues.length} venues found`}
                  </span>
                </div>

                {query && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="text-sm"></span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm">AI-powered recommendations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Enhanced Left Sidebar */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50 sticky top-24">
              {/* Refine Search Section */}
              <div className="mb-8">
                <div className="flex items-center space-x-2 mb-4">
                  <Filter className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Refine Your Search</h3>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  Add more details to get more accurate venue recommendations powered by AI
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Additional Search Details
                    </label>
                    <textarea
                      value={searchDetails}
                      onChange={(e) => setSearchDetails(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="e.g., Need catering services, prefer downtown location, must have parking, cocktail style event, budget under $5000..."
                      rows={6}
                      className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none text-sm backdrop-blur-sm transition-all duration-200"
                    />
                  </div>

                  <button
                    onClick={handleDetailedSearch}
                    disabled={!searchDetails.trim() || isSearching}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105 transform"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>AI is thinking...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enhance with AI</span>
                      </>
                    )}
                  </button>

                  {/* Tips Section */}
                  <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                    <div className="flex items-center space-x-2 mb-3">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <p className="font-medium text-white text-sm">AI Tips for better results</p>
                    </div>
                    <ul className="space-y-2 text-xs text-gray-400">
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                        <span>Mention specific amenities needed</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-pink-400 rounded-full"></div>
                        <span>Include event type and style</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                        <span>Specify location preferences</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                        <span>Add budget constraints</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Featured Services */}
              {ads.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span>Featured Services</span>
                  </h4>
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
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white line-clamp-2">
                            {ad.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 capitalize">{ad.kind}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Results Section */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50 animate-pulse">
                    <div className="flex space-x-4">
                      <div className="w-48 h-32 bg-gray-700/50 rounded-xl flex-shrink-0"></div>
                      <div className="flex-1 space-y-4">
                        <div className="h-6 bg-gray-700/50 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-700/50 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-700/50 rounded w-2/3"></div>
                        <div className="h-4 bg-gray-700/50 rounded w-1/3"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : venues.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-purple-500/20">
                  <Search className="w-12 h-12 text-purple-400" />
                </div>
                <h3 className="text-xl font-medium text-white mb-4">No venues found</h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  Try adding more details in the search box or refining your search criteria to get better AI recommendations
                </p>
                <button
                  onClick={() => setSearchDetails('')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
                >
                  Clear Search Details
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {venues.map((venue) => {
                  const venueId = venue.venue_id || venue.id;
                  const venueImage = venue.main_image || venue.hero_image || '/placeholder-venue.jpg';
                  const venueAmenities = typeof venue.amenities === 'string'
                    ? venue.amenities.split(',').map(a => a.trim())
                    : venue.amenities || [];

                  return (
                    <div
                      key={venueId}
                      className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden border border-gray-700/50 hover:border-purple-500/30 group hover:scale-105 transform"
                    >
                      <div className="flex">
                        <div className="w-48 h-48 flex-shrink-0 relative overflow-hidden">
                          <img
                            src={venueImage}
                            alt={venue.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <Link
                                to={`/venue/${venueId}`}
                                className="text-xl font-bold text-white mb-2 hover:text-purple-400 transition-colors duration-200 flex items-center space-x-2"
                              >
                                <span>{venue.name}</span>
                                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                              <div className="flex items-center text-gray-400 mb-2">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span>{venue.city}</span>
                              </div>
                            </div>
                            {venue.rating && (
                              <div className="flex items-center space-x-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-2 rounded-full border border-yellow-500/30">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="text-sm font-semibold text-white">{venue.rating}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            {venue.capacity && (
                              <div className="flex items-center text-gray-400">
                                <Users className="w-4 h-4 mr-2" />
                                <span>Capacity: {venue.capacity} guests</span>
                              </div>
                            )}
                            {venue.pricePerHour && (
                              <div className="text-right">
                                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                  ${venue.pricePerHour}
                                </span>
                                <span className="text-gray-400">/hour</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mb-6">
                            {venueAmenities.slice(0, 4).map((amenity, index) => (
                              <span
                                key={index}
                                className="text-xs bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full border border-gray-600/30 backdrop-blur-sm"
                              >
                                {amenity}
                              </span>
                            ))}
                            {venueAmenities.length > 4 && (
                              <span className="text-xs text-gray-400 bg-gray-700/30 px-3 py-1 rounded-full border border-gray-600/30">
                                +{venueAmenities.length - 4} more
                              </span>
                            )}
                          </div>

                          <div className="flex space-x-3">
                            <Link
                              to={`/venue/${venueId}`}
                              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-center py-3 px-6 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 transform"
                            >
                              View Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Loading More Indicator */}
                {loadingMore && !userSpecifiedLimit && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center space-x-3 bg-gray-800/50 backdrop-blur-xl rounded-full px-6 py-3 border border-gray-700/50">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-300 font-medium">AI is finding more venues...</span>
                    </div>
                  </div>
                )}

                {/* End of Results */}
                {!hasMore && !userSpecifiedLimit && venues.length > 6 && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-full px-6 py-3 border border-green-500/30">
                      <Sparkles className="w-5 h-5 text-green-400" />
                      <span className="text-green-300 font-medium">You've seen all available venues!</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Right Sidebar */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span>Recommended Services</span>
              </h3>

              {/* Enhanced Ad Slot */}
              <div data-ad-slot="sidebar" className="mb-6">
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-8 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Loading premium recommendations...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enquiry Form Modal */}
        {selectedEnquiryVenue && (
          <EnquiryForm
            venueId={selectedEnquiryVenue.venue_id}
            venueName={selectedEnquiryVenue.name}
            onClose={() => setSelectedEnquiryVenue(null)}
            onSuccess={() => {
              console.log('Enquiry submitted successfully');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Results;