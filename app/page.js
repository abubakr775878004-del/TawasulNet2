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

  const EMAIL_DOMAIN = '@gmail.com';

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError('الرجاء إدخال اسم المستخدم');
      setLoading(false);
      return;
    }

    const fullEmail = cleanUser.includes('@') ? cleanUser : `${cleanUser}${EMAIL_DOMAIN}`;

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: fullEmail, 
        password 
      });

      if (authError) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        setError('تعذّر العثور على حساب مرتبط بهذا البريد');
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
    <div className="auth-container">
      <div className="auth-card-wrap">
        {/* القسم الجانبي الجمالي */}
        <div className="auth-art">
          {/* الشارة */}
          <div className="badge-wrap">
            <span className="network-badge">
              ⚡ نظام إدارة وتوزيع كروت الشبكة
            </span>
          </div>

          {/* المحتوى الرئيسي */}
          <div className="art-main">
            <h1 className="brand-title">
              شبكة تواصل
            </h1>
            <h2 className="brand-subtitle">
              منصتك المتكاملة لإدارة الكروت، المبيعات، ورصيد الموزعين.
            </h2>
            <p className="brand-description">
              طباعة وتصدير الكروت، متابعة طلبيات الموزعين فورياً، والسحب الأسبوعي للزبائن في مكان واحد.
            </p>
          </div>

          {/* التوقيع */}
          <div className="art-footer">
            <span>© شبكة تواصل</span>
            <span className="developer-tag">
              تطوير وإدارة: <strong>أبو بكر محسن</strong>
            </span>
          </div>
        </div>

        {/* نموذج تسجيل الدخول */}
        <div className="auth-form-side">
          <form className="form-card" onSubmit={handleLogin}>
            <div className="form-header">
              <h2 className="login-title">تسجيل الدخول</h2>
              <p className="login-subtitle">
                أدخل اسم المستخدم المخصص لك للوصول إلى لوحة المبيعات
              </p>
            </div>

            {error && <div className="error-note">{error}</div>}

            {/* حقل اسم المستخدم */}
            <div className="field-group">
              <label className="input-label">اسم المستخدم</label>
              <div className="username-input-wrap">
                <input 
                  type="text" 
                  required 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="ادخل اسم المستخدم" 
                  className="username-input"
                />
                <span className="email-domain-tag">
                  {EMAIL_DOMAIN}
                </span>
              </div>
              <span className="helper-text">
                اكتب اسم حسابك فقط بدون كتابة {EMAIL_DOMAIN}
              </span>
            </div>

            {/* حقل كلمة المرور */}
            <div className="field-group">
              <label className="input-label">كلمة المرور</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="password-input"
              />
            </div>

            {/* زر الدخول */}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading flex-center">
                  <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="spinner-track" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري التحقق والدخول...
                </span>
              ) : 'تسجيل الدخول'}
            </button>

            {/* رابط طلب انضمام */}
            <div className="signup-prompt">
              ليس لديك حساب موزع؟{' '}
              <a href="/signup" className="signup-link">
                طلب انضمام كموزع
              </a>
            </div>
          </form>
        </div>
      </div>

      {/* التنسيقات المضمنة المباشرة */}
      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #090d16;
          background-image: 
            radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.12) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.15) 0px, transparent 50%);
          padding: 20px;
          direction: rtl;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .auth-card-wrap {
          display: flex;
          width: 100%;
          max-width: 980px;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* القسم الجانبي الجمالي */
        .auth-art {
          flex: 1.1;
          background: linear-gradient(145deg, #0f172a 0%, #064e3b 100%);
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .auth-art::before {
          content: '';
          position: absolute;
          top: -100px;
          right: -100px;
          width: 300px;
          height: 300px;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 50%;
          filter: blur(80px);
        }

        .network-badge {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          color: #6ee7b7;
          padding: 8px 18px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 700;
          display: inline-block;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .art-main {
          margin: auto 0;
          padding: 30px 0;
          position: relative;
          z-index: 2;
        }

        .brand-title {
          font-size: 42px;
          font-weight: 900;
          color: #ffffff;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }

        .brand-subtitle {
          font-size: 20px;
          line-height: 1.6;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 16px;
        }

        .brand-description {
          color: #94a3b8;
          line-height: 1.8;
          font-size: 14px;
          max-width: 420px;
          margin: 0;
        }

        .art-footer {
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #94a3b8;
          position: relative;
          z-index: 2;
        }

        .developer-tag {
          color: #6ee7b7;
          font-weight: 600;
        }

        .developer-tag strong {
          color: #ffffff;
        }

        /* قسم نموذج الدخول */
        .auth-form-side {
          flex: 1;
          padding: 48px 40px;
          display: flex;
          align-items: center;
          background: #ffffff;
        }

        .form-card {
          width: 100%;
        }

        .form-header {
          margin-bottom: 28px;
        }

        .login-title {
          font-weight: 900;
          font-size: 26px;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .login-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }

        .error-note {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .field-group {
          margin-bottom: 20px;
        }

        .input-label {
          font-weight: 700;
          font-size: 13px;
          color: #334155;
          margin-bottom: 8px;
          display: block;
        }

        .username-input-wrap {
          display: flex;
          align-items: center;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .username-input-wrap:focus-within {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
        }

        .username-input {
          border: none;
          flex: 1;
          padding: 14px 16px;
          outline: none;
          font-size: 14px;
          color: #0f172a;
          direction: ltr;
          text-align: right;
          background: transparent;
        }

        .email-domain-tag {
          padding: 0 16px;
          color: #059669;
          font-size: 13px;
          font-weight: 800;
          background: #f0fdf4;
          border-right: 1.5px solid #e2e8f0;
          height: 48px;
          display: flex;
          align-items: center;
          direction: ltr;
        }

        .password-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .password-input:focus {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
        }

        .helper-text {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 6px;
          display: block;
        }

        .btn-primary {
          width: 100%;
          padding: 14px;
          background: #059669;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
          margin-top: 8px;
        }

        .btn-primary:hover:not(:disabled) {
          background: #047857;
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .spinner {
          width: 18px;
          height: 18px;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .signup-prompt {
          text-align: center;
          font-size: 14px;
          color: #64748b;
          margin-top: 24px;
        }

        .signup-link {
          color: #059669;
          font-weight: 800;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .signup-link:hover {
          color: #047857;
          text-decoration: underline;
        }

        /* الاستجابة للهواتف والشاشات الصغيرة */
        @media (max-width: 868px) {
          .auth-card-wrap {
            flex-direction: column;
            border-radius: 16px;
          }

          .auth-art {
            padding: 32px 24px;
          }

          .brand-title {
            font-size: 32px;
          }

          .brand-subtitle {
            font-size: 17px;
          }

          .auth-form-side {
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
}
