import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Results from './pages/Results';
import VenueDetail from './pages/VenueDetail';
import Inquiry from './pages/Inquiry';
import Auth from './pages/Auth';
import MyEnquiries from './pages/MyEnquiries';
import ChatDock from './components/ChatDock';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-900">
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/results" element={<Results />} />
              <Route path="/venue/:id" element={<VenueDetail />} />
              <Route path="/inquiry/:venueId" element={<Inquiry />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-enquiries" element={<MyEnquiries />} />
            </Routes>
          </Layout>
          <ChatDock />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;