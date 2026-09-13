'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function formatNumericDate(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return dateString;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}

function formatDateTime(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return dateString;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} - ${hours}:${minutes}`;
}

function getDateKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getYearKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  return String(d.getFullYear());
}

function getLocalDateValue(date) {
  const d = date instanceof Date ? date : new Date(date);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();

  // الأحد = 0
  // نعتبر الأسبوع من الأحد إلى السبت.
  d.setDate(d.getDate() - day);

  return d;
}

function getEndOfWeek(date) {
  const start = getStartOfWeek(date);
  const end = new Date(start);

  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return end;
}

function getYesterdayValue() {
  const d = new Date();
  d.setDate(d.getDate() - 1);

  return getLocalDateValue(d);
}

function getDynamicSaleValue(sale, keys) {
  for (const key of keys) {
    if (
      sale &&
      sale[key] !== undefined &&
      sale[key] !== null &&
      String(sale[key]).trim() !== ''
    ) {
      return sale[key];
    }
  }

  return '';
}

export default function DistributorSalesPage() {
  const { profile, loading } = useProfile('distributor');

  const [soldCards, setSoldCards] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [currentDebt, setCurrentDebt] = useState(0);
  const [commissionRate, setCommissionRate] = useState(10);

  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();

  const currentDateValue = getLocalDateValue(today);

  const currentMonthValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0')
  ].join('-');

  const currentYearValue = String(today.getFullYear());

  const [reportType, setReportType] = useState('month');

  const [selectedDay, setSelectedDay] = useState(
    currentDateValue
  );

  const [selectedMonth, setSelectedMonth] = useState(
    currentMonthValue
  );

  const [selectedYear, setSelectedYear] = useState(
    currentYearValue
  );

  const [customFrom, setCustomFrom] = useState(
    currentDateValue
  );

  const [customTo, setCustomTo] = useState(
    currentDateValue
  );

  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 20;

  async function loadData(showRefresh = false) {
    if (!profile) return;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setDataLoading(true);
    }

    try {
      /*
       * بيانات الموزع الحالية.
       *
       * الدين الحالي مستقل عن الفترة المحددة.
       */
      const {
        data: distributorData,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(
          'debt_balance, debt, commission_rate'
        )
        .eq('id', profile.id)
        .single();

      if (profileError) {
        console.error(
          'Error loading distributor profile:',
          profileError
        );
      }

      if (distributorData) {
        setCurrentDebt(
          Number(
            distributorData.debt_balance ??
            distributorData.debt ??
            0
          )
        );

        setCommissionRate(
          Number(
            distributorData.commission_rate ??
            10
          )
        );
      }

      /*
       * سجل المبيعات التاريخي.
       *
       * نستخدم * هنا حتى نستطيع الاستفادة من أي معلومات
       * محفوظة أصلًا في sales_log مثل كود الكرت أو اسم العميل
       * أو قيمة العمولة التاريخية، إن كانت موجودة.
       *
       * لا يتم إنشاء أو تعديل أي عمود.
       */
      const {
        data: salesData,
        error: salesError
      } = await supabase
        .from('sales_log')
        .select('*')
        .eq('distributor_id', profile.id)
        .order('sold_at', {
          ascending: false
        });

      if (salesError) {
        console.error(
          'Error loading sales log:',
          salesError
        );
      }

      const formattedSales =
        (salesData || []).map((sale) => {
          const cardCode = getDynamicSaleValue(
            sale,
            [
              'code',
              'card_code',
              'cardCode',
              'card_number',
              'cardNumber'
            ]
          );

          const customerName =
            getDynamicSaleValue(
              sale,
              [
                'customer_name',
                'customerName',
                'customer',
                'client_name',
                'clientName'
              ]
            );

          const historicalCommission =
            getDynamicSaleValue(
              sale,
              [
                'distributor_commission',
                'commission',
                'commission_amount',
                'distributor_share',
                'distributor_share_amount'
              ]
            );

          return {
            ...sale,

            id: sale.id,

            package_name:
              sale.package_name ||
              'باقة غير معروفة',

            price: Number(
              sale.price || 0
            ),

            sold_at: sale.sold_at,

            card_code:
              cardCode
                ? String(cardCode)
                : '',

            customer_name:
              customerName
                ? String(customerName)
                : '',

            historical_commission:
              historicalCommission !== ''
                ? Number(
                    historicalCommission
                  )
                : null
          };
        });

      setSoldCards(formattedSales);

      /*
       * المخزون الحالي فقط.
       *
       * with_distributor لا يدخل في المبيعات.
       */
      const {
        data: inventoryData,
        error: inventoryError
      } = await supabase
        .from('cards')
        .select(`
          id,
          code,
          packages (
            name,
            price
          )
        `)
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      if (inventoryError) {
        console.error(
          'Error loading inventory:',
          inventoryError
        );
      }

      setMyCards(inventoryData || []);

    } catch (error) {
      console.error(
        'Distributor report error:',
        error
      );
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  /*
   * فلترة الفترة.
   */
  const periodFilteredSales = useMemo(() => {
    return soldCards.filter((sale) => {
      if (!sale.sold_at) return false;

      if (reportType === 'day') {
        return (
          getDateKey(sale.sold_at) ===
          selectedDay
        );
      }

      if (reportType === 'yesterday') {
        return (
          getDateKey(sale.sold_at) ===
          getYesterdayValue()
        );
      }

      if (reportType === 'week') {
        const saleDate = new Date(
          sale.sold_at
        );

        if (isNaN(saleDate.getTime())) {
          return false;
        }

        const start = getStartOfWeek(
          new Date()
        );

        const end = getEndOfWeek(
          new Date()
        );

        return (
          saleDate >= start &&
          saleDate <= end
        );
      }

      if (reportType === 'month') {
        return (
          getMonthKey(sale.sold_at) ===
          selectedMonth
        );
      }

      if (reportType === 'year') {
        return (
          getYearKey(sale.sold_at) ===
          selectedYear
        );
      }

      if (reportType === 'custom') {
        if (!customFrom || !customTo) {
          return true;
        }

        const fromDate = new Date(
          `${customFrom}T00:00:00`
        );

        const toDate = new Date(
          `${customTo}T23:59:59.999`
        );

        const saleDate = new Date(
          sale.sold_at
        );

        if (
          isNaN(fromDate.getTime()) ||
          isNaN(toDate.getTime()) ||
          isNaN(saleDate.getTime())
        ) {
          return false;
        }

        return (
          saleDate >= fromDate &&
          saleDate <= toDate
        );
      }

      return true;
    });
  }, [
    soldCards,
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear,
    customFrom,
    customTo
  ]);

  /*
   * البحث داخل نتائج الفترة.
   *
   * يدعم:
   * - كود الكرت إذا كان محفوظًا في sales_log
   * - اسم العميل إذا كان محفوظًا
   * - اسم الباقة
   */
  const filteredSales = useMemo(() => {
    const term =
      searchTerm.trim().toLowerCase();

    if (!term) {
      return periodFilteredSales;
    }

    return periodFilteredSales.filter(
      (sale) => {
        const values = [
          sale.card_code,
          sale.customer_name,
          sale.package_name,
          sale.code,
          sale.card_code,
          sale.card_number
        ];

        return values.some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(term)
        );
      }
    );
  }, [
    periodFilteredSales,
    searchTerm
  ]);

  /*
   * عند تغيير البحث أو الفترة نعود للصفحة الأولى.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear,
    customFrom,
    customTo,
    searchTerm
  ]);

  /*
   * إجمالي المبيعات.
   */
  const salesTotal = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.price || 0),
      0
    );
  }, [filteredSales]);

  /*
   * عدد الكروت المباعة.
   */
  const soldCardsCount =
    filteredSales.length;

  /*
   * العمولة.
   *
   * إذا كان السجل التاريخي يحتوي على قيمة العمولة،
   * نستخدمها.
   *
   * وإذا لم تكن محفوظة، نحافظ على طريقة الحساب الحالية
   * باستخدام نسبة العمولة الحالية.
   */
  const distributorCommission =
    useMemo(() => {
      return filteredSales.reduce(
        (sum, sale) => {
          if (
            sale.historical_commission !==
              null &&
            !Number.isNaN(
              sale.historical_commission
            )
          ) {
            return (
              sum +
              Number(
                sale.historical_commission
              )
            );
          }

          return (
            sum +
            Number(sale.price || 0) *
              (commissionRate / 100)
          );
        },
        0
      );
    }, [
      filteredSales,
      commissionRate
    ]);

  /*
   * متوسط قيمة الكرت.
   */
  const averageSaleValue =
    soldCardsCount > 0
      ? salesTotal / soldCardsCount
      : 0;

  /*
   * قيمة المخزون الحالي.
   */
  const inventoryValue = useMemo(() => {
    return myCards.reduce(
      (sum, card) =>
        sum +
        Number(
          card.packages?.price || 0
        ),
      0
    );
  }, [myCards]);

  /*
   * تجميع المبيعات حسب الباقة.
   */
  const salesByPackage = useMemo(() => {
    const result = {};

    filteredSales.forEach((sale) => {
      const packageName =
        sale.package_name ||
        'باقة غير معروفة';

      if (!result[packageName]) {
        result[packageName] = {
          count: 0,
          revenue: 0
        };
      }

      result[packageName].count += 1;

      result[packageName].revenue +=
        Number(sale.price || 0);
    });

    return result;
  }, [filteredSales]);

  /*
   * Pagination.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredSales.length /
        PAGE_SIZE
    )
  );

  const paginatedSales = useMemo(() => {
    const start =
      (currentPage - 1) *
      PAGE_SIZE;

    return filteredSales.slice(
      start,
      start + PAGE_SIZE
    );
  }, [
    filteredSales,
    currentPage
  ]);

  const paginationStart =
    filteredSales.length === 0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const paginationEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredSales.length
  );

  /*
   * عنوان الفترة.
   */
  const reportTitle = useMemo(() => {
    if (reportType === 'day') {
      return selectedDay || 'اليوم المحدد';
    }

    if (reportType === 'yesterday') {
      return 'أمس';
    }

    if (reportType === 'week') {
      const start = getStartOfWeek(
        new Date()
      );

      const end = getEndOfWeek(
        new Date()
      );

      return `${getLocalDateValue(
        start
      )} إلى ${getLocalDateValue(
        end
      )}`;
    }

    if (reportType === 'month') {
      return selectedMonth || 'الشهر المحدد';
    }

    if (reportType === 'year') {
      return selectedYear || 'السنة المحددة';
    }

    if (reportType === 'custom') {
      if (
        customFrom &&
        customTo
      ) {
        return `${customFrom} إلى ${customTo}`;
      }

      return 'فترة مخصصة';
    }

    return '';
  }, [
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear,
    customFrom,
    customTo
  ]);

  function selectToday() {
    setReportType('day');
    setSelectedDay(currentDateValue);
  }

  function selectYesterday() {
    setReportType('yesterday');
  }

  function selectCurrentWeek() {
    setReportType('week');
  }

  function selectCurrentMonth() {
    setReportType('month');
    setSelectedMonth(currentMonthValue);
  }

  function selectCurrentYear() {
    setReportType('year');
    setSelectedYear(currentYearValue);
  }

  function selectCustom() {
    setReportType('custom');
  }

  function goToPage(page) {
    const safePage = Math.min(
      Math.max(page, 1),
      totalPages
    );

    setCurrentPage(safePage);
  }

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

        {/* =========================
            رأس الصفحة
        ========================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 18
          }}
        >

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 25,
                fontWeight: 900,
                color: '#0F172A'
              }}
            >
              تقارير مبيعاتي
            </h1>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: '#64748B',
                fontWeight: 600
              }}
            >
              نظرة واضحة على مبيعاتك وعمولتك وحسابك
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              borderRadius: 11,
              padding: '10px 15px',
              fontWeight: 900,
              fontSize: 12,
              cursor: refreshing
                ? 'not-allowed'
                : 'pointer',
              opacity: refreshing ? 0.65 : 1,
              boxShadow:
                '0 2px 6px rgba(15,23,42,0.04)'
            }}
          >
            {refreshing
              ? 'جاري التحديث...'
              : '↻ تحديث البيانات'}
          </button>

        </div>

        {/* =========================
            اختيار الفترة
        ========================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            boxShadow:
              '0 2px 8px rgba(15,23,42,0.03)'
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 13
            }}
          >

            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#0F172A'
                }}
              >
                فترة التقرير
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: '#64748B',
                  marginTop: 4
                }}
              >
                حدد الفترة التي تريد تحليل مبيعاتها
              </div>
            </div>

            <div
              style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #DBEAFE',
                borderRadius: 9,
                padding: '7px 10px',
                fontSize: 11,
                fontWeight: 900
              }}
            >
              الفترة: {reportTitle}
            </div>

          </div>

          {/* أنواع التقارير */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 10
            }}
          >

            {[
              {
                value: 'day',
                label: 'اليوم'
              },
              {
                value: 'yesterday',
                label: 'أمس'
              },
              {
                value: 'week',
                label: 'هذا الأسبوع'
              },
              {
                value: 'month',
                label: 'هذا الشهر'
              },
              {
                value: 'year',
                label: 'هذا العام'
              },
              {
                value: 'custom',
                label: 'مخصص'
              }
            ].map((item) => {

              const active =
                reportType === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setReportType(
                      item.value
                    )
                  }
                  style={{
                    padding: '11px 8px',
                    borderRadius: 10,
                    border: active
                      ? '2px solid #2563EB'
                      : '1px solid #CBD5E1',
                    background: active
                      ? '#EFF6FF'
                      : '#FFFFFF',
                    color: active
                      ? '#1D4ED8'
                      : '#475569',
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              );
            })}

          </div>

          {/* اختصارات */}

          <div
            style={{
              display: 'flex',
              gap: 7,
              flexWrap: 'wrap',
              marginBottom: 11
            }}
          >

            <button
              type="button"
              onClick={selectToday}
              style={{
                border: '1px solid #DBEAFE',
                background: '#F8FAFC',
                color: '#1D4ED8',
                padding: '7px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              اليوم
            </button>

            <button
              type="button"
              onClick={selectYesterday}
              style={{
                border: '1px solid #DBEAFE',
                background: '#F8FAFC',
                color: '#1D4ED8',
                padding: '7px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              أمس
            </button>

            <button
              type="button"
              onClick={selectCurrentWeek}
              style={{
                border: '1px solid #DBEAFE',
                background: '#F8FAFC',
                color: '#1D4ED8',
                padding: '7px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              هذا الأسبوع
            </button>

            <button
              type="button"
              onClick={selectCurrentMonth}
              style={{
                border: '1px solid #DBEAFE',
                background: '#F8FAFC',
                color: '#1D4ED8',
                padding: '7px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              هذا الشهر
            </button>

            <button
              type="button"
              onClick={selectCurrentYear}
              style={{
                border: '1px solid #DBEAFE',
                background: '#F8FAFC',
                color: '#1D4ED8',
                padding: '7px 11px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              هذا العام
            </button>

          </div>

          {/* اختيار اليوم */}

          {reportType === 'day' && (
            <input
              type="date"
              value={selectedDay}
              onChange={(e) =>
                setSelectedDay(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 800,
                background: '#F8FAFC',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          )}

          {/* اختيار الشهر */}

          {reportType === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 800,
                background: '#F8FAFC',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          )}

          {/* اختيار السنة */}

          {reportType === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 800,
                background: '#F8FAFC',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            >
              {[
                currentYearValue,
                String(
                  Number(currentYearValue) - 1
                ),
                String(
                  Number(currentYearValue) - 2
                ),
                String(
                  Number(currentYearValue) - 3
                ),
                String(
                  Number(currentYearValue) + 1
                )
              ].map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>
          )}

          {/* الفترة المخصصة */}

          {reportType === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: 9
              }}
            >

              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#475569',
                    marginBottom: 5
                  }}
                >
                  من تاريخ
                </div>

                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) =>
                    setCustomFrom(
                      e.target.value
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: 10,
                    border:
                      '1.5px solid #CBD5E1',
                    fontSize: 13,
                    fontWeight: 800,
                    background: '#F8FAFC',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#475569',
                    marginBottom: 5
                  }}
                >
                  إلى تاريخ
                </div>

                <input
                  type="date"
                  value={customTo}
                  onChange={(e) =>
                    setCustomTo(
                      e.target.value
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: 10,
                    border:
                      '1.5px solid #CBD5E1',
                    fontSize: 13,
                    fontWeight: 800,
                    background: '#F8FAFC',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

            </div>
          )}

        </div>

        {/* =========================
            ملخص الفترة
        ========================== */}

        <div
          style={{
            background:
              'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '10px 13px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >

          <div
            style={{
              fontSize: 11,
              color: '#64748B',
              fontWeight: 800
            }}
          >
            النتائج المعروضة الآن
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: '#0F172A'
            }}
          >
            {reportTitle}
          </div>

        </div>

        {/* =========================
            أهم مؤشرات التقرير
        ========================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 16
          }}
        >

          <div
            style={{
              background:
                'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
              border: '1px solid #BFDBFE',
              borderRadius: 15,
              padding: 15
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#1D4ED8',
                fontWeight: 900
              }}
            >
              الكروت المباعة
            </div>

            <div
              style={{
                fontSize: 25,
                color: '#1E3A8A',
                fontWeight: 900,
                marginTop: 6
              }}
            >
              {formatNumber(
                soldCardsCount
              )}

              <span
                style={{
                  fontSize: 11,
                  marginRight: 5
                }}
              >
                كرت
              </span>
            </div>
          </div>

          <div
            style={{
              background:
                'linear-gradient(135deg, #F3F0FF, #EDE9FE)',
              border: '1px solid #DDD6FE',
              borderRadius: 15,
              padding: 15
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#6D28D9',
                fontWeight: 900
              }}
            >
              إجمالي المبيعات
            </div>

            <div
              style={{
                fontSize: 22,
                color: '#4C1D95',
                fontWeight: 900,
                marginTop: 6
              }}
            >
              {formatNumber(
                salesTotal
              )}

              <span
                style={{
                  fontSize: 10,
                  marginRight: 5
                }}
              >
                ر.ي
              </span>
            </div>
          </div>

          <div
            style={{
              background:
                'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
              border: '1px solid #A7F3D0',
              borderRadius: 15,
              padding: 15
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#047857',
                fontWeight: 900
              }}
            >
              عمولتي
            </div>

            <div
              style={{
                fontSize: 22,
                color: '#059669',
                fontWeight: 900,
                marginTop: 6
              }}
            >
              {formatNumber(
                distributorCommission
              )}

              <span
                style={{
                  fontSize: 10,
                  marginRight: 5
                }}
              >
                ر.ي
              </span>
            </div>

            <div
              style={{
                fontSize: 10,
                color: '#047857',
                fontWeight: 700,
                marginTop: 3
              }}
            >
              بنسبة {commissionRate}%
            </div>
          </div>

          {/* الدين الحالي */}

          <div
            style={{
              background:
                currentDebt > 0
                  ? 'linear-gradient(135deg, #991B1B, #DC2626)'
                  : 'linear-gradient(135deg, #065F46, #059669)',
              borderRadius: 15,
              padding: 15,
              color: '#FFFFFF'
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                opacity: 0.9
              }}
            >
              المتبقي عليّ من الدين
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 6
              }}
            >
              {formatNumber(
                currentDebt
              )}

              <span
                style={{
                  fontSize: 10,
                  marginRight: 5
                }}
              >
                ر.ي
              </span>
            </div>

            <div
              style={{
                fontSize: 9,
                marginTop: 3,
                fontWeight: 800,
                opacity: 0.9
              }}
            >
              الدين الحالي وليس دين الفترة
            </div>
          </div>

        </div>

        {/* =========================
            مؤشرات إضافية
        ========================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 16
          }}
        >

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 13,
              padding: 13
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#64748B',
                fontWeight: 800
              }}
            >
              متوسط قيمة الكرت
            </div>

            <div
              style={{
                fontSize: 19,
                color: '#0F172A',
                fontWeight: 900,
                marginTop: 5
              }}
            >
              {formatNumber(
                averageSaleValue
              )}

              <span
                style={{
                  fontSize: 10,
                  marginRight: 4
                }}
              >
                ر.ي
              </span>
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 13,
              padding: 13
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#64748B',
                fontWeight: 800
              }}
            >
              نسبة العمولة
            </div>

            <div
              style={{
                fontSize: 19,
                color: '#0F172A',
                fontWeight: 900,
                marginTop: 5
              }}
            >
              {commissionRate}%
            </div>
          </div>

        </div>

        {/* =========================
            المخزون الحالي
        ========================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            boxShadow:
              '0 2px 8px rgba(15,23,42,0.03)'
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap'
            }}
          >

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#0F172A'
                }}
              >
                المخزون الحالي
              </h3>

              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  marginTop: 4
                }}
              >
                الكروت الموجودة لديك ولم يتم بيعها
              </div>
            </div>

            <div
              style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #DBEAFE',
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 900
              }}
            >
              {formatNumber(
                myCards.length
              )}{' '}
              كرت
            </div>

          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 9
            }}
          >

            <div
              style={{
                background: '#F8FAFC',
                border:
                  '1px solid #E2E8F0',
                borderRadius: 11,
                padding: 12
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  fontWeight: 800
                }}
              >
                عدد الكروت
              </div>

              <div
                style={{
                  fontSize: 20,
                  color: '#0F172A',
                  fontWeight: 900,
                  marginTop: 4
                }}
              >
                {formatNumber(
                  myCards.length
                )}
              </div>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                border:
                  '1px solid #E2E8F0',
                borderRadius: 11,
                padding: 12
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  fontWeight: 800
                }}
              >
                القيمة الإجمالية
              </div>

              <div
                style={{
                  fontSize: 18,
                  color: '#2563EB',
                  fontWeight: 900,
                  marginTop: 4
                }}
              >
                {formatNumber(
                  inventoryValue
                )}

                <span
                  style={{
                    fontSize: 9,
                    marginRight: 4
                  }}
                >
                  ر.ي
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* =========================
            ملخص الباقات
        ========================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            boxShadow:
              '0 2px 8px rgba(15,23,42,0.03)'
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 12
            }}
          >

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#0F172A'
                }}
              >
                ملخص الباقات المباعة
              </h3>

              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  marginTop: 4
                }}
              >
                توزيع المبيعات داخل الفترة المحددة
              </div>
            </div>

            <div
              style={{
                background: '#F1F5F9',
                color: '#475569',
                padding: '6px 9px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 900
              }}
            >
              {Object.keys(
                salesByPackage
              ).length}{' '}
              باقة
            </div>

          </div>

          {Object.keys(
            salesByPackage
          ).length === 0 ? (

            <div
              style={{
                padding: 22,
                textAlign: 'center',
                background: '#F8FAFC',
                border:
                  '1px dashed #CBD5E1',
                borderRadius: 12,
                color: '#64748B'
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  marginBottom: 6
                }}
              >
                📦
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#334155'
                }}
              >
                لا توجد مبيعات
              </div>

              <div
                style={{
                  fontSize: 10,
                  marginTop: 3
                }}
              >
                لا توجد مبيعات لهذه الفترة
              </div>
            </div>

          ) : (

            <div
              style={{
                display: 'grid',
                gap: 8
              }}
            >

              {Object.entries(
                salesByPackage
              ).map(
                ([name, data]) => (

                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 11,
                      background: '#F8FAFC',
                      border:
                        '1px solid #E2E8F0'
                    }}
                  >

                    <div
                      style={{
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: '#334155',
                          overflow:
                            'hidden',
                          textOverflow:
                            'ellipsis',
                          whiteSpace:
                            'nowrap'
                        }}
                      >
                        {name}
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          color: '#64748B',
                          marginTop: 3
                        }}
                      >
                        {formatNumber(
                          data.count
                        )}{' '}
                        كرت
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: 'left',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: '#0F172A'
                        }}
                      >
                        {formatNumber(
                          data.revenue
                        )}{' '}
                        ر.ي
                      </div>

                      <div
                        style={{
                          fontSize: 9,
                          color: '#059669',
                          fontWeight: 800,
                          marginTop: 2
                        }}
                      >
                        إجمالي المبيعات
                      </div>
                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>

        {/* =========================
            سجل المبيعات
        ========================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            boxShadow:
              '0 2px 8px rgba(15,23,42,0.03)'
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 12
            }}
          >

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#0F172A'
                }}
              >
                سجل المبيعات
              </h3>

              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  marginTop: 4
                }}
              >
                تفاصيل عمليات البيع في الفترة المحددة
              </div>
            </div>

            <div
              style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                border:
                  '1px solid #DBEAFE',
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 900
              }}
            >
              {formatNumber(
                filteredSales.length
              )}{' '}
              عملية
            </div>

          </div>

          {/* البحث */}

          <div
            style={{
              marginBottom: 13
            }}
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
              placeholder="ابحث بالكرت أو اسم العميل أو الباقة..."
              style={{
                width: '100%',
                padding: '12px 13px',
                border:
                  '1.5px solid #CBD5E1',
                borderRadius: 11,
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: 12,
                fontWeight: 700,
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {dataLoading ? (

            <div
              style={{
                textAlign: 'center',
                padding: 30,
                background: '#F8FAFC',
                borderRadius: 12,
                color: '#64748B'
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  marginBottom: 7
                }}
              >
                ⏳
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                جاري تحميل التقرير...
              </div>
            </div>

          ) : filteredSales.length === 0 ? (

            <div
              style={{
                textAlign: 'center',
                padding: 30,
                background: '#F8FAFC',
                border:
                  '1px dashed #CBD5E1',
                borderRadius: 12
              }}
            >
              <div
                style={{
                  fontSize: 25,
                  marginBottom: 7
                }}
              >
                📊
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#334155'
                }}
              >
                {searchTerm
                  ? 'لا توجد نتائج للبحث'
                  : 'لا توجد مبيعات في هذه الفترة'}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: '#64748B',
                  marginTop: 4
                }}
              >
                {searchTerm
                  ? 'جرّب كلمة بحث أخرى'
                  : 'جرّب اختيار فترة أخرى'}
              </div>
            </div>

          ) : (

            <>
              <div
                style={{
                  display: 'grid',
                  gap: 8
                }}
              >

                {paginatedSales.map(
                  (item, index) => {

                    const absoluteIndex =
                      (currentPage - 1) *
                        PAGE_SIZE +
                      index +
                      1;

                    const cardCode =
                      item.card_code ||
                      item.code ||
                      '';

                    const customerName =
                      item.customer_name ||
                      '';

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: '#F8FAFC',
                          border:
                            '1px solid #E2E8F0',
                          borderRadius: 12,
                          padding: 12
                        }}
                      >

                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'flex-start',
                            gap: 12
                          }}
                        >

                          <div
                            style={{
                              minWidth: 0,
                              flex: 1
                            }}
                          >

                            <div
                              style={{
                                display: 'flex',
                                alignItems:
                                  'center',
                                gap: 7,
                                marginBottom: 7
                              }}
                            >

                              <div
                                style={{
                                  width: 27,
                                  height: 27,
                                  borderRadius: 8,
                                  background:
                                    '#DBEAFE',
                                  color:
                                    '#1D4ED8',
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                  fontSize: 10,
                                  fontWeight: 900,
                                  flexShrink: 0
                                }}
                              >
                                {absoluteIndex}
                              </div>

                              <div
                                style={{
                                  minWidth: 0
                                }}
                              >

                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 900,
                                    color:
                                      '#0F172A',
                                    overflow:
                                      'hidden',
                                    textOverflow:
                                      'ellipsis',
                                    whiteSpace:
                                      'nowrap'
                                  }}
                                >
                                  {item.package_name}
                                </div>

                                {cardCode ? (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color:
                                        '#2563EB',
                                      fontWeight:
                                        800,
                                      marginTop: 2
                                    }}
                                  >
                                    الكرت: {cardCode}
                                  </div>
                                ) : null}

                              </div>

                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gap: 4,
                                paddingRight: 34
                              }}
                            >

                              <div
                                style={{
                                  fontSize: 10,
                                  color:
                                    '#64748B'
                                }}
                              >
                                التاريخ والوقت:{' '}
                                <strong
                                  style={{
                                    color:
                                      '#334155'
                                  }}
                                >
                                  {formatDateTime(
                                    item.sold_at
                                  )}
                                </strong>
                              </div>

                              {customerName ? (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color:
                                      '#64748B'
                                  }}
                                >
                                  العميل:{' '}
                                  <strong
                                    style={{
                                      color:
                                        '#334155'
                                    }}
                                  >
                                    {customerName}
                                  </strong>
                                </div>
                              ) : null}

                            </div>

                          </div>

                          <div
                            style={{
                              textAlign: 'left',
                              flexShrink: 0
                            }}
                          >

                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: '#059669'
                              }}
                            >
                              {formatNumber(
                                item.price
                              )}{' '}
                              ر.ي
                            </div>

                            <div
                              style={{
                                fontSize: 9,
                                color:
                                  '#64748B',
                                marginTop: 3
                              }}
                            >
                              {formatNumericDate(
                                item.sold_at
                              )}
                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

              {/* Pagination */}

              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop:
                      '1px solid #E2E8F0'
                  }}
                >

                  <div
                    style={{
                      fontSize: 10,
                      color: '#64748B',
                      fontWeight: 700
                    }}
                  >
                    عرض {paginationStart} -{' '}
                    {paginationEnd} من{' '}
                    {filteredSales.length}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: 6
                    }}
                  >

                    <button
                      type="button"
                      disabled={
                        currentPage === 1
                      }
                      onClick={() =>
                        goToPage(
                          currentPage - 1
                        )
                      }
                      style={{
                        border:
                          '1px solid #CBD5E1',
                        background:
                          currentPage === 1
                            ? '#F1F5F9'
                            : '#FFFFFF',
                        color:
                          currentPage === 1
                            ? '#94A3B8'
                            : '#334155',
                        borderRadius: 8,
                        padding:
                          '7px 10px',
                        fontSize: 11,
                        fontWeight: 900,
                        cursor:
                          currentPage === 1
                            ? 'not-allowed'
                            : 'pointer'
                      }}
                    >
                      السابق
                    </button>

                    <div
                      style={{
                        background:
                          '#EFF6FF',
                        color:
                          '#1D4ED8',
                        border:
                          '1px solid #DBEAFE',
                        borderRadius: 8,
                        padding:
                          '7px 11px',
                        fontSize: 11,
                        fontWeight: 900
                      }}
                    >
                      {currentPage} /{' '}
                      {totalPages}
                    </div>

                    <button
                      type="button"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        goToPage(
                          currentPage + 1
                        )
                      }
                      style={{
                        border:
                          '1px solid #CBD5E1',
                        background:
                          currentPage ===
                          totalPages
                            ? '#F1F5F9'
                            : '#FFFFFF',
                        color:
                          currentPage ===
                          totalPages
                            ? '#94A3B8'
                            : '#334155',
                        borderRadius: 8,
                        padding:
                          '7px 10px',
                        fontSize: 11,
                        fontWeight: 900,
                        cursor:
                          currentPage ===
                          totalPages
                            ? 'not-allowed'
                            : 'pointer'
                      }}
                    >
                      التالي
                    </button>

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
