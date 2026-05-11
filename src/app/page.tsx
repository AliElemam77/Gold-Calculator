"use client";

import { useState, useEffect } from "react";

type GoldBar = {
  id: string;
  label: string;
  grams: number;
  karat: number;
  maxQty: number;
  fees: { MB: number; GE: number; BTC: number };
};

type PricesData = {
  gramPrice: number;
  bars: GoldBar[];
};

type Chosen = {
  idx: string;
  item: GoldBar;
  qty: number;
  unitPrice: number;
  feePerG: number;
};

type Combo = {
  chosen: Chosen[];
  remaining: number;
  totalSpent: number;
  totalGrams: number;
};

type UpgradeSuggestion = {
  bar: GoldBar;
  unitPrice: number;
  shortfall: number;
  newTotal: number;
  totalGrams: number;
  avgF: number;
};

function avgFee(fees: { MB: number; GE: number; BTC: number }) {
  return (fees.MB + fees.GE + fees.BTC) / 3;
}

function piecePrice(item: GoldBar, p21: number, p24: number) {
  const base = item.karat === 21 ? p21 : p24;
  return Math.round((base + avgFee(item.fees)) * item.grams);
}

function egpFmt(n: number) {
  return Math.round(n).toLocaleString("ar-EG") + " ج.م";
}

export default function Calculator() {
  const [budget, setBudget] = useState<number | "">("");
  const [data, setData] = useState<PricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBars, setShowBars] = useState(false);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d: PricesData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">⏳</div>
        <p>جاري الاتصال بخزنة الذهب…</p>
      </div>
    );
  }

  if (!data) return <div className="empty-state"><p>فشل تحميل البيانات.</p></div>;

  const b = Number(budget);
  const p24 = data.gramPrice;
  const p21 = p24 * (21 / 24);

  // All bar prices
  const allPieces = data.bars.map((bar) => ({
    idx: bar.id,
    item: bar,
    unitPrice: piecePrice(bar, p21, p24),
    feePerG: avgFee(bar.fees),
  }));

  const affordablePieces = allPieces.filter((p) => p.unitPrice <= b);

  /* ── Greedy engine ─────────────────────────────────────────── */
  const greedy = (
    sortFn: (a: typeof allPieces[0], x: typeof allPieces[0]) => number,
    maxQtyFn?: () => number
  ): Combo | null => {
    let rem = b;
    const chosen: Chosen[] = [];
    for (const p of [...affordablePieces].sort(sortFn)) {
      const cap = maxQtyFn ? maxQtyFn() : p.item.maxQty;
      const qty = Math.min(Math.floor(rem / p.unitPrice), cap);
      if (qty > 0) { chosen.push({ ...p, qty }); rem -= qty * p.unitPrice; }
    }
    if (!chosen.length) return null;
    return {
      chosen,
      remaining: rem,
      totalSpent: b - rem,
      totalGrams: chosen.reduce((s, c) => s + c.item.grams * c.qty, 0),
    };
  };

  const topCombos: Combo[] = [];
  if (b > 0) {
    const opts = [
      greedy((a, x) => a.feePerG - x.feePerG),
      greedy((a, x) => x.item.grams - a.item.grams),
      greedy((a, x) => x.item.grams - a.item.grams, () => 1),
    ];
    const seen = new Set<string>();
    for (const o of opts) {
      if (!o) continue;
      const k = o.chosen.map((c) => `${c.idx}x${c.qty}`).sort().join("|");
      if (!seen.has(k)) { seen.add(k); topCombos.push(o); }
    }
  }

  /* ── "زود كذا عشان تشتري كذا" – upgrade suggestions ──────── */
  // Case A: budget too low for anything → show cheapest items + shortfall
  const budgetTooLow = b > 0 && affordablePieces.length === 0;

  // Case B: budget OK, but there are BETTER deals just out of reach (shortfall ≤ 30% of budget)
  const upgradeSuggestions: UpgradeSuggestion[] = [];
  if (b > 0 && !budgetTooLow) {
    const unaffordable = allPieces.filter((p) => p.unitPrice > b);
    for (const p of unaffordable) {
      const shortfall = p.unitPrice - b;
      if (shortfall <= b * 0.30) { // only suggest if within 30% more
        upgradeSuggestions.push({
          bar: p.item,
          unitPrice: p.unitPrice,
          shortfall,
          newTotal: p.unitPrice,
          totalGrams: p.item.grams,
          avgF: avgFee(p.item.fees),
        });
      }
    }
    // sort by smallest shortfall first, cap at 3
    upgradeSuggestions.sort((a, b) => a.shortfall - b.shortfall);
    upgradeSuggestions.splice(3);
  }

  // For budgetTooLow: cheapest 3 items sorted by price
  const cheapestItems = [...allPieces]
    .sort((a, b) => a.unitPrice - b.unitPrice)
    .slice(0, 3);

  const RANKS = [
    { label: "الأفضل قيمة",   cls: "rank-1", badge: "badge-gold",   title: "أعلى عائد وأقل مصنعية" },
    { label: "سبائك كبيرة",   cls: "rank-2", badge: "badge-blue",   title: "أكبر كميات الذهب الممكنة" },
    { label: "محفظة متنوعة",  cls: "rank-3", badge: "badge-purple", title: "توزيع متوازن وتنوع القطع" },
  ];

  return (
    <div className="animate-fade-in">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="page-hero">
        <h1>حاسبة استثمار الذهب 🪙</h1>
        <p className="subtitle">أدخل ميزانيتك واحصل على أفضل توصيات استثمارية فوريّة ومخصّصة</p>
        <div className="live-price-badge">
          <span className="dot" />
          سعر عيار 24 الحالي: {egpFmt(p24)} | عيار 21: {egpFmt(Math.round(p21))}
        </div>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div className="disclaimer-banner animate-fade-in">
        <span className="disclaimer-icon">⚠️</span>
        <span>
          <strong>تنبيه مهم:</strong> أسعار الذهب تتغيّر بشكل شبه يومي بناءً على أسعار السوق العالمية.
          يُنصح بمراجعة لوحة الإدارة وتحديث السعر قبل الاستخدام لضمان دقة الحسابات.
        </span>
      </div>

      {/* ── Bars Reference (toggle) ───────────────────────────────── */}
      <div className="bars-section animate-fade-in">
        <button className="bars-toggle-btn" onClick={() => setShowBars(!showBars)}>
          <span>{showBars ? "▲" : "▼"}</span>
          {showBars ? "إخفاء قائمة السبائك والمصنعيات" : "عرض قائمة جميع السبائك ومصنعياتها"}
        </button>

        {showBars && (
          <div className="bars-grid animate-fade-in">
            {data.bars.map((bar) => {
              const price = piecePrice(bar, p21, p24);
              const af = avgFee(bar.fees);
              return (
                <div key={bar.id} className="bar-card">
                  <div className="bar-card-header">
                    <span className="bar-name">{bar.label}</span>
                    <span className={`bar-karat-badge ${bar.karat === 21 ? "karat-21" : "karat-24"}`}>
                      عيار {bar.karat}
                    </span>
                  </div>
                  <div className="bar-price">{egpFmt(price)}</div>
                  <div className="bar-details">
                    <span>{bar.grams} جرام</span>
                    <span>·</span>
                    <span>مصنعية MB: {bar.fees.MB}</span>
                    <span>·</span>
                    <span>GE: {bar.fees.GE}</span>
                    <span>·</span>
                    <span>BTC: {bar.fees.BTC}</span>
                  </div>
                  <div className="bar-avg-fee">متوسط المصنعية: <strong>{Math.round(af)} ج.م/جرام</strong></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main Grid ────────────────────────────────────────────── */}
      <div className="grid-2">

        {/* LEFT: Budget input */}
        <div className="glass-panel animate-fade-in">
          <h2>ميزانيتك</h2>

          <div className="budget-input-wrapper">
            <label htmlFor="budget">أدخل المبلغ المتاح</label>
            <div className="budget-input-inner">
              <input
                type="number"
                id="budget"
                placeholder="مثال: 100,000"
                value={budget}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBudget(v > 0 ? v : "");
                }}
              />
              <span className="currency-tag">ج.م</span>
            </div>
          </div>

          {/* quick price reference */}
          <div className="price-list">
            <p className="price-list-title">الأسعار الحالية شاملة متوسط المصنعية</p>
            <div className="stat-row">
              <span className="stat-label">جرام عيار 24 (خام)</span>
              <span className="stat-value gold">{egpFmt(p24)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">جرام عيار 21 (خام)</span>
              <span className="stat-value gold">{egpFmt(Math.round(p21))}</span>
            </div>
            {data.bars.map((bar) => (
              <div className="stat-row" key={bar.id}>
                <span className="stat-label">{bar.label}</span>
                <span className="stat-value">{egpFmt(piecePrice(bar, p21, p24))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="glass-panel animate-fade-in">

          {/* ── No budget entered ─────────────────────────────── */}
          {!b || b <= 0 ? (
            <>
              <h2>التوصيات المقترحة</h2>
              <div className="empty-state">
                <div className="empty-icon">💡</div>
                <p>أدخل ميزانيتك على اليسار لتظهر توصيات مخصّصة لك هنا.</p>
              </div>
            </>
          ) : budgetTooLow ? (
            /* ── Budget too low: suggest cheapest items ───────── */
            <>
              <h2>💸 الميزانية غير كافية</h2>
              <p style={{ marginBottom: "1.25rem" }}>
                مبلغ <strong style={{ color: "var(--gold)" }}>{egpFmt(b)}</strong> غير كافٍ لشراء أي وحدة متاحة حالياً.
                لكن لا تقلق — إليك أرخص 3 خيارات وكم تحتاج للوصول إليها:
              </p>
              <div className="upgrade-list">
                {cheapestItems.map((p, i) => {
                  const shortfall = p.unitPrice - b;
                  return (
                    <div key={i} className="upgrade-card shortfall-card animate-fade-in">
                      <div className="upgrade-header">
                        <span className="upgrade-rank">#{i + 1}</span>
                        <span className="upgrade-name">{p.item.label} — عيار {p.item.karat}</span>
                      </div>
                      <div className="upgrade-body">
                        <div className="upgrade-row">
                          <span>سعر القطعة</span>
                          <strong>{egpFmt(p.unitPrice)}</strong>
                        </div>
                        <div className="upgrade-row">
                          <span>ميزانيتك الحالية</span>
                          <strong>{egpFmt(b)}</strong>
                        </div>
                        <div className="upgrade-row need">
                          <span>💰 تحتاج أن تزيد</span>
                          <strong className="shortfall-amount">+ {egpFmt(shortfall)}</strong>
                        </div>
                        <div className="upgrade-perks">
                          <span>✅ {p.item.grams} جرام</span>
                          <span>✅ متوسط مصنعية {Math.round(p.feePerG)} ج.م</span>
                          <span>✅ عيار {p.item.karat}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Budget OK: show recommendations + upgrade hints ─ */
            <>
              <h2>التوصيات المقترحة</h2>
              <div className="rec-panel">
                {topCombos.map((combo, i) => {
                  const rank = RANKS[i];
                  return (
                    <div key={i} className={`recommendation-card ${rank.cls} animate-fade-in`}>
                      <div className="card-header">
                        <span className={`rank-badge ${rank.badge}`}>{rank.label}</span>
                        <span className="card-title">{rank.title}</span>
                      </div>
                      <table className="items-table">
                        <tbody>
                          {combo.chosen.map((c, j) => (
                            <tr key={j}>
                              <td>
                                <div className="item-name">
                                  {c.qty > 1 ? `${c.qty} × ` : ""}{c.item.label}
                                </div>
                                <div className="item-sub">
                                  عيار {c.item.karat} · مصنعية {Math.round(avgFee(c.item.fees))} ج.م/جرام
                                </div>
                              </td>
                              <td className="item-price">{egpFmt(c.unitPrice * c.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="card-summary">
                        <div className="summary-item">
                          <div className="summary-label">المُستغَل</div>
                          <div className="summary-val">{egpFmt(combo.totalSpent)}</div>
                        </div>
                        <div className="summary-item">
                          <div className="summary-label">المتبقي</div>
                          <div className="summary-val green">{egpFmt(combo.remaining)}</div>
                        </div>
                        <div className="summary-item">
                          <div className="summary-label">الوزن</div>
                          <div className="summary-val gold">{parseFloat(combo.totalGrams.toFixed(2))} جم</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Upgrade suggestions (deals just out of reach) ── */}
              {upgradeSuggestions.length > 0 && (
                <div className="upgrade-section animate-fade-in">
                  <div className="upgrade-section-title">
                    🚀 صفقات تستحق التفكير — أنت قريب جداً!
                  </div>
                  <p className="upgrade-section-sub">
                    بزيادة بسيطة في ميزانيتك يمكنك الحصول على هذه المنتجات الأفضل:
                  </p>
                  <div className="upgrade-list">
                    {upgradeSuggestions.map((s, i) => (
                      <div key={i} className="upgrade-card animate-fade-in">
                        <div className="upgrade-header">
                          <span className="upgrade-name">🏅 {s.bar.label} — عيار {s.bar.karat}</span>
                        </div>
                        <div className="upgrade-body">
                          <div className="upgrade-row">
                            <span>سعر القطعة</span>
                            <strong>{egpFmt(s.unitPrice)}</strong>
                          </div>
                          <div className="upgrade-row need">
                            <span>💰 تحتاج زيادة</span>
                            <strong className="shortfall-amount">+ {egpFmt(s.shortfall)}</strong>
                          </div>
                          <div className="upgrade-perks">
                            <span>✅ {s.totalGrams} جرام ذهب خالص</span>
                            <span>✅ متوسط مصنعية {Math.round(s.avgF)} ج.م/جرام</span>
                            <span>✅ عيار {s.bar.karat} — استثمار آمن</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
