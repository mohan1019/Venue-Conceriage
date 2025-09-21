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
    </div>
  );
};

export default Home;