// server/services/smsService.ts

export interface ISmsService {
  sendOtp(phoneNumber: string, otp: string): Promise<boolean>;
  sendAlert(phoneNumber: string, message: string): Promise<boolean>;
}

export class ConsoleMockSmsService implements ISmsService {
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    console.log(`\n=================================================`);
    console.log(`📱 [SMS GATEWAY MOCK] Verification Code`);
    console.log(`To: +91 ${phoneNumber}`);
    console.log(`Message: Your VioletLink verification code is ${otp}. Valid for 5 minutes.`);
    console.log(`=================================================\n`);
    return true;
  }

  async sendAlert(phoneNumber: string, message: string): Promise<boolean> {
    console.log(`\n📢 [SMS ALERT MOCK] To: ${phoneNumber} | Content: ${message}\n`);
    return true;
  }
}

export class Fast2SmsService implements ISmsService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          variables_values: otp,
          route: 'otp',
          numbers: phoneNumber
        })
      });
      const data = await response.json();
      return data.return === true;
    } catch (err) {
      console.error('Fast2SMS provider error:', err);
      return false;
    }
  }

  async sendAlert(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          language: 'english',
          route: 'q',
          numbers: phoneNumber
        })
      });
      const data = await response.json();
      return data.return === true;
    } catch (err) {
      console.error('Fast2SMS alert error:', err);
      return false;
    }
  }
}

export const smsService: ISmsService = process.env.SMS_GATEWAY_API_KEY
  ? new Fast2SmsService(process.env.SMS_GATEWAY_API_KEY)
  : new ConsoleMockSmsService();
