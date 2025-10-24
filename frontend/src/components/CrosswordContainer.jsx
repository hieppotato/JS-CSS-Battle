import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from '../AppProvider';
import { stopTimerHandler } from '../scripts/timer-crossword';
import axiosInstance from '../utils/axiosInstance';
import './style.css';

// DrawCrossword component renders the crossword puzzle form.
export const DrawCrossword = ({ showAnswers = false, handleKeyDown, inputRefs, puzzleId, userInfo, setScoreFromServer, setCount }) => {
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
  
  const numberOfDisabledRows = disabledRows.map(e => e ? 1 : 0).reduce((a, b) => a + b, 0);
  // console.log("numberOfDisabledRows:", numberOfDisabledRows);
  
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


  useEffect(() => {
  if (typeof setCount === 'function') {
    const num = (disabledRows || []).filter(Boolean).length;
    setCount(num);
  }
}, [disabledRows, setCount]);


const handleInputChange = async (e, i, j) => {
  if (disabledRows[i]) return; // already completed remotely

  const reward = 10;
  const newValue = (e.target.value || '').toUpperCase().slice(-1);

  // cập nhật inputAns local
  setInputAns(prev => {
    const copy = prev.map(r => r.slice());
    if (!copy[i]) copy[i] = Array((answers[i] || '').length).fill('');
    copy[i][j] = newValue;
    return copy;
  });

  // tạo candidate dựa trên current inputAns (không chờ setState)
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

  if (!isRowCorrect || disabledRows[i]) return;

  // -> hàng đúng và chưa disable: optimistic xử lý
  // 1) disable row locally để UX mượt
  setDisabledRows(prev => {
    const cp = prev.slice();
    cp[i] = true;
    return cp;
  });

  // 2) optimistic tăng điểm trên popup ngay (nếu setScoreFromServer được truyền)
  //    dùng functional updater để tránh stale value
  if (typeof setScoreFromServer === 'function') {
    setScoreFromServer(prev => {
      const numericPrev = Number(prev) || 0;
      return numericPrev + reward;
    });
  }

  // 3) gọi server để persist (idempotent). server phải trả { already, points }
  try {
    const resp = await axiosInstance.post('/complete-row', {
      userId: userInfo.id,
      puzzleId,
      rowIndex: i,
      reward
    });

    // nếu server trả points, sync lại với server (prefer server value)
    if (resp?.data?.points != null && typeof setScoreFromServer === 'function') {
      setScoreFromServer(Number(resp.data.points));
    }

    // nếu server nói đã completed trước đó (already), server có thể trả same points
    // nothing more to do
  } catch (err) {
    console.error('complete-row error', err);

    // rollback: nếu muốn hoàn tác việc disable & điểm khi lỗi
    // (tùy UX: bạn có thể giữ disable và retry later; dưới đây là rollback)
    setDisabledRows(prev => {
      const cp = prev.slice();
      cp[i] = false;
      return cp;
    });
    if (typeof setScoreFromServer === 'function') {
      // trừ lại điểm optimistic
      setScoreFromServer(prev => {
        const numericPrev = Number(prev) || 0;
        const newVal = numericPrev - reward;
        return newVal >= 0 ? newVal : 0;
      });
    }
    // hiển thị lỗi cho user
    alert('Không thể lưu trạng thái hoàn thành hàng. Vui lòng thử lại.');
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
    if(userInfo.point < 4) 
    {      alert('Không đủ điểm để mua hint');
      return;
    }
    try{
      const response = await axiosInstance.post('/request-buy-hint', {
        userId: userInfo.id,
        rowId: puzzleId * 10 + rowIndex,
        hintCost: userInfo?.hints.includes((puzzleId * 10 + rowIndex).toString()) ? 6 : 4
    }
      );
      alert('Yêu cầu mua hint thành công');
    } catch (error) {
      console.error('Error purchasing hint:', error);
      alert('Failed to purchase hint. Please try again.');
    }
  }
  
  return (
  <form className="puzzle-form" style={{ display: 'grid', gridTemplateRows: `repeat(${answers.length}, 44px)` }}>
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
              {userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) ? '(Đã mua)' : 'Mua hint 1 (-4 điểm)'}
            </button>
            }
            {
              userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) && 
              <button
              type="button"
              style={{ gridRow: i + 1, gridColumn: currInitPosition + rowWord.length + 1 }}
              onClick={() => handleBuyHint(i + 1)}
            >
              {userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) &&  'Mua hint 2 (-6 điểm)'}
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
const CrosswordContainer = ({ puzzleId, userInfo, setScoreFromServer }) => {
  // console.log("User Info in CrosswordContainer:", userInfo);
  const { getPuzzleById, showAnswers, loadingPuzzles, puzzlesError } = useContext(AppContext);
  const [count, setCount] = useState(0);
  const [verticalGuess, setVerticalGuess] = useState('');
  const [disableInput, setDisableInput] = useState(false);
  // select puzzle by id, memoized — chỉ recompute khi puzzleId hoặc map thay đổi inside getPuzzleById
  useEffect(() => {
    setDisableInput(userInfo?.puzzles?.includes(puzzleId));
    // console.log(userInfo);
  }, [userInfo, puzzleId]);
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

  const handleVerticalSubmit = async () => {
  if (!verticalGuess.trim()) {
    alert('Vui lòng nhập chữ hàng dọc.');
    return;
  }

  // Chuyển hết về chữ thường để so sánh không phân biệt hoa/thường
  const normalizedGuess = verticalGuess.trim().toLowerCase();
  const correctVWord = vword.toLowerCase();

  if (normalizedGuess === correctVWord) {
    alert('Chính xác! Bạn đã đoán đúng chữ hàng dọc 🎉');
    try{
      const response = await axiosInstance.post('/complete-vword', {
        userId: userInfo.id,
        puzzleId,
        reward: 100
      });
      if (response?.data?.points != null && typeof setScoreFromServer === 'function') {
        setScoreFromServer(Number(response.data.points));
        setDisableInput(response.data.puzzles?.includes(puzzleId));
      }
    } catch (error) {
      console.error('Error completing vertical word:', error);
      alert('Đã xảy ra lỗi khi gửi đáp án. Vui lòng thử lại.');
    }
  } else {
    alert('Sai rồi, hãy thử lại 😅');
  }
};

  

    return (
    <div>
      <div className="draw-center">
        <div className="card cp-card">
          <h2 className="cp-title">Crossword Completion Progress</h2>

          <div className="cp-body">
            <DrawCrossword
              showAnswers={showAnswers}
              handleKeyDown={handleKeyDown}
              inputRefs={inputRefs}
              puzzleId={puzzleId}
              userInfo={userInfo}
              setScoreFromServer={setScoreFromServer}
              setCount={setCount}
            />

            <div className="cp-footer">
              <div className="completed-count">Đã hoàn thành: <strong>{count}</strong></div>

              {count > 4 && !disableInput && (
                <div className="vertical-guess-row">
                  <input
                    name="verticalGuess"
                    placeholder="Đoán chữ hàng dọc"
                    value={verticalGuess}
                    onChange={(e) => setVerticalGuess(e.target.value)}
                    className="vertical-input"
                  />
                  <button
                    type="button"
                    onClick={handleVerticalSubmit}
                    className="btn btn-primary"
                  >
                    Nộp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrosswordContainer
