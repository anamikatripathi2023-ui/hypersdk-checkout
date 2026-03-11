import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface CardData { number: string; expiry: string; cvv: string; name: string; saveCard: boolean; }
interface SavedCard { token: string; last4: string; network: string; expiry: string; bank: string; color: string; }
interface TokenResult { token: string; last4: string; network: string; expiry: string; }
interface CardErrors { number?: string; expiry?: string; cvv?: string; name?: string; }
interface Product { id: number; name: string; category: string; price: number; img: string; rating: number; reviews: number; }
interface PayResult { ok: boolean; method?: string; }
type FlowState = "idle" | "processing" | "success" | "failed";

// ─── TOKEN VAULT ──────────────────────────────────────────────────────────────
const TokenVault = {
  tokenize: (cardData: CardData): TokenResult => {
    const token = "tok_" + Math.random().toString(36).slice(2, 14).toUpperCase();
    return { token, last4: cardData.number.slice(-4), network: detectNetwork(cardData.number), expiry: cardData.expiry };
  },
  savedCards: [
    { token: "tok_SAVEDHDFC4242", last4: "4242", network: "visa",       expiry: "12/26", bank: "HDFC Bank", color: "#1a3c8f" },
    { token: "tok_SAVEDAXIS5678", last4: "5678", network: "mastercard", expiry: "08/25", bank: "Axis Bank", color: "#8B0000" },
    { token: "tok_SAVEDRUPAY91",  last4: "9100", network: "rupay",      expiry: "03/27", bank: "SBI Card",  color: "#1a6b3c" },
  ] as SavedCard[],
};

function detectNetwork(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]|^2[2-7]/.test(n)) return "mastercard";
  if (/^6[0-9]{15}/.test(n) || /^508[5-9]|^60698|^6521|^6522/.test(n)) return "rupay";
  if (/^3[47]/.test(n)) return "amex";
  return "unknown";
}

function formatCardNumber(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function validateCard(form: CardData): CardErrors {
  const errors: CardErrors = {};
  const num = form.number.replace(/\s/g, "");
  if (num.length < 15) errors.number = "Invalid card number";
  if (!form.expiry.match(/^\d{2}\/\d{2}$/)) errors.expiry = "MM/YY";
  else {
    const [m, y] = form.expiry.split("/").map(Number);
    const now = new Date(); const ym = now.getFullYear() % 100; const mm = now.getMonth() + 1;
    if (m < 1 || m > 12 || y < ym || (y === ym && m < mm)) errors.expiry = "Card expired";
  }
  if (form.cvv.length < 3) errors.cvv = "Invalid";
  if (form.name.trim().length < 2) errors.name = "Enter name";
  return errors;
}

function validateUPI(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(vpa.trim());
}

// ─── NETWORK BADGE ────────────────────────────────────────────────────────────
const NetworkBadge = ({ network, size = 28 }: { network: string; size?: number }) => {
  const cfg: Record<string, { bg: string; text: string; label: string; italic?: boolean }> = {
    visa:       { bg: "#1A1F71", text: "#fff", label: "VISA", italic: true },
    mastercard: { bg: "#EB001B", text: "#fff", label: "MC" },
    rupay:      { bg: "#1a6b3c", text: "#fff", label: "RuPay" },
    amex:       { bg: "#007BC1", text: "#fff", label: "AMEX" },
    unknown:    { bg: "#27272A", text: "#71717A", label: "CARD" },
  };
  const c = cfg[network] ?? cfg["unknown"];
  return (
    <div style={{ width: size * 1.6, height: size, background: c.bg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: c.text, fontSize: size * 0.38, fontWeight: 800, fontStyle: c.italic ? "italic" : "normal", letterSpacing: "-0.02em" }}>{c.label}</span>
    </div>
  );
};

// ─── WALLETS ──────────────────────────────────────────────────────────────────
const WALLETS = [
  { id: "gpay",    name: "Google Pay",  color: "#4285F4", icon: "G", sub: "UPI" },
  { id: "phonepe", name: "PhonePe",     color: "#5F259F", icon: "P", sub: "UPI" },
  { id: "paytm",   name: "Paytm",       color: "#00BAF2", icon: "₽", sub: "Wallet" },
  { id: "amazon",  name: "Amazon Pay",  color: "#FF9900", icon: "a", sub: "Wallet" },
  { id: "cred",    name: "CRED Pay",    color: "#1C1C1C", icon: "C", sub: "Pay Later" },
  { id: "slice",   name: "Slice",       color: "#8B5CF6", icon: "S", sub: "Pay Later" },
];

// ─── CARD PREVIEW ─────────────────────────────────────────────────────────────
const CardPreview = ({ form }: { form: CardData }) => {
  const net = detectNetwork(form.number);
  const gradients: Record<string, string> = {
    visa: "135deg, #1a237e, #1565c0", mastercard: "135deg, #8B0000, #c62828",
    rupay: "135deg, #1a3c1a, #2e7d32", amex: "135deg, #01579b, #0288d1", unknown: "135deg, #18181b, #27272a",
  };
  return (
    <div style={{ width: "100%", maxWidth: 300, height: 170, borderRadius: 14, background: `linear-gradient(${gradients[net] ?? gradients["unknown"]})`, padding: "18px 22px", position: "relative", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", bottom: -40, left: -20, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ width: 36, height: 28, background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: 4, opacity: 0.9 }} />
        <NetworkBadge network={net} size={24} />
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 17, color: "#fff", letterSpacing: "0.18em", marginBottom: 16, opacity: 0.95 }}>
        {(form.number || "•••• •••• •••• ••••").padEnd(19, "•").slice(0, 19)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", marginBottom: 2 }}>CARD HOLDER</div>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{form.name || "YOUR NAME"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", marginBottom: 2 }}>EXPIRES</div>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{form.expiry || "MM/YY"}</div>
        </div>
      </div>
    </div>
  );
};

// ─── FIELD ────────────────────────────────────────────────────────────────────
const Field = ({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 11, color: error ? "#f87171" : "#71717A", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>
    {children}
    {error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{error}</div>}
    {hint && !error && <div style={{ fontSize: 11, color: "#52525B", marginTop: 4 }}>{hint}</div>}
  </div>
);

const inputBase = (error: boolean, focused: boolean) => ({
  width: "100%", padding: "11px 13px",
  background: focused ? "#18181B" : "#111113",
  border: `1px solid ${error ? "#f87171" : focused ? "#6366f1" : "#27272A"}`,
  borderRadius: 8, color: "#FAFAFA" as const, fontSize: 14, outline: "none",
  transition: "all 0.15s", fontFamily: "inherit", letterSpacing: "0.02em", boxSizing: "border-box" as const,
});

// ─── PROCESSING STATE ─────────────────────────────────────────────────────────
const ProcessingState = ({ state, amount }: { state: FlowState; amount: string }) => {
  const msgs = ["Encrypting card data...", "Connecting to bank...", "Authenticating...", "Confirming payment..."];
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 700);
    return () => clearInterval(t);
  }, [state]);

  if (state === "processing") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", gap: 20 }}>
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg width="72" height="72" style={{ position: "absolute", top: 0, left: 0, animation: "spin 1s linear infinite" }}>
          <circle cx="36" cy="36" r="30" fill="none" stroke="#27272A" strokeWidth="3" />
          <circle cx="36" cy="36" r="30" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="60 130" strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔐</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#FAFAFA", marginBottom: 6 }}>Processing ₹{amount}</div>
        <div style={{ fontSize: 13, color: "#71717A", minHeight: 20 }}>{msgs[msgIdx]}</div>
      </div>
    </div>
  );

  if (state === "success") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>✓</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#FAFAFA", marginBottom: 4 }}>Payment Successful!</div>
        <div style={{ fontSize: 14, color: "#71717A" }}>₹{amount} paid</div>
        <div style={{ fontSize: 11, color: "#52525B", marginTop: 8, fontFamily: "'Courier New', monospace" }}>TXN#{Math.random().toString(36).toUpperCase().slice(2, 12)}</div>
      </div>
      <div style={{ marginTop: 8, padding: "8px 16px", background: "#10b98120", border: "1px solid #10b98140", borderRadius: 6, fontSize: 12, color: "#10b981" }}>Token saved for future 1-click payments</div>
    </div>
  );

  if (state === "failed") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #ef4444, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>✕</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#FAFAFA", marginBottom: 4 }}>Payment Failed</div>
        <div style={{ fontSize: 14, color: "#71717A" }}>Bank declined the transaction</div>
        <div style={{ fontSize: 12, color: "#52525B", marginTop: 4 }}>Error: INSUFFICIENT_FUNDS</div>
      </div>
    </div>
  );
  return null;
};

// ─── CHECKOUT SHEET (SDK) ─────────────────────────────────────────────────────
interface CheckoutSheetProps {
  isOpen: boolean; onClose: () => void; amount: number; merchant: string;
  onSuccess?: (method: string) => void; onFailure?: () => void;
}

function CheckoutSheet({ isOpen, onClose, amount, merchant, onSuccess, onFailure }: CheckoutSheetProps) {
  const [tab, setTab] = useState("saved");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [cardForm, setCardForm] = useState<CardData>({ number: "", expiry: "", cvv: "", name: "", saveCard: true });
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [upiVpa, setUpiVpa] = useState("");
  const [upiValid, setUpiValid] = useState<boolean | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedCard>(TokenVault.savedCards[0]);
  const [savedCvv, setSavedCvv] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setFlow("idle"); setCardForm({ number: "", expiry: "", cvv: "", name: "", saveCard: true });
    setCardErrors({}); setUpiVpa(""); setUpiValid(null);
    setSelectedWallet(null); setSelectedSaved(TokenVault.savedCards[0]); setSavedCvv(""); setTab("saved");
  };

  useEffect(() => { if (!isOpen) { setTimeout(reset, 400); } }, [isOpen]);

  const handleUpiChange = (val: string) => {
    setUpiVpa(val);
    if (val.length > 5) setUpiValid(validateUPI(val));
    else setUpiValid(null);
  };

  const simulate = useCallback((methodLabel: string) => {
    setFlow("processing");
    setTimeout(() => {
      const ok = Math.random() > 0.2;
      setFlow(ok ? "success" : "failed");
      if (ok) onSuccess?.(methodLabel);
      else onFailure?.();
    }, 2800);
  }, [onSuccess, onFailure]);

  const payCard = () => {
    const errors = validateCard(cardForm);
    if (Object.keys(errors).length) { setCardErrors(errors); return; }
    simulate(`Card •••• ${cardForm.number.slice(-4)}`);
  };

  const paySaved = () => { if (savedCvv.length < 3) return; simulate(`Saved Card •••• ${selectedSaved.last4}`); };
  const payUpi = () => { if (!upiValid) return; simulate(`UPI ${upiVpa}`); };
  const payWallet = () => { if (!selectedWallet) return; simulate(WALLETS.find(w => w.id === selectedWallet)?.name ?? "Wallet"); };

  const tabs = [
    { id: "saved", label: "⚡ Saved", badge: TokenVault.savedCards.length },
    { id: "card",    label: "💳 Card" },
    { id: "upi",     label: "📱 UPI" },
    { id: "wallets", label: "👛 Wallets" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, opacity: isOpen ? 1 : 0, transition: "opacity 0.3s", pointerEvents: isOpen ? "auto" : "none", backdropFilter: "blur(4px)" }} />
      <div ref={sheetRef} style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: "#0C0C0F", borderRadius: "20px 20px 0 0", border: "1px solid #27272A", borderBottom: "none", transform: isOpen ? "translateY(0)" : "translateY(100%)", transition: "transform 0.4s cubic-bezier(0.34, 1.1, 0.64, 1)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3F3F46" }} />
        </div>

        <div style={{ padding: "12px 20px 14px", borderBottom: "1px solid #18181B", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#52525B", letterSpacing: "0.1em", marginBottom: 2 }}>SECURE CHECKOUT</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#FAFAFA" }}>{merchant}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#71717A" }}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FAFAFA", letterSpacing: "-0.02em" }}>₹{amount.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ padding: "6px 20px", background: "#0a1628", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #0d2040" }}>
          <span style={{ fontSize: 11 }}>🔒</span>
          <span style={{ fontSize: 10, color: "#3b82f6", letterSpacing: "0.06em" }}>256-bit SSL encrypted · PCI-DSS Level 1 · Powered by HyperSDK</span>
        </div>

        {flow === "idle" ? (
          <>
            <div style={{ display: "flex", borderBottom: "1px solid #18181B", overflowX: "auto", flexShrink: 0 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: "1 0 auto", padding: "12px 8px", background: "transparent", border: "none", borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent", color: tab === t.id ? "#6366f1" : "#71717A", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {t.label}
                  {t.badge && <span style={{ fontSize: 10, background: "#6366f1", color: "#fff", borderRadius: 10, padding: "1px 5px" }}>{t.badge}</span>}
                </button>
              ))}
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>

              {tab === "saved" && (
                <div>
                  <div style={{ fontSize: 12, color: "#52525B", marginBottom: 12 }}>Securely tokenized cards</div>
                  {TokenVault.savedCards.map(card => (
                    <div key={card.token} onClick={() => setSelectedSaved(card)} style={{ padding: "12px 14px", marginBottom: 8, borderRadius: 10, border: `1px solid ${selectedSaved?.token === card.token ? "#6366f1" : "#27272A"}`, background: selectedSaved?.token === card.token ? "#6366f120" : "#111113", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${selectedSaved?.token === card.token ? "#6366f1" : "#52525B"}`, background: selectedSaved?.token === card.token ? "#6366f1" : "transparent", flexShrink: 0 }} />
                      <div style={{ width: 36, height: 24, borderRadius: 4, background: card.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <NetworkBadge network={card.network} size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#E4E4E7" }}>•••• •••• •••• {card.last4}</div>
                        <div style={{ fontSize: 11, color: "#71717A" }}>{card.bank} · Expires {card.expiry}</div>
                      </div>
                    </div>
                  ))}
                  {selectedSaved && (
                    <div style={{ marginTop: 16 }}>
                      <Field label="CVV" error={savedCvv.length > 0 && savedCvv.length < 3 ? "Invalid CVV" : undefined} hint="3-digit code on back">
                        <input type="password" maxLength={4} value={savedCvv} onChange={e => setSavedCvv(e.target.value.replace(/\D/g, ""))} placeholder="•••" style={{ ...inputBase(savedCvv.length > 0 && savedCvv.length < 3, focusedField === "scvv"), width: 100 }} onFocus={() => setFocusedField("scvv")} onBlur={() => setFocusedField(null)} />
                      </Field>
                      <button onClick={paySaved} style={{ width: "100%", padding: "14px", background: savedCvv.length >= 3 ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#27272A", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: savedCvv.length >= 3 ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
                        ⚡ Pay ₹{amount.toLocaleString()} in 1 Click
                      </button>
                      <div style={{ textAlign: "center", fontSize: 11, color: "#52525B", marginTop: 8 }}>No OTP needed for saved cards</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "card" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                    <CardPreview form={cardForm} />
                  </div>
                  <Field label="CARD NUMBER" error={cardErrors.number}>
                    <div style={{ position: "relative" }}>
                      <input value={cardForm.number} onChange={e => setCardForm(f => ({ ...f, number: formatCardNumber(e.target.value) }))} onFocus={() => setFocusedField("number")} onBlur={() => setFocusedField(null)} placeholder="1234 5678 9012 3456" style={{ ...inputBase(!!cardErrors.number, focusedField === "number"), fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", paddingRight: 50 }} inputMode="numeric" />
                      <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}><NetworkBadge network={detectNetwork(cardForm.number)} size={20} /></div>
                    </div>
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="EXPIRY" error={cardErrors.expiry}>
                      <input value={cardForm.expiry} onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))} onFocus={() => setFocusedField("expiry")} onBlur={() => setFocusedField(null)} placeholder="MM/YY" style={{ ...inputBase(!!cardErrors.expiry, focusedField === "expiry"), fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }} inputMode="numeric" />
                    </Field>
                    <Field label="CVV" error={cardErrors.cvv}>
                      <input type="password" maxLength={4} value={cardForm.cvv} onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, "") }))} onFocus={() => setFocusedField("cvv")} onBlur={() => setFocusedField(null)} placeholder="•••" style={{ ...inputBase(!!cardErrors.cvv, focusedField === "cvv"), fontFamily: "'Courier New', monospace", letterSpacing: "0.2em" }} />
                    </Field>
                  </div>
                  <Field label="NAME ON CARD" error={cardErrors.name}>
                    <input value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)} placeholder="AS ON CARD" style={{ ...inputBase(!!cardErrors.name, focusedField === "name"), textTransform: "uppercase", letterSpacing: "0.05em" }} />
                  </Field>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }} onClick={() => setCardForm(f => ({ ...f, saveCard: !f.saveCard }))}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${cardForm.saveCard ? "#6366f1" : "#3F3F46"}`, background: cardForm.saveCard ? "#6366f1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}>
                      {cardForm.saveCard && <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "#A1A1AA" }}>Save card for 1-click future payments (tokenized, never stored raw)</span>
                  </div>
                  <button onClick={payCard} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #6366f1, #4f46e5)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Pay ₹{amount.toLocaleString()} Securely
                  </button>
                </div>
              )}

              {tab === "upi" && (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
                    {["gpay", "phonepe", "paytm"].map(id => {
                      const w = WALLETS.find(x => x.id === id)!;
                      return (
                        <button key={id} onClick={() => setUpiVpa(id === "gpay" ? "user@okicici" : id === "phonepe" ? "user@ybl" : "user@paytm")} style={{ flexShrink: 0, padding: "10px 14px", background: w.color + "22", border: `1px solid ${w.color}44`, borderRadius: 8, color: "#E4E4E7", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                  <Field label="UPI ID / VPA" error={upiValid === false && upiVpa.length > 5 ? "Format: name@bankname" : undefined} hint={upiValid === true ? "✓ VPA looks valid" : "e.g. yourname@okhdfc"}>
                    <div style={{ position: "relative" }}>
                      <input value={upiVpa} onChange={e => handleUpiChange(e.target.value)} onFocus={() => setFocusedField("upi")} onBlur={() => setFocusedField(null)} placeholder="name@bankname" style={{ ...inputBase(upiValid === false && upiVpa.length > 5, focusedField === "upi"), paddingRight: 36 }} />
                      {upiValid !== null && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: upiValid ? "#10b981" : "#f87171", fontSize: 16 }}>{upiValid ? "✓" : "✕"}</div>}
                    </div>
                  </Field>
                  <div style={{ background: "#111113", border: "1px solid #27272A", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#71717A", lineHeight: 1.6 }}>
                    📲 A payment request of <strong style={{ color: "#E4E4E7" }}>₹{amount.toLocaleString()}</strong> will be sent to your UPI app. Approve it within 5 minutes.
                  </div>
                  <button onClick={payUpi} disabled={!upiValid} style={{ width: "100%", padding: "14px", background: upiValid ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#27272A", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: upiValid ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all 0.2s" }}>
                    Send ₹{amount.toLocaleString()} Request
                  </button>
                </div>
              )}

              {tab === "wallets" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {WALLETS.map(w => (
                      <div key={w.id} onClick={() => setSelectedWallet(w.id)} style={{ padding: "14px 12px", borderRadius: 10, border: `1px solid ${selectedWallet === w.id ? w.color : "#27272A"}`, background: selectedWallet === w.id ? w.color + "18" : "#111113", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: w.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{w.icon}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#E4E4E7" }}>{w.name}</div>
                          <div style={{ fontSize: 10, color: "#71717A" }}>{w.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={payWallet} disabled={!selectedWallet} style={{ width: "100%", padding: "14px", background: selectedWallet ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#27272A", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: selectedWallet ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all 0.2s" }}>
                    {selectedWallet ? `Pay via ${WALLETS.find(w => w.id === selectedWallet)?.name}` : "Select a Wallet"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <ProcessingState state={flow} amount={amount.toLocaleString()} />
            {(flow === "success" || flow === "failed") && (
              <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
                {flow === "failed" && (
                  <button onClick={() => setFlow("idle")} style={{ flex: 1, padding: "13px", background: "transparent", border: "1px solid #3F3F46", borderRadius: 10, color: "#E4E4E7", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Try Again</button>
                )}
                <button onClick={onClose} style={{ flex: 1, padding: "13px", background: flow === "success" ? "linear-gradient(135deg, #10b981, #059669)" : "#27272A", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {flow === "success" ? "Done" : "Close"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── MERCHANT PAGE ────────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: 1, name: "Noise ColorFit Pro 5",   category: "Smartwatch",  price: 4999, img: "⌚", rating: 4.5, reviews: 2847  },
  { id: 2, name: "boAt Airdopes 141",       category: "TWS Earbuds", price: 1299, img: "🎧", rating: 4.3, reviews: 18924 },
  { id: 3, name: "Portronics Kronos X3",    category: "Power Bank",  price: 1799, img: "🔋", rating: 4.2, reviews: 5631  },
];

export default function App() {
  const [cart, setCart] = useState<Product[]>([PRODUCTS[0]]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastResult, setLastResult] = useState<PayResult | null>(null);
  const total = cart.reduce((s, p) => s + p.price, 0);

  const toggleCart = (product: Product) => {
    setCart(c => c.find(p => p.id === product.id) ? c.filter(p => p.id !== product.id) : [...c, product]);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#F5F5F0", minHeight: "100vh", maxWidth: "100vw", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .prod-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.12); transform: translateY(-2px); }
        .prod-card { transition: all 0.2s; }
        .checkout-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .checkout-btn { transition: all 0.2s; }
      `}</style>

      <div style={{ background: "#111", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>QuickMart</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            {cart.length > 0 && <div style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, background: "#6366f1", borderRadius: "50%", fontSize: 9, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{cart.length}</div>}
          </div>
          {cart.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>₹{total.toLocaleString()}</span>}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>Powered by HyperSDK</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>⚡ 1-Click Checkout</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>No re-entering card details, ever.</div>
          </div>
          <div style={{ fontSize: 48 }}>💳</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#6B7280" }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <span><strong style={{ color: "#111" }}>CheckoutSDK v2.4.1</strong> — Card · UPI · Wallets · 1-Click · Tokenization · PCI-DSS L1</span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Products</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {PRODUCTS.map(p => {
            const inCart = cart.find(c => c.id === p.id);
            return (
              <div key={p.id} className="prod-card" style={{ background: "#fff", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 14, border: `1.5px solid ${inCart ? "#6366f1" : "#E5E7EB"}`, cursor: "pointer" }} onClick={() => toggleCart(p)}>
                <div style={{ width: 56, height: 56, background: inCart ? "#6366f120" : "#F9FAFB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>{p.img}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{p.category} · ⭐ {p.rating} ({p.reviews.toLocaleString()})</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>₹{p.price.toLocaleString()}</div>
                </div>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: inCart ? "#6366f1" : "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700, flexShrink: 0, transition: "all 0.15s" }}>
                  {inCart ? "✓" : "+"}
                </div>
              </div>
            );
          })}
        </div>

        {cart.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #E5E7EB", marginBottom: 16, animation: "slideUp 0.3s ease" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Order Summary</div>
            {cart.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{p.img} {p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>₹{p.price.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Total</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#111" }}>₹{total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <button className="checkout-btn" onClick={() => { setLastResult(null); setSheetOpen(true); }} disabled={cart.length === 0}
          style={{ width: "100%", padding: "16px", borderRadius: 12, background: cart.length > 0 ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#E5E7EB", border: "none", color: cart.length > 0 ? "#fff" : "#9CA3AF", fontSize: 16, fontWeight: 800, cursor: cart.length > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: cart.length > 0 ? "0 8px 30px rgba(99,102,241,0.35)" : "none" }}>
          {cart.length === 0 ? "Add items to continue" : <>⚡ Checkout · ₹{total.toLocaleString()}</>}
        </button>

        {lastResult && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, background: lastResult.ok ? "#d1fae5" : "#fee2e2", border: `1px solid ${lastResult.ok ? "#6ee7b7" : "#fca5a5"}`, fontSize: 13, color: lastResult.ok ? "#065f46" : "#991b1b", animation: "slideUp 0.3s ease" }}>
            {lastResult.ok ? `✅ Payment successful via ${lastResult.method}` : `❌ Payment failed — try another method`}
          </div>
        )}
      </div>

      <CheckoutSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        amount={total}
        merchant="QuickMart"
        onSuccess={(method) => { setLastResult({ ok: true, method }); setTimeout(() => setSheetOpen(false), 3200); }}
        onFailure={() => { setLastResult({ ok: false }); }}
      />
    </div>
  );
}