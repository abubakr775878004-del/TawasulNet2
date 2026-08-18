'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function AdminMessagesPage() {
  const { profile, loading } = useProfile('admin');
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(true);

  async function loadNotes() {
    setBusy(true);
    const { data } = await supabase
      .from('distributor_notes')
      .select('*')
      .order('created_at', { ascending: false });
    setNotes(data || []);
    setBusy(false);
  }

  useEffect(() => { if (profile) loadNotes(); }, [profile]);

  async function deleteNote(id) {
    if (!confirm('هل تريد حذف هذه الرسالة؟')) return;
    await supabase.from('distributor_notes').delete().eq('id', id);
    loadNotes();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/messages" name={profile.full_name} />
      <div className="main">
        <h1>رسائل وملاحظات الموزعين</h1>
        <p className="greet" style={{ marginBottom: 20 }}>الطلبات والملاحظات الواردة من الموزعين مباشرة</p>

        <div className="panel">
          <div className="panel-head">
            <h3>الرسائل الواردة</h3>
            <span className="muted">{notes.length} رسالة</span>
          </div>

          {busy && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>جاري التحميل...</div>}
          {!busy && notes.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد رسائل جديدة</div>}

          {!busy && notes.map((note) => (
            <div
              key={note.id}
              style={{
                borderTop: '1px solid var(--line)', padding: '16px 4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#5B21B6', marginBottom: 4 }}>
                  {note.distributor_name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                  {note.content}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
                  {new Date(note.created_at).toLocaleString('ar')}
                </div>
              </div>

              <button
                onClick={() => deleteNote(note.id)}
                style={{
                  background: '#DC2626', color: '#fff', border: 'none',
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
