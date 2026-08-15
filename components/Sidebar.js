'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Sidebar({ role, active, name }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const adminLinks = [
    { href: '/admin', label: 'الرئيسية' },
    { href: '/admin/cards', label: 'المخزون والكروت' },
    { href: '/admin/cards/import', label: 'استيراد PDF' },
    { href: '/admin/packages', label: 'الباقات' },
    { href: '/admin/requests', label: 'طلبات الموزعين' },
    { href: '/admin/distributors', label: 'الموزعون' },
  ];

  const distLinks = [
    { href: '/distributor', label: 'الرئيسية' },
    { href: '/distributor/request', label: 'طلب كروت جديد' },
    { href: '/distributor/sales', label: 'مبيعاتي (٢٤ ساعة)' },
  ];

  const links = role === 'admin' ? adminLinks : distLinks;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
      {/* زر الثلاث خطوط يظهر فقط في الشاشات الصغيرة (الجوال) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: 15,
          left: 15,
          zIndex: 1100,
          background: '#2D1B4E',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          width: 42,
          height: 42,
          fontSize: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        className="mobile-menu-btn"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* خلفية معتمة عند فتح القائمة في الجوال */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 998,
          }}
        />
      )}

      {/* القائمة الجانبية */}
      <div
        className={`sidebar ${isOpen ? 'open' : ''}`}
        style={{
          transform: isOpen ? 'translateX(0)' : undefined,
        }}
      >
        <div className="brand">تواصل</div>
        <div style={{ fontSize: 12, color: '#9186B8', marginBottom: 26 }}>
          {role === 'admin' ? 'لوحة المدير' : 'لوحة الموزع'}
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setIsOpen(false)}
            className={`navitem ${active === l.href ? 'on' : ''}`}
          >
            {l.label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 40 }}>
          <div style={{ fontSize: 12, color: '#9186B8', marginBottom: 10 }}>
            متصل كـ <b style={{ color: '#fff' }}>{name}</b>
          </div>
          <button onClick={logout} className="btn-logout">تسجيل الخروج</button>
        </div>
      </div>

      {/* تنسيقات بسيطة للاستجابة مع الجوال */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            right: 0;
            top: 0;
            bottom: 0;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
            z-index: 999;
          }
          .sidebar.open {
            transform: translateX(0) !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
