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

  // النطاق الذي يستخدمه الموزعون في حساباتهم
  const EMAIL_DOMAIN = '@gmail.com';

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // دمج المدخل مع @gmail.com
    const fullEmail = `${username.trim().toLowerCase()}${EMAIL_DOMAIN}`;

    const { data, error: authError } = await supabase.auth.signInWithPassword({ 
      email: fullEmail, 
      password 
    });

    if (authError) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      setError('لم يتم العثور على حساب مرتبط بهذا البريد');
      setLoading(false);
      return;
    }

    if (profile.status !== 'approved' && profile.role === 'distributor') {
      setError('حسابك لا يزال قيد المراجعة من قبل المدير');
      setLoading(false);
      return;
    }

    router.push(profile.role === 'admin' ? '/admin' : '/distributor');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div className="brand" style={{ fontWeight: 900, fontSize: 20 }}>تواصل</div>
        <div>
          <h2 style={{ fontSize: 26, lineHeight: 1.7 }}>مخزونك، موزعينك، كل الكروت تحت سيطرتك.</h2>
          <p style={{ color: '#E3D6FF', marginTop: 12, lineHeight: 1.9 }}>
            أضِف الكروت يدويًا أو عبر ملف PDF، وزّعها على باقات، وامنح موزعيك رصيدًا يطلبون به بأنفسهم.
          </p>
        </div>
        <div style={{ fontSize: 11.5, color: '#C9BFEA' }}>© تواصل — أبو بكر محسن</div>
      </div>

      <div className="auth-form">
        <form className="form-card" onSubmit={handleLogin}>
          <div className="brand" style={{ fontWeight: 900, fontSize: 18, marginBottom: 24 }}>تسجيل الدخول</div>

          {error && <div className="error-note">{error}</div>}

          <div className="field">
            <label>البريد الإلكتروني</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              <input 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="اسم المستخدم" 
                style={{ border: 'none', flex: 1, padding: '10px', outline: 'none' }}
              />
              <span style={{ padding: '0 8px', color: '#888', fontSize: '12px', background: '#f5f5f5', borderRight: '1px solid #ddd' }}>
                {EMAIL_DOMAIN}
              </span>
            </div>
          </div>

          <div className="field">
            <label>كلمة المرور</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
          
          <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 16 }}>
            ليس لديك حساب موزع؟ <a href="/signup" style={{ color: 'var(--grape)', fontWeight: 700 }}>أنشئ حسابًا</a>
          </div>
        </form>
      </div>
    </div>
  );
}
