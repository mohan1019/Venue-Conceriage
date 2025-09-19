import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Users, Star, Filter, X } from 'lucide-react';
import API_ENDPOINTS from '../config/api';

interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  pricePerHour: number;
  rating: number;
  images: string[];
  amenities: string[];
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
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [minCapacity, setMinCapacity] = useState(searchParams.get('minCapacity') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPricePerHour') || '');

  const query = searchParams.get('query') || '';
  const cities = ['New York', 'San Francisco', 'Los Angeles'];

  useEffect(() => {
    fetchVenues();
    fetchAds();
  }, [searchParams]);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`${API_ENDPOINTS.VENUES}?${params}`);
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
      const tags = [query, selectedCity].filter(Boolean).join(',');
      const response = await fetch(`${API_ENDPOINTS.ADS}?context=search&tags=${tags}&minCapacity=${minCapacity}`);
      const data = await response.json();
      setAds(data.ads || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (selectedCity) params.set('city', selectedCity);
    if (minCapacity) params.set('minCapacity', minCapacity);
    if (maxPrice) params.set('maxPricePerHour', maxPrice);
    
    setSearchParams(params);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSelectedCity('');
    setMinCapacity('');
    setMaxPrice('');
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    setSearchParams(params);
  };

  const hasActiveFilters = selectedCity || minCapacity || maxPrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {query ? `Results for "${query}"` : 'All Venues'}
        </h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            {loading ? 'Searching...' : `Found ${venues.length} venues`}
          </p>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                {[selectedCity, minCapacity, maxPrice].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar */}
        <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-80 flex-shrink-0`}>
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowFilters(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* City Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  City
                </label>
                <div className="space-y-2">
                  {cities.map((city) => (
                    <label key={city} className="flex items-center">
                      <input
                        type="radio"
                        name="city"
                        value={city}
                        checked={selectedCity === city}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{city}</span>
                    </label>
                  ))}
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="city"
                      value=""
                      checked={selectedCity === ''}
                      onChange={() => setSelectedCity('')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">All Cities</span>
                  </label>
                </div>
              </div>

              {/* Capacity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Minimum Capacity
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Max Price per Hour
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <button
                onClick={applyFilters}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Apply Filters
              </button>
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
                <MapPin className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No venues found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search criteria or browse all venues
              </p>
              <button
                onClick={clearFilters}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {venues.map((venue) => (
                <Link
                  key={venue.id}
                  to={`/venue/${venue.id}`}
                  className="block bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden"
                >
                  <div className="flex">
                    <div className="w-48 h-48 flex-shrink-0">
                      <img
                        src={venue.images[0]}
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
                        <div className="flex items-center space-x-1 bg-yellow-50 px-3 py-1 rounded-full">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-semibold">{venue.rating}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center text-gray-600">
                          <Users className="w-4 h-4 mr-1" />
                          <span>Capacity: {venue.capacity} guests</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary-600">
                            ${venue.pricePerHour}
                          </span>
                          <span className="text-gray-500">/hour</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {venue.amenities.slice(0, 4).map((amenity) => (
                          <span
                            key={amenity}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                          >
                            {amenity}
                          </span>
                        ))}
                        {venue.amenities.length > 4 && (
                          <span className="text-xs text-gray-500">
                            +{venue.amenities.length - 4} more amenities
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Results;