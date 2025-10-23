import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from '../AppProvider';
import { stopTimerHandler } from '../scripts/timer-crossword';
import axiosInstance from '../utils/axiosInstance';

// DrawCrossword component renders the crossword puzzle form.
export const DrawCrossword = ({ showAnswers = false, handleKeyDown, inputRefs, puzzleId, userInfo }) => {
  const { colors, timerRef, setTimerRef } = useContext(AppContext);
  const { getPuzzleById, loadingPuzzles, puzzlesError } = useContext(AppContext);
  // console.log("userInfo :",userInfo);
  
  const puzzle = useMemo(() => {
    if (!puzzleId) return null;
    return getPuzzleById(puzzleId);
  }, [getPuzzleById, puzzleId]);
  
  // safe defaults
  const vword = useMemo(() => {
    if (!puzzle) return '';
    return typeof puzzle.vword === 'string' ? puzzle.vword : (Array.isArray(puzzle.vword) ? puzzle.vword.join('') : '');
  }, [puzzle]);
  
  const answers = useMemo(() => {
    return Array.isArray(puzzle?.answers) ? puzzle.answers : [];
  }, [puzzle]);
  // states
  const [inputAns, setInputAns] = useState(() => {
    return answers.map(row => Array((row || '').length).fill(''));
  });
  const [isCorrect, setIsCorrect] = useState(() => Array(answers.length).fill(false));
  
  const [disabledRows, setDisabledRows] = useState(() => Array(answers.length).fill(false));

  useEffect(() => {
    const loadCompleted = async () => {
      if (!userInfo?.id || !puzzleId) return;
      try {
        const resp = await axiosInstance.get('/user-completed-rows', {
          params: { userId: userInfo.id, puzzleId }
        });
        const completed = resp.data?.completedRows || [];
        setDisabledRows(prev => {
          const arr = Array(Math.max(prev.length, answers.length)).fill(false);
          completed.forEach(idx => { if (typeof idx === 'number') arr[idx] = true; });
          return arr;
        });
      } catch (err) {
        console.error('loadCompleted error', err);
      }
    };
    loadCompleted();
  }, [userInfo?.id, puzzleId, answers.length]);

  // safe get vertical char for row i
  const getVChar = (i) => {
    if (!vword) return '';
    return (vword[i] || '').toString();
  };
  
  // compute numeric maxInit once per answers/vword change (primitive result)
  const computedMaxInit = useMemo(() => {
    if (!Array.isArray(answers) || answers.length === 0) return 0;
    let init = 0;
    for (let i = 0; i < answers.length; i++) {
      const row = (answers[i] || '').toString();
      const vchar = (getVChar(i) || '').toLowerCase();
      if (!vchar) continue;
      const idx = row.toLowerCase().indexOf(vchar);
      if (idx >= 0) init = Math.max(init, idx);
    }
    return init;
  }, [answers, vword]);
  
  // set max position local variable (no need setState for this)
  const maxInitPosition = computedMaxInit;
  
  // initialize inputAns when answers / vword change — set only if different
  useEffect(() => {
    const newInputAns = answers.map((rowWord) => {
      const row = (rowWord || '').toString();
      return Array(row.length).fill('');
    });
    
    setInputAns(prev => {
      const same = JSON.stringify(prev) === JSON.stringify(newInputAns);
      return same ? prev : newInputAns;
    });
    
    // reset correctness array
    setIsCorrect(Array(answers.length).fill(false));
  }, [answers, vword]);

const handleInputChange = async (e, i, j) => {
    if (disabledRows[i]) return; // already completed remotely

    const newValue = (e.target.value || '').toUpperCase().slice(-1);
    setInputAns(prev => {
      const copy = prev.map(r => r.slice());
      if (!copy[i]) copy[i] = Array((answers[i] || '').length).fill('');
      copy[i][j] = newValue;
      return copy;
    });

    // compute candidate locally (use latest inputAns; since setState is async we build from current + new char)
    const candidate = (inputAns[i] ? inputAns[i].slice() : Array((answers[i] || '').length).fill(''));
    candidate[j] = newValue;
    const word = candidate.join('');
    const correct = (answers[i] || '').toString();

    const isRowCorrect = word.toLowerCase() === correct.toLowerCase();

    setIsCorrect(prev => {
      const cp = prev.slice();
      cp[i] = isRowCorrect;
      return cp;
    });

    if (isRowCorrect && !disabledRows[i]) {
      // optimistic set to prevent double requests from quick users
      setDisabledRows(prev => { const cp = prev.slice(); cp[i] = true; return cp; });

      try {
        const resp = await axiosInstance.post('/complete-row', {
          userId: userInfo.id,
          puzzleId,
          rowIndex: i,
          reward: 10
        });

        if (resp.data?.already) {
          // already completed remotely — nothing to do
        } else {
          // success: server awarded points and stored completion
          // if you want, update local userInfo.points (if kept in context)
          // e.g. updateUserPoints(resp.data.points);
        }
      } catch (err) {
        console.error('complete-row error', err);
        // rollback optimistic if desired:
        // setDisabledRows(prev => { const cp = prev.slice(); cp[i] = false; return cp; });
        // but better keep disabled and let retry later; or show message
      }
    }
  };


  useEffect(() => {
    if (Array.isArray(isCorrect) && isCorrect.length > 0 && isCorrect.every(v => v === true)) {
      stopTimerHandler(timerRef, setTimerRef);
      alert('Congrats! You finished the crossword.');
    }
  }, [isCorrect, timerRef, setTimerRef]);

  if (!Array.isArray(answers) || answers.length === 0) return <div>No puzzle data available.</div>;

  const handleBuyHint = async (rowIndex) => {
    console.log(`Buy hint for row ${rowIndex}`);
    // console.log("userInfo in handleBuyHint:", userInfo.hints);
    if(userInfo.point < 10) 
    {      alert('Không đủ điểm để mua hint');
      return;
    }
    try{
      const response = await axiosInstance.post('/request-buy-hint', {
        userId: userInfo.id,
        rowId: puzzleId * 10 + rowIndex,
        hintCost: 10
    }
      );
      alert('Yêu cầu mua hint thành công');
    } catch (error) {
      console.error('Error purchasing hint:', error);
      alert('Failed to purchase hint. Please try again.');
    }
  }
  
  return (
  <form className="puzzle-form" style={{ display: 'grid', gridTemplateRows: `repeat(${answers.length}, 1fr)` }}>
    {answers.map((rowWordRaw, i) => {
      try {
        const rowWord = (rowWordRaw || '').toString();
        const vChar = (getVChar(i) || '').toLowerCase();
        const charIndex = vChar ? rowWord.toLowerCase().indexOf(vChar) : -1;
        let currInitPosition = maxInitPosition - (charIndex >= 0 ? charIndex : 0);
        if (currInitPosition < 0) currInitPosition = 0;

        return (
          <React.Fragment key={`row-${i}`}>
            {Array.from({ length: rowWord.length }).map((_, j) => {
              const correctValue = rowWord[j] || '';
              const defaultValue = inputAns[i] ? inputAns[i][j] : '';

              return (
                <input
                  key={`${i}-${j}`}
                  className={'puzzle-cell ' + (isCorrect[i] ? 'correct-answer' : '')}
                  style={{ gridRow: i + 1, gridColumn: currInitPosition + j + 1, ...colors }}
                  // Nếu đang showAnswers thì hiện đáp án, nếu hàng đã disabled thì cũng hiện đáp án,
                  // ngược lại hiện giá trị người chơi đang nhập (defaultValue).
                  value={
                    showAnswers
                      ? correctValue
                      : (disabledRows[i] ? correctValue : (defaultValue || ''))
                  }
                  onChange={(e) => handleInputChange(e, i, j)}
                  maxLength={1}
                  disabled={!!disabledRows[i]}   // vẫn giữ disabled cho hàng đã hoàn thành
                  ref={el => {
                    if (inputRefs && inputRefs.current) {
                      if (!inputRefs.current[i]) inputRefs.current[i] = Array(36).fill(null);
                      inputRefs.current[i][currInitPosition + j] = el;
                    }
                  }}
                  onKeyDown={(e) => { if (handleKeyDown) handleKeyDown(e, i, currInitPosition + j); }}
                />
              );
            })}
            {/* Button cuối hàng */}
            {
            !userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) && <button
              type="button"
              style={{ gridRow: i + 1, gridColumn: currInitPosition + rowWord.length + 1 }}
              onClick={() => handleBuyHint(i + 1)}
            >
              {userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) ? '(Đã mua)' : 'Mua hint 1 (-10 điểm)'}
            </button>
            }
            {
              userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) && 
              <button
              type="button"
              style={{ gridRow: i + 1, gridColumn: currInitPosition + rowWord.length + 1 }}
              onClick={() => handleBuyHint(i + 1)}
            >
              {userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) &&  'Mua hint 2 (-10 điểm)'}
            </button>
            }
          </React.Fragment>
        );
      } catch (err) {
        console.error('Error rendering row', i, err);
        return null;
      }
    })}
  </form>
);
};


// CrosswordContainer component renders the crossword puzzle container.
const CrosswordContainer = ({ puzzleId, userInfo }) => {
  // console.log("User Info in CrosswordContainer:", userInfo);
  const { getPuzzleById, showAnswers, loadingPuzzles, puzzlesError } = useContext(AppContext);

  // select puzzle by id, memoized — chỉ recompute khi puzzleId hoặc map thay đổi inside getPuzzleById
  const puzzle = useMemo(() => {
    if (!puzzleId) return null;
    return getPuzzleById(puzzleId);
  }, [getPuzzleById, puzzleId]);

  // safe defaults
  const vword = useMemo(() => {
    if (!puzzle) return '';
    // puzzle.vword might be string or array — keep as string for DrawCrossword, adapt if needed
    return typeof puzzle.vword === 'string' ? puzzle.vword : (Array.isArray(puzzle.vword) ? puzzle.vword.join('') : '');
  }, [puzzle]);

  const answers = useMemo(() => {
    return Array.isArray(puzzle?.answers) ? puzzle.answers : [];
  }, [puzzle]);

  // initialize inputRefs with stable ref; length may change when answers length changes
  const inputRefs = useRef([]);
  if (!Array.isArray(inputRefs.current) || inputRefs.current.length !== Math.max(answers.length, 0)) {
    inputRefs.current = Array.from({ length: Math.max(answers.length, 0) }, () => Array(36).fill(null));
  }

  // stable keyboard handler
  const handleKeyDown = useCallback((e, i, j) => {
    if (e.key === 'ArrowUp' && inputRefs.current[i - 1]?.[j]) inputRefs.current[i - 1][j].focus();
    else if (e.key === 'ArrowDown' && inputRefs.current[i + 1]?.[j]) inputRefs.current[i + 1][j].focus();
    else if (e.key === 'ArrowLeft' && inputRefs.current[i]?.[j - 1]) inputRefs.current[i][j - 1].focus();
    else if (e.key === 'ArrowRight' && inputRefs.current[i]?.[j + 1]) inputRefs.current[i][j + 1].focus();
  }, []);

  if (loadingPuzzles) return <div>Loading puzzles…</div>;
  if (puzzlesError) return <div>Error loading puzzles.</div>;
  if (!puzzle) return <div>Puzzle not found.</div>;

  return (
    <div className="container-md actual" id="cpuzzle">
      <DrawCrossword
        showAnswers={showAnswers}
        handleKeyDown={handleKeyDown}
        inputRefs={inputRefs}
        puzzleId={puzzleId}
        userInfo={userInfo}
      />
    </div>
  );
};

export default CrosswordContainer
