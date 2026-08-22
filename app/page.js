'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // النطاق الافتراضي
  const EMAIL_DOMAIN = '@gmail.com';

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError('الرجاء إدخال اسم المستخدم أو البريد');
      setLoading(false);
      return;
    }

    // إذا كتب المستخدم البريد كاملاً يستخدمه، وإلا يدمج @gmail.com تلقائياً
    const fullEmail = cleanUser.includes('@') ? cleanUser : `${cleanUser}${EMAIL_DOMAIN}`;

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: fullEmail, 
        password 
      });

      if (authError) {
        setError('بيانات الدخول غير صحيحة، يرجى التأكد من اسم المستخدم وكلمة المرور');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        setError('تعذّر العثور على الحساب المرتبط بهذه البيانات');
        setLoading(false);
        return;
      }

      if (profile.status !== 'approved' && profile.role === 'distributor') {
        setError('حسابك لا يزال قيد المراجعة والتدقيق من قبل إدارة الشبكة');
        setLoading(false);
        return;
      }

      router.push(profile.role === 'admin' ? '/admin' : '/distributor');
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال، يرجى المحاولة لاحقاً');
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      {/* القسم الجانبي الجمالي */}
      <div className="auth-art">
        <div className="brand" style={{ fontWeight: 900, fontSize: 24, letterSpacing: '0.5px' }}>
          شبكة تواصل
        </div>
        
        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <span style={{ 
            background: 'rgba(255, 255, 255, 0.15)', 
            padding: '6px 14px', 
            borderRadius: '20px', 
            fontSize: '12px', 
            fontWeight: '700',
            display: 'inline-block',
            marginBottom: '16px'
          }}>
            نظام إدارة وتوزيع كروت الشبكة
          </span>
          <h2 style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 800 }}>
            منصتك المتكاملة لإدارة الكروت، المبيعات، ورصيد الموزعين.
          </h2>
          <p style={{ color: '#E3D6FF', marginTop: 14, lineHeight: 1.8, fontSize: '14px' }}>
            طباعة وتصدير الكروت، متابعة طلبيات الموزعين فورياً، والسحب الأسبوعي للزبائن في مكان واحد.
          </p>
        </div>

        <div style={{ fontSize: 12, color: '#C9BFEA', fontWeight: '600' }}>
          © شبكة تواصل — تطوير وإدارة أبو بكر محسن
        </div>
      </div>

      {/* نموذج تسجيل الدخول */}
      <div className="auth-form">
        <form className="form-card" onSubmit={handleLogin}>
          <div style={{ marginBottom: 24 }}>
            <div className="brand" style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink-dark, #0F172A)', marginBottom: 6 }}>
              تسجيل الدخول
            </div>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              أدخل اسم المستخدم المخصص لك للوصول إلى لوحة المبيعات
            </p>
          </div>

          {error && <div className="error-note" style={{ marginBottom: 16 }}>{error}</div>}

          {/* حقل اسم المستخدم المدمج مع @gmail.com */}
          <div className="field" style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', display: 'block' }}>
              اسم المستخدم / البريد
            </label>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              border: '1.5px solid #E2E8F0', 
              borderRadius: '10px', 
              overflow: 'hidden', 
              background: '#fff',
              transition: 'border-color 0.2s'
            }}>
              <input 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="أدخل اسم المستخدم" 
                style={{ 
                  border: 'none', 
                  flex: 1, 
                  padding: '12px 14px', 
                  outline: 'none',
                  fontSize: '14px',
                  direction: 'ltr',
                  textAlign: 'right'
                }}
              />
              <span style={{ 
                padding: '0 12px', 
                color: '#64748B', 
                fontSize: '13px', 
                fontWeight: '700',
                background: '#F8FAFC', 
                borderRight: '1.5px solid #E2E8F0',
                lineHeight: '42px',
                direction: 'ltr'
              }}>
                {EMAIL_DOMAIN}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
              اكتب اسم حسابك فقط بدون كتابة {EMAIL_DOMAIN}
            </span>
          </div>

          {/* حقل كلمة المرور */}
          <div className="field" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', display: 'block' }}>
              كلمة المرور
            </label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '13px' }}>
            {loading ? 'جاري التحقق والدخول...' : 'تسجيل الدخول'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', marginTop: 20 }}>
            ليس لديك حساب موزع؟{' '}
            <a href="/signup" style={{ color: 'var(--grape)', fontWeight: 800, textDecoration: 'none' }}>
              طلب انضمام كموزع
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
