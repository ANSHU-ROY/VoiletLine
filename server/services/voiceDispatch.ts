// server/services/voiceDispatch.ts
import fs from 'fs';
import path from 'path';
import { PodEngine } from './podEngine.js';

export interface DispatchNotification {
  podId: string;
  stationName: string;
  gateNumber: number;
  dropZoneName: string;
  seatCount: number;
  totalFare: number;
  hindiText: string;
  audioFilePath?: string;
}

export class VoiceDispatchService {
  private podEngine: PodEngine;
  private telegramToken?: string;
  private chatId?: string;
  private audioDir: string;

  constructor(podEngine: PodEngine) {
    this.podEngine = podEngine;
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_DISPATCH_CHAT_ID;
    this.audioDir = path.resolve(process.cwd(), 'uploads', 'dispatch-audio');

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  /**
   * Compose Hindi voice dispatch prompt
   */
  createHindiText(stationName: string, gateId: number, dropZoneName: string, fare: number): string {
    return `नमस्ते ड्राइवर भाई! ${stationName} गेट ${gateId} से ${dropZoneName} के लिए नया राइड पॉड तैयार है। कुल किराया ₹${fare}। स्वीकार करने के लिए 1 भेजें।`;
  }

  /**
   * Synthesize Hindi TTS audio and trigger Telegram broadcast
   */
  async dispatchLockedPod(podId: string, stationName: string, gateId: number, dropZoneName: string, fare: number) {
    const hindiText = this.createHindiText(stationName, gateId, dropZoneName, fare);
    const audioFileName = `dispatch-${podId}.mp3`;
    const audioFilePath = path.join(this.audioDir, audioFileName);

    console.log(`\n======================================================`);
    console.log(`📢 [VOICE DISPATCH] Pod ${podId} Locked! Triggering Dispatch`);
    console.log(`Station: ${stationName} (Gate ${gateId}) -> ${dropZoneName}`);
    console.log(`Fare: ₹${fare}`);
    console.log(`Hindi Prompt: "${hindiText}"`);

    // Fetch free Google TTS MP3 audio
    try {
      const encoded = encodeURIComponent(hindiText);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encoded}`;
      const res = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(audioFilePath, Buffer.from(buffer));
        console.log(`🔊 [VOICE TTS] Saved audio file to: ${audioFilePath}`);
      }
    } catch (err) {
      console.log('TTS download fallback: audio synthesis bypassed.');
    }

    // Telegram Bot dispatch
    if (this.telegramToken && this.chatId && !process.env.MOCK_DISPATCH) {
      try {
        await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: `🚖 *VioletLink नया राइड अलर्ट*\n\n📍 *स्टेशन:* ${stationName} (गेट ${gateId})\n🏁 *ड्रॉप:* ${dropZoneName}\n💰 *कुल किराया:* ₹${fare}\n\nपॉड लेने के लिए *1* लिखकर भेजें!`,
            parse_mode: 'Markdown'
          })
        });
        console.log(`✈️ [TELEGRAM DISPATCH] Dispatched to Telegram Chat ID ${this.chatId}`);
      } catch (err) {
        console.error('Telegram dispatch error:', err);
      }
    } else {
      console.log(`🤖 [TELEGRAM MOCK] Dispatch logged to console (Mock active). First reply '1' wins.`);
    }
    console.log(`======================================================\n`);

    return {
      podId,
      hindiText,
      audioUrl: fs.existsSync(audioFilePath) ? `/uploads/dispatch-audio/${audioFileName}` : null
    };
  }

  /**
   * Driver replies "1" via Telegram or SMS fallback
   */
  handleDriverReply(driverId: string, podId: string, replyText: string) {
    if (replyText.trim() === '1') {
      const claimResult = this.podEngine.claimPodAtomic(podId, driverId);
      return claimResult;
    }
    return { success: false, error: 'Invalid reply code. Send "1" to accept.' };
  }
}
