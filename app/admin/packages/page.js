'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function PackagesPage() {
  const { profile, loading: profileLoading } = useProfile('admin');

  const [packages, setPackages] = useState([]);
  const [mikrotikProfiles, setMikrotikProfiles] = useState([]);
  const [mappings, setMappings] = useState({});

  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingMapping, setSavingMapping] = useState(null);

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newPackageName, setNewPackageName] = useState('');
  const [newPackagePrice, setNewPackagePrice] = useState('');
  const [addingPackage, setAddingPackage] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState(null);

  const [quantity, setQuantity] = useState('10');
  const [prefix, setPrefix] = useState('');
  const [codeLength, setCodeLength] = useState('12');

  const [previewCards, setPreviewCards] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [creatingCards, setCreatingCards] = useState(false);

  const [creationResult, setCreationResult] = useState(null);

  const isAdmin =
    profile?.role === 'admin' &&
    profile?.status === 'active';

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.');
    }

    return session.access_token;
  }, []);

  const apiRequest = useCallback(
    async (url, options = {}) => {
      const token = await getAccessToken();

      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || 'حدث خطأ في الاتصال بالخادم.'
        );
      }

      return data;
    },
    [getAccessToken]
  );

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    setError('');

    try {
      const { data, error: packagesError } = await supabase
        .from('packages')
        .select('*, cards(id)')
        .order('created_at', { ascending: false });

      if (packagesError) {
        throw packagesError;
      }

      const formatted = (data || []).map((pkg) => ({
        ...pkg,
        cardsCount: Array.isArray(pkg.cards)
          ? pkg.cards.length
          : 0,
      }));

      setPackages(formatted);

      if (
        selectedPackage &&
        !formatted.some((pkg) => pkg.id === selectedPackage.id)
      ) {
        setSelectedPackage(null);
        setPreviewCards([]);
      }
    } catch (err) {
      console.error('loadPackages:', err);
      setError(
        err?.message ||
          'تعذر تحميل الباقات من قاعدة البيانات.'
      );
    } finally {
      setLoadingPackages(false);
    }
  }, [selectedPackage]);

  const loadMikrotikProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setError('');

    try {
      const data = await apiRequest(
        '/api/mikrotik/user-manager?action=profiles'
      );

      const profiles =
        Array.isArray(data?.profiles)
          ? data.profiles
          : Array.isArray(data)
            ? data
            : [];

      setMikrotikProfiles(profiles);

      if (data?.mappings && typeof data.mappings === 'object') {
        setMappings(data.mappings);
      } else if (data?.mapping && typeof data.mapping === 'object') {
        setMappings(data.mapping);
      }

      setConnectionStatus({
        connected: true,
        message: 'تم الاتصال بنجاح مع User Manager',
      });
    } catch (err) {
      console.error('loadMikrotikProfiles:', err);

      setConnectionStatus({
        connected: false,
        message: err?.message || 'تعذر الاتصال بـ MikroTik',
      });

      setError(
        err?.message ||
          'تعذر جلب Profiles من MikroTik User Manager.'
      );
    } finally {
      setLoadingProfiles(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    if (!profileLoading && isAdmin) {
      loadPackages();
      loadMikrotikProfiles();
    }
  }, [
    profileLoading,
    isAdmin,
    loadPackages,
    loadMikrotikProfiles,
  ]);

  const testConnection = async () => {
    clearMessages();
    setTestingConnection(true);

    try {
      const data = await apiRequest(
        '/api/mikrotik/user-manager?action=test'
      );

      setConnectionStatus({
        connected: true,
        message:
          data?.message ||
          'تم الاتصال بنجاح مع MikroTik User Manager.',
      });

      setSuccess('تم اختبار الاتصال بنجاح.');
    } catch (err) {
      console.error('testConnection:', err);

      setConnectionStatus({
        connected: false,
        message: err?.message || 'فشل الاتصال.',
      });

      setError(
        err?.message ||
          'فشل اختبار الاتصال بـ MikroTik User Manager.'
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const refreshProfiles = async () => {
    clearMessages();
    await loadMikrotikProfiles();
  };

  const handleMappingChange = async (packageId, profileName) => {
    clearMessages();

    setMappings((current) => ({
      ...current,
      [packageId]: profileName,
    }));

    setSavingMapping(packageId);

    try {
      await apiRequest('/api/mikrotik/user-manager', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save-mapping',
          packageId,
          profileName,
        }),
      });

      setSuccess('تم حفظ ربط الباقة بنجاح.');
    } catch (err) {
      console.error('save-mapping:', err);

      setError(
        err?.message ||
          'تعذر حفظ ربط الباقة.'
      );

      await loadMikrotikProfiles();
    } finally {
      setSavingMapping(null);
    }
  };

  const handleAddPackage = async (event) => {
    event.preventDefault();
    clearMessages();

    const name = newPackageName.trim();
    const numericPrice = Number(newPackagePrice);

    if (!name) {
      setError('يرجى إدخال اسم الباقة.');
      return;
    }

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setError('يرجى إدخال سعر صحيح أكبر من صفر.');
      return;
    }

    setAddingPackage(true);

    try {
      const { data, error: insertError } = await supabase
        .from('packages')
        .insert({
          name,
          price: numericPrice,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setPackages((current) => [
        {
          ...data,
          cardsCount: 0,
        },
        ...current,
      ]);

      setNewPackageName('');
      setNewPackagePrice('');

      setSuccess('تمت إضافة الباقة بنجاح.');
    } catch (err) {
      console.error('add package:', err);

      setError(
        err?.message ||
          'تعذر إضافة الباقة.'
      );
    } finally {
      setAddingPackage(false);
    }
  };

  const handleDeletePackage = async (id) => {
    const packageToDelete = packages.find(
      (pkg) => pkg.id === id
    );

    if (!packageToDelete) return;

    if (
      packageToDelete.cardsCount > 0
    ) {
      setError(
        'لا يمكن حذف هذه الباقة لأنها مرتبطة بكروت موجودة.'
      );
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الباقة "${packageToDelete.name}"؟`
    );

    if (!confirmed) return;

    clearMessages();

    try {
      const { error: deleteError } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      setPackages((current) =>
        current.filter((pkg) => pkg.id !== id)
      );

      setMappings((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      if (selectedPackage?.id === id) {
        setSelectedPackage(null);
        setPreviewCards([]);
        setCreationResult(null);
      }

      setSuccess('تم حذف الباقة بنجاح.');
    } catch (err) {
      console.error('delete package:', err);

      setError(
        err?.message ||
          'تعذر حذف الباقة.'
      );
    }
  };

  const validation = useMemo(() => {
    const parsedQuantity = Number(quantity);
    const parsedLength = Number(codeLength);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 1000
    ) {
      return {
        valid: false,
        message: 'الكمية يجب أن تكون بين 1 و1000.',
      };
    }

    if (
      !Number.isInteger(parsedLength) ||
      parsedLength < 4 ||
      parsedLength > 32
    ) {
      return {
        valid: false,
        message: 'طول الكود يجب أن يكون بين 4 و32.',
      };
    }

    if (prefix && !/^\d+$/.test(prefix)) {
      return {
        valid: false,
        message: 'البادئة يجب أن تحتوي على أرقام فقط.',
      };
    }

    if (prefix.length >= parsedLength) {
      return {
        valid: false,
        message:
          'طول البادئة يجب أن يكون أقل من طول الكود.',
      };
    }

    if (
      selectedPackage &&
      !mappings[selectedPackage.id]
    ) {
      return {
        valid: false,
        message:
          'يجب ربط الباقة أولًا مع Profile من MikroTik User Manager.',
      };
    }

    return {
      valid: true,
      quantity: parsedQuantity,
      length: parsedLength,
    };
  }, [
    quantity,
    codeLength,
    prefix,
    selectedPackage,
    mappings,
  ]);

  const generateRandomDigits = (length) => {
    let result = '';

    while (result.length < length) {
      result += Math.floor(
        Math.random() * 1000000000
      ).toString();
    }

    return result.slice(0, length);
  };

  const generatePreview = () => {
    clearMessages();
    setCreationResult(null);

    if (!selectedPackage) {
      setError('يرجى اختيار الباقة أولًا.');
      return;
    }

    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setPreviewing(true);

    try {
      const result = [];
      const used = new Set();

      const suffixLength =
        validation.length - prefix.length;

      while (
        result.length < validation.quantity
      ) {
        const code =
          prefix +
          generateRandomDigits(suffixLength);

        if (used.has(code)) continue;

        used.add(code);
        result.push(code);
      }

      setPreviewCards(result);
      setSuccess(
        `تم إنشاء معاينة لـ ${result.length} كرت.`
      );
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreateCards = async () => {
    clearMessages();
    setCreationResult(null);

    if (!selectedPackage) {
      setError('يرجى اختيار الباقة أولًا.');
      return;
    }

    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    if (!mappings[selectedPackage.id]) {
      setError(
        'لا يمكن إنشاء الكروت قبل ربط الباقة مع Profile فعلي من MikroTik.'
      );
      return;
    }

    const confirmed = window.confirm(
      `سيتم إنشاء ${validation.quantity} كرت للباقة "${selectedPackage.name}" باستخدام Profile "${mappings[selectedPackage.id]}". هل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setCreatingCards(true);

    try {
      const data = await apiRequest(
        '/api/mikrotik/user-manager',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'create-cards',
            packageId: selectedPackage.id,
            quantity: validation.quantity,
            prefix,
            codeLength: validation.length,
          }),
        }
      );

      setCreationResult(data);

      const createdCount =
        Number(data?.createdCount) ||
        Number(data?.successCount) ||
        (Array.isArray(data?.cards)
          ? data.cards.length
          : 0);

      const failedCount =
        Number(data?.failedCount) ||
        (Array.isArray(data?.failed)
          ? data.failed.length
          : 0);

      if (createdCount > 0) {
        setSuccess(
          `تم إنشاء ${createdCount} كرت بنجاح${
            failedCount > 0
              ? `، وفشل إنشاء ${failedCount} كرت.`
              : '.'
          }`
        );
      } else {
        setSuccess(
          data?.message ||
            'تم تنفيذ عملية إنشاء الكروت.'
        );
      }

      setPreviewCards([]);

      await loadPackages();
    } catch (err) {
      console.error('create-cards:', err);

      setError(
        err?.message ||
          'تعذر إنشاء الكروت.'
      );
    } finally {
      setCreatingCards(false);
    }
  };

  const selectPackage = (pkg) => {
    clearMessages();
    setSelectedPackage(pkg);
    setPreviewCards([]);
    setCreationResult(null);
  };

  const formatPrice = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '0';
    }

    return new Intl.NumberFormat('ar-YE').format(
      number
    );
  };

  const profileName = profile?.full_name || 'المدير';

  if (profileLoading) {
    return (
      <div
        dir="rtl"
        style={styles.loadingPage}
      >
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={{ margin: 0 }}>
            جاري التحقق من صلاحيات المدير...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div
      dir="rtl"
      style={styles.page}
    >
      <Sidebar />

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Header */}
          <header style={styles.header}>
            <div>
              <div style={styles.breadcrumb}>
                لوحة التحكم
                <span style={styles.breadcrumbArrow}>
                  /
                </span>
                الباقات والكروت
              </div>

              <h1 style={styles.title}>
                إدارة الباقات والكروت
              </h1>

              <p style={styles.subtitle}>
                إدارة باقات تواصل وربطها يدويًا مع
                Profiles الموجودة فعليًا في MikroTik
                User Manager.
              </p>
            </div>

            <div style={styles.headerUser}>
              <div style={styles.avatar}>
                {profileName.charAt(0)}
              </div>

              <div>
                <div style={styles.userLabel}>
                  المدير
                </div>

                <div style={styles.userName}>
                  {profileName}
                </div>
              </div>
            </div>
          </header>

          {/* Alerts */}
          {error && (
            <div style={styles.alertError}>
              <div style={styles.alertIcon}>!</div>

              <div style={{ flex: 1 }}>
                <strong>حدث خطأ</strong>
                <div style={styles.alertText}>
                  {error}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setError('')}
                style={styles.alertClose}
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div style={styles.alertSuccess}>
              <div style={styles.successIcon}>
                ✓
              </div>

              <div style={{ flex: 1 }}>
                <strong>تم بنجاح</strong>
                <div style={styles.alertText}>
                  {success}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSuccess('')}
                style={styles.alertClose}
              >
                ×
              </button>
            </div>
          )}

          {/* Top statistics */}
          <section style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div
                style={{
                  ...styles.statIcon,
                  background:
                    'rgba(37, 99, 235, 0.10)',
                  color: '#2563eb',
                }}
              >
                ◈
              </div>

              <div>
                <div style={styles.statLabel}>
                  إجمالي الباقات
                </div>

                <div style={styles.statValue}>
                  {packages.length}
                </div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div
                style={{
                  ...styles.statIcon,
                  background:
                    'rgba(16, 185, 129, 0.10)',
                  color: '#059669',
                }}
              >
                ▣
              </div>

              <div>
                <div style={styles.statLabel}>
                  إجمالي الكروت
                </div>

                <div style={styles.statValue}>
                  {packages.reduce(
                    (sum, pkg) =>
                      sum +
                      (Number(pkg.cardsCount) || 0),
                    0
                  )}
                </div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div
                style={{
                  ...styles.statIcon,
                  background:
                    'rgba(124, 58, 237, 0.10)',
                  color: '#7c3aed',
                }}
              >
                ⇄
              </div>

              <div>
                <div style={styles.statLabel}>
                  الباقات المرتبطة
                </div>

                <div style={styles.statValue}>
                  {
                    packages.filter(
                      (pkg) => mappings[pkg.id]
                    ).length
                  }
                </div>
              </div>
            </div>

            <div
              style={{
                ...styles.statCard,
                border:
                  connectionStatus?.connected
                    ? '1px solid rgba(16,185,129,.25)'
                    : '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  ...styles.statIcon,
                  background:
                    connectionStatus?.connected
                      ? 'rgba(16,185,129,.10)'
                      : 'rgba(107,114,128,.10)',
                  color:
                    connectionStatus?.connected
                      ? '#059669'
                      : '#6b7280',
                }}
              >
                ●
              </div>

              <div style={{ flex: 1 }}>
                <div style={styles.statLabel}>
                  حالة MikroTik
                </div>

                <div
                  style={{
                    ...styles.statStatus,
                    color:
                      connectionStatus?.connected
                        ? '#059669'
                        : '#6b7280',
                  }}
                >
                  {connectionStatus?.connected
                    ? 'متصل'
                    : 'غير متحقق'}
                </div>
              </div>
            </div>
          </section>

          {/* MikroTik Connection */}
          <section style={styles.connectionCard}>
            <div style={styles.connectionInfo}>
              <div style={styles.sectionIconBlue}>
                ⚡
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  MikroTik User Manager
                </h2>

                <p style={styles.sectionDescription}>
                  يتم جلب Profiles الحقيقية من جهاز
                  MikroTik، وبعدها تختار أنت يدويًا
                  Profile المناسبة لكل باقة.
                </p>

                {connectionStatus?.message && (
                  <div
                    style={{
                      ...styles.connectionMessage,
                      color:
                        connectionStatus.connected
                          ? '#059669'
                          : '#dc2626',
                    }}
                  >
                    <span>
                      {connectionStatus.connected
                        ? '●'
                        : '●'}
                    </span>
                    {connectionStatus.message}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.connectionActions}>
              <button
                type="button"
                onClick={testConnection}
                disabled={testingConnection}
                style={{
                  ...styles.secondaryButton,
                  opacity: testingConnection
                    ? 0.65
                    : 1,
                }}
              >
                {testingConnection ? (
                  <>
                    <span style={styles.smallSpinner} />
                    جاري الاختبار...
                  </>
                ) : (
                  <>اختبار الاتصال</>
                )}
              </button>

              <button
                type="button"
                onClick={refreshProfiles}
                disabled={loadingProfiles}
                style={{
                  ...styles.primaryButton,
                  opacity: loadingProfiles
                    ? 0.65
                    : 1,
                }}
              >
                {loadingProfiles ? (
                  <>
                    <span style={styles.smallSpinnerLight} />
                    جاري التحديث...
                  </>
                ) : (
                  <>↻ تحديث Profiles</>
                )}
              </button>
            </div>
          </section>

          {/* Packages + Mapping */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  الباقات وربط MikroTik
                </h2>

                <p style={styles.sectionDescription}>
                  الباقات هنا هي الباقات الرسمية الموجودة
                  في نظام تواصل. اختر Profile MikroTik
                  المناسبة لكل باقة يدويًا.
                </p>
              </div>

              <div style={styles.profileCounter}>
                <span style={styles.counterDot} />
                {mikrotikProfiles.length} Profile متاحة
              </div>
            </div>

            <div style={styles.tableWrap}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        الباقة
                      </th>

                      <th style={styles.th}>
                        السعر
                      </th>

                      <th style={styles.th}>
                        الكروت
                      </th>

                      <th style={styles.th}>
                        Profile MikroTik
                      </th>

                      <th style={styles.th}>
                        الحالة
                      </th>

                      <th style={styles.th}>
                        الإجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingPackages ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={styles.emptyCell}
                        >
                          <div style={styles.inlineLoading}>
                            <span style={styles.spinner} />
                            جاري تحميل الباقات...
                          </div>
                        </td>
                      </tr>
                    ) : packages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={styles.emptyCell}
                        >
                          لا توجد باقات حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      packages.map((pkg) => {
                        const mappedProfile =
                          mappings[pkg.id] || '';

                        const isSelected =
                          selectedPackage?.id ===
                          pkg.id;

                        return (
                          <tr
                            key={pkg.id}
                            style={{
                              ...styles.tr,
                              background: isSelected
                                ? '#f8faff'
                                : 'transparent',
                            }}
                          >
                            <td style={styles.td}>
                              <div style={styles.packageCell}>
                                <div style={styles.packageIcon}>
                                  ◈
                                </div>

                                <div>
                                  <div style={styles.packageName}>
                                    {pkg.name}
                                  </div>

                                  <div style={styles.packageId}>
                                    ID: {String(pkg.id).slice(0, 8)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.priceBadge}>
                                {formatPrice(pkg.price)} ريال
                              </span>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.cardsCount}>
                                {pkg.cardsCount}
                              </span>
                            </td>

                            <td
                              style={{
                                ...styles.td,
                                minWidth: 280,
                              }}
                            >
                              <select
                                value={mappedProfile}
                                onChange={(event) =>
                                  handleMappingChange(
                                    pkg.id,
                                    event.target.value
                                  )
                                }
                                disabled={
                                  loadingProfiles ||
                                  savingMapping === pkg.id
                                }
                                style={styles.select}
                              >
                                <option value="">
                                  اختر Profile من MikroTik
                                </option>

                                {mikrotikProfiles.map(
                                  (profileItem, index) => {
                                    const name =
                                      typeof profileItem ===
                                      'string'
                                        ? profileItem
                                        : profileItem?.name ||
                                          profileItem?.profile ||
                                          profileItem?.profileName ||
                                          '';

                                    if (!name) {
                                      return null;
                                    }

                                    return (
                                      <option
                                        key={`${name}-${index}`}
                                        value={name}
                                      >
                                        {name}
                                      </option>
                                    );
                                  }
                                )}
                              </select>
                            </td>

                            <td style={styles.td}>
                              {mappedProfile ? (
                                <span style={styles.badgeSuccess}>
                                  ✓ مرتبط
                                </span>
                              ) : (
                                <span style={styles.badgeWarning}>
                                  غير مرتبط
                                </span>
                              )}
                            </td>

                            <td style={styles.td}>
                              <div style={styles.rowActions}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectPackage(pkg)
                                  }
                                  style={
                                    isSelected
                                      ? styles.actionButtonActive
                                      : styles.actionButton
                                  }
                                >
                                  {isSelected
                                    ? 'محدد'
                                    : 'إنشاء كروت'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeletePackage(
                                      pkg.id
                                    )
                                  }
                                  style={styles.deleteButton}
                                  disabled={
                                    pkg.cardsCount > 0
                                  }
                                  title={
                                    pkg.cardsCount > 0
                                      ? 'لا يمكن حذف باقة مرتبطة بكروت'
                                      : 'حذف الباقة'
                                  }
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Add Package */}
          <section style={styles.card}>
            <div style={styles.cardHeaderCompact}>
              <div>
                <h2 style={styles.sectionTitle}>
                  إضافة باقة جديدة
                </h2>

                <p style={styles.sectionDescription}>
                  أضف الباقة الرسمية في نظام تواصل، ثم
                  اربطها لاحقًا مع Profile من MikroTik.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddPackage}
              style={styles.addPackageGrid}
            >
              <div style={styles.field}>
                <label style={styles.label}>
                  اسم الباقة
                </label>

                <input
                  type="text"
                  value={newPackageName}
                  onChange={(event) =>
                    setNewPackageName(event.target.value)
                  }
                  placeholder="مثال: أبو 500"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  السعر
                </label>

                <div style={styles.inputWithSuffix}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newPackagePrice}
                    onChange={(event) =>
                      setNewPackagePrice(
                        event.target.value
                      )
                    }
                    placeholder="500"
                    style={{
                      ...styles.input,
                      paddingLeft: 70,
                    }}
                  />

                  <span style={styles.inputSuffix}>
                    ريال
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={addingPackage}
                style={{
                  ...styles.primaryButton,
                  alignSelf: 'end',
                  height: 48,
                  opacity: addingPackage ? 0.65 : 1,
                }}
              >
                {addingPackage ? (
                  <>
                    <span style={styles.smallSpinnerLight} />
                    جاري الإضافة...
                  </>
                ) : (
                  <>+ إضافة الباقة</>
                )}
              </button>
            </form>
          </section>

          {/* Card Generator */}
          <section style={styles.generatorCard}>
            <div style={styles.generatorHeader}>
              <div>
                <div style={styles.generatorTitleRow}>
                  <div style={styles.generatorIcon}>
                    ▣
                  </div>

                  <div>
                    <h2 style={styles.sectionTitle}>
                      إنشاء كروت MikroTik
                    </h2>

                    <p style={styles.sectionDescription}>
                      اختر الباقة ثم حدد إعدادات الأكواد.
                      عملية الإنشاء الفعلية تتم من الخادم
                      ويتم إنشاء المستخدمين داخل MikroTik.
                    </p>
                  </div>
                </div>
              </div>

              {selectedPackage && (
                <div style={styles.selectedPackage}>
                  <span style={styles.selectedLabel}>
                    الباقة المحددة
                  </span>

                  <strong>
                    {selectedPackage.name}
                  </strong>

                  <span>
                    {formatPrice(selectedPackage.price)} ريال
                  </span>
                </div>
              )}
            </div>

            {!selectedPackage ? (
              <div style={styles.selectPackageEmpty}>
                <div style={styles.emptyIllustration}>
                  ◈
                </div>

                <h3 style={styles.emptyTitle}>
                  اختر باقة للبدء
                </h3>

                <p style={styles.emptyDescription}>
                  اختر إحدى الباقات من الجدول أعلاه
                  لعرض إعدادات إنشاء الكروت.
                </p>
              </div>
            ) : (
              <>
                <div style={styles.mappingNotice}>
                  <div style={styles.noticeIcon}>
                    ⇄
                  </div>

                  <div>
                    <strong>
                      Profile MikroTik المرتبط
                    </strong>

                    <div style={styles.noticeValue}>
                      {mappings[selectedPackage.id] ||
                        'لم يتم الربط بعد'}
                    </div>
                  </div>
                </div>

                <div style={styles.generatorGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      عدد الكروت
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <small style={styles.helpText}>
                      من 1 إلى 1000 كرت.
                    </small>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      بادئة الكود
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={prefix}
                      onChange={(event) =>
                        setPrefix(
                          event.target.value.replace(
                            /\D/g,
                            ''
                          )
                        )
                      }
                      placeholder="مثال: 200"
                      style={styles.input}
                    />

                    <small style={styles.helpText}>
                      أرقام فقط، ويمكن تركها فارغة.
                    </small>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      طول الكود
                    </label>

                    <input
                      type="number"
                      min="4"
                      max="32"
                      value={codeLength}
                      onChange={(event) =>
                        setCodeLength(
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <small style={styles.helpText}>
                      من 4 إلى 32 خانة.
                    </small>
                  </div>
                </div>

                {!validation.valid && (
                  <div style={styles.validationError}>
                    {validation.message}
                  </div>
                )}

                <div style={styles.generatorActions}>
                  <button
                    type="button"
                    onClick={generatePreview}
                    disabled={
                      previewing ||
                      !validation.valid
                    }
                    style={{
                      ...styles.secondaryButtonLarge,
                      opacity:
                        previewing ||
                        !validation.valid
                          ? 0.55
                          : 1,
                    }}
                  >
                    {previewing ? (
                      <>
                        <span style={styles.smallSpinner} />
                        جاري إنشاء المعاينة...
                      </>
                    ) : (
                      <>◉ معاينة الأكواد</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateCards}
                    disabled={
                      creatingCards ||
                      !validation.valid ||
                      !mappings[selectedPackage.id]
                    }
                    style={{
                      ...styles.primaryButtonLarge,
                      opacity:
                        creatingCards ||
                        !validation.valid ||
                        !mappings[selectedPackage.id]
                          ? 0.55
                          : 1,
                    }}
                  >
                    {creatingCards ? (
                      <>
                        <span
                          style={
                            styles.smallSpinnerLight
                          }
                        />
                        جاري إنشاء الكروت...
                      </>
                    ) : (
                      <>✓ إنشاء الكروت فعليًا</>
                    )}
                  </button>
                </div>

                <div style={styles.securityNote}>
                  <span>ⓘ</span>
                  <div>
                    <strong>
                      تنبيه مهم:
                    </strong>{' '}
                    لا يتم اعتماد Profile ثابت داخل
                    الواجهة. سيتم استخدام الربط اليدوي
                    المحفوظ للباقة، وإنشاء الكروت يتم عبر
                    API الخادم.
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Preview */}
          {previewCards.length > 0 && (
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>
                    معاينة الكروت
                  </h2>

                  <p style={styles.sectionDescription}>
                    هذه معاينة محلية للأكواد فقط. لم يتم
                    إنشاء هذه الكروت في MikroTik بعد.
                  </p>
                </div>

                <span style={styles.previewCount}>
                  {previewCards.length} كرت
                </span>
              </div>

              <div style={styles.previewGrid}>
                {previewCards.map((code, index) => (
                  <div
                    key={`${code}-${index}`}
                    style={styles.previewItem}
                  >
                    <span style={styles.previewIndex}>
                      {index + 1}
                    </span>

                    <code style={styles.previewCode}>
                      {code}
                    </code>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Creation result */}
          {creationResult && (
            <section style={styles.resultCard}>
              <div style={styles.resultHeader}>
                <div style={styles.resultSuccessIcon}>
                  ✓
                </div>

                <div>
                  <h2 style={styles.resultTitle}>
                    نتيجة إنشاء الكروت
                  </h2>

                  <p style={styles.resultDescription}>
                    تم تنفيذ طلب إنشاء الكروت من خلال
                    MikroTik User Manager.
                  </p>
                </div>
              </div>

              <div style={styles.resultStats}>
                <div style={styles.resultStat}>
                  <span>تم إنشاؤها</span>

                  <strong>
                    {Number(
                      creationResult?.createdCount ??
                        creationResult?.successCount ??
                        (Array.isArray(
                          creationResult?.cards
                        )
                          ? creationResult.cards.length
                          : 0)
                    )}
                  </strong>
                </div>

                <div style={styles.resultStat}>
                  <span>فشل</span>

                  <strong>
                    {Number(
                      creationResult?.failedCount ??
                        (Array.isArray(
                          creationResult?.failed
                        )
                          ? creationResult.failed.length
                          : 0)
                    )}
                  </strong>
                </div>

                <div style={styles.resultStat}>
                  <span>الباقة</span>

                  <strong>
                    {selectedPackage?.name || '-'}
                  </strong>
                </div>
              </div>

              {Array.isArray(
                creationResult?.failed
              ) &&
                creationResult.failed.length > 0 && (
                  <div style={styles.failedBox}>
                    <h3 style={styles.failedTitle}>
                      الكروت التي لم يتم إنشاؤها
                    </h3>

                    <div style={styles.failedList}>
                      {creationResult.failed.map(
                        (item, index) => (
                          <div
                            key={index}
                            style={styles.failedItem}
                          >
                            {typeof item === 'string'
                              ? item
                              : item?.code ||
                                item?.username ||
                                item?.error ||
                                JSON.stringify(
                                  item
                                )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {creationResult?.message && (
                <div style={styles.resultMessage}>
                  {creationResult.message}
                </div>
              )}
            </section>
          )}

          <footer style={styles.footer}>
            <span>
              نظام تواصل لإدارة الباقات والكروت
            </span>

            <span>
              MikroTik User Manager
            </span>
          </footer>
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 1100px) {
          .dummy {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #f7f9fc 0%, #f1f5f9 100%)',
    color: '#172033',
    fontFamily:
      'Tahoma, Arial, sans-serif',
  },

  main: {
    minHeight: '100vh',
    padding: '28px 24px 50px',
    boxSizing: 'border-box',
  },

  container: {
    width: '100%',
    maxWidth: 1480,
    margin: '0 auto',
  },

  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fb',
    direction: 'rtl',
    fontFamily:
      'Tahoma, Arial, sans-serif',
  },

  loadingCard: {
    background: '#fff',
    border: '1px solid #e8edf5',
    borderRadius: 20,
    padding: '32px 45px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    boxShadow:
      '0 15px 40px rgba(15, 23, 42, .07)',
    color: '#475569',
  },

  spinner: {
    width: 24,
    height: 24,
    border: '3px solid #dbe4f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  smallSpinner: {
    width: 15,
    height: 15,
    border: '2px solid #cbd5e1',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },

  smallSpinnerLight: {
    width: 15,
    height: 15,
    border: '2px solid rgba(255,255,255,.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 24,
    flexWrap: 'wrap',
  },

  breadcrumb: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 9,
  },

  breadcrumbArrow: {
    margin: '0 8px',
    color: '#cbd5e1',
  },

  title: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.3,
    fontWeight: 800,
    color: '#172033',
  },

  subtitle: {
    margin: '8px 0 0',
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.8,
    maxWidth: 720,
  },

  headerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    background: '#fff',
    border: '1px solid #e6ebf2',
    borderRadius: 16,
    padding: '10px 13px',
    boxShadow:
      '0 5px 20px rgba(15, 23, 42, .04)',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    background:
      'linear-gradient(135deg, #1d4ed8, #6366f1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 17,
  },

  userLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 3,
  },

  userName: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: 700,
  },

  alertError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#fff7f7',
    border: '1px solid #fecaca',
    borderRadius: 15,
    padding: '13px 15px',
    marginBottom: 18,
    color: '#991b1b',
  },

  alertSuccess: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 15,
    padding: '13px 15px',
    marginBottom: 18,
    color: '#166534',
  },

  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    background: '#fee2e2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
  },

  successIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    background: '#dcfce7',
    color: '#16a34a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
  },

  alertText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 1.7,
  },

  alertClose: {
    border: 0,
    background: 'transparent',
    color: '#64748b',
    fontSize: 20,
    cursor: 'pointer',
    padding: '0 4px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },

  statCard: {
    background: '#fff',
    border: '1px solid #e7ecf3',
    borderRadius: 18,
    padding: 17,
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    minHeight: 92,
    boxSizing: 'border-box',
    boxShadow:
      '0 5px 18px rgba(15, 23, 42, .035)',
  },

  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 19,
    fontWeight: 800,
  },

  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },

  statValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#172033',
  },

  statStatus: {
    fontSize: 16,
    fontWeight: 800,
  },

  connectionCard: {
    background:
      'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dce8f8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    boxShadow:
      '0 8px 25px rgba(37, 99, 235, .045)',
  },

  connectionInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
    minWidth: 280,
  },

  sectionIconBlue: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },

  sectionTitle: {
    margin: 0,
    color: '#172033',
    fontSize: 17,
    fontWeight: 800,
  },

  sectionDescription: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 12,
    lineHeight: 1.8,
  },

  connectionMessage: {
    marginTop: 7,
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },

  connectionActions: {
    display: 'flex',
    gap: 9,
    flexWrap: 'wrap',
  },

  primaryButton: {
    border: 0,
    borderRadius: 12,
    background:
      'linear-gradient(135deg, #2563eb, #4f46e5)',
    color: '#fff',
    minHeight: 42,
    padding: '0 16px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow:
      '0 6px 15px rgba(37, 99, 235, .16)',
  },

  secondaryButton: {
    border: '1px solid #dbe3ef',
    borderRadius: 12,
    background: '#fff',
    color: '#334155',
    minHeight: 42,
    padding: '0 16px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  card: {
    background: '#fff',
    border: '1px solid #e6ebf2',
    borderRadius: 20,
    marginBottom: 18,
    overflow: 'hidden',
    boxShadow:
      '0 7px 25px rgba(15, 23, 42, .035)',
  },

  cardHeader: {
    padding: '20px 20px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    flexWrap: 'wrap',
  },

  cardHeaderCompact: {
    padding: '20px 20px 4px',
  },

  profileCounter: {
    borderRadius: 30,
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #dcfce7',
    padding: '7px 11px',
    fontSize: 11,
    fontWeight: 800,
  },

  counterDot: {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
    marginLeft: 6,
  },

  tableWrap: {
    width: '100%',
    borderTop: '1px solid #eef2f7',
  },

  tableScroll: {
    overflowX: 'auto',
    width: '100%',
  },

  table: {
    width: '100%',
    minWidth: 950,
    borderCollapse: 'collapse',
  },

  th: {
    textAlign: 'right',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: 11,
    fontWeight: 800,
    padding: '13px 16px',
    borderBottom: '1px solid #e7edf4',
    whiteSpace: 'nowrap',
  },

  tr: {
    transition: 'background .15s ease',
  },

  td: {
    padding: '13px 16px',
    borderBottom: '1px solid #eef2f7',
    color: '#334155',
    fontSize: 12,
    verticalAlign: 'middle',
  },

  packageCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  packageIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    background: '#eef2ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
  },

  packageName: {
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: 3,
  },

  packageId: {
    color: '#94a3b8',
    fontSize: 9,
    direction: 'ltr',
    textAlign: 'right',
  },

  priceBadge: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    borderRadius: 9,
    padding: '6px 9px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  cardsCount: {
    fontWeight: 800,
    color: '#1d4ed8',
  },

  select: {
    width: '100%',
    minHeight: 40,
    border: '1px solid #dbe3ef',
    borderRadius: 10,
    background: '#fff',
    color: '#334155',
    padding: '0 11px',
    fontSize: 11,
    outline: 'none',
    cursor: 'pointer',
  },

  badgeSuccess: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 20,
    padding: '6px 9px',
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #d1fae5',
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  badgeWarning: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 20,
    padding: '6px 9px',
    background: '#fffbeb',
    color: '#b45309',
    border: '1px solid #fde68a',
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  rowActions: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },

  actionButton: {
    border: '1px solid #dbe3ef',
    background: '#fff',
    color: '#334155',
    borderRadius: 9,
    padding: '7px 9px',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  actionButtonActive: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: 9,
    padding: '7px 9px',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },

  deleteButton: {
    border: '1px solid #fee2e2',
    background: '#fff7f7',
    color: '#dc2626',
    borderRadius: 9,
    padding: '7px 9px',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },

  emptyCell: {
    padding: '45px 20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
  },

  inlineLoading: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
  },

  addPackageGrid: {
    padding: '14px 20px 20px',
    display: 'grid',
    gridTemplateColumns:
      'minmax(220px, 1.5fr) minmax(180px, 1fr) auto',
    gap: 13,
    alignItems: 'end',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },

  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: 800,
  },

  input: {
    width: '100%',
    height: 46,
    boxSizing: 'border-box',
    border: '1px solid #dbe3ef',
    borderRadius: 11,
    background: '#fff',
    color: '#1e293b',
    padding: '0 12px',
    fontSize: 12,
    outline: 'none',
  },

  inputWithSuffix: {
    position: 'relative',
  },

  inputSuffix: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 800,
  },

  generatorCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    marginBottom: 18,
    overflow: 'hidden',
    boxShadow:
      '0 9px 28px rgba(15, 23, 42, .045)',
  },

  generatorHeader: {
    padding: 21,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
    flexWrap: 'wrap',
    borderBottom: '1px solid #eef2f7',
    background:
      'linear-gradient(180deg, #ffffff, #fbfdff)',
  },

  generatorTitleRow: {
    display: 'flex',
    gap: 13,
    alignItems: 'flex-start',
  },

  generatorIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background:
      'linear-gradient(135deg, #eef2ff, #eff6ff)',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 20,
    flexShrink: 0,
  },

  selectedPackage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    minWidth: 190,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 13,
    padding: '10px 13px',
    color: '#1e293b',
    fontSize: 12,
    fontWeight: 800,
  },

  selectedLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 700,
  },

  selectPackageEmpty: {
    padding: '55px 20px',
    textAlign: 'center',
  },

  emptyIllustration: {
    width: 58,
    height: 58,
    margin: '0 auto 12px',
    borderRadius: 17,
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 25,
  },

  emptyTitle: {
    margin: '0 0 5px',
    fontSize: 16,
    color: '#1e293b',
  },

  emptyDescription: {
    margin: 0,
    color: '#94a3b8',
    fontSize: 11,
  },

  mappingNotice: {
    margin: '18px 20px 0',
    borderRadius: 14,
    border: '1px solid #dbeafe',
    background: '#f8fbff',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },

  noticeIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    background: '#dbeafe',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
  },

  noticeValue: {
    marginTop: 3,
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: 800,
  },

  generatorGrid: {
    padding: 20,
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(180px, 1fr))',
    gap: 14,
  },

  helpText: {
    color: '#94a3b8',
    fontSize: 10,
  },

  validationError: {
    margin: '0 20px 15px',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#c2410c',
    borderRadius: 11,
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
  },

  generatorActions: {
    padding: '0 20px 18px',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },

  secondaryButtonLarge: {
    minHeight: 46,
    border: '1px solid #dbe3ef',
    background: '#fff',
    color: '#334155',
    borderRadius: 11,
    padding: '0 18px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  primaryButtonLarge: {
    minHeight: 46,
    border: 0,
    background:
      'linear-gradient(135deg, #2563eb, #4f46e5)',
    color: '#fff',
    borderRadius: 11,
    padding: '0 20px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow:
      '0 7px 17px rgba(37, 99, 235, .17)',
  },

  securityNote: {
    margin: '0 20px 20px',
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    padding: '10px 12px',
    fontSize: 10,
    lineHeight: 1.8,
    display: 'flex',
    gap: 8,
  },

  previewCount: {
    borderRadius: 20,
    padding: '7px 11px',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: 800,
  },

  previewGrid: {
    padding: '0 20px 20px',
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 8,
  },

  previewItem: {
    border: '1px solid #e5e7eb',
    background: '#fafafa',
    borderRadius: 10,
    padding: '10px 11px',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },

  previewIndex: {
    width: 22,
    height: 22,
    borderRadius: 7,
    background: '#eef2ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 800,
    flexShrink: 0,
  },

  previewCode: {
    direction: 'ltr',
    color: '#1e293b',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  resultCard: {
    background: '#fff',
    border: '1px solid #bbf7d0',
    borderRadius: 20,
    marginBottom: 18,
    overflow: 'hidden',
    boxShadow:
      '0 7px 25px rgba(22, 163, 74, .04)',
  },

  resultHeader: {
    padding: 20,
    background: '#f0fdf4',
    display: 'flex',
    alignItems: 'center',
    gap: 13,
  },

  resultSuccessIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: '#dcfce7',
    color: '#16a34a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 900,
  },

  resultTitle: {
    margin: 0,
    color: '#166534',
    fontSize: 17,
    fontWeight: 800,
  },

  resultDescription: {
    margin: '4px 0 0',
    color: '#4d7c5b',
    fontSize: 11,
  },

  resultStats: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, 1fr)',
    gap: 10,
    padding: 18,
  },

  resultStat: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    background: '#fff',
  },

  failedBox: {
    margin: '0 18px 18px',
    borderRadius: 13,
    background: '#fff7f7',
    border: '1px solid #fecaca',
    padding: 13,
  },

  failedTitle: {
    margin: '0 0 9px',
    color: '#991b1b',
    fontSize: 12,
  },

  failedList: {
    display: 'grid',
    gap: 6,
  },

  failedItem: {
    borderRadius: 8,
    background: '#fff',
    border: '1px solid #fee2e2',
    color: '#7f1d1d',
    padding: '7px 9px',
    fontSize: 10,
  },

  resultMessage: {
    margin: '0 18px 18px',
    borderRadius: 11,
    background: '#f8fafc',
    padding: '10px 12px',
    color: '#475569',
    fontSize: 11,
  },

  footer: {
    padding: '8px 4px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15,
    color: '#94a3b8',
    fontSize: 10,
  },
};
