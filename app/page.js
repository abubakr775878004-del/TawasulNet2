'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
const router = useRouter();

const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const EMAIL_DOMAIN = '@gmail.com';

async function handleLogin(e) {
e.preventDefault();

if (loading) return;

setError('');
setLoading(true);

const cleanUser = username.trim().toLowerCase();

if (!cleanUser) {
  setError('الرجاء إدخال اسم المستخدم');
  setLoading(false);
  return;
}

if (!password) {
  setError('الرجاء إدخال كلمة المرور');
  setLoading(false);
  return;
}

const fullEmail = cleanUser.includes('@')
  ? cleanUser
  : `${cleanUser}${EMAIL_DOMAIN}`;

try {
  const { data, error: authError } =
    await supabase.auth.signInWithPassword({
      email: fullEmail,
      password,
    });

  if (authError || !data?.user) {
    setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    setLoading(false);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    setError('تعذّر العثور على حساب مرتبط بهذا المستخدم');
    setLoading(false);
    return;
  }

  /*
    منع الموزعين غير المعتمدين من الدخول إلى النظام
    يتم تسجيل خروج المستخدم مباشرة حتى لا تبقى جلسة فعالة.
  */
  if (
    profile.role === 'distributor' &&
    profile.status !== 'approved'
  ) {
    await supabase.auth.signOut();

    setError(
      'حسابك لا يزال قيد المراجعة والتدقيق من قبل إدارة شبكة تواصل'
    );

    setLoading(false);
    return;
  }

  /*
    إعادة التوجيه حسب صلاحية المستخدم
  */
  if (profile.role === 'admin') {
    router.replace('/admin');
  } else {
    router.replace('/distributor');
  }
} catch (err) {
  console.error('Login error:', err);

  await supabase.auth.signOut();

  setError('حدث خطأ أثناء الاتصال، يرجى المحاولة لاحقاً');
  setLoading(false);
}

}

return (
<main className="auth-container">
<div className="background-glow glow-one" />
<div className="background-glow glow-two" />

  <div className="auth-card-wrap">

    {/* القسم التعريفي */}
    <section className="auth-art">

      <div className="art-top">

        <div className="network-logo">

          <div className="logo-icon">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="32"
                cy="32"
                r="25"
                stroke="currentColor"
                strokeWidth="4"
                opacity="0.25"
              />

              <path
                d="M18 33C22 25 27 21 32 21C37 21 42 25 46 33"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />

              <path
                d="M23 40C26 35 29 33 32 33C35 33 38 35 41 40"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />

              <circle
                cx="32"
                cy="43"
                r="3"
                fill="currentColor"
              />
            </svg>
          </div>

          <div className="logo-text">
            <span className="logo-title">
              شبكة تواصل
            </span>

            <span className="logo-caption">
              TAWASUL NET
            </span>
          </div>

        </div>

        <div className="network-badge">
          <span className="badge-dot" />
          نظام إدارة شبكة الإنترنت
        </div>

      </div>


      <div className="art-main">

        <div className="welcome-label">
          مرحباً بك في
        </div>

        <h1 className="brand-title">
          شبكة تواصل
        </h1>

        <h2 className="brand-subtitle">
          إدارة ذكية وسريعة لجميع عمليات الشبكة
        </h2>

        <p className="brand-description">
          منصة متكاملة لإدارة الكروت والمبيعات والموزعين
          والرصيد والطلبات والتقارير في مكان واحد.
        </p>


        <div className="feature-list">

          <div className="feature-item">
            <span className="feature-icon">✓</span>
            إدارة الكروت والمبيعات
          </div>

          <div className="feature-item">
            <span className="feature-icon">✓</span>
            متابعة أرصدة الموزعين
          </div>

          <div className="feature-item">
            <span className="feature-icon">✓</span>
            تقارير وإحصائيات مباشرة
          </div>

        </div>

      </div>


      <div className="art-footer">

        <span>
          © {new Date().getFullYear()} شبكة تواصل
        </span>

        <span className="developer-tag">
          تطوير وإدارة:
          <strong> أبو بكر محسن</strong>
        </span>

      </div>

    </section>


    {/* نموذج تسجيل الدخول */}
    <section className="auth-form-side">

      <form
        className="form-card"
        onSubmit={handleLogin}
      >

        <div className="mobile-logo">

          <div className="mobile-logo-icon">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="32"
                cy="32"
                r="25"
                stroke="currentColor"
                strokeWidth="4"
                opacity="0.25"
              />

              <path
                d="M18 33C22 25 27 21 32 21C37 21 42 25 46 33"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />

              <path
                d="M23 40C26 35 29 33 32 33C35 33 38 35 41 40"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />

              <circle
                cx="32"
                cy="43"
                r="3"
                fill="currentColor"
              />
            </svg>
          </div>

          <div>
            <strong>شبكة تواصل</strong>
            <span>TAWASUL NET</span>
          </div>

        </div>


        <div className="form-header">

          <div className="login-icon">
            ↪
          </div>

          <h2 className="login-title">
            تسجيل الدخول
          </h2>

          <p className="login-subtitle">
            أدخل بيانات حسابك للوصول إلى لوحة التحكم
          </p>

        </div>


        {error && (
          <div
            className="error-note"
            role="alert"
          >
            <span className="error-icon">
              !
            </span>

            <span>
              {error}
            </span>
          </div>
        )}


        {/* اسم المستخدم */}
        <div className="field-group">

          <label className="input-label">
            اسم المستخدم
          </label>

          <div className="username-input-wrap">

            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="ادخل اسم المستخدم"
              className="username-input"
              disabled={loading}
            />

            <span className="email-domain-tag">
              {EMAIL_DOMAIN}
            </span>

          </div>

          <span className="helper-text">
            اكتب اسم حسابك فقط وسيتم إضافة
            {' '}
            {EMAIL_DOMAIN}
            {' '}
            تلقائياً
          </span>

        </div>


        {/* كلمة المرور */}
        <div className="field-group">

          <label className="input-label">
            كلمة المرور
          </label>

          <div className="password-input-wrap">

            <input
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="أدخل كلمة المرور"
              className="password-input"
              disabled={loading}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label={
                showPassword
                  ? 'إخفاء كلمة المرور'
                  : 'إظهار كلمة المرور'
              }
              disabled={loading}
            >
              {showPassword ? 'إخفاء' : 'إظهار'}
            </button>

          </div>

        </div>


        {/* زر الدخول */}
        <button
          className="btn-primary"
          type="submit"
          disabled={loading}
        >

          {loading ? (
            <span className="btn-loading">

              <svg
                className="spinner"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.25"
                />

                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

              </svg>

              جاري تسجيل الدخول...

            </span>
          ) : (
            <>
              <span>
                تسجيل الدخول
              </span>

              <span className="login-arrow">
                ←
              </span>
            </>
          )}

        </button>


        {/* طلب انضمام */}
        <div className="signup-prompt">

          <span>
            ليس لديك حساب موزع؟
          </span>

          <Link
            href="/signup"
            className="signup-link"
          >
            طلب الانضمام كموزع
          </Link>

        </div>


        <div className="form-footer">
          <span className="security-dot" />
          اتصال آمن ومشفّر
        </div>

      </form>

    </section>

  </div>


  <style jsx>{`

    .auth-container {
      min-height: 100vh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      direction: rtl;
      background:
        radial-gradient(
          circle at top right,
          rgba(16, 185, 129, 0.13),
          transparent 35%
        ),
        radial-gradient(
          circle at bottom left,
          rgba(37, 99, 235, 0.15),
          transparent 40%
        ),
        #07111f;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }


    .background-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }


    .glow-one {
      width: 350px;
      height: 350px;
      background: rgba(16, 185, 129, 0.14);
      top: -120px;
      right: -120px;
    }


    .glow-two {
      width: 300px;
      height: 300px;
      background: rgba(37, 99, 235, 0.15);
      bottom: -120px;
      left: -100px;
    }


    .auth-card-wrap {
      width: 100%;
      max-width: 1080px;
      min-height: 620px;
      display: flex;
      position: relative;
      z-index: 2;
      border-radius: 28px;
      overflow: hidden;
      background: #ffffff;
      box-shadow:
        0 35px 80px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(255, 255, 255, 0.08);
    }


    /* القسم التعريفي */

    .auth-art {
      width: 53%;
      padding: 42px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(
          circle at 85% 10%,
          rgba(16, 185, 129, 0.25),
          transparent 28%
        ),
        linear-gradient(
          145deg,
          #071827 0%,
          #0b2f2d 55%,
          #064e3b 100%
        );
    }


    .auth-art::before {
      content: "";
      position: absolute;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.06);
      left: -140px;
      bottom: -100px;
    }


    .auth-art::after {
      content: "";
      position: absolute;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.04);
      left: -210px;
      bottom: -170px;
    }


    .art-top,
    .art-main,
    .art-footer {
      position: relative;
      z-index: 2;
    }


    .network-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }


    .logo-icon {
      width: 58px;
      height: 58px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6ee7b7;
      background: rgba(255, 255, 255, 0.09);
      border: 1px solid rgba(255, 255, 255, 0.13);
      backdrop-filter: blur(12px);
    }


    .logo-icon svg {
      width: 36px;
      height: 36px;
    }


    .logo-text {
      display: flex;
      flex-direction: column;
    }


    .logo-title {
      color: #ffffff;
      font-size: 20px;
      font-weight: 900;
    }


    .logo-caption {
      color: #6ee7b7;
      font-size: 10px;
      letter-spacing: 2px;
      margin-top: 2px;
      direction: ltr;
      text-align: right;
    }


    .network-badge {
      margin-top: 26px;
      width: fit-content;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 13px;
      border-radius: 999px;
      color: #a7f3d0;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      font-weight: 700;
    }


    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.8);
    }


    .art-main {
      margin: auto 0;
      padding: 45px 0;
    }


    .welcome-label {
      color: #6ee7b7;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 12px;
    }


    .brand-title {
      margin: 0;
      color: #ffffff;
      font-size: 48px;
      line-height: 1.2;
      font-weight: 950;
      letter-spacing: -1px;
    }


    .brand-subtitle {
      margin: 16px 0 12px;
      color: #e2e8f0;
      font-size: 21px;
      line-height: 1.7;
      font-weight: 800;
    }


    .brand-description {
      max-width: 460px;
      margin: 0;
      color: #94a3b8;
      font-size: 14px;
      line-height: 2;
    }


    .feature-list {
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }


    .feature-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #d1fae5;
      font-size: 13px;
      font-weight: 600;
    }


    .feature-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #052e25;
      background: #6ee7b7;
      font-size: 13px;
      font-weight: 900;
    }


    .art-footer {
      padding-top: 22px;
      border-top:
        1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      color: #94a3b8;
      font-size: 12px;
    }


    .developer-tag {
      color: #a7f3d0;
      font-weight: 600;
    }


    .developer-tag strong {
      color: #ffffff;
    }


    /* نموذج الدخول */

    .auth-form-side {
      width: 47%;
      display: flex;
      align-items: center;
      padding: 50px 48px;
      background:
        linear-gradient(
          180deg,
          #ffffff,
          #f8fafc
        );
      box-sizing: border-box;
    }


    .form-card {
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
    }


    .mobile-logo {
      display: none;
    }


    .form-header {
      margin-bottom: 30px;
    }


    .login-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 18px;
      color: #ffffff;
      background:
        linear-gradient(
          135deg,
          #059669,
          #10b981
        );
      font-size: 24px;
      font-weight: 900;
      box-shadow:
        0 10px 22px
        rgba(5, 150, 105, 0.2);
    }


    .login-title {
      margin: 0 0 8px;
      color: #0f172a;
      font-size: 30px;
      font-weight: 900;
    }


    .login-subtitle {
      margin: 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.7;
    }


    .error-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 20px;
      padding: 13px 14px;
      border-radius: 14px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #be123c;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.6;
    }


    .error-icon {
      width: 21px;
      height: 21px;
      min-width: 21px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #ffffff;
      background: #e11d48;
      font-size: 13px;
    }


    .field-group {
      margin-bottom: 20px;
    }


    .input-label {
      display: block;
      margin-bottom: 8px;
      color: #334155;
      font-size: 13px;
      font-weight: 800;
    }


    .username-input-wrap,
    .password-input-wrap {
      display: flex;
      align-items: center;
      min-height: 52px;
      border:
        1.5px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      background: #ffffff;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }


    .username-input-wrap:focus-within,
    .password-input-wrap:focus-within {
      border-color: #059669;
      box-shadow:
        0 0 0 4px
        rgba(5, 150, 105, 0.1);
    }


    .username-input {
      flex: 1;
      width: 100%;
      height: 52px;
      padding: 0 16px;
      border: none;
      outline: none;
      color: #0f172a;
      background: transparent;
      font-size: 14px;
      text-align: right;
      direction: ltr;
      box-sizing: border-box;
    }


    .username-input::placeholder,
    .password-input::placeholder {
      color: #94a3b8;
    }


    .email-domain-tag {
      height: 52px;
      display: flex;
      align-items: center;
      padding: 0 14px;
      color: #059669;
      background: #f0fdf4;
      border-right:
        1px solid #dcfce7;
      font-size: 12px;
      font-weight: 900;
      direction: ltr;
      white-space: nowrap;
    }


    .password-input {
      flex: 1;
      width: 100%;
      height: 52px;
      padding: 0 16px;
      border: none;
      outline: none;
      color: #0f172a;
      background: transparent;
      font-size: 14px;
      box-sizing: border-box;
    }


    .password-toggle {
      height: 36px;
      margin-left: 8px;
      padding: 0 12px;
      border: none;
      border-radius: 9px;
      color: #059669;
      background: #ecfdf5;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      transition: all 0.2s ease;
    }


    .password-toggle:hover:not(:disabled) {
      color: #ffffff;
      background: #059669;
    }


    .password-toggle:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }


    .helper-text {
      display: block;
      margin-top: 7px;
      color: #94a3b8;
      font-size: 11px;
      line-height: 1.5;
    }


    .btn-primary {
      width: 100%;
      min-height: 54px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border: none;
      border-radius: 15px;
      color: #ffffff;
      background:
        linear-gradient(
          135deg,
          #047857,
          #059669,
          #10b981
        );
      cursor: pointer;
      font-size: 15px;
      font-weight: 900;
      box-shadow:
        0 12px 25px
        rgba(5, 150, 105, 0.22);
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        opacity 0.2s ease;
    }


    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow:
        0 16px 30px
        rgba(5, 150, 105, 0.3);
    }


    .btn-primary:active:not(:disabled) {
      transform: translateY(0);
    }


    .btn-primary:disabled {
      opacity: 0.75;
      cursor: not-allowed;
    }


    .login-arrow {
      font-size: 20px;
      line-height: 1;
    }


    .btn-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }


    .spinner {
      width: 20px;
      height: 20px;
      animation:
        spin 0.8s linear infinite;
    }


    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }


    .signup-prompt {
      margin-top: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
      color: #64748b;
      font-size: 13px;
    }


    .signup-link {
      color: #059669;
      font-weight: 900;
      text-decoration: none;
    }


    .signup-link:hover {
      text-decoration: underline;
    }


    .form-footer {
      margin-top: 28px;
      padding-top: 18px;
      border-top:
        1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      color: #94a3b8;
      font-size: 11px;
    }


    .security-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow:
        0 0 8px
        rgba(34, 197, 94, 0.7);
    }


    /* الأجهزة اللوحية */

    @media (max-width: 950px) {

      .auth-container {
        padding: 16px;
      }


      .auth-card-wrap {
        max-width: 820px;
      }


      .auth-art {
        padding: 34px 28px;
      }


      .auth-form-side {
        padding: 40px 30px;
      }


      .brand-title {
        font-size: 38px;
      }


      .brand-subtitle {
        font-size: 18px;
      }


      .feature-list {
        margin-top: 22px;
      }

    }


    /* الهواتف */

    @media (max-width: 760px) {

      .auth-container {
        align-items: flex-start;
        padding: 0;
        background:
          radial-gradient(
            circle at top,
            rgba(16, 185, 129, 0.12),
            transparent 35%
          ),
          #f8fafc;
      }


      .background-glow {
        display: none;
      }


      .auth-card-wrap {
        width: 100%;
        min-height: 100vh;
        border-radius: 0;
        flex-direction: column;
        box-shadow: none;
      }


      .auth-art {
        display: none;
      }


      .auth-form-side {
        width: 100%;
        min-height: 100vh;
        padding:
          28px 20px
          max(28px, env(safe-area-inset-bottom));
        align-items: flex-start;
        background:
          linear-gradient(
            180deg,
            #f0fdf4 0%,
            #ffffff 32%
          );
      }


      .form-card {
        max-width: 100%;
      }


      .mobile-logo {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-bottom: 34px;
      }


      .mobile-logo-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            #047857,
            #10b981
          );
        box-shadow:
          0 10px 20px
          rgba(5, 150, 105, 0.2);
      }


      .mobile-logo-icon svg {
        width: 30px;
        height: 30px;
      }


      .mobile-logo div:last-child {
        display: flex;
        flex-direction: column;
      }


      .mobile-logo strong {
        color: #0f172a;
        font-size: 18px;
        font-weight: 900;
      }


      .mobile-logo span {
        margin-top: 2px;
        color: #059669;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 1.5px;
        direction: ltr;
        text-align: right;
      }


      .form-header {
        margin-bottom: 28px;
      }


      .login-icon {
        width: 42px;
        height: 42px;
        margin-bottom: 14px;
      }


      .login-title {
        font-size: 28px;
      }


      .login-subtitle {
        font-size: 13px;
      }


      .username-input-wrap,
      .password-input-wrap {
        min-height: 54px;
        border-radius: 15px;
      }


      .username-input,
      .password-input {
        height: 54px;
        font-size: 16px;
      }


      .email-domain-tag {
        height: 54px;
        padding: 0 10px;
        font-size: 11px;
      }


      .password-toggle {
        margin-left: 6px;
        padding: 0 10px;
      }


      .btn-primary {
        min-height: 56px;
        border-radius: 16px;
        font-size: 16px;
      }


      .signup-prompt {
        margin-top: 26px;
        font-size: 13px;
      }


      .form-footer {
        margin-top: 26px;
      }

    }


    @media (max-width: 380px) {

      .auth-form-side {
        padding-right: 16px;
        padding-left: 16px;
      }


      .email-domain-tag {
        padding: 0 8px;
        font-size: 10px;
      }


      .password-toggle {
        padding: 0 8px;
        font-size: 11px;
      }


      .login-title {
        font-size: 25px;
      }

    }

  `}</style>

</main>

);
}
