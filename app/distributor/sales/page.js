'use client';

import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumericDate(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) {
    return dateString;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
}

function getYearMonth(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

export default function DistributorSalesPage() {
  const { profile, loading } = useProfile('distributor');

  const [soldCards, setSoldCards] = useState([]);
  const [myCards, setMyCards] = useState([]);

  // الدين الحالي الحقيقي من قاعدة البيانات
  const [currentDebt, setCurrentDebt] = useState(0);

  // السدادات المسجلة
  const [payments, setPayments] = useState([]);

  // حالة تحميل التقرير
  const [reportLoading, setReportLoading] = useState(true);

  // الأخطاء
  const [error, setError] = useState('');

  const currentDate = new Date();

  const [selectedYear, setSelectedYear] = useState(
    String(currentDate.getFullYear())
  );

  const [selectedMonthNum, setSelectedMonthNum] = useState(
    String(currentDate.getMonth() + 1).padStart(2, '0')
  );

  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;

  // =====================================================
  // تحميل بيانات التقرير
  // =====================================================

  async function loadData() {
    if (!profile?.id) return;

    setReportLoading(true);
    setError('');

    try {
      // =====================================================
      // 1. جلب بيانات الموزع الحالية
      // =====================================================
      //
      // الدين يتم قراءته مباشرة من profiles
      // ولا يتم إعادة حسابه من المبيعات
      //
      // =====================================================

      const { data: distributorData, error: distributorError } =
        await supabase
          .from('profiles')
          .select(
            `
              id,
              full_name,
              commission_rate,
              debt,
              debt_balance
            `
          )
          .eq('id', profile.id)
          .single();

      if (distributorError) {
        throw new Error(
          `تعذر تحميل الحالة المالية: ${distributorError.message}`
        );
      }

      const realCurrentDebt = Number(
        distributorData?.debt_balance ??
          distributorData?.debt ??
          0
      );

      setCurrentDebt(realCurrentDebt);

      // =====================================================
      // 2. جلب الكروت المباعة
      // =====================================================

      const { data: cardsData, error: cardsError } =
        await supabase
          .from('cards')
          .select(
            `
              id,
              sold_at,
              manager_price,
              packages (
                name,
                price
              )
            `
          )
          .eq('assigned_to', profile.id)
          .eq('status', 'sold')
          .order('sold_at', {
            ascending: false,
          });

      if (cardsError) {
        throw new Error(
          `تعذر تحميل المبيعات: ${cardsError.message}`
        );
      }

      const formattedSales = (cardsData || []).map((card) => ({
        id: card.id,

        package_name:
          card.packages?.name || 'باقة كرت',

        price: Number(
          card.packages?.price || 0
        ),

        manager_price: Number(
          card.manager_price || 0
        ),

        sold_at: card.sold_at,
      }));

      setSoldCards(formattedSales);

      // =====================================================
      // 3. جلب المخزون الحالي
      // =====================================================

      const { data: inventoryData, error: inventoryError } =
        await supabase
          .from('cards')
          .select(
            `
              id,
              assigned_to,
              status,
              packages (
                name,
                price
              )
            `
          )
          .eq('assigned_to', profile.id)
          .eq('status', 'with_distributor');

      if (inventoryError) {
        throw new Error(
          `تعذر تحميل المخزون: ${inventoryError.message}`
        );
      }

      setMyCards(inventoryData || []);

      // =====================================================
      // 4. جلب السدادات الصحيحة
      // =====================================================
      //
      // المصدر المالي الرسمي للسداد هو:
      //
      // distributor_debt_transactions
      //
      // وليس جدول payments القديم
      //
      // =====================================================

      const { data: paymentsData, error: paymentsError } =
        await supabase
          .from('distributor_debt_transactions')
          .select(
            `
              id,
              amount,
              type,
              created_at,
              notes
            `
          )
          .eq('distributor_id', profile.id)
          .eq('type', 'payment')
          .order('created_at', {
            ascending: false,
          });

      if (paymentsError) {
        throw new Error(
          `تعذر تحميل السدادات: ${paymentsError.message}`
        );
      }

      const formattedPayments = (paymentsData || []).map(
        (payment) => ({
          id: payment.id,
          amount: Number(payment.amount || 0),
          type: payment.type,
          created_at: payment.created_at,
          notes: payment.notes || '',
        })
      );

      setPayments(formattedPayments);

    } catch (err) {
      console.error('Distributor report error:', err);

      setError(
        err.message ||
          'حدث خطأ أثناء تحميل التقرير'
      );

    } finally {
      setReportLoading(false);
    }
  }

  // =====================================================
  // تحميل التقرير
  // =====================================================

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  // =====================================================
  // بيانات الموزع المالية
  // =====================================================

  const commissionRate = Number(
    profile?.commission_rate ?? 10
  );

  const managerRate =
    Math.max(
      0,
      100 - commissionRate
    );

  // =====================================================
  // مبيعات الشهر المحدد
  // =====================================================

  const filteredSales = useMemo(() => {
    return soldCards.filter((sale) => {
      return (
        getYearMonth(sale.sold_at) ===
        selectedMonth
      );
    });
  }, [
    soldCards,
    selectedMonth,
  ]);

  // =====================================================
  // سدادات الشهر المحدد
  // =====================================================

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      return (
        getYearMonth(
          payment.created_at
        ) === selectedMonth
      );
    });
  }, [
    payments,
    selectedMonth,
  ]);

  // =====================================================
  // إجمالي المبيعات الشهرية
  // =====================================================

  const monthlyRevenue =
    filteredSales.reduce(
      (sum, item) =>
        sum + Number(item.price || 0),
      0
    );

  // =====================================================
  // عمولة الموزع
  // =====================================================

  const monthlyCommission =
    (monthlyRevenue *
      commissionRate) /
    100;

  // =====================================================
  // مستحق المدير الناتج عن مبيعات الشهر
  // =====================================================

  const monthlyManagerDue =
    (monthlyRevenue *
      managerRate) /
    100;

  // =====================================================
  // إجمالي السداد خلال الشهر المحدد
  // =====================================================

  const monthlyPaidAmount =
    filteredPayments.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

  // =====================================================
  // إجمالي السدادات المسجلة تاريخياً
  // =====================================================

  const totalPaidAmount =
    payments.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

  // =====================================================
  // إجمالي قيمة المخزون الحالي
  // =====================================================

  const remainingInventoryValue =
    myCards.reduce(
      (sum, card) =>
        sum +
        Number(
          card.packages?.price || 0
        ),
      0
    );

  // =====================================================
  // ملخص المبيعات حسب الباقة
  // =====================================================

  const salesByPackage =
    useMemo(() => {
      const data = {};

      filteredSales.forEach((item) => {
        const name =
          item.package_name ||
          'باقة كرت';

        if (!data[name]) {
          data[name] = {
            count: 0,
            revenue: 0,
          };
        }

        data[name].count += 1;

        data[name].revenue +=
          Number(item.price || 0);
      });

      return data;
    }, [filteredSales]);

  // =====================================================
  // حالة التحميل
  // =====================================================

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="app">

      <Sidebar
        role="distributor"
        active="/distributor/sales"
        name={profile.full_name}
      />

      <div className="main">

        {/* ================================================= */}
        {/* رأس الصفحة */}
        {/* ================================================= */}

        <div className="topbar">

          <div>
            <h1>
              تقارير حالتي
            </h1>

            <div className="greet">
              متابعة مبيعاتك وأرباحك ومخزونك
              وحالتك المالية الحالية
            </div>
          </div>

        </div>

        {/* ================================================= */}
        {/* رسالة الخطأ */}
        {/* ================================================= */}

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 12,
              background: '#FEF2F2',
              border:
                '1px solid #FCA5A5',
              color: '#B91C1C',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* ================================================= */}
        {/* اختيار الفترة */}
        {/* ================================================= */}

        <div
          style={{
            marginBottom: 20,
            background: '#FFFFFF',
            padding: 16,
            borderRadius: 16,
            border:
              '1px solid #E2E8F0',
            boxShadow:
              '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >

          <label
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#334155',
              display: 'block',
              marginBottom: 8,
            }}
          >
            تحديد شهر التقرير:
          </label>

          <div
            style={{
              display: 'flex',
              gap: 10,
            }}
          >

            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value
                )
              }
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontWeight: 800,
                fontSize: 14,
                background: '#F8FAFC',
              }}
            >
              <option value="2025">
                2025
              </option>

              <option value="2026">
                2026
              </option>

              <option value="2027">
                2027
              </option>

            </select>

            <select
              value={
                selectedMonthNum
              }
              onChange={(e) =>
                setSelectedMonthNum(
                  e.target.value
                )
              }
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontWeight: 800,
                fontSize: 14,
                direction: 'ltr',
                background: '#F8FAFC',
              }}
            >
              <option value="01">
                شهر 01
              </option>

              <option value="02">
                شهر 02
              </option>

              <option value="03">
                شهر 03
              </option>

              <option value="04">
                شهر 04
              </option>

              <option value="05">
                شهر 05
              </option>

              <option value="06">
                شهر 06
              </option>

              <option value="07">
                شهر 07
              </option>

              <option value="08">
                شهر 08
              </option>

              <option value="09">
                شهر 09
              </option>

              <option value="10">
                شهر 10
              </option>

              <option value="11">
                شهر 11
              </option>

              <option value="12">
                شهر 12
              </option>

            </select>

          </div>

        </div>

        {/* ================================================= */}
        {/* حالة التحميل */}
        {/* ================================================= */}

        {reportLoading ? (

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 30,
              textAlign: 'center',
              color: '#64748B',
              border:
                '1px solid #E2E8F0',
              fontWeight: 700,
            }}
          >
            جاري تحميل التقرير...
          </div>

        ) : (

          <>

            {/* ============================================= */}
            {/* بطاقات المبيعات والعمولة */}
            {/* ============================================= */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 12,
                marginBottom: 12,
              }}
            >

              <div
                style={{
                  background:
                    'linear-gradient(135deg, #F3F0FB 0%, #EDE9FE 100%)',
                  padding: 16,
                  borderRadius: 16,
                  border:
                    '1px solid #DDD6FE',
                }}
              >

                <div
                  style={{
                    fontSize: 12,
                    color: '#6D28D9',
                    fontWeight: 800,
                  }}
                >
                  مبيعات الفترة
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#4C1D95',
                    marginTop: 4,
                  }}
                >
                  {formatNumber(
                    monthlyRevenue
                  )}

                  <span
                    style={{
                      fontSize: 12,
                    }}
                  >
                    {' '}
                    ر.ي
                  </span>

                </div>

              </div>

              <div
                style={{
                  background:
                    'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                  padding: 16,
                  borderRadius: 16,
                  border:
                    '1px solid #A7F3D0',
                }}
              >

                <div
                  style={{
                    fontSize: 12,
                    color: '#047857',
                    fontWeight: 800,
                  }}
                >
                  عمولتك ({commissionRate}%)
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#059669',
                    marginTop: 4,
                  }}
                >
                  {formatNumber(
                    monthlyCommission
                  )}

                  <span
                    style={{
                      fontSize: 12,
                    }}
                  >
                    {' '}
                    ر.ي
                  </span>

                </div>

              </div>

            </div>

            {/* ============================================= */}
            {/* مستحق المدير من مبيعات الفترة */}
            {/* ============================================= */}

            <div
              style={{
                background:
                  '#FFF7ED',
                border:
                  '1px solid #FED7AA',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >

              <div
                style={{
                  fontSize: 12,
                  color: '#C2410C',
                  fontWeight: 800,
                }}
              >
                مستحق المدير الناتج عن
                مبيعات هذه الفترة
                ({managerRate}%)
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#9A3412',
                  marginTop: 4,
                }}
              >
                {formatNumber(
                  monthlyManagerDue
                )}{' '}
                <span
                  style={{
                    fontSize: 12,
                  }}
                >
                  ر.ي
                </span>
              </div>

            </div>

            {/* ============================================= */}
            {/* السداد خلال الفترة */}
            {/* ============================================= */}

            <div
              style={{
                background:
                  '#F0FDFA',
                border:
                  '1px solid #99F6E4',
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}
            >

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                }}
              >

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#0F766E',
                      fontWeight: 800,
                    }}
                  >
                    إجمالي السداد خلال
                    الفترة المحددة
                  </div>

                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#0F766E',
                      marginTop: 4,
                    }}
                  >
                    {formatNumber(
                      monthlyPaidAmount
                    )}{' '}
                    <span
                      style={{
                        fontSize: 12,
                      }}
                    >
                      ر.ي
                    </span>
                  </div>

                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#0F766E',
                    fontWeight: 700,
                    background:
                      '#CCFBF1',
                    padding:
                      '7px 10px',
                    borderRadius: 10,
                  }}
                >
                  {filteredPayments.length}{' '}
                  عملية سداد
                </div>

              </div>

            </div>

            {/* ============================================= */}
            {/* الدين الحالي الحقيقي */}
            {/* ============================================= */}

            <div
              style={{
                background:
                  currentDebt > 0
                    ? 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)'
                    : 'linear-gradient(135deg, #065F46 0%, #059669 100%)',

                borderRadius: 16,

                padding:
                  '18px 20px',

                color: '#FFFFFF',

                marginBottom: 20,

                boxShadow:
                  '0 4px 12px rgba(0,0,0,0.08)',
              }}
            >

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                }}
              >

                <div>

                  <div
                    style={{
                      fontSize: 12,
                      color: '#F8FAFC',
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    المبلغ الحالي المستحق
                    للمدير
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                    }}
                  >
                    {formatNumber(
                      currentDebt
                    )}{' '}

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight:
                          'normal',
                      }}
                    >
                      ر.ي
                    </span>

                  </div>

                </div>

                <div
                  style={{
                    textAlign: 'left',
                    fontSize: 11,
                    background:
                      'rgba(255,255,255,0.18)',
                    padding:
                      '7px 10px',
                    borderRadius: 10,
                  }}
                >
                  <div>
                    الحالة المالية الحالية
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontWeight: 800,
                    }}
                  >
                    {currentDebt > 0
                      ? 'يوجد مستحق'
                      : 'لا يوجد مستحق'}
                  </div>

                </div>

              </div>

            </div>

            {/* ============================================= */}
            {/* ملخص الباقات */}
            {/* ============================================= */}

            <div
              className="panel"
              style={{
                marginBottom: 20,
                background:
                  '#FFFFFF',
                borderRadius: 16,
                border:
                  '1px solid #E2E8F0',
                padding: 16,
              }}
            >

              <h3
                style={{
                  margin:
                    '0 0 12px 0',
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#0F172A',
                }}
              >
                ملخص الباقات المباعة
              </h3>

              {Object.keys(
                salesByPackage
              ).length === 0 ? (

                <div
                  style={{
                    fontSize: 13,
                    color: '#64748B',
                    padding:
                      '10px 0',
                    textAlign:
                      'center',
                  }}
                >
                  لا توجد مبيعات مسجلة
                  في هذه الفترة
                </div>

              ) : (

                Object.entries(
                  salesByPackage
                ).map(
                  ([name, data]) => (

                    <div
                      key={name}
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        padding:
                          '10px 0',

                        fontSize: 13,

                        borderBottom:
                          '1px solid #F1F5F9',
                      }}
                    >

                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            '#334155',
                        }}
                      >
                        {name}
                      </span>

                      <span
                        style={{
                          fontWeight: 900,
                          color:
                            '#0F172A',
                        }}
                      >
                        {data.count} كرت{' '}

                        <span
                          style={{
                            color:
                              '#059669',

                            fontWeight: 700,
                          }}
                        >
                          (
                          {formatNumber(
                            data.revenue
                          )}{' '}
                          ر.ي)
                        </span>

                      </span>

                    </div>

                  )
                )

              )}

            </div>

            {/* ============================================= */}
            {/* المخزون الحالي */}
            {/* ============================================= */}

            <div
              className="panel"
              style={{
                background:
                  '#FFFFFF',

                border:
                  '1px solid #E2E8F0',

                borderRadius: 16,

                padding: 16,

                marginBottom: 20,
              }}
            >

              <h3
                style={{
                  margin:
                    '0 0 12px 0',

                  fontSize: 15,

                  fontWeight: 900,

                  color: '#0F172A',
                }}
              >
                حالة المخزون الحالي
              </h3>

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  fontSize: 13,

                  background:
                    '#FAF5FF',

                  padding:
                    '12px 14px',

                  borderRadius: 12,

                  border:
                    '1px solid #F3E8FF',
                }}
              >

                <span
                  style={{
                    fontWeight: 700,

                    color:
                      '#6B21A8',
                  }}
                >
                  قيمة الكروت الموجودة
                  لديك ({myCards.length} كرت)
                </span>

                <span
                  style={{
                    fontWeight: 900,

                    color:
                      '#7E22CE',

                    fontSize: 15,
                  }}
                >
                  {formatNumber(
                    remainingInventoryValue
                  )}{' '}
                  ر.ي
                </span>

              </div>

            </div>

            {/* ============================================= */}
            {/* سجل السدادات */}
            {/* ============================================= */}

            <div
              className="panel"
              style={{
                background:
                  '#FFFFFF',

                border:
                  '1px solid #E2E8F0',

                borderRadius: 16,

                padding: 16,

                marginBottom: 20,
              }}
            >

              <h3
                style={{
                  margin:
                    '0 0 12px 0',

                  fontSize: 15,

                  fontWeight: 900,

                  color: '#0F172A',
                }}
              >
                سجل السدادات
              </h3>

              {filteredPayments.length ===
              0 ? (

                <div
                  style={{
                    fontSize: 13,

                    color:
                      '#64748B',

                    padding:
                      '10px 0',

                    textAlign:
                      'center',
                  }}
                >
                  لا توجد عمليات سداد
                  مسجلة في هذه الفترة
                </div>

              ) : (

                filteredPayments.map(
                  (payment) => (

                    <div
                      key={
                        payment.id
                      }
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'center',

                        padding:
                          '10px 0',

                        borderBottom:
                          '1px solid #F1F5F9',
                      }}
                    >

                      <div>

                        <div
                          style={{
                            fontWeight: 800,

                            fontSize: 13,

                            color:
                              '#0F172A',
                          }}
                        >
                          سداد نقدي
                        </div>

                        {payment.notes && (

                          <div
                            style={{
                              fontSize: 11,

                              color:
                                '#64748B',

                              marginTop: 3,
                            }}
                          >
                            {
                              payment.notes
                            }
                          </div>

                        )}

                      </div>

                      <div
                        style={{
                          textAlign:
                            'left',
                        }}
                      >

                        <div
                          style={{
                            fontWeight: 900,

                            fontSize: 14,

                            color:
                              '#059669',
                          }}
                        >
                          {formatNumber(
                            payment.amount
                          )}{' '}
                          ر.ي
                        </div>

                        <div
                          style={{
                            fontSize: 11,

                            color:
                              '#64748B',

                            marginTop: 3,
                          }}
                        >
                          {formatNumericDate(
                            payment.created_at
                          )}
                        </div>

                      </div>

                    </div>

                  )
                )

              )}

            </div>

            {/* ============================================= */}
            {/* سجل المبيعات */}
            {/* ============================================= */}

            <div
              className="panel"
              style={{
                background:
                  '#FFFFFF',

                border:
                  '1px solid #E2E8F0',

                borderRadius: 16,

                padding: 16,
              }}
            >

              <h3
                style={{
                  margin:
                    '0 0 12px 0',

                  fontSize: 15,

                  fontWeight: 900,

                  color: '#0F172A',
                }}
              >
                سجل المبيعات التفصيلي
              </h3>

              {filteredSales.length ===
              0 ? (

                <div
                  style={{
                    fontSize: 13,

                    color:
                      '#64748B',

                    padding:
                      '10px 0',

                    textAlign:
                      'center',
                  }}
                >
                  لا توجد عمليات بيع
                  مسجلة في هذه الفترة
                </div>

              ) : (

                filteredSales.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={
                        item.id ||
                        index
                      }
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'center',

                        padding:
                          '10px 0',

                        borderBottom:
                          '1px solid #F1F5F9',
                      }}
                    >

                      <div>

                        <div
                          style={{
                            fontWeight: 800,

                            fontSize: 13,

                            color:
                              '#0F172A',
                          }}
                        >
                          {
                            item.package_name
                          }
                        </div>

                        <div
                          style={{
                            fontSize: 12,

                            color:
                              '#64748B',

                            marginTop: 2,
                          }}
                        >
                          قيمة البيع:{' '}

                          {formatNumber(
                            item.price
                          )}{' '}

                          ر.ي
                        </div>

                      </div>

                      <div
                        style={{
                          fontSize: 12,

                          fontWeight: 700,

                          color:
                            '#475569',

                          background:
                            '#F1F5F9',

                          padding:
                            '4px 8px',

                          borderRadius: 8,
                        }}
                      >
                        {formatNumericDate(
                          item.sold_at
                        )}
                      </div>

                    </div>

                  )
                )

              )}

            </div>

            {/* ============================================= */}
            {/* إجمالي السدادات التاريخية */}
            {/* ============================================= */}

            <div
              style={{
                marginTop: 16,

                padding: 12,

                borderRadius: 12,

                background:
                  '#F8FAFC',

                border:
                  '1px solid #E2E8F0',

                fontSize: 12,

                color:
                  '#475569',

                display:
                  'flex',

                justifyContent:
                  'space-between',
              }}
            >

              <span
                style={{
                  fontWeight: 700,
                }}
              >
                إجمالي السدادات المسجلة
              </span>

              <strong
                style={{
                  color:
                    '#059669',

                  fontSize: 14,
                }}
              >
                {formatNumber(
                  totalPaidAmount
                )}{' '}
                ر.ي
              </strong>

            </div>

          </>

        )}

      </div>

    </div>
  );
}
