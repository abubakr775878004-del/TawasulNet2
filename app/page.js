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

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      /*
       * تشخيص مؤقت:
       * نعرض الخطأ الحقيقي القادم من Supabase
       * بدل الرسالة العامة.
       */
      if (profileError || !profile) {
        console.error('PROFILE LOOKUP ERROR:', {
          profileError,
          profile,
          userId: data.user.id,
        });

        await supabase.auth.signOut();

        setError(
          profileError?.message ||
          profileError?.details ||
          'تعذّر العثور على حساب مرتبط بهذا المستخدم'
        );

        setLoading(false);
        return;
      }

      // منع الموزعين غير المعتمدين من الدخول
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

      // التوجيه حسب نوع الحساب
      if (profile.role === 'admin') {
        router.replace('/admin');
      } else if (profile.role === 'distributor') {
        router.replace('/distributor');
      } else {
        await supabase.auth.signOut();

        setError('نوع الحساب غير معتمد للدخول إلى النظام');
        setLoading(false);
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

        {/* =========================
            القسم التعريفي
        ========================== */}
        <section className="auth-art">

          {/* الشعار */}
          <div className="art-header">

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
              نظام إدارة وتوزيع كروت الشبكة
            </div>

          </div>


          {/* المحتوى */}
          <div className="art-main">

            <div className="welcome-label">
              مرحباً بك في
            </div>

            <h1 className="brand-title">
              شبكة تواصل
            </h1>

            <h2 className="brand-subtitle">
              منصتك المتكاملة لإدارة الشبكة
            </h2>

            <p className="brand-description">
              إدارة الكروت والمبيعات والموزعين والطلبات
              والتقارير والرصيد من مكان واحد، بسرعة
              وسهولة وأمان.
            </p>


            <div className="feature-list">

              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>إدارة الكروت والمبيعات</span>
              </div>

              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>متابعة أرصدة الموزعين والطلبات</span>
              </div>

              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>تقارير وإحصائيات دقيقة</span>
              </div>

            </div>

          </div>


          {/* التذييل */}
          <div className="art-footer">

            <span className="copyright">
              © {new Date().getFullYear()} شبكة تواصل
            </span>

            <span className="developer-tag">
              تطوير وإدارة:
              <strong> أبو بكر محسن</strong>
            </span>

          </div>

        </section>


        {/* =========================
            نموذج تسجيل الدخول
        ========================== */}
        <section className="auth-form-side">

          <form
            className="form-card"
            onSubmit={handleLogin}
          >

            <div className="form-header">

              <div className="login-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 17L15 12L10 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M15 12H3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  <path
                    d="M21 3V21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                </svg>
              </div>

              <h2 className="login-title">
                تسجيل الدخول
              </h2>

              <p className="login-subtitle">
                أدخل بيانات حسابك للوصول إلى لوحة التحكم
              </p>

            </div>


            {/* رسالة الخطأ */}
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

                <div className="input-symbol">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M5 20C5.8 16.8 8.2 15 12 15C15.8 15 18.2 16.8 19 20"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

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
                اكتب اسم حسابك فقط بدون كتابة {EMAIL_DOMAIN}
              </span>

            </div>


            {/* كلمة المرور */}
            <div className="field-group">

              <label className="input-label">
                كلمة المرور
              </label>

              <div className="password-input-wrap">

                <div className="input-symbol">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M8 10V7.5C8 5.29 9.79 3.5 12 3.5C14.21 3.5 16 5.29 16 7.5V10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <circle
                      cx="12"
                      cy="15"
                      r="1.2"
                      fill="currentColor"
                    />
                  </svg>
                </div>

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
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? 'إخفاء كلمة المرور'
                      : 'إظهار كلمة المرور'
                  }
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M3 3L21 21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M10.6 10.6C10.25 11 10 11.47 10 12C10 13.1 10.9 14 12 14C12.53 14 13 13.75 13.4 13.4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M9.88 5.1C10.56 4.89 11.27 4.78 12 4.78C16.5 4.78 19.5 8.1 21 12C20.45 13.43 19.65 14.75 18.62 15.82"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M6.61 6.61C4.92 7.78 3.74 9.76 3 12C4.5 15.9 7.5 19.22 12 19.22C13.1 19.22 14.13 19.03 15.08 18.7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M3 12C4.5 8.1 7.5 4.78 12 4.78C16.5 4.78 19.5 8.1 21 12C19.5 15.9 16.5 19.22 12 19.22C7.5 19.22 4.5 15.9 3 12Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  )}
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
                      d="M21 12A9 9 0 0 0 12 3"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>

                  جاري التحقق والدخول...

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


            {/* التسجيل */}
            <div className="signup-prompt">

              <span>
                ليس لديك حساب موزع؟
              </span>

              <Link
                href="/signup"
                className="signup-link"
              >
                طلب انضمام كموزع
              </Link>

            </div>


            {/* الأمان */}
            <div className="form-footer">

              <span className="security-dot" />

              <span>
                اتصال آمن ومشفّر
              </span>

            </div>

          </form>

        </section>

      </div>


      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .auth-container {
          min-height: 100vh;
          width: 100%;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          direction: rtl;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(16, 185, 129, 0.13),
              transparent 32%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(37, 99, 235, 0.14),
              transparent 35%
            ),
            #07111f;
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
        }


        .background-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(100px);
        }


        .glow-one {
          width: 360px;
          height: 360px;
          top: -160px;
          right: -120px;
          background: rgba(16, 185, 129, 0.14);
        }


        .glow-two {
          width: 330px;
          height: 330px;
          bottom: -160px;
          left: -120px;
          background: rgba(37, 99, 235, 0.14);
        }


        .auth-card-wrap {
          width: 100%;
          max-width: 1080px;
          min-height: 650px;
          display: flex;
          position: relative;
          z-index: 2;
          overflow: hidden;
          border-radius: 28px;
          background: #ffffff;
          box-shadow:
            0 35px 90px rgba(0, 0, 0, 0.42),
            0 0 0 1px rgba(255, 255, 255, 0.08);
        }


        /* =========================
           القسم الجانبي
        ========================== */

        .auth-art {
          width: 52%;
          min-width: 0;
          padding: 42px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 80% 10%,
              rgba(16, 185, 129, 0.25),
              transparent 30%
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
          width: 320px;
          height: 320px;
          right: -170px;
          top: -170px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.07);
        }


        .auth-art::after {
          content: "";
          position: absolute;
          width: 520px;
          height: 520px;
          left: -300px;
          bottom: -300px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }


        .art-header,
        .art-main,
        .art-footer {
          position: relative;
          z-index: 2;
        }


        .network-logo {
          display: flex;
          align-items: center;
          gap: 13px;
        }


        .logo-icon {
          width: 58px;
          height: 58px;
          flex: 0 0 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          color: #6ee7b7;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.13);
          backdrop-filter: blur(12px);
          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.12);
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
          font-size: 21px;
          font-weight: 900;
        }


        .logo-caption {
          margin-top: 3px;
          color: #6ee7b7;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          direction: ltr;
          text-align: right;
        }


        .network-badge {
          width: fit-content;
          margin-top: 25px;
          padding: 8px 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          color: #a7f3d0;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
          font-weight: 700;
        }


        .badge-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 7px;
          border-radius: 50%;
          background: #34d399;
          box-shadow:
            0 0 12px rgba(52, 211, 153, 0.8);
        }


        .art-main {
          margin: auto 0;
          padding: 42px 0;
        }


        .welcome-label {
          margin-bottom: 10px;
          color: #6ee7b7;
          font-size: 14px;
          font-weight: 800;
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
          margin: 15px 0 12px;
          color: #e2e8f0;
          font-size: 21px;
          line-height: 1.65;
          font-weight: 800;
        }


        .brand-description {
          max-width: 470px;
          margin: 0;
          color: #94a3b8;
          font-size: 14px;
          line-height: 2;
        }


        .feature-list {
          margin-top: 28px;
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
          flex: 0 0 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          color: #052e25;
          background: #6ee7b7;
          font-size: 12px;
          font-weight: 900;
        }


        .art-footer {
          padding-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 12px;
        }


        .developer-tag {
          color: #a7f3d0;
          font-weight: 600;
          text-align: left;
        }


        .developer-tag strong {
          color: #ffffff;
        }


        /* =========================
           نموذج الدخول
        ========================== */

        .auth-form-side {
          width: 48%;
          min-width: 0;
          padding: 52px 50px;
          display: flex;
          align-items: center;
          background:
            linear-gradient(
              180deg,
              #ffffff 0%,
              #f8fafc 100%
            );
        }


        .form-card {
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
        }


        .form-header {
          margin-bottom: 28px;
        }


        .login-icon {
          width: 46px;
          height: 46px;
          margin-bottom: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          color: #ffffff;
          background:
            linear-gradient(
              135deg,
              #047857,
              #10b981
            );
          box-shadow:
            0 10px 24px
            rgba(5, 150, 105, 0.2);
        }


        .login-icon svg {
          width: 25px;
          height: 25px;
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
          margin-bottom: 20px;
          padding: 12px 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border: 1px solid #fecdd3;
          border-radius: 13px;
          color: #be123c;
          background: #fff1f2;
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
          font-size: 12px;
          font-weight: 900;
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
          min-height: 54px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1.5px solid #cbd5e1;
          border-radius: 14px;
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
            rgba(5, 150, 105, 0.09);
        }


        .input-symbol {
          width: 43px;
          min-width: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }


        .input-symbol svg {
          width: 20px;
          height: 20px;
        }


        .username-input,
        .password-input {
          height: 52px;
          flex: 1;
          min-width: 0;
          padding: 0 8px;
          border: none;
          outline: none;
          color: #0f172a;
          background: transparent;
          font-size: 14px;
        }


        .username-input {
          direction: ltr;
          text-align: right;
        }


        .password-input {
          direction: ltr;
          text-align: right;
        }


        .username-input::placeholder,
        .password-input::placeholder {
          color: #94a3b8;
        }


        .email-domain-tag {
          height: 52px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          color: #059669;
          background: #f0fdf4;
          border-right: 1px solid #dcfce7;
          font-size: 12px;
          font-weight: 900;
          direction: ltr;
          white-space: nowrap;
        }


        .helper-text {
          display: block;
          margin-top: 7px;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }


        .password-toggle {
          width: 40px;
          height: 38px;
          margin-left: 7px;
          margin-right: 5px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 9px;
          color: #059669;
          background: #ecfdf5;
          cursor: pointer;
          transition:
            background 0.2s ease,
            color 0.2s ease;
        }


        .password-toggle svg {
          width: 19px;
          height: 19px;
        }


        .password-toggle:hover:not(:disabled) {
          color: #ffffff;
          background: #059669;
        }


        .password-toggle:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }


        .btn-primary {
          width: 100%;
          min-height: 55px;
          margin-top: 7px;
          padding: 0 18px;
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
          box-shadow:
            0 12px 25px
            rgba(5, 150, 105, 0.2);
          cursor: pointer;
          font-size: 15px;
          font-weight: 900;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            opacity 0.2s ease;
        }


        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 16px 30px
            rgba(5, 150, 105, 0.28);
        }


        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }


        .btn-primary:disabled {
          opacity: 0.72;
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
          gap: 9px;
        }


        .spinner {
          width: 20px;
          height: 20px;
          animation: spin 0.8s linear infinite;
        }


        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }


        .signup-prompt {
          margin-top: 24px;
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
          transition: color 0.2s ease;
        }


        .signup-link:hover {
          color: #047857;
          text-decoration: underline;
        }


        .form-footer {
          margin-top: 25px;
          padding-top: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-top: 1px solid #e2e8f0;
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
            rgba(34, 197, 94, 0.65);
        }


        /* =========================
           شاشات الكمبيوتر المتوسطة
        ========================== */

        @media (max-width: 1000px) {

          .auth-container {
            padding: 18px;
          }


          .auth-card-wrap {
            max-width: 900px;
            min-height: 600px;
          }


          .auth-art {
            padding: 34px;
          }


          .auth-form-side {
            padding: 42px 34px;
          }


          .brand-title {
            font-size: 42px;
          }


          .brand-subtitle {
            font-size: 18px;
          }

        }


        /* =========================
           الهاتف والتابلت
           نفس التصميم - ترتيب عمودي
        ========================== */

        @media (max-width: 760px) {

          .auth-container {
            min-height: 100vh;
            padding: 14px;
            align-items: center;
            background:
              radial-gradient(
                circle at top right,
                rgba(16, 185, 129, 0.12),
                transparent 40%
              ),
              #07111f;
          }


          .background-glow {
            filter: blur(80px);
          }


          .auth-card-wrap {
            width: 100%;
            min-height: auto;
            flex-direction: column;
            border-radius: 22px;
          }


          /*
            نفس القسم الجانبي السابق،
            لكن يصبح الجزء التعريفي في الأعلى.
          */
          .auth-art {
            width: 100%;
            min-height: auto;
            padding: 27px 22px 23px;
          }


          .art-header {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }


          .network-logo {
            gap: 10px;
          }


          .logo-icon {
            width: 50px;
            height: 50px;
            flex-basis: 50px;
            border-radius: 15px;
          }


          .logo-icon svg {
            width: 31px;
            height: 31px;
          }


          .logo-title {
            font-size: 18px;
          }


          .logo-caption {
            font-size: 8px;
            letter-spacing: 1.5px;
          }


          .network-badge {
            margin-top: 17px;
            padding: 7px 11px;
            font-size: 10px;
          }


          .art-main {
            padding: 24px 0 20px;
          }


          .welcome-label {
            margin-bottom: 6px;
            font-size: 12px;
          }


          .brand-title {
            font-size: 32px;
            letter-spacing: -0.5px;
          }


          .brand-subtitle {
            margin: 9px 0 7px;
            font-size: 16px;
            line-height: 1.55;
          }


          .brand-description {
            max-width: 100%;
            font-size: 12px;
            line-height: 1.8;
          }


          .feature-list {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 7px;
          }


          .feature-item {
            min-width: 0;
            padding: 8px 6px;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            gap: 5px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.045);
            color: #d1fae5;
            font-size: 9px;
            line-height: 1.35;
          }


          .feature-icon {
            width: 19px;
            height: 19px;
            flex-basis: 19px;
            border-radius: 6px;
            font-size: 10px;
          }


          .art-footer {
            padding-top: 15px;
            gap: 10px;
            font-size: 9px;
          }


          .developer-tag {
            text-align: left;
          }


          /*
            نموذج الدخول يستخدم نفس التصميم
            ولا يوجد mobile-logo منفصل.
          */
          .auth-form-side {
            width: 100%;
            padding: 28px 22px 25px;
            background:
              linear-gradient(
                180deg,
                #ffffff 0%,
                #f8fafc 100%
              );
          }


          .form-card {
            max-width: 100%;
          }


          .form-header {
            margin-bottom: 23px;
          }


          .login-icon {
            width: 42px;
            height: 42px;
            margin-bottom: 13px;
            border-radius: 12px;
          }


          .login-icon svg {
            width: 23px;
            height: 23px;
          }


          .login-title {
            font-size: 25px;
          }


          .login-subtitle {
            font-size: 12px;
            line-height: 1.6;
          }


          .error-note {
            margin-bottom: 17px;
            padding: 11px 12px;
            font-size: 11px;
          }


          .field-group {
            margin-bottom: 17px;
          }


          .input-label {
            margin-bottom: 7px;
            font-size: 12px;
          }


          .username-input-wrap,
          .password-input-wrap {
            min-height: 52px;
            border-radius: 13px;
          }


          .input-symbol {
            width: 39px;
            min-width: 39px;
          }


          .input-symbol svg {
            width: 18px;
            height: 18px;
          }


          .username-input,
          .password-input {
            height: 50px;
            font-size: 15px;
          }


          .email-domain-tag {
            height: 50px;
            padding: 0 10px;
            font-size: 10px;
          }


          .password-toggle {
            width: 38px;
            height: 36px;
            margin-left: 5px;
            margin-right: 4px;
          }


          .password-toggle svg {
            width: 18px;
            height: 18px;
          }


          .helper-text {
            margin-top: 6px;
            font-size: 10px;
          }


          .btn-primary {
            min-height: 53px;
            border-radius: 14px;
            font-size: 14px;
          }


          .signup-prompt {
            margin-top: 20px;
            font-size: 12px;
          }


          .form-footer {
            margin-top: 20px;
            padding-top: 14px;
            font-size: 10px;
          }

        }


        /* =========================
           الهواتف الصغيرة جدًا
        ========================== */

        @media (max-width: 390px) {

          .auth-container {
            padding: 8px;
          }


          .auth-card-wrap {
            border-radius: 18px;
          }


          .auth-art {
            padding:
              22px 17px 19px;
          }


          .logo-icon {
            width: 45px;
            height: 45px;
            flex-basis: 45px;
          }


          .logo-icon svg {
            width: 28px;
            height: 28px;
          }


          .logo-title {
            font-size: 17px;
          }


          .network-badge {
            font-size: 9px;
          }


          .brand-title {
            font-size: 29px;
          }


          .brand-subtitle {
            font-size: 14px;
          }


          .brand-description {
            font-size: 11px;
          }


          .feature-item {
            font-size: 8px;
          }


          .auth-form-side {
            padding:
              24px 17px 22px;
          }


          .login-title {
            font-size: 23px;
          }


          .login-subtitle {
            font-size: 11px;
          }


          .email-domain-tag {
            padding: 0 7px;
            font-size: 9px;
          }


          .password-toggle {
            width: 35px;
            margin-left: 3px;
            margin-right: 3px;
          }

        }


        /* =========================
           شاشات قصيرة الارتفاع
        ========================== */

        @media (max-height: 700px) and (min-width: 761px) {

          .auth-card-wrap {
            min-height: 560px;
          }


          .auth-art {
            padding-top: 28px;
            padding-bottom: 28px;
          }


          .art-main {
            padding: 25px 0;
          }


          .brand-title {
            font-size: 40px;
          }


          .feature-list {
            margin-top: 18px;
          }


          .auth-form-side {
            padding-top: 30px;
            padding-bottom: 30px;
          }

        }

      `}</style>
    </main>
  );
}
