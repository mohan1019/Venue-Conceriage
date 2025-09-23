import React from 'react';
import { MessageCircle } from 'lucide-react';

interface Venue {
  venue_id: string;
  name: string;
  city: string;
  state: string;
}

interface EnquireWidgetProps {
  venue: Venue;
  onEnquire: () => void;
}

const EnquireWidget: React.FC<EnquireWidgetProps> = ({ venue, onEnquire }) => {
  const handleEnquire = () => {
    onEnquire();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <MessageCircle className="w-5 h-5 mr-2 text-primary-600" />
        Make Enquiry
      </h3>

      <div className="space-y-4">
        <button
          onClick={handleEnquire}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors"
        >
          Make Enquiry
        </button>

        <p className="text-xs text-gray-500 text-center">
          Get a personalized quote and discuss your event requirements
        </p>
      </div>
    </div>
  );
};

export default EnquireWidget;