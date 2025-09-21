import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Users, Star, Search, Send } from 'lucide-react';
import API_ENDPOINTS from '../config/api';

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
  const [searchDetails, setSearchDetails] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [replyText, setReplyText] = useState<string>('');

  const query = searchParams.get('query') || '';

  // Function to clean and format the search query for display
  const formatDisplayQuery = (rawQuery: string): string => {
    if (!rawQuery) return '';

    // Remove "Additional details:" prefixes
    let cleaned = rawQuery.replace(/\.\s*Additional details:\s*/gi, '. ');

    // Fix common typos
    cleaned = cleaned.replace(/\bt\s*o\s*(\d+)/gi, 'to $1');
    cleaned = cleaned.replace(/change\s*it\s*to/gi, 'for');
    cleaned = cleaned.replace(/change\s*to/gi, 'for');

    // Remove redundant capacity mentions - keep the last one
    const capacityMatches = cleaned.match(/(\d+)\s*people/gi);
    if (capacityMatches && capacityMatches.length > 1) {
      // Remove all capacity mentions except the last one
      const lastCapacity = capacityMatches[capacityMatches.length - 1];
      cleaned = cleaned.replace(/\d+\s*people/gi, '');
      cleaned = cleaned.replace(/for\s*\./gi, '');
      cleaned = `${cleaned.trim()} for ${lastCapacity}`;
    }

    // Clean up multiple spaces and periods
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\.+/g, '.');
    cleaned = cleaned.replace(/\.\s*\./g, '.');

    // Remove trailing periods and spaces
    cleaned = cleaned.replace(/\.\s*$/, '');
    cleaned = cleaned.trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  };

  useEffect(() => {
    fetchVenues();
    fetchAds();
    fetchReplyText();
  }, [searchParams]);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      // Always use AI search API
      const searchQuery = query || 'Show me venues'; // Default query if none exists

      const response = await fetch(`${API_ENDPOINTS.VENUES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_request: searchQuery
        })
      });
      const data = await response.json();
      setVenues(data.venues || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
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
    setLoading(true); // Also set loading to show visual feedback

    try {
      // Always append to existing query
      const baseQuery = query || 'Show me venues';
      const combinedQuery = `${baseQuery}. Additional details: ${searchDetails}`;

      console.log('Searching with combined query:', combinedQuery);

      const response = await fetch(`${API_ENDPOINTS.VENUES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_request: combinedQuery
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received venues data:', data);

      // Force update venues state
      setVenues([]);  // Clear first to trigger re-render
      setTimeout(() => {
        setVenues(data.venues || []);
      }, 50);

      // Update URL to reflect the refined search
      const params = new URLSearchParams();
      params.set('query', combinedQuery);
      setSearchParams(params);

      // Clear the search details text field
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {replyText || (query ? `Results for "${formatDisplayQuery(query)}"` : 'All Venues')}
        </h1>
        <p className="text-gray-600">
          {loading ? 'Searching...' : `Found ${venues.length} venues`}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Detailed Search Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Refine Your Search</h3>
              <p className="text-sm text-gray-600">
                Add more details to get more accurate venue recommendations
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Additional Search Details
                </label>
                <textarea
                  value={searchDetails}
                  onChange={(e) => setSearchDetails(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., Need catering services, prefer downtown location, must have parking, cocktail style event, budget under $5000..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
                />
              </div>

              <button
                onClick={handleDetailedSearch}
                disabled={!searchDetails.trim() || isSearching}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {isSearching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Search with Details</span>
                  </>
                )}
              </button>

              <div className="text-xs text-gray-500 space-y-2">
                <p className="font-medium">💡 Tips for better results:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Mention specific amenities needed</li>
                  <li>Include event type and style</li>
                  <li>Specify location preferences</li>
                  <li>Add budget constraints</li>
                  <li>Mention capacity requirements</li>
                </ul>
              </div>
            </div>

            {/* Ads Section */}
            {ads.length > 0 && (
              <div className="mt-8 space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Featured Services</h4>
                {ads.slice(0, 3).map((ad) => (
                  <a
                    key={ad.id}
                    href={ad.clickUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gray-50 hover:bg-gray-100 p-4 rounded-lg transition-colors"
                  >
                    <div className="flex space-x-3">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {ad.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{ad.kind}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-lg p-6 animate-pulse">
                  <div className="flex space-x-4">
                    <div className="w-32 h-32 bg-gray-300 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1 space-y-4">
                      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No venues found</h3>
              <p className="text-gray-600 mb-6">
                Try adding more details in the search box or refining your search criteria
              </p>
              <button
                onClick={() => setSearchDetails('')}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Clear Search Details
              </button>
            </div>
          ) : (
            <div className="space-y-6" key={venues.length}>
              {venues.map((venue) => {
                const venueId = venue.venue_id || venue.id;
                const venueImage = venue.images?.[0] || venue.main_image || venue.hero_image || '/placeholder-venue.jpg';
                const venueAmenities = typeof venue.amenities === 'string'
                  ? venue.amenities.split(',').map(a => a.trim())
                  : venue.amenities || [];

                return (
                  <Link
                    key={venueId}
                    to={`/venue/${venueId}`}
                    className="block bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden"
                  >
                    <div className="flex">
                      <div className="w-48 h-48 flex-shrink-0">
                        <img
                          src={venueImage}
                          alt={venue.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {venue.name}
                            </h3>
                            <div className="flex items-center text-gray-600 mb-2">
                              <MapPin className="w-4 h-4 mr-1" />
                              <span>{venue.city}</span>
                            </div>
                          </div>
                          {venue.rating && (
                            <div className="flex items-center space-x-1 bg-yellow-50 px-3 py-1 rounded-full">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm font-semibold">{venue.rating}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          {venue.capacity && (
                            <div className="flex items-center text-gray-600">
                              <Users className="w-4 h-4 mr-1" />
                              <span>Capacity: {venue.capacity} guests</span>
                            </div>
                          )}
                          {venue.pricePerHour && (
                            <div className="text-right">
                              <span className="text-2xl font-bold text-primary-600">
                                ${venue.pricePerHour}
                              </span>
                              <span className="text-gray-500">/hour</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {venueAmenities.slice(0, 4).map((amenity, index) => (
                            <span
                              key={index}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                            >
                              {amenity}
                            </span>
                          ))}
                          {venueAmenities.length > 4 && (
                            <span className="text-xs text-gray-500">
                              +{venueAmenities.length - 4} more amenities
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Results;