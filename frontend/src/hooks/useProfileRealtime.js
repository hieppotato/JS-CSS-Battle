// src/hooks/useProfileRealtime.js
import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function useProfileRealtime(userId, onChange) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // tạo channel subscription (supabase-js v2)
    const channel = supabase
      .channel(`public:profiles:id=eq.${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          // payload.new chứa row mới
          onChange && onChange(payload.new, payload);
        }
      )
      .subscribe(status => {
        // status có thể là 'SUBSCRIBED' hoặc lỗi
        // console.log('supabase subscription status', status);
      });

    channelRef.current = channel;

    return () => {
      try {
        channel.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, [userId, onChange]);
}
