// src/components/PaymentModal.tsx
import React, { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle2, ShieldCheck, QrCode, Smartphone,
  Wallet, ArrowRight, Sparkles, X, Download, Share2, AlertCircle, RefreshCw
} from 'lucide-react';
import { Ride } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: Ride;
  onPaymentSuccess: (data: { method: string; txnId: string; amount: number }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  ride,
  onPaymentSuccess
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'wallet' | 'cash'>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim'>('gpay');
  const [customUpiId, setCustomUpiId] = useState('');
  const [showQr, setShowQr] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState<number>(250);
  const [isToppingUp, setIsToppingUp] = useState(false);

  // Processing & Success
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Discount calculation
  const originalFare = ride.fare || 25;
  const subsidyDiscount = Math.min(5, Math.floor(originalFare * 0.15));
  const finalAmount = Math.max(15, originalFare - subsidyDiscount);

  // Fetch live wallet balance
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('violetlink_token');
    if (!token) return;

    fetch('/api/rider/wallet', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (typeof data.balance === 'number') setWalletBalance(data.balance);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Process UPI Payment
  const handleUpiPay = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    setProcessStep('Connecting to UPI Gateway (NPCI)...');

    try {
      await new Promise(r => setTimeout(r, 600));
      setProcessStep(`Authorizing with ${selectedUpiApp.toUpperCase()}...`);
      await new Promise(r => setTimeout(r, 800));

      const token = localStorage.getItem('violetlink_token');
      const res = await fetch('/api/rider/payments/upi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rideId: ride.id,
          amount: finalAmount,
          upiId: customUpiId || `commuter@${selectedUpiApp}`,
          upiApp: selectedUpiApp
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'UPI transaction failed');

      setProcessStep('Payment Verified! Generating e-receipt...');
      await new Promise(r => setTimeout(r, 400));

      setPaymentSuccess({
        method: `UPI (${selectedUpiApp.toUpperCase()})`,
        txnId: data.txnId,
        amount: finalAmount,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      });

      onPaymentSuccess({ method: 'upi', txnId: data.txnId, amount: finalAmount });
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment failed. Please try another method.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Process Wallet Payment
  const handleWalletPay = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    setProcessStep('Verifying VioletLink Smart Wallet...');

    try {
      await new Promise(r => setTimeout(r, 500));
      const token = localStorage.getItem('violetlink_token');
      const res = await fetch('/api/rider/payments/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rideId: ride.id,
          amount: finalAmount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wallet payment failed');

      setWalletBalance(data.newBalance);
      setPaymentSuccess({
        method: 'VioletLink Smart Wallet',
        txnId: data.txnId,
        amount: finalAmount,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        newBalance: data.newBalance
      });

      onPaymentSuccess({ method: 'wallet', txnId: data.txnId, amount: finalAmount });
    } catch (err: any) {
      setErrorMsg(err.message || 'Wallet transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Top up wallet
  const handleTopupWallet = async (amt: number) => {
    setIsToppingUp(true);
    try {
      const token = localStorage.getItem('violetlink_token');
      const res = await fetch('/api/rider/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amt })
      });
      const data = await res.json();
      if (res.ok) setWalletBalance(data.balance);
    } catch (err) {
      console.error(err);
    } finally {
      setIsToppingUp(false);
    }
  };

  // 3. Process Card / Razorpay Gateway Payment
  const handleCardPay = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    setProcessStep('Initiating Secure Razorpay Gateway...');

    try {
      const token = localStorage.getItem('violetlink_token');
      const orderRes = await fetch('/api/rider/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rideId: ride.id, amount: finalAmount })
      });
      const order = await orderRes.json();

      if (order.isMock || !(window as any).Razorpay) {
        // Fast mock verification with HMAC verification
        setProcessStep('Simulating Card 3D-Secure OTP...');
        await new Promise(r => setTimeout(r, 800));

        const verifyRes = await fetch('/api/rider/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            rideId: ride.id,
            razorpayOrderId: order.orderId,
            razorpayPaymentId: `pay_card_${Date.now()}`,
            razorpaySignature: 'mock_valid_signature',
            isMock: true
          })
        });

        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.error || 'Card verification failed');

        setPaymentSuccess({
          method: 'Razorpay Online Gateway (Debit/Credit Card)',
          txnId: vData.txnId || `pay_card_${Date.now()}`,
          amount: finalAmount,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        });
        onPaymentSuccess({ method: 'razorpay', txnId: vData.txnId, amount: finalAmount });
      } else {
        // Native Razorpay Checkout.js
        const options = {
          key: order.keyId,
          amount: order.amountPaisa,
          currency: 'INR',
          name: 'VioletLink Metro Last-Mile',
          description: `Fare payment for ride ${ride.id}`,
          order_id: order.orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch('/api/rider/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                rideId: ride.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                isMock: false
              })
            });
            const vData = await verifyRes.json();
            setPaymentSuccess({
              method: 'Razorpay Secure Gateway',
              txnId: response.razorpay_payment_id,
              amount: finalAmount,
              time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            });
            onPaymentSuccess({ method: 'razorpay', txnId: response.razorpay_payment_id, amount: finalAmount });
          }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gateway error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 animate-fadeIn">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-4 text-white flex items-center justify-between relative">
          <div>
            <div className="text-[10px] uppercase font-black tracking-widest text-violet-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" /> Digital Metro Pay
            </div>
            <h2 className="text-lg font-black tracking-tight">Pay for Ride</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* State 1: Payment Success E-Receipt */}
        {paymentSuccess ? (
          <div className="p-5 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <div className="text-xs uppercase font-extrabold text-emerald-700 tracking-wider">Payment Confirmed</div>
              <h3 className="text-3xl font-black text-slate-900 mt-1">₹{paymentSuccess.amount}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Driver notified instantly with audio receipt</p>
            </div>

            {/* Detailed E-Receipt Card */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-500 pb-1.5 border-b border-slate-200 text-[11px]">
                <span>Transaction Ref:</span>
                <span className="font-mono font-bold text-slate-800">{paymentSuccess.txnId}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Method:</span>
                <span className="font-extrabold text-violet-700">{paymentSuccess.method}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pickup:</span>
                <span className="font-semibold text-slate-900">{ride.station_slug.toUpperCase()} &bull; Gate {ride.gate_id}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Drop:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[170px]">{ride.drop_address}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                <span>Time:</span>
                <span>{paymentSuccess.date} at {paymentSuccess.time}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  alert(`🧾 Digital receipt for ₹${paymentSuccess.amount} copied to clipboard! Ref: ${paymentSuccess.txnId}`);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-violet-200 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Payment Method Selection & Checkout */
          <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
            {/* Fare Breakdown Card */}
            <div className="bg-violet-50/80 border border-violet-100 rounded-2xl p-3">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-violet-200/60">
                <span className="text-slate-600">Ride Transit Fare</span>
                <span className="font-bold text-slate-800">₹{originalFare}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 text-emerald-700 font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> DMRC Green Corridor Offer
                </span>
                <span>-₹{subsidyDiscount}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-violet-200/60 font-black">
                <span className="text-slate-900">Total Payable</span>
                <span className="text-base text-violet-700">₹{finalAmount}</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                className={`py-2 rounded-xl transition flex flex-col items-center gap-0.5 ${
                  selectedMethod === 'upi' ? 'bg-white text-violet-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>UPI Pay</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('wallet')}
                className={`py-2 rounded-xl transition flex flex-col items-center gap-0.5 ${
                  selectedMethod === 'wallet' ? 'bg-white text-violet-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`py-2 rounded-xl transition flex flex-col items-center gap-0.5 ${
                  selectedMethod === 'card' ? 'bg-white text-violet-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('cash')}
                className={`py-2 rounded-xl transition flex flex-col items-center gap-0.5 ${
                  selectedMethod === 'cash' ? 'bg-white text-violet-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                <span className="text-xs">💵</span>
                <span>Cash</span>
              </button>
            </div>

            {/* TAB 1: UPI PAYMENT */}
            {selectedMethod === 'upi' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Choose Instant UPI App</span>
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className="text-[11px] text-violet-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <QrCode className="w-3 h-3" /> {showQr ? 'Hide QR' : 'Show QR Code'}
                  </button>
                </div>

                {/* UPI QR Display */}
                {showQr && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2 animate-fadeIn">
                    <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-300 shadow-sm flex items-center justify-center">
                      <div className="text-center font-mono text-[10px] text-slate-500">
                        <QrCode className="w-24 h-24 mx-auto text-slate-900 mb-1" />
                        Scan with Any UPI App
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-700">
                      Amount: ₹{finalAmount} &bull; VPA: <span className="font-mono text-violet-700">dmrc.violetlink@icici</span>
                    </div>
                  </div>
                )}

                {/* Popular UPI Apps Picker */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'gpay', label: 'Google Pay', icon: '🌐', color: 'border-blue-500 bg-blue-50/50' },
                    { id: 'phonepe', label: 'PhonePe', icon: '🟣', color: 'border-purple-500 bg-purple-50/50' },
                    { id: 'paytm', label: 'Paytm UPI', icon: '💠', color: 'border-sky-500 bg-sky-50/50' },
                    { id: 'bhim', label: 'BHIM UPI', icon: '🇮🇳', color: 'border-emerald-500 bg-emerald-50/50' }
                  ].map(app => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedUpiApp(app.id as any)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition ${
                        selectedUpiApp === app.id
                          ? `${app.color} border-2 shadow-sm font-black text-slate-900`
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="text-base">{app.icon}</span>
                      <div className="text-xs font-bold">{app.label}</div>
                    </button>
                  ))}
                </div>

                {/* Or Custom VPA */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Or Enter Any UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={customUpiId}
                    onChange={e => setCustomUpiId(e.target.value)}
                    placeholder="e.g. mobile@upi or name@okhdfcbank"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Pay Action Button */}
                <button
                  type="button"
                  onClick={handleUpiPay}
                  disabled={isProcessing}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-violet-200 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {processStep}
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{finalAmount} via {selectedUpiApp.toUpperCase()}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: VIOLETLINK SMART WALLET */}
            {selectedMethod === 'wallet' && (
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md">
                  <div className="flex items-center justify-between text-xs opacity-80">
                    <span>VioletLink Metro Card Balance</span>
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black mt-1">₹{walletBalance.toFixed(2)}</div>
                  <div className="text-[10px] text-violet-200 mt-1">
                    Instant 1-tap checkout for daily metro commuters
                  </div>
                </div>

                {/* Top Up Fast Buttons */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Quick Top-Up</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[100, 200, 500].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleTopupWallet(amt)}
                        disabled={isToppingUp}
                        className="py-1.5 border border-violet-200 hover:border-violet-400 bg-violet-50/50 rounded-xl text-xs font-bold text-violet-700 transition"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {walletBalance < finalAmount ? (
                  <div className="text-center text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    Wallet balance is lower than ₹{finalAmount}. Please tap +100 above to top up.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleWalletPay}
                    disabled={isProcessing}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-violet-200 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {processStep}
                      </>
                    ) : (
                      <>
                        <span>Pay ₹{finalAmount} with 1-Tap</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* TAB 3: CARDS & RAZORPAY GATEWAY */}
            {selectedMethod === 'card' && (
              <div className="space-y-3">
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm text-xs font-mono space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>VIOLETLINK TRANSIT PASS</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-sm font-black tracking-widest pt-1">•••• •••• •••• 4242</div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                    <span>EXP: 12/28</span>
                    <span>CVV: •••</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  Supports Visa, Mastercard, RuPay & NetBanking via Razorpay 256-bit SSL encrypted checkout.
                </div>

                <button
                  type="button"
                  onClick={handleCardPay}
                  disabled={isProcessing}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {processStep}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-3.5 h-3.5" /> Pay ₹{finalAmount} via Razorpay
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 4: CASH ON ARRIVAL */}
            {selectedMethod === 'cash' && (
              <div className="space-y-3 text-center p-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-xl">
                  💵
                </div>
                <div className="text-xs font-bold text-slate-900">Pay Driver in Cash on Drop</div>
                <p className="text-[11px] text-slate-500">
                  Please hand over exact change of <strong>₹{originalFare}</strong> to the auto driver at your destination.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
                >
                  Confirm Cash on Arrival
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
