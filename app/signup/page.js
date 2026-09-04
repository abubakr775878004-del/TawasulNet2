'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });

  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }

    if (form.password !== form.confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (form.password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } =
        await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            data: {
              full_name: name,
              name,
              signup_type: 'distributor',
            },
          },
        });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data?.user) {
        setError('تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى.');
        return;
      }

      /*
       * مهم:
       * لا ننشئ profiles يدويًا هنا.
       *
       * Trigger:
       * on_auth_user_created
       *      ↓
       * handle_new_user()
       *
       * ويجب أن ينشئ الحساب:
       * role = distributor
       * status = pending
       */

      setDone(true);
    } catch (err) {
      console.error('Distributor signup error:', err);
      setError('حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div
          className="brand"
          style={{ fontWeight: 900, fontSize: 20 }}
        >
          تواصل
        </div>

        <div>
          <h2 style={{ fontSize: 26, lineHeight: 1.7 }}>
            انضم كموزّع من أي مكان.
          </h2>

          <p
            style={{
              color: '#E3D6FF',
              marginTop: 12,
              lineHeight: 1.9,
            }}
          >
            أنشئ حسابك، وبعد موافقة المدير يمكنك طلب الكروت ومتابعة رصيدك.
          </p>
        </div>

        <div
          style={{
            fontSize: 11.5,
            color: '#C9BFEA',
          }}
        >
          © تواصل — أبو بكر محسن
        </div>
      </div>

      <div className="auth-form">
        {done ? (
          <div className="form-card">
            <div className="pending-note">
              ⏳ تم إرسال طلبك بنجاح. حسابك الآن بحالة "قيد المراجعة"
              حتى يوافق عليه مدير الشبكة.
            </div>
          </div>
        ) : (
          <form
            className="form-card"
            onSubmit={handleSignup}
          >
            <div
              className="brand"
              style={{
                fontWeight: 900,
                fontSize: 18,
                marginBottom: 24,
              }}
            >
              حساب موزع جديد
            </div>

            {error && (
              <div className="error-note">
                {error}
              </div>
            )}

            <div className="field">
              <label>الاسم الكامل</label>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  update('name', e.target.value)
                }
              />
            </div>

            <div className="field">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  update('email', e.target.value)
                }
              />
            </div>

            <div className="field">
              <label>كلمة المرور</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) =>
                  update('password', e.target.value)
                }
              />
            </div>

            <div className="field">
              <label>تأكيد كلمة المرور</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={(e) =>
                  update('confirm', e.target.value)
                }
              />
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'جاري الإرسال...'
                : 'إرسال طلب التسجيل'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
