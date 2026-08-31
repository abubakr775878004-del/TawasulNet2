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
        getYear
