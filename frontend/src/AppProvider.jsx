// AppProvider.jsx
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axiosInstance from './utils/axiosInstance';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const mountedRef = useRef(true);

  // puzzlesMap: { [id]: { id, vword, answers, refs, ... } }
  const [puzzlesMap, setPuzzlesMap] = useState({});
  const [loadingPuzzles, setLoadingPuzzles] = useState(false);
  const [puzzlesError, setPuzzlesError] = useState(null);

  // UI states (giữ giống trước)
  const [showAnswers, setShowAnswers] = useState(false);
  const original_colors = useRef({ '--c': '#3C096C', '--d': '#5A189A', '--e': '#7B2CBF', '--f': '#9D4EDD' });
  const [colors, setColors] = useState(original_colors.current);
  const [lang, setLang] = useState(localStorage.getItem('language') || 'en');
  const [timerRef, setTimerRef] = useState(null);
  const [vword, setVword] = useState('');
  const [answers, setAnswers] = useState([]);

  // Fetch all puzzles once when provider mounts
  useEffect(() => {
    mountedRef.current = true;
    const fetchPuzzles = async () => {
      setLoadingPuzzles(true);
      try {
        const resp = await axiosInstance.get('/chunk-dd12a0af');
        const list = Array.isArray(resp.data) ? resp.data : (resp.data?.puzzles || []);
        // convert to map for O(1) lookup
        const map = {};
        list.forEach(p => {
          if (!p || !p.id) return;
          map[p.id] = p;
        });
        if (mountedRef.current) {
          setPuzzlesMap(prev => {
            // avoid setting same reference if identical keys+values (simple shallow)
            const same = Object.keys(prev).length === Object.keys(map).length &&
                         Object.keys(map).every(k => prev[k] && JSON.stringify(prev[k]) === JSON.stringify(map[k]));
            return same ? prev : map;
          });
        }
      } catch (err) {
        console.error('Failed to fetch puzzles', err);
        if (mountedRef.current) setPuzzlesError(err);
      } finally {
        if (mountedRef.current) setLoadingPuzzles(false);
      }
    };

    fetchPuzzles();
    return () => { mountedRef.current = false; };
  }, []);

  // memoized getPuzzleById
  const getPuzzleById = useCallback((id) => {
    if (!id) return null;
    return puzzlesMap[id] || null;
  }, [puzzlesMap]);

  // provider value memoized to avoid unnecessary re-renders
  const value = useMemo(() => ({
    // puzzles access
    vword,
    setVword,
    puzzlesMap,
    getPuzzleById,
    loadingPuzzles,
    puzzlesError,
    // UI / other states
    showAnswers, setShowAnswers,
    colors, setColors,
    lang, setLang,
    timerRef, setTimerRef,
    answers, setAnswers,
  }), [vword, puzzlesMap, getPuzzleById, loadingPuzzles, puzzlesError, showAnswers, colors, lang, timerRef]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
