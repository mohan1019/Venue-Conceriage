# Venue Concierge - SmythOS Integration API Documentation

## Overview
This document provides the API endpoints and integration details for SmythOS agents to interact with the Venue Concierge enquiry system. The system allows users to submit venue enquiries, which are then processed by SmythOS agents for intelligent responses and venue owner coordination.

## Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com` (replace with your actual domain)

## Authentication
Currently, no authentication is required for SmythOS agent endpoints. All requests should include:
```
Content-Type: application/json
```

---

## API Endpoints

### 1. Get Enquiry Details for Agent Processing

**Endpoint**: `GET /api/inquiries/agent-data/{enquiry_id}`

**Purpose**: Retrieve complete enquiry details for SmythOS agent processing

**Parameters**:
- `enquiry_id` (string, required): The unique identifier of the enquiry

**Response**:
```json
{
  "success": true,
  "enquiry": {
    "enquiry_id": "550e8400-e29b-41d4-a716-446655440000",
    "venue_id": "1ecf5405-2bf5-4acd-afbf-861ec68cb8be",
    "venue_name": "Renaissance Seattle Hotel",
    "venue_contact": {
      "email": "events@renaissanceseattle.com",
      "phone": "+1-206-583-0300",
      "manager_name": "Sarah Johnson",
      "address": "515 Madison St, Seattle, WA 98104",
      "website": "https://www.marriott.com/hotels/travel/searc-renaissance-seattle-hotel/"
    },
    "customer_details": {
      "name": "John Smith",
      "email": "john.smith@email.com",
      "phone": "+1-555-123-4567"
    },
    "event_details": {
      "date": "2025-12-15",
      "type": "Corporate Event",
      "guest_count": 150,
      "requirements": "Need a professional conference setup with AV equipment, catering for lunch, and breakout rooms for workshops. Budget range is $8,000-$12,000."
    },
    "status": "pending",
    "created_at": "2025-09-21T16:30:00.000Z",
    "negotiation_history": [
      {
        "timestamp": "2025-09-21T16:35:00.000Z",
        "type": "agent",
        "message": "Thank you for your enquiry. I'm analyzing your requirements..."
      }
    ]
  }
}
```

**Error Responses**:
```json
// 404 - Enquiry not found
{
  "error": "Enquiry not found"
}

// 500 - Server error
{
  "error": "Failed to fetch enquiry data"
}
```

---

### 2. Store/Update Enquiry Response

**Endpoint**: `POST /api/inquiries/agent-response`

**Purpose**: Update an enquiry with agent responses, venue owner responses, status changes, and negotiation data

**Request Body**:
```json
{
  "enquiry_id": "550e8400-e29b-41d4-a716-446655440000",
  "agent_response": "Based on your requirements for a corporate event with 150 guests, I've found that Renaissance Seattle Hotel is an excellent match. They have a 18,030 sq ft ballroom that can accommodate your needs with professional AV setup.",
  "venue_owner_response": "We'd be delighted to host your corporate event. We can offer our Grand Ballroom with full AV package and premium catering for $10,500. This includes setup, breakdown, and dedicated event coordinator.",
  "status": "negotiating",
  "recommendations": "Consider upgrading to the premium AV package which includes wireless microphones and presentation clickers. The venue also offers team-building activities in their adjacent meeting rooms.",
  "negotiation_data": {
    "price_quoted": 10500,
    "discount_offered": 5,
    "package_details": {
      "venue_rental": 6000,
      "catering_per_person": 25,
      "av_package": 1500,
      "service_charge": 15
    },
    "additional_services": [
      "Professional AV setup",
      "Dedicated event coordinator",
      "Premium catering menu",
      "Complimentary WiFi",
      "Parking validation"
    ],
    "terms": {
      "deposit_required": 2000,
      "cancellation_policy": "72 hours advance notice",
      "payment_terms": "50% deposit, 50% day of event"
    }
  }
}
```

**Required Fields**:
- `enquiry_id`: The unique identifier of the enquiry to update

**Optional Fields**:
- `agent_response`: Response message from the SmythOS agent
- `venue_owner_response`: Response message from the venue owner
- `status`: Updated status (`pending`, `confirmed`, `declined`, `negotiating`)
- `recommendations`: Additional recommendations for the customer
- `negotiation_data`: Structured data about pricing, packages, terms

**Response**:
```json
{
  "success": true,
  "message": "Enquiry updated successfully",
  "enquiry": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "negotiating",
    "updatedAt": "2025-09-21T16:45:00.000Z"
  }
}
```

**Error Responses**:
```json
// 400 - Missing required fields
{
  "error": "enquiry_id is required"
}

// 404 - Enquiry not found
{
  "error": "Enquiry not found"
}

// 500 - Server error
{
  "error": "Failed to update enquiry"
}
```

---

## Integration Workflow

### Step 1: Enquiry Submission
When a user submits an enquiry through the website:
1. System creates enquiry record
2. System calls SmythOS agent with enquiry details
3. Enquiry ID is generated and stored

### Step 2: Agent Processing
Your SmythOS agent should:
1. Receive enquiry notification with `enquiry_id`
2. Call `GET /api/inquiries/agent-data/{enquiry_id}` to get full details
3. Process the enquiry (analyze requirements, check venue compatibility, etc.)
4. Optionally contact venue owners through your system
5. Call `POST /api/inquiries/agent-response` to store response

### Step 3: User Notification
The system will:
1. Update the enquiry status in real-time
2. Display responses in user's "My Enquiries" page
3. Send notifications (if implemented)

---

## Data Models

### Enquiry Status Values
- `pending`: Initial status when enquiry is submitted
- `negotiating`: Agent or venue owner has responded, negotiation in progress
- `confirmed`: Venue booking confirmed
- `declined`: Enquiry declined by venue or customer

### Event Types
Common values include:
- `Wedding`
- `Corporate Event`
- `Conference`
- `Birthday Party`
- `Anniversary`
- `Baby Shower`
- `Graduation`
- `Holiday Party`
- `Networking Event`
- `Product Launch`
- `Other`

---

## Example Integration Code

### Python Example
```python
import requests
import json

# Get enquiry details
def get_enquiry_details(enquiry_id):
    url = f"http://localhost:3000/api/inquiries/agent-data/{enquiry_id}"
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error fetching enquiry: {response.status_code}")
        return None

# Update enquiry with response
def update_enquiry_response(enquiry_id, agent_response, status="negotiating"):
    url = "http://localhost:3000/api/inquiries/agent-response"

    payload = {
        "enquiry_id": enquiry_id,
        "agent_response": agent_response,
        "status": status,
        "recommendations": "Consider our premium package for better value"
    }

    response = requests.post(url,
                           headers={"Content-Type": "application/json"},
                           data=json.dumps(payload))

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error updating enquiry: {response.status_code}")
        return None

# Example usage
enquiry_data = get_enquiry_details("550e8400-e29b-41d4-a716-446655440000")
if enquiry_data:
    # Process the enquiry...
    response_message = "Thank you for your enquiry. We can accommodate your event!"
    update_enquiry_response(enquiry_data['enquiry']['enquiry_id'], response_message)
```

### JavaScript/Node.js Example
```javascript
const axios = require('axios');

// Get enquiry details
async function getEnquiryDetails(enquiryId) {
    try {
        const response = await axios.get(
            `http://localhost:3000/api/inquiries/agent-data/${enquiryId}`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching enquiry:', error.response?.status);
        return null;
    }
}

// Update enquiry with response
async function updateEnquiryResponse(enquiryId, agentResponse, status = 'negotiating') {
    try {
        const payload = {
            enquiry_id: enquiryId,
            agent_response: agentResponse,
            status: status,
            negotiation_data: {
                price_quoted: 8500,
                discount_offered: 10,
                additional_services: ['catering', 'av_equipment']
            }
        };

        const response = await axios.post(
            'http://localhost:3000/api/inquiries/agent-response',
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        return response.data;
    } catch (error) {
        console.error('Error updating enquiry:', error.response?.status);
        return null;
    }
}

// Example usage
async function processEnquiry(enquiryId) {
    const enquiry = await getEnquiryDetails(enquiryId);

    if (enquiry) {
        const eventDetails = enquiry.enquiry.event_details;
        const customerDetails = enquiry.enquiry.customer_details;

        // Process based on requirements...
        const response = `Hello ${customerDetails.name}, thank you for your ${eventDetails.type} enquiry for ${eventDetails.guest_count} guests. We have great options available!`;

        await updateEnquiryResponse(enquiryId, response);
    }
}
```

---

## Testing Endpoints

### Test with cURL

**Get enquiry details:**
```bash
curl -X GET "http://localhost:3000/api/inquiries/agent-data/YOUR_ENQUIRY_ID" \
     -H "Content-Type: application/json"
```

**Update enquiry:**
```bash
curl -X POST "http://localhost:3000/api/inquiries/agent-response" \
     -H "Content-Type: application/json" \
     -d '{
       "enquiry_id": "YOUR_ENQUIRY_ID",
       "agent_response": "Thank you for your enquiry. We have excellent options available!",
       "status": "negotiating"
     }'
```

---

## Error Handling

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (missing required fields)
- `404`: Not Found (enquiry doesn't exist)
- `500`: Internal Server Error

### Best Practices
1. Always check the `success` field in responses
2. Handle network timeouts gracefully
3. Implement retry logic for failed requests
4. Log all API interactions for debugging

---

## Support

For technical support or questions about this API:
- Check server logs for detailed error messages
- Ensure your requests include proper Content-Type headers
- Verify enquiry IDs are valid UUIDs
- Contact the development team with specific error messages and request details

---

## Changelog

### Version 1.0 (Current)
- Initial API release
- Basic enquiry retrieval and update functionality
- Support for agent responses and venue owner responses
- Negotiation history tracking
- Status management system