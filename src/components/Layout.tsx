import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Calendar } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center group-hover:bg-primary-600 transition-colors duration-200">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Venue Concierge</h1>
                <p className="text-xs text-gray-500">Find Your Perfect Event Space</p>
              </div>
            </Link>

            <nav className="hidden md:flex space-x-8">
              <Link 
                to="/" 
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  location.pathname === '/' 
                    ? 'text-primary-600 bg-primary-50' 
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Browse Venues</span>
              </Link>
              
              <a 
                href="#"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
              >
                <Calendar className="w-4 h-4" />
                <span>My Events</span>
              </a>
            </nav>

            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-primary-600 transition-colors duration-200">
                Sign In
              </button>
              <button className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors duration-200">
                List Your Venue
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <MapPin className="w-6 h-6 text-primary-400" />
                <span className="font-bold">Venue Concierge</span>
              </div>
              <p className="text-gray-400 text-sm">
                Discover and book the perfect venue for your next event with AI-powered assistance.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">For Event Planners</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Browse Venues</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AI Assistant</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing Calculator</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Event Planning Tips</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">For Venue Owners</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">List Your Venue</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Management Tools</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Analytics</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Venue Concierge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;