import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Users, Star, Calendar, DollarSign, CheckCircle, MessageCircle } from 'lucide-react';
import QuoteWidget from '../components/QuoteWidget';
import AskAI from '../components/AskAI';
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
  availableDates: string[];
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-96 bg-gray-300 rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-6 bg-gray-300 rounded"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-64 bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Venue not found</h1>
        <Link
          to="/results"
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Browse Venues
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link to="/" className="hover:text-primary-600">Home</Link></li>
          <li>/</li>
          <li><Link to="/results" className="hover:text-primary-600">Venues</Link></li>
          <li>/</li>
          <li className="text-gray-900">{venue.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Image Gallery */}
          <div className="mb-8">
            <div className="relative h-96 rounded-2xl overflow-hidden mb-4">
              <img
                src={venue.images[selectedImage]}
                alt={venue.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {selectedImage + 1} / {venue.images.length}
              </div>
            </div>
            {venue.images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {venue.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden ${
                      selectedImage === index ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${venue.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Venue Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{venue.name}</h1>
              
              <div className="flex items-center space-x-6 text-gray-600 mb-6">
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  <span>{venue.city}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  <span>Up to {venue.capacity} guests</span>
                </div>
                <div className="flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-400 fill-current" />
                  <span>{venue.rating} rating</span>
                </div>
              </div>

              <div className="bg-primary-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-bold text-primary-600">
                      ${venue.pricePerHour}
                    </span>
                    <span className="text-gray-600 ml-2">per hour</span>
                  </div>
                  <div className="text-right">
                    <Link
                      to={`/inquiry/${venue.id}`}
                      className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {venue.amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Dates */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Available Dates</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {venue.availableDates.slice(0, 8).map((date) => (
                  <div key={date} className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <Calendar className="w-5 h-5 text-green-600 mx-auto mb-2" />
                    <span className="text-sm font-medium text-green-800">
                      {new Date(date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask AI Panel */}
            <div className="bg-gray-50 rounded-lg p-6">
              <button
                onClick={() => setShowAskAI(!showAskAI)}
                className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Ask AI about this venue</span>
              </button>
              {showAskAI && (
                <div className="mt-4">
                  <AskAI venueId={venue.id} venueName={venue.name} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quote Widget */}
          <QuoteWidget venue={venue} />

          {/* Featured Services Ads */}
          {ads.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Featured Services</h3>
              <div className="space-y-4">
                {ads.slice(0, 3).map((ad) => (
                  <a
                    key={ad.id}
                    href={ad.clickUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:bg-gray-50 p-3 rounded-lg transition-colors -m-3"
                  >
                    <div className="flex space-x-3">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {ad.title}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{ad.kind}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueDetail;