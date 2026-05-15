"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Types ──────────────────────────────────────────────────────── */
type SKU = {
  id: string;
  label: string;
  grams: number;
  karat: number;
  fees: { MB: number; GE: number; BTC: number };
};

type PricesData = {
  gramPrice24: number;
  gramPrice21: number;
  bars: SKU[];
};

type LineItem = {
  sku: SKU;
  qty: number;
  basePrice: number;   // grams × goldPricePerGram  (no fee)
  feePerGram: number;  // avg(MB, GE, BTC)
  feeTotal: number;    // grams × feePerGram × qty
  unitFee: number;     // grams × feePerGram (single unit)
};

type Combo = {
  items: LineItem[];
  totalBase: number;   // sum of base prices
  totalFees: number;   // sum of all fees
  remaining: number;   // budget − totalBase
  pieces: number;      // total physical pieces
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function avgFee(fees: { MB: number; GE: number; BTC: number }): number {
  return (fees.MB + fees.GE + fees.BTC) / 3;
}

function basePrice(sku: SKU, p21: number, p24: number): number {
  const gpg = sku.karat === 21 ? p21 : p24;
  return gpg * sku.grams;
}

function egp(n: number): string {
  return Math.round(n).toLocaleString("ar-EG") + " ج.م";
}

/* ─── DFS "Minimum Pieces" Engine ───────────────────────────────── */
const MAX_REMAINING = 5_000;
const MAX_COMBOS    = 20; // safety cap on results

function dfsSearch(
  skus: SKU[],
  budget: number,
  p21: number,
  p24: number
): Combo[] {
  // Pre-compute base prices; sort skus descending by base price (largest first)
  const priced = skus
    .map((s) => ({ sku: s, base: basePrice(s, p21, p24) }))
    .filter((s) => s.base <= budget)
    .sort((a, b) => b.base - a.base);

  if (priced.length === 0) return [];

  const cheapest  = priced[priced.length - 1].base;
  const mostExp   = priced[0].base;

  const results: Combo[] = [];

  function buildCombo(
    skuIdx: number,
    remaining: number,
    slotsFilled: number,
    totalSlots: number,
    chosen: { skuIdx: number; qty: number }[]
  ) {
    if (results.length >= MAX_COMBOS) return;

    const slotsLeft = totalSlots - slotsFilled;

    // Pruning: can we still possibly qualify?
    if (slotsLeft === 0) {
      // Leaf node — check validity
      if (remaining <= MAX_REMAINING) {
        // Build LineItem[]
        const items: LineItem[] = chosen
          .filter((c) => c.qty > 0)
          .map((c) => {
            const { sku } = priced[c.skuIdx];
            const fpg = avgFee(sku.fees);
            const bp  = basePrice(sku, p21, p24);
            return {
              sku,
              qty: c.qty,
              basePrice: bp,
              feePerGram: fpg,
              feeTotal: fpg * sku.grams * c.qty,
              unitFee: fpg * sku.grams,
            };
          });
        const totalBase  = items.reduce((s, i) => s + i.basePrice * i.qty, 0);
        const totalFees  = items.reduce((s, i) => s + i.feeTotal, 0);
        results.push({
          items,
          totalBase,
          totalFees,
          remaining: budget - totalBase,
          pieces: totalSlots,
        });
      }
      return;
    }

    // Prune: even filling remaining slots with cheapest SKU overshoots?
    if (remaining - slotsLeft * cheapest < -0.01) return;
    // Prune: even filling remaining slots with most expensive SKU can't cover budget−5000?
    if (remaining - slotsLeft * mostExp > MAX_REMAINING) return;

    // No more skus to try
    if (skuIdx >= priced.length) return;

    const { base } = priced[skuIdx];
    const maxQty = Math.min(slotsLeft, Math.floor(remaining / base));

    for (let q = maxQty; q >= 0; q--) {
      buildCombo(
        skuIdx + 1,
        remaining - q * base,
        slotsFilled + q,
        totalSlots,
        [...chosen, { skuIdx, qty: q }]
      );
      if (results.length >= MAX_COMBOS) return;
    }
  }

  // Try N = 1, 2, 3, … until we get at least one valid combo
  for (let N = 1; N <= 50; N++) {
    buildCombo(0, budget, 0, N, []);
    if (results.length > 0) break;
  }

  // Sort: least remaining first (best budget coverage)
  results.sort((a, b) => a.remaining - b.remaining);
  return results;
}

/* ─── Component: Result Card ─────────────────────────────────────── */
function ComboCard({
  combo,
  index,
  budget,
}: {
  combo: Combo;
  index: number;
  budget: number;
}) {
  const [showFees, setShowFees] = useState(false);

  const grandTotal   = combo.totalBase + (showFees ? combo.totalFees : 0);
  const newRemaining = budget - grandTotal;

  return (
    <div className={`combo-card animate-fade-in combo-rank-${Math.min(index + 1, 3)}`}>
      {/* Card header */}
      <div className="combo-card-header">
        <div className="combo-meta">
          <span className="combo-index">#{index + 1}</span>
          <span className="combo-piece-badge">
            {combo.pieces} {combo.pieces === 1 ? "قطعة" : "قطع"}
          </span>
        </div>
        <button
          className={`fee-toggle-btn ${showFees ? "fee-toggle-on" : ""}`}
          onClick={() => setShowFees((v) => !v)}
        >
          {showFees ? "↩ إخفاء المصنعية" : "＋ أضف المصنعية"}
        </button>
      </div>

      {/* Line items */}
      <div className="combo-items">
        {combo.items.map((item, j) => {
          const baseLine = item.basePrice * item.qty;
          const feeLine  = item.unitFee  * item.qty;
          const total    = showFees ? baseLine + feeLine : baseLine;

          return (
            <div key={j} className="combo-line-item">
              <div className="combo-line-left">
                <span className="combo-line-name">
                  {item.qty > 1 ? `${item.qty} × ` : ""}
                  {item.sku.label}
                </span>
                <span className={`combo-karat-tag karat-tag-${item.sku.karat}`}>
                  عيار {item.sku.karat}
                </span>
                {showFees && (
                  <span className="combo-fee-note">
                    + مصنعية {egp(feeLine)}
                  </span>
                )}
              </div>
              <div className="combo-line-right">
                {egp(total)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fee summary row (visible only when fees on) */}
      {showFees && (
        <div className="combo-fee-summary">
          <span>إجمالي المصنعيات</span>
          <span className="fee-total-val">{egp(combo.totalFees)}</span>
        </div>
      )}

      {/* Footer summary */}
      <div className="combo-footer">
        <div className="combo-stat">
          <div className="combo-stat-label">المُستغَل (خام)</div>
          <div className="combo-stat-val">{egp(combo.totalBase)}</div>
        </div>
        {showFees && (
          <div className="combo-stat">
            <div className="combo-stat-label">الإجمالي شامل المصنعية</div>
            <div className="combo-stat-val fee-grand">{egp(grandTotal)}</div>
          </div>
        )}
        <div className="combo-stat">
          <div className="combo-stat-label">المتبقي {showFees ? "(بعد المصنعية)" : ""}</div>
          <div className={`combo-stat-val ${newRemaining >= 0 ? "remaining-ok" : "remaining-warn"}`}>
            {egp(Math.max(0, newRemaining))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function Calculator() {
  const [budget, setBudget]     = useState<number | "">("");
  const [data, setData]         = useState<PricesData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [computing, setComputing] = useState(false);
  const [combos, setCombos]     = useState<Combo[]>([]);
  const [showBars, setShowBars] = useState(false);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d: PricesData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const runEngine = useCallback(() => {
    if (!data || !budget || Number(budget) <= 0) {
      setCombos([]);
      return;
    }
    setComputing(true);
    // Run in next tick so UI can show computing state
    setTimeout(() => {
      const results = dfsSearch(data.bars, Number(budget), data.gramPrice21, data.gramPrice24);
      setCombos(results);
      setComputing(false);
    }, 10);
  }, [data, budget]);

  if (loading) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">⏳</div>
        <p>جاري الاتصال بخزنة الذهب…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <p>فشل تحميل البيانات.</p>
      </div>
    );
  }

  const b   = Number(budget);
  const p24 = data.gramPrice24;
  const p21 = data.gramPrice21;

  // SKU base prices for reference panel
  const skuRows = data.bars.map((s) => ({
    sku: s,
    bp: basePrice(s, p21, p24),
    fpg: avgFee(s.fees),
  }));

  const noResult = b > 0 && !computing && combos.length === 0;
  const budgetTooLow = b > 0 && skuRows.every((r) => r.bp > b);

  return (
    <div className="animate-fade-in">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="page-hero">
        <h1>حاسبة استثمار الذهب 🪙</h1>
        <p className="subtitle">
          أدخل ميزانيتك واضغط احسب — سنجد أقل عدد قطع يغطي ميزانيتك بفارق ≤ 5,000 ج.م
        </p>
        <div className="live-price-badge">
          <span className="dot" />
          عيار 24: {egp(p24)} / جرام &nbsp;|&nbsp; عيار 21: {egp(p21)} / جرام
        </div>
      </div>

      {/* ── Disclaimer ────────────────────────────────────────── */}
      <div className="disclaimer-banner animate-fade-in">
        <span className="disclaimer-icon">⚠️</span>
        <span>
          <strong>تنبيه:</strong> أسعار الذهب تتغيّر يومياً. تأكد من تحديث السعر في
          لوحة التحكم قبل الاستخدام. الأسعار المعروضة بدون مصنعية — يمكنك إضافتها
          من كل كارت بشكل مستقل.
        </span>
      </div>

      {/* ── SKU Reference (collapsible) ───────────────────────── */}
      <div className="bars-section animate-fade-in">
        <button className="bars-toggle-btn" onClick={() => setShowBars(!showBars)}>
          <span>{showBars ? "▲" : "▼"}</span>
          {showBars ? "إخفاء قائمة المنتجات والمصنعيات" : "عرض جميع المنتجات والمصنعيات"}
        </button>
        {showBars && (
          <div className="bars-grid animate-fade-in">
            {skuRows.map(({ sku, bp, fpg }) => (
              <div key={sku.id} className="bar-card">
                <div className="bar-card-header">
                  <span className="bar-name">{sku.label}</span>
                  <span className={`bar-karat-badge ${sku.karat === 21 ? "karat-21" : "karat-24"}`}>
                    عيار {sku.karat}
                  </span>
                </div>
                <div className="bar-price">{egp(bp)}</div>
                <div className="bar-details">
                  <span>{sku.grams} جرام</span>
                  <span>·</span>
                  <span>MB: {sku.fees.MB}</span>
                  <span>·</span>
                  <span>GE: {sku.fees.GE}</span>
                  <span>·</span>
                  <span>BTC: {sku.fees.BTC}</span>
                </div>
                <div className="bar-avg-fee">
                  متوسط المصنعية: <strong>{Math.round(fpg)} ج.م/جرام</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Input + Calculate ─────────────────────────────────── */}
      <div className="calc-input-row animate-fade-in">
        <div className="budget-input-wrapper" style={{ marginBottom: 0, flex: 1 }}>
          <label htmlFor="budget">أدخل ميزانيتك (ج.م)</label>
          <div className="budget-input-inner">
            <input
              type="number"
              id="budget"
              placeholder="مثال: 50,000"
              value={budget}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBudget(v > 0 ? v : "");
                setCombos([]);
              }}
              onKeyDown={(e) => e.key === "Enter" && runEngine()}
            />
            <span className="currency-tag">ج.م</span>
          </div>
        </div>
        <button
          className="primary-btn calc-btn"
          onClick={runEngine}
          disabled={!budget || Number(budget) <= 0 || computing}
        >
          {computing ? "⏳ جاري الحساب…" : "🔍 احسب"}
        </button>
      </div>

      {/* ── Results area ──────────────────────────────────────── */}
      <div className="results-area">

        {/* No budget yet */}
        {!b || b <= 0 ? (
          <div className="empty-state animate-fade-in">
            <div className="empty-icon">💡</div>
            <p>أدخل ميزانيتك واضغط «احسب» لتظهر توصيات مخصّصة لك هنا.</p>
          </div>
        ) : budgetTooLow ? (
          /* Budget can't afford any single SKU */
          <div className="no-result-box animate-fade-in">
            <div className="no-result-icon">💸</div>
            <h3>الميزانية غير كافية</h3>
            <p>
              مبلغ <strong>{egp(b)}</strong> لا يكفي لشراء أي قطعة متاحة.
              أرخص قطعة حالياً هي{" "}
              <strong>
                {(() => {
                  const cheapest = skuRows.slice().sort((a, z) => a.bp - z.bp)[0];
                  return `${cheapest.sku.label} بسعر ${egp(cheapest.bp)}`;
                })()}
              </strong>.
            </p>
          </div>
        ) : computing ? (
          <div className="empty-state animate-fade-in">
            <div className="empty-icon">⚙️</div>
            <p>جاري البحث عن أفضل تشكيلة…</p>
          </div>
        ) : noResult && !budgetTooLow ? (
          /* Budget is sufficient for individual SKUs but no combo hits the ≤5000 gap */
          <div className="no-result-box animate-fade-in">
            <div className="no-result-icon">🔎</div>
            <h3>لا توجد تشكيلة مناسبة</h3>
            <p>
              لم نتمكن من إيجاد تشكيلة تترك ≤ 5,000 ج.م متبقية من ميزانيتك.
              جرّب تعديل الميزانية أو مراجعة الأسعار في لوحة التحكم.
            </p>
          </div>
        ) : combos.length > 0 ? (
          <>
            <div className="results-header animate-fade-in">
              <div className="results-title">
                🏆 أفضل تشكيلات الشراء
              </div>
              <div className="results-sub">
                {combos.length} نتيجة — مرتبة حسب أقل مبلغ متبقٍ · تترك ≤ 5,000 ج.م فارقاً
              </div>
            </div>
            <div className="combos-grid">
              {combos.map((c, i) => (
                <ComboCard key={i} combo={c} index={i} budget={b} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
