import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Users, Star, ChevronRight, Clock, FileText, Calendar, Sparkles, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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

interface Inquiry {
  id: string;
  venueName: string;
  eventDate: string;
  status: 'pending' | 'confirmed' | 'declined';
  createdAt: string;
}

const Home: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredVenues, setFeaturedVenues] = useState<Venue[]>([]);
  const [recentInquiries, setRecentInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    fetchFeaturedVenues();
    if (isAuthenticated) {
      fetchRecentInquiries();
    }
  }, [isAuthenticated]);

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

  const fetchRecentInquiries = async () => {
    try {
      const mockInquiries: Inquiry[] = [
        {
          id: '1',
          venueName: 'Grand Ballroom Hotel',
          eventDate: '2025-10-15',
          status: 'pending',
          createdAt: '2025-09-20'
        },
        {
          id: '2',
          venueName: 'Sunset Garden Venue',
          eventDate: '2025-11-20',
          status: 'confirmed',
          createdAt: '2025-09-18'
        },
        {
          id: '3',
          venueName: 'Modern Conference Center',
          eventDate: '2025-12-05',
          status: 'declined',
          createdAt: '2025-09-15'
        }
      ];
      setRecentInquiries(mockInquiries);
    } catch (error) {
      console.error('Error fetching recent inquiries:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/results?query=${encodeURIComponent(searchQuery)}`);
  };

  const cities = ['New York', 'Chicago', 'Boston', 'Seattle'];
  const popularSearches = ['Wedding Venue', 'Corporate Event', 'Birthday Party', 'Conference Hall'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'declined':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen relative overflow-hidden">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-50" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E\")"}}></div>
      </div>
      {/* Recent Enquiries Section - Only for signed-in users */}
      {isAuthenticated && recentInquiries.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-400" />
                Recent Enquiries
              </h2>
              <Link
                to="/my-enquiries"
                className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors duration-200"
              >
                View All
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentInquiries.slice(0, 3).map((inquiry) => (
                <div key={inquiry.id} className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-purple-500/30 transition-all duration-200 hover:transform hover:scale-105">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-white text-sm">{inquiry.venueName}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(inquiry.status)}`}>
                      {inquiry.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Event: {new Date(inquiry.eventDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Submitted: {new Date(inquiry.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-screen">
        {/* Complex Animated Background */}
        <div className="absolute inset-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-gray-900 via-indigo-900 to-pink-900"></div>

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-yellow-500/10"></div>

          {/* Animated grid pattern */}
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23grid)'/%3E%3C/svg%3E\")"}}></div>

          {/* Multiple floating orbs */}
          <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-gradient-to-bl from-pink-500/25 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-cyan-500/15 to-transparent rounded-full blur-2xl animate-pulse delay-2000"></div>
          <div className="absolute top-10 right-1/4 w-48 h-48 bg-gradient-to-tl from-yellow-500/20 to-transparent rounded-full blur-2xl animate-pulse delay-3000"></div>
          <div className="absolute bottom-10 left-1/4 w-56 h-56 bg-gradient-to-tr from-indigo-500/18 to-transparent rounded-full blur-2xl animate-pulse delay-500"></div>

          {/* Moving geometric shapes */}
          <div className="absolute top-1/4 left-1/3 w-32 h-32 rotate-45 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl animate-spin" style={{animationDuration: '20s'}}></div>
          <div className="absolute bottom-1/3 right-1/3 w-24 h-24 rotate-12 bg-gradient-to-tl from-cyan-500/15 to-yellow-500/15 rounded-full animate-bounce" style={{animationDuration: '8s'}}></div>

          {/* Particle effect overlay */}
          <div className="absolute inset-0 opacity-60" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E\")"}}></div>

          {/* Gradient mesh animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-pulse delay-1500"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-500/5 to-transparent animate-pulse delay-2500"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center space-y-12">
            {/* Main Heading */}
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-6 py-2 text-sm">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-medium">AI-Powered Venue Discovery</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Find Your Perfect
                </span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-pulse">
                  Event Venue
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                Discover amazing venues with cutting-edge AI assistance. From intimate gatherings to grand celebrations, we'll find your perfect match.
              </p>
            </div>

            {/* Enhanced Search Bar */}
            <form onSubmit={handleSearch} className="max-w-4xl mx-auto">
              <div className="relative flex items-center bg-gray-800/50 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300">
                <div className="flex-1 flex items-center space-x-4 px-6">
                  <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg">
                    <Search className="w-6 h-6 text-purple-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search venues, locations, or event types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-white placeholder-gray-400 outline-none text-lg bg-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105 transform"
                >
                  <span>Search</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Quick City Search */}
            <div className="flex flex-wrap justify-center gap-4">
              {cities.map((city) => (
                <Link
                  key={city}
                  to={`/results?query=${encodeURIComponent(`venues in ${city}`)}`}
                  className="group bg-gray-800/30 backdrop-blur-sm hover:bg-gray-700/50 text-gray-300 hover:text-white px-6 py-3 rounded-full transition-all duration-200 hover:scale-105 transform border border-gray-700/50 hover:border-purple-500/30 shadow-lg"
                >
                  <MapPin className="w-4 h-4 inline mr-2 group-hover:text-purple-400 transition-colors" />
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-pink-500/5 rounded-3xl"></div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-8 bg-gray-800/30 backdrop-blur-xl rounded-2xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">10,000+</h3>
            <p className="text-gray-400">Premium Venues</p>
          </div>

          <div className="text-center p-8 bg-gray-800/30 backdrop-blur-xl rounded-2xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">50,000+</h3>
            <p className="text-gray-400">Happy Customers</p>
          </div>

          <div className="text-center p-8 bg-gray-800/30 backdrop-blur-xl rounded-2xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">4.9/5</h3>
            <p className="text-gray-400">Average Rating</p>
          </div>
        </div>
      </section>

      {/* Popular Searches */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Floating decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-gradient-to-tl from-yellow-500/10 to-transparent rounded-full blur-xl"></div>

        <div className="relative text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white">Popular Searches</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Discover what others are looking for and get inspired for your next event
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {popularSearches.map((search) => (
              <Link
                key={search}
                to={`/results?query=${encodeURIComponent(search)}`}
                className="group bg-gray-800/40 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 text-gray-300 hover:text-white px-8 py-4 rounded-2xl transition-all duration-200 hover:scale-105 transform border border-gray-700/50 hover:border-purple-500/30 shadow-lg"
              >
                <span className="font-medium">{search}</span>
                <ChevronRight className="w-4 h-4 inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="relative bg-gradient-to-r from-purple-800/50 to-pink-800/50 backdrop-blur-xl rounded-3xl p-12 text-center border border-purple-500/20 shadow-2xl overflow-hidden">
          {/* CTA Background Effects */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-pink-400/20 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-cyan-400/15 to-transparent rounded-full blur-xl animate-pulse"></div>
          <div className="relative space-y-6">
            <h2 className="text-4xl font-bold text-white">Ready to Find Your Perfect Venue?</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Join thousands of event planners who trust us to find their ideal venues. Start your search today and discover amazing spaces near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/results')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                Start Searching
              </button>
              <Link
                to="/auth"
                className="text-purple-300 hover:text-white transition-colors duration-200 font-medium"
              >
                or create an account to save favorites
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;