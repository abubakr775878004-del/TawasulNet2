
'use client';

import { useState } from 'react';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);

    if (typeof window !== 'undefined' && navigator.onLine) {
      window.location.reload();
      return;
    }

    setTimeout(() => {
      setChecking(false);
    }, 1000);
  };

  return (
    <main
      dir="rtl"
      className="offline-page"
    >
      <div className="offline-container">

        {/* شعار التطبيق */}
        <div className="brand">
          <div className="brand-icon">
            <img
              src="/icons/icon-192.png"
              alt="أيقونة شبكة تواصل"
              className="app-logo"
            />
          </div>

          <h1>شبكة تواصل</h1>

          <p className="brand-description">
            تواصل دائمًا بالقرب منك
          </p>
        </div>

        {/* حالة الاتصال */}
        <div className="status-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="65"
            height="65"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M5 13a10 10 0 0 1 5-2.5" />
            <path d="M19 13a10 10 0 0 0-2.5-1.8" />
            <path d="M2 8.5a15 15 0 0 1 20 0" />
            <path d="M12 20h.01" />
          </svg>
        </div>

        <div className="message">
          <h2>لا يوجد اتصال بالإنترنت</h2>

          <p>
            يبدو أنك غير متصل بالإنترنت حاليًا.
            يرجى التحقق من اتصالك بشبكة Wi-Fi
            أو بيانات الهاتف والمحاولة مرة أخرى.
          </p>
        </div>

        {/* زر إعادة المحاولة */}
        <button
          type="button"
          className="retry-button"
          onClick={handleRetry}
          disabled={checking}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={checking ? 'spinning' : ''}
          >
            <path d="M20 7v5h-5" />
            <path d="M4 17v-5h5" />
            <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12" />
            <path d="M18.4 15a7 7 0 0 1-11.6 2L4 12" />
          </svg>

          {checking ? 'جارٍ التحقق...' : 'إعادة المحاولة'}
        </button>

        <div className="footer">
          <span className="footer-dot" />
          بمجرد عودة الاتصال يمكنك متابعة استخدام التطبيق
        </div>

      </div>

      <style jsx>{`
        .offline-page {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          box-sizing: border-box;
          background: linear-gradient(
            145deg,
            #f0faf5 0%,
            #ffffff 55%,
            #e8f8f7 100%
          );
          font-family: inherit;
          color: #174b38;
        }

        .offline-container {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border: 1px solid #e5f2eb;
          border-radius: 28px;
          padding: 38px 28px;
          text-align: center;
          box-shadow: 0 15px 50px rgba(21, 125, 83, 0.08);
          box-sizing: border-box;
        }

        .brand {
          margin-bottom: 38px;
        }

        .brand-icon {
          width: 76px;
          height: 76px;
          margin: 0 auto 14px;
          border-radius: 23px;
          background: #f0faf5;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .app-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand h1 {
          color: #138653;
          font-size: 25px;
          font-weight: 800;
          margin: 0;
        }

        .brand-description {
          color: #719384;
          font-size: 13px;
          margin-top: 8px;
        }

        .status-icon {
          width: 112px;
          height: 112px;
          margin: 0 auto 25px;
          border-radius: 50%;
          background: #e6f7ef;
          color: #159b65;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .message h2 {
          font-size: 23px;
          font-weight: 800;
          color: #167b50;
          margin: 0 0 14px;
        }

        .message p {
          font-size: 15px;
          line-height: 1.9;
          color: #71877d;
          margin: 0;
        }

        .retry-button {
          width: 100%;
          min-height: 54px;
          margin-top: 30px;
          border: none;
          border-radius: 15px;
          background: linear-gradient(
            110deg,
            #159b65,
            #13a99c
          );
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: opacity 0.2s, transform 0.2s;
        }

        .retry-button:hover {
          opacity: 0.92;
          transform: translateY(-2px);
        }

        .retry-button:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 25px;
          color: #91a99c;
          font-size: 11px;
          line-height: 1.8;
        }

        .footer-dot {
          width: 7px;
          height: 7px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #19b58b;
        }

        @media (max-width: 480px) {
          .offline-container {
            padding: 30px 22px;
            border-radius: 23px;
          }

          .brand {
            margin-bottom: 30px;
          }

          .message h2 {
            font-size: 21px;
          }

          .message p {
            font-size: 14px;
          }
        }

        @media (min-width: 768px) {
          .offline-container {
            max-width: 480px;
            padding: 45px 38px;
          }
        }
      `}</style>
    </main>
  );
}
