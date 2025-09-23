import 'dotenv/config';

export default class EnquiryProcessingAgent {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.emailJSConfig = {
      serviceId: 'service_7eyolgn',
      templateId: 'template_aqeen8x',
      userId: 'rITLsBAfHPUeBiii5'
    };
  }

  async prompt(message) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: message }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  }

  async composeEmail(enquiryData) {
    try {
      const { customer, event, requirements, venue } = enquiryData;

      const prompt = `Compose a professional email to a venue manager with this enquiry:

Customer: ${customer.name} (${customer.email}, ${customer.phone})
Event: ${event.type} on ${event.date} for ${event.guest_count} guests
Requirements: ${requirements}
Venue: ${venue.name}
Manager: ${venue.manager_name}

Write a courteous, clear email requesting availability, pricing, and services. Include all customer requirements and contact details.

Return ONLY the email content, no subject line or formatting.`;

      const emailContent = await this.prompt(prompt);
      return emailContent.trim();
    } catch (error) {
      console.error('Error composing email:', error);
      return 'Unable to compose email at this time.';
    }
  }

  async sendEmail(emailData) {
    try {
      const { venue_email, event_date, event_type, email_content, customer_name, customer_email } = emailData;

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: this.emailJSConfig.serviceId,
          template_id: this.emailJSConfig.templateId,
          user_id: this.emailJSConfig.userId,
          template_params: {
            to_email: venue_email,
            name: customer_name,
            reply_to: customer_email,
            subject: `Venue Enquiry — ${event_type} on ${event_date}`,
            message: email_content
          }
        })
      });

      if (!response.ok) {
        throw new Error(`EmailJS error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending email:', error);
      return { error: 'Failed to send email' };
    }
  }

  extractEnquiryData(enquiry) {
    const { customer, event, venue } = enquiry;

    return {
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      event_type: event.type,
      event_date: event.date,
      guest_count: event.guest_count,
      venue_name: venue.name,
      venue_email: venue.contact_email,
      manager_name: venue.manager_name
    };
  }

  async processEnquiry(enquiryData) {
    try {
      const { enquiry_id, customer, event, requirements, venue } = enquiryData;

      // Extract data from enquiry object
      const extractedData = this.extractEnquiryData({ customer, event, venue });

      // Compose email content
      const emailContent = await this.composeEmail({
        customer, event, requirements, venue
      });

      // Prepare email data
      const emailData = {
        venue_email: extractedData.venue_email,
        event_date: extractedData.event_date,
        event_type: extractedData.event_type,
        email_content: emailContent,
        customer_name: extractedData.customer_name,
        customer_email: extractedData.customer_email
      };

      // Send email
      const emailResult = await this.sendEmail(emailData);

      return {
        enquiry_id: enquiry_id,
        status: emailResult.error ? 'failed' : 'success',
        email_sent: !emailResult.error,
        email_content: emailContent,
        extracted_data: extractedData,
        email_result: emailResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error processing enquiry:', error);
      return {
        enquiry_id: enquiryData.enquiry_id,
        error: 'Failed to process enquiry',
        status: 'failed'
      };
    }
  }
}