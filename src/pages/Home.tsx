import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Users, Star, ChevronRight } from 'lucide-react';
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

const Home: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredVenues, setFeaturedVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeaturedVenues();
  }, []);

  const fetchFeaturedVenues = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.VENUES);
      const data = await response.json();
      if (data.venues && Array.isArray(data.venues)) {
        setFeaturedVenues(data.venues.slice(0, 6));
      } else {
        console.error('Invalid venues data:', data);
        setFeaturedVenues([]);
      }
    } catch (error) {
      console.error('Error fetching featured venues:', error);
      setFeaturedVenues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/results?query=${encodeURIComponent(searchQuery)}`);
  };

  const cities = ['New York', 'San Francisco', 'Los Angeles'];
  const popularSearches = ['Wedding Venue', 'Corporate Event', 'Birthday Party', 'Conference Hall'];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Find Your Perfect
                <span className="block text-yellow-300">Event Venue</span>
              </h1>
              <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
                Discover amazing venues with AI-powered assistance. From intimate gatherings to grand celebrations.
              </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
              <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-2xl">
                <div className="flex-1 flex items-center space-x-4 px-4">
                  <Search className="w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search venues, locations, or event types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-gray-800 placeholder-gray-400 outline-none text-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>Search</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Quick Filters */}
            <div className="flex flex-wrap justify-center gap-4">
              {cities.map((city) => (
                <Link
                  key={city}
                  to={`/results?city=${encodeURIComponent(city)}`}
                  className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-6 py-3 rounded-full transition-all duration-200 hover:scale-105"
                >
                  <MapPin className="w-4 h-4 inline mr-2" />
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Popular Searches */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Popular Searches</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {popularSearches.map((search) => (
              <Link
                key={search}
                to={`/results?query=${encodeURIComponent(search)}`}
                className="bg-gray-100 hover:bg-primary-50 hover:text-primary-600 text-gray-700 px-6 py-3 rounded-full transition-all duration-200 hover:scale-105"
              >
                {search}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Venues */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Featured Venues</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our handpicked selection of premium venues perfect for any occasion
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-300"></div>
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredVenues.map((venue) => (
              <Link
                key={venue.id}
                to={`/venue/${venue.id}`}
                className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={venue.images[0]}
                    alt={venue.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-semibold">{venue.rating}</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {venue.name}
                  </h3>
                  <div className="flex items-center text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{venue.city}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-600">
                      <Users className="w-4 h-4 mr-1" />
                      <span>Up to {venue.capacity}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary-600">
                        ${venue.pricePerHour}
                      </span>
                      <span className="text-gray-500 text-sm">/hour</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {venue.amenities.slice(0, 3).map((amenity) => (
                      <span
                        key={amenity}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                    {venue.amenities.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{venue.amenities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            to="/results"
            className="inline-flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold transition-colors duration-200"
          >
            <span>View All Venues</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6 mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Why Choose Venue Concierge?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We make finding and booking the perfect venue effortless with cutting-edge technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-4">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">AI-Powered Search</h3>
              <p className="text-gray-600">
                Our intelligent search understands your needs and finds venues that perfectly match your vision.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-4">
              <div className="w-16 h-16 bg-secondary-100 rounded-2xl flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8 text-secondary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Curated Selection</h3>
              <p className="text-gray-600">
                Every venue is carefully vetted to ensure quality, reliability, and exceptional service.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-4">
              <div className="w-16 h-16 bg-accent-100 rounded-2xl flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-accent-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Expert Support</h3>
              <p className="text-gray-600">
                Get personalized recommendations and support from our venue experts throughout your journey.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;