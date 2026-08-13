'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useProfile(requiredRole) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/');

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!active) return;

      if (!data || data.role !== requiredRole) {
        router.push('/');
        return;
      }
      setProfile(data);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router, requiredRole]);

  return { profile, loading };
}
