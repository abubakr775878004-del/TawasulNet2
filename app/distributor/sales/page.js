'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function ReportsPage() {
  const { profile, loading } = useProfile('admin');
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true);

  // حالات الإجماليات العامة للشبكة
  const [totalNetworkSalesCount, setTotalNetworkSalesCount] = useState(0);
  const [totalNetworkSalesValue, setTotalNetworkSalesValue] = useState(0);
  const [totalNetworkCommission, setTotalNetworkCommission] = useState(0);
  const [totalNetworkManagerDue, setTotalNetworkManagerDue] = useState(0);

  async function loadReport() {
    setBusy(true);

    let since = null;
    if (filter === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      since = d.toISOString();
    } else if (filter === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      since = d.toISOString();
    }

    const [
      { data: distributors },
      { data: heldCards },
      salesQuery
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, commission_rate')
        .eq('role', 'distributor'),

      supabase
        .from('cards')
        .select('assigned_to, packages(price)')
        .eq('status', 'with_distributor'),

      (() => {
        let q = supabase
          .from('sales_log')
          .select(
            'distributor_id, distributor_name, price, sold_at, package_name'
          );

        if (since) {
          q = q.gte('sold_at', since);
        }

        return q;
      })(),
    ]);

    const { data: sales } = salesQuery;

    const map = {};

    /*
     * إنشاء بيانات كل موزع.
     *
     * commission_rate يأتي من profiles وليس رقمًا ثابتًا.
     */
    (distributors || []).forEach((d) => {
      const commissionRate = Number(d.commission_rate);

      map[d.id] = {
        name: d.full_name,
        commissionRate:
          Number.isFinite(commissionRate) &&
          commissionRate >= 0 &&
          commissionRate <= 100
            ? commissionRate
            : 0,
        heldCount: 0,
        heldValue: 0,
        salesCount: 0,
        salesValue: 0,
        commissionValue: 0,
        managerDue: 0,
      };
    });

    /*
     * الكروت الموجودة عند الموزعين.
     *
     * هذه بيانات مخزون فقط.
     * لا تدخل في إجمالي المبيعات أو عمولة الموزع أو مستحق المدير.
     */
    (heldCards || []).forEach((c) => {
      if (!map[c.assigned_to]) return;

      map[c.assigned_to].heldCount += 1;
      map[c.assigned_to].heldValue += Number(c.packages?.price) || 0;
    });

    let netSalesCount = 0;
    let netSalesValue = 0;
    let netCommission = 0;
    let netManagerDue = 0;

    /*
     * sales_log هو المصدر الوحيد للمبيعات الفعلية.
     *
     * لا نبحث عن الكرت الذي تم بيعه.
     * لا نربط sale بالسجلات الموجودة في cards.
     * السعر مأخوذ من sales_log.price حتى لا يتغير تاريخيًا
     * عند تغيير سعر الباقة مستقبلًا.
     */
    (sales || []).forEach((s) => {
      const price = Number(s.price) || 0;

      if (price <= 0) return;

      if (!map[s.distributor_id]) {
        map[s.distributor_id] = {
          name: s.distributor_name,
          commissionRate: 0,
          heldCount: 0,
          heldValue: 0,
          salesCount: 0,
          salesValue: 0,
          commissionValue: 0,
          managerDue: 0,
        };
      }

      const distributor = map[s.distributor_id];

      const commissionRate = Number(distributor.commissionRate) || 0;

      /*
       * عمولة الموزع:
       * price × commission_rate / 100
       */
      const commission = price * (commissionRate / 100);

      /*
       * مستحق المدير:
       * price - عمولة الموزع
       */
      const managerDue = price - commission;

      distributor.salesCount += 1;
      distributor.salesValue += price;
      distributor.commissionValue += commission;
      distributor.managerDue += managerDue;

      // الإجماليات العامة للشبكة - من sales_log فقط
      netSalesCount += 1;
      netSalesValue += price;
      netCommission += commission;
      netManagerDue += managerDue;
    });

    setTotalNetworkSalesCount(netSalesCount);
    setTotalNetworkSalesValue(netSalesValue);
    setTotalNetworkCommission(netCommission);
    setTotalNetworkManagerDue(netManagerDue);

    const result = Object.values(map).sort(
      (a, b) => b.salesValue - a.salesValue
    );

    setRows(result);
    setBusy(false);
  }

  useEffect(() => {
    if (profile) {
      loadReport();
    }
  }, [profile, filter]);

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading) return null;

  const filterLabel = {
    all: 'الكل',
    month: 'آخر 30 يومًا',
    week: 'آخر 7 أيام'
  };

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/reports"
        name={profile?.full_name}
      />

      <div className="main">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '16px'
          }}
        >
          <div>
            <h1>التقارير</h1>
            <p className="greet">
              مقارنة أداء الموزعين — الكروت الموجودة عندهم والمبيعات الفعلية
            </p>
          </div>

          <button
            onClick={handlePrintPDF}
            className="no-print"
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1.5px solid var(--line)',
              background: '#fff',
              color: 'var(--ink)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow)'
            }}
          >
            🖨️ طباعة / حفظ PDF
          </button>
        </div>

        {/* أزرار الفلترة الزمنية */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            flexWrap: 'wrap'
          }}
        >
          {['all', 'month', 'week'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '9px 18px',
                borderRadius: 12,
                border: 'none',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                background:
                  filter === f
                    ? 'linear-gradient(120deg, #0F766E, #14B8A6)'
                    : '#F3F8F6',
                color: filter === f ? '#fff' : '#0F766E'
              }}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>

        {/* البطاقات العلوية الإجمالية للمبيعات */}
        <div
          className="grid-stats"
          style={{
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}
        >
          <div
            className="stat"
            style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--line)'
            }}
          >
            <div
              className="label"
              style={{
                fontSize: '12px',
                color: 'var(--ink-soft)',
                fontWeight: 700
              }}
            >
              إجمالي الكروت المباعة ({filterLabel[filter]})
            </div>

            <div
              className="value"
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0F766E',
                marginTop: '6px'
              }}
            >
              {totalNetworkSalesCount} كرت
            </div>
          </div>

          <div
            className="stat"
            style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--line)'
            }}
          >
            <div
              className="label"
              style={{
                fontSize: '12px',
                color: 'var(--ink-soft)',
                fontWeight: 700
              }}
            >
              إجمالي المبلغ المحقق ({filterLabel[filter]})
            </div>

            <div
              className="value mono"
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#10B981',
                marginTop: '6px'
              }}
            >
              {totalNetworkSalesValue.toLocaleString('en-US')} ريال
            </div>
          </div>

          <div
            className="stat"
            style={{
              background: '#ECFDF5',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #A7F3D0'
            }}
          >
            <div
              className="label"
              style={{
                fontSize: '12px',
                color: '#047857',
                fontWeight: 700
              }}
            >
              إجمالي عمولات الموزعين
            </div>

            <div
              className="value mono"
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#059669',
                marginTop: '6px'
              }}
            >
              {totalNetworkCommission.toLocaleString('en-US')} ريال
            </div>
          </div>

          <div
            className="stat"
            style={{
              background: '#EFF6FF',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #BFDBFE'
            }}
          >
            <div
              className="label"
              style={{
                fontSize: '12px',
                color: '#1E40AF',
                fontWeight: 700
              }}
            >
              إجمالي مستحق المدير
            </div>

            <div
              className="value mono"
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#2563EB',
                marginTop: '6px'
              }}
            >
              {totalNetworkManagerDue.toLocaleString('en-US')} ريال
            </div>
          </div>
        </div>

        {/* جدول أو قائمة مقارنة الموزعين */}
        <div className="panel">
          <div className="panel-head">
            <h3>مقارنة أداء الموزعين</h3>
            <span className="muted">
              {rows.length} موزع
            </span>
          </div>

          {busy && (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
                padding: '10px 0'
              }}
            >
              جاري التحميل...
            </div>
          )}

          {!busy && rows.length === 0 && (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
                padding: '10px 0'
              }}
            >
              لا توجد بيانات مبيعات خلال هذه الفترة
            </div>
          )}

          {!busy &&
            rows.map((r, i) => (
              <div
                key={i}
                style={{
                  borderTop:
                    i !== 0
                      ? '1px solid var(--line)'
                      : 'none',
                  padding: '14px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 14.5
                  }}
                >
                  {r.name}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        fontWeight: 700
                      }}
                    >
                      كروت لديه الآن (غير مباعة)
                    </div>

                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        marginTop: '2px'
                      }}
                    >
                      {r.heldCount} كرت —{' '}
                      {r.heldValue.toLocaleString('en-US')} ريال
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        fontWeight: 700
                      }}
                    >
                      المبيعات الفعلية ({filterLabel[filter]})
                    </div>

                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#10B981',
                        marginTop: '2px'
                      }}
                    >
                      {r.salesCount} كرت —{' '}
                      {r.salesValue.toLocaleString('en-US')} ريال
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        fontWeight: 700
                      }}
                    >
                      نسبة عمولة الموزع
                    </div>

                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#059669',
                        marginTop: '2px'
                      }}
                    >
                      {r.commissionRate}%
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        fontWeight: 700
                      }}
                    >
                      عمولة الموزع
                    </div>

                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#059669',
                        marginTop: '2px'
                      }}
                    >
                      {r.commissionValue.toLocaleString('en-US')} ريال
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        fontWeight: 700
                      }}
                    >
                      مستحق المدير
                    </div>

                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#2563EB',
                        marginTop: '2px'
                      }}
                    >
                      {r.managerDue.toLocaleString('en-US')} ريال
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* تخصيص الطباعة لمنع الشاشة البيضاء وإخراج PDF مرتب ونظيف */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }

          .no-print,
          .sidebar {
            display: none !important;
          }

          .app,
          .main {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .panel,
          .stat {
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            margin-bottom: 15px !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
