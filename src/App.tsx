import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Results from './pages/Results';
import VenueDetail from './pages/VenueDetail';
import Inquiry from './pages/Inquiry';
import ChatDock from './components/ChatDock';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/venue/:id" element={<VenueDetail />} />
            <Route path="/inquiry/:venueId" element={<Inquiry />} />
          </Routes>
        </Layout>
        <ChatDock />
      </div>
    </Router>
  );
}

export default App;