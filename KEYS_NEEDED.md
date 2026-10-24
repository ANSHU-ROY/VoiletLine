# VioletLink — API Keys & Accounts Checklist

VioletLink is architected with a **100% Zero-Key Mock Mode**.  
You can run the entire platform locally (`npm install && npm run dev`) without creating a single external account or adding any API key.

When you are ready to connect real external services, follow the numbered checklist below.

---

## Keys & Accounts Checklist

| # | Provider & Purpose | Signup URL | What to Copy | .env Variable | Type | Features That Stay in Mock Mode Until Added |
|---|---|---|---|---|---|---|
| **1** | **Razorpay Test Mode** (Payments & Refunds) | [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup) | In Dashboard: Switch to **Test Mode** (toggle on top bar) -> **Settings** -> **API Keys** -> **Generate Key**. Copy **Key Id** and **Key Secret**. | `RAZORPAY_KEY_ID`<br>`RAZORPAY_KEY_SECRET` | **OPTIONAL** | App uses embedded fake payment simulator with instant UPI/Card mock confirmation and mock refunds. |
| **2** | **Telegram Bot API** (Offline Driver Dispatch) | Open Telegram app, message [@BotFather](https://t.me/BotFather) | Send `/newbot`, choose a name and username. BotFather will reply with the HTTP API Token (e.g., `7123456789:ABCdef...`). | `TELEGRAM_BOT_TOKEN`<br>`TELEGRAM_DISPATCH_CHAT_ID` | **OPTIONAL** | App logs dispatch alerts to the server console and provides direct web audio TTS playout. |
| **3** | **Neon Cloud PostgreSQL** (Production DB) | [https://console.neon.tech/signup](https://console.neon.tech/signup) | Create a free project. From Dashboard, copy the connection string: `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`. | `DATABASE_URL` | **OPTIONAL** | App uses embedded SQLite (`violetlink.db`) with atomic WAL transactions and zero setup. |
| **4** | **Fast2SMS / 2Factor** (Real Phone OTP) | [https://www.fast2sms.com/](https://www.fast2sms.com/) | Sign up for free trial credits, copy the Authorization API Key from Dev API tab. | `SMS_GATEWAY_API_KEY` | **OPTIONAL** | App logs the 4-digit OTP to the developer terminal/browser console and auto-fills `1234` for rapid testing. |

---

## Summary of Defaults

- **Local Development Default:** ALL keys empty or missing.
- **Port Defaults:** `PORT=3000` (Unified Vite + Express API & Socket server).
- **Mock Flags:**
  ```env
  NODE_ENV=development
  MOCK_PAYMENTS=true
  MOCK_SMS=true
  MOCK_DISPATCH=true
  MOCK_TRAIN_CLOCK=true
  ```
