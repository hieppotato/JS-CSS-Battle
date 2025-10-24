import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from '../AppProvider';
import { stopTimerHandler } from '../scripts/timer-crossword';
import axiosInstance from '../utils/axiosInstance';
import './style.css'; 

// DrawCrossword component (ĐÃ LOẠI BỎ LOGIC RENDER BUTTON)
export const DrawCrossword = ({ showAnswers = false, handleKeyDown, inputRefs, puzzleId, userInfo, setScoreFromServer, setCount }) => {
  const { colors, timerRef, setTimerRef } = useContext(AppContext);
  const { getPuzzleById, loadingPuzzles, puzzlesError } = useContext(AppContext);
  
  // console.log(userInfo.rows);
  // const includes = !userInfo.rows.includes(String(1));
  // console.log(includes);

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

      // build arr then set it and cập nhật count ngay lập tức
      setDisabledRows(prev => {
        const arr = Array(Math.max(prev.length, answers.length)).fill(false);
        completed.forEach(idx => { if (typeof idx === 'number') arr[idx] = true; });

        if (typeof setCount === 'function') {
          setCount((arr || []).filter(Boolean).length);
        }
        return arr;
      });

    } catch (err) {
      console.error('loadCompleted error', err);
    }
  };
  loadCompleted();
}, [userInfo?.id, puzzleId, answers.length, setCount]);

  
  const numberOfDisabledRows = disabledRows.map(e => e ? 1 : 0).reduce((a, b) => a + b, 0);
  
  const getVChar = (i) => {
    if (!vword) return '';
    return (vword[i] || '').toString();
  };
  
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
  
  const maxInitPosition = computedMaxInit;
  
  useEffect(() => {
    const newInputAns = answers.map((rowWord) => {
      const row = (rowWord || '').toString();
      return Array(row.length).fill('');
    });
    
    setInputAns(prev => {
      const same = JSON.stringify(prev) === JSON.stringify(newInputAns);
      return same ? prev : newInputAns;
    });
    
    setIsCorrect(Array(answers.length).fill(false));
  }, [answers, vword]);


  useEffect(() => {
  if (typeof setCount === 'function') {
    const num = (disabledRows || []).filter(Boolean).length;
    setCount(num);
  }
}, [disabledRows, setCount]);


const handleInputChange = async (e, i, j) => {
  if (disabledRows[i]) return;

  const reward = 10;
  const newValue = (e.target.value || '').toUpperCase().slice(-1);

  setInputAns(prev => {
    const copy = prev.map(r => r.slice());
    if (!copy[i]) copy[i] = Array((answers[i] || '').length).fill('');
    copy[i][j] = newValue;
    return copy;
  });

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

  setDisabledRows(prev => {
  const cp = prev.slice();
  // đảm bảo đủ dài
  if (cp.length < answers.length) {
    const tmp = Array(Math.max(answers.length, cp.length)).fill(false);
    for (let k = 0; k < cp.length; k++) tmp[k] = cp[k];
    cp.splice(0, cp.length, ...tmp);
  }
  cp[i] = true;

  // cập nhật count ngay lập tức
  if (typeof setCount === 'function') {
    setCount((cp || []).filter(Boolean).length);
  }

  return cp;
});

  if (typeof setScoreFromServer === 'function') {
    setScoreFromServer(prev => {
      const numericPrev = Number(prev) || 0;
      return numericPrev + reward;
    });
  }

  try {
    const resp = await axiosInstance.post('/complete-row', {
      userId: userInfo.id,
      puzzleId,
      rowIndex: i,
      reward
    });

    if (resp?.data?.points != null && typeof setScoreFromServer === 'function') {
      alert('Hàng hoàn thành! Điểm của bạn đã được cập nhật.');
      setScoreFromServer(Number(resp.data.points));
    }
  } catch (err) {
    console.error('complete-row error', err);

    setDisabledRows(prev => {
      const cp = prev.slice();
      cp[i] = false;

      // cập nhật count ngay lập tức sau rollback
      if (typeof setCount === 'function') {
        setCount((cp || []).filter(Boolean).length);
      }
      return cp;
    });
    if (typeof setScoreFromServer === 'function') {
      setScoreFromServer(prev => {
        const numericPrev = Number(prev) || 0;
        const newVal = numericPrev - reward;
        return newVal >= 0 ? newVal : 0;
      });
    }
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

  // // XÓA: handleBuyHint đã được chuyển lên CrosswordContainer

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

              // đánh dấu ô chứa ký tự của vertical word (vChar)
              const isVChar = (charIndex >= 0 && j === charIndex);

              return (
                <input
                  key={`${i}-${j}`}
                  className={
                    'puzzle-cell ' +
                    (isCorrect[i] ? 'correct-answer ' : '') +
                    (isVChar ? 'vword-cell' : '')
                  }
                  style={{ gridRow: i + 1, gridColumn: currInitPosition + j + 1, ...colors }}
                  value={
                    showAnswers
                      ? correctValue
                      : (disabledRows[i] ? correctValue : (defaultValue || ''))
                  }
                  onChange={(e) => handleInputChange(e, i, j)}
                  maxLength={1}
                  disabled={!!disabledRows[i] || !userInfo.rows.includes(String(i + 1))}
                  // disabled={!userInfo.rows.includes(String(i + 1))}
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
           
            {/* // // XÓA: Toàn bộ logic render button hint đã bị xóa khỏi đây.
              // // Bạn không cần làm gì cả, code này đã bị loại bỏ.
            */}

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


// CrosswordContainer component (ĐÃ THÊM LOGIC RENDER BUTTON HINT)
const CrosswordContainer = ({ puzzleId, userInfo, setScoreFromServer }) => {
  const { getPuzzleById, showAnswers, loadingPuzzles, puzzlesError } = useContext(AppContext);
  const [count, setCount] = useState(0);
  const [verticalGuess, setVerticalGuess] = useState('');
  const [disableInput, setDisableInput] = useState(false);
  
  useEffect(() => {
    setDisableInput(userInfo?.puzzles?.includes(puzzleId));
  }, [userInfo, puzzleId]);

  const puzzle = useMemo(() => {
    if (!puzzleId) return null;
    return getPuzzleById(puzzleId);
  }, [getPuzzleById, puzzleId]);

  const vword = useMemo(() => {
    if (!puzzle) return '';
    return typeof puzzle.vword === 'string' ? puzzle.vword : (Array.isArray(puzzle.vword) ? puzzle.vword.join('') : '');
  }, [puzzle]);

  const answers = useMemo(() => {
    return Array.isArray(puzzle?.answers) ? puzzle.answers : [];
  }, [puzzle]);

  const inputRefs = useRef([]);
  if (!Array.isArray(inputRefs.current) || inputRefs.current.length !== Math.max(answers.length, 0)) {
    inputRefs.current = Array.from({ length: Math.max(answers.length, 0) }, () => Array(36).fill(null));
  }

  const handleKeyDown = useCallback((e, i, j) => {
    if (e.key === 'ArrowUp' && inputRefs.current[i - 1]?.[j]) inputRefs.current[i - 1][j].focus();
    else if (e.key === 'ArrowDown' && inputRefs.current[i + 1]?.[j]) inputRefs.current[i + 1][j].focus();
    else if (e.key === 'ArrowLeft' && inputRefs.current[i]?.[j - 1]) inputRefs.current[i][j - 1].focus();
    else if (e.key === 'ArrowRight' && inputRefs.current[i]?.[j + 1]) inputRefs.current[i][j + 1].focus();
  }, []);

  // // THÊM MỚI: handleBuyHint đã được chuyển lên đây
  const handleBuyHint = async (rowIndex) => {
    console.log(`Buy hint for row ${rowIndex}`);
    if(userInfo.point < 4) 
    {     alert('Không đủ điểm để mua hint');
      return;
    }
    try{
      const response = await axiosInstance.post('/request-buy-hint', {
        userId: userInfo.id,
        rowId: puzzleId * 10 + rowIndex,
        // // Logic tính toán chi phí hint (rowIndex đã là i + 1)
        hintCost: userInfo?.hints.includes((puzzleId * 10 + rowIndex).toString()) ? 6 : 4,
        userName: userInfo.name
      }
      );
      alert('Yêu cầu mua hint thành công');
      // // TODO: Bạn cần có cơ chế cập nhật lại `userInfo` sau khi mua hint
      // // ví dụ: gọi lại hàm fetch user info.
    } catch (error) {
      console.error('Error purchasing hint:', error);
      alert('Failed to purchase hint. Please try again.');
    }
  }

  if (loadingPuzzles) return <div>Loading puzzles…</div>;
  if (puzzlesError) return <div>Error loading puzzles.</div>;
  if (!puzzle) return <div>Puzzle not found.</div>;

  function countOccurrences(array, item) {
    return array.reduce((count, current) => {
      return current === item ? count + 1 : count;
    }, 0);
  }

  const handleVerticalSubmit = async () => {
  if (!verticalGuess.trim()) {
    alert('Vui lòng nhập chữ hàng dọc.');
    return;
  }
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
    <div className='page-root'>
      <div className="draw-center">
        <div className="card cp-card">
          <h2 className="cp-title">Crossword Completion Progress</h2>

          <div className="cp-body">
            
            {/* // // SỬA ĐỔI: Thêm wrapper cho 2 cột */}
            <div className="puzzle-with-hints">
              
              {/* // // Cột 1: Lưới ô chữ */}
              <DrawCrossword
                showAnswers={showAnswers}
                handleKeyDown={handleKeyDown}
                inputRefs={inputRefs}
                puzzleId={puzzleId}
                userInfo={userInfo}
                setScoreFromServer={setScoreFromServer}
                setCount={setCount}
              />

              {/* // // THÊM MỚI: Cột 2: Các button hint */}
              <div className="hint-button-column">
                {/* Lặp qua 'answers' để tạo số lượng button tương ứng */}
                {answers.map((_, i) => (
                  <div key={`hint-btn-wrapper-${i}`} className="hint-button-wrapper">
                    {userInfo?.hints.includes((puzzleId * 10 + i + 1).toString()) ? (
                      // Đã mua hint 1 -> Hiển thị nút mua hint 2
                      countOccurrences(userInfo.hints, toString(puzzleId * 10 + i + 1) < 2) && 
                      <button
                        type="button"
                        className="btn hint-button" // // Dùng class mới
                        onClick={() => handleBuyHint(i + 1)} // // i + 1 là rowIndex (1-based)
                      >
                        Mua hint 2 (-6 điểm)
                      </button>
                    ) : (
                      // Chưa mua hint 1 -> Hiển thị nút mua hint 1
                      <button
                        type="button"
                        className="btn hint-button" // // Dùng class mới
                        onClick={() => handleBuyHint(i + 1)}
                      >
                        Mua hint 1 (-4 điểm)
                      </button>
                    )}
                  </div>
                ))}
              </div> {/* // // Kết thúc .hint-button-column */}

            </div> {/* // // Kết thúc .puzzle-with-hints */}


            {/* // // Phần footer giữ nguyên */}
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
              <button
                    type="button"
                    onClick={() => window.location.href = '/home'}
                    className="btn btn-primary justify-center mt-4"
                  >
                    Quay về trang chủ
                  </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrosswordContainer