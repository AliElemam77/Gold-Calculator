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

export default function Dashboard() {
  const [data, setData] = useState<PricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d: PricesData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setMessage({ text: res.ok ? "✅ تم حفظ التغييرات بنجاح!" : "❌ حدث خطأ أثناء الحفظ.", ok: res.ok });
    } catch {
      setMessage({ text: "❌ تعذّر الاتصال بالخادم.", ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const updateGramPrice = (v: string) => data && setData({ ...data, gramPrice: Number(v) });

  const updateFee = (id: string, vendor: "MB" | "GE" | "BTC", v: string) => {
    if (!data) return;
    setData({
      ...data,
      bars: data.bars.map((b) =>
        b.id === id ? { ...b, fees: { ...b.fees, [vendor]: Number(v) } } : b
      ),
    });
  };

  if (loading)
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">⏳</div>
        <p>جاري تحميل لوحة التحكم…</p>
      </div>
    );

  if (!data) return <div className="empty-state"><p>فشل تحميل البيانات.</p></div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Page header */}
      <div className="page-hero">
        <h1>لوحة التحكم</h1>
        <p className="subtitle">
          أدِر أسعار السبائك ومصنعيات الشركات — يُحسَب السعر النهائي تلقائياً ويُعرض في الحاسبة.
        </p>
      </div>

      <div className="glass-panel">
        {/* Panel toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <h2>الأسعار والمصنعيات</h2>
          <button className="primary-btn" style={{ width: "auto" }} onClick={handleSave} disabled={saving}>
            {saving ? "⏳ جاري الحفظ…" : "💾 حفظ التغييرات"}
          </button>
        </div>

        {/* Feedback */}
        {message && (
          <div className={message.ok ? "success-text" : "error-text"} style={{ marginBottom: "1.25rem" }}>
            {message.text}
          </div>
        )}

        {/* Gram price */}
        <div style={{ background: "var(--gold-pale)", border: "1.5px solid var(--border-strong)", borderRadius: "var(--radius-md)", padding: "1.25rem", marginBottom: "2rem", maxWidth: 360 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>🏅 سعر الجرام الخام — عيار 24 (ج.م)</label>
            <input
              type="number"
              value={data.gramPrice}
              onChange={(e) => updateGramPrice(e.target.value)}
            />
          </div>
          <p style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
            * تعديل هذا السعر يُحدّث جميع الحسابات فوراً.
          </p>
        </div>

        {/* Bars table */}
        <h3 style={{ marginBottom: "1rem" }}>المصنعيات التفصيلية (جنيه مصري / لكل جرام)</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>العيار</th>
                <th>الوزن (جم)</th>
                <th>مصنعية MB</th>
                <th>مصنعية Gold Era</th>
                <th>مصنعية BTC</th>
                <th>المتوسط</th>
              </tr>
            </thead>
            <tbody>
              {data.bars.map((bar) => {
                const avg = Math.round((bar.fees.MB + bar.fees.GE + bar.fees.BTC) / 3);
                return (
                  <tr key={bar.id}>
                    <td style={{ fontWeight: 700, color: "var(--text-heading)", whiteSpace: "nowrap" }}>
                      {bar.label}
                    </td>
                    <td>{bar.karat}</td>
                    <td>{bar.grams}</td>
                    {(["MB", "GE", "BTC"] as const).map((v) => (
                      <td key={v}>
                        <input
                          type="number"
                          value={bar.fees[v]}
                          onChange={(e) => updateFee(bar.id, v, e.target.value)}
                          style={{ width: 80, textAlign: "center" }}
                        />
                      </td>
                    ))}
                    <td style={{ color: "var(--gold)", fontWeight: 900, textAlign: "center" }}>
                      {avg} ج.م
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
