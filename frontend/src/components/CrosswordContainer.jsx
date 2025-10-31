import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from '../AppProvider';
import { stopTimerHandler } from '../scripts/timer-crossword';
import axiosInstance from '../utils/axiosInstance';
import useProfileRealtime from '../hooks/useProfileRealtime';
import './style.css'; 

// DrawCrossword component (ĐÃ LOẠI BỎ LOGIC RENDER BUTTON)
export const DrawCrossword = ({ showAnswers = false, handleKeyDown, inputRefs, puzzleId, userInfo, setScoreFromServer, setCount, setDisableInput }) => {
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

const internalHandleKeyDown = (e, i, j, currInitPosition) => {
  const gridCol = currInitPosition + j;

  // 1. Logic di chuyển lùi khi bấm Backspace
  if (e.key === "Backspace") {
    const currentInput = inputRefs.current?.[i]?.[gridCol];

    // Chỉ di chuyển lùi nếu ô hiện tại đã rỗng
    if (currentInput && currentInput.value === "" && inputRefs.current && inputRefs.current[i]) {
      let prevWordIndex = j - 1;

      // Tìm ô liền trước mà không bị vô hiệu hóa
      while (prevWordIndex >= 0) {
        const prevGridCol = currInitPosition + prevWordIndex;
        const prevInput = inputRefs.current[i][prevGridCol];

        if (prevInput && !prevInput.disabled) {
          prevInput.focus();
          prevInput.select(); // Bôi đen text (nếu có)
          break; // Dừng lại khi đã tìm thấy và focus
        }
        prevWordIndex--; // Thử ô trước đó nữa
      }
    }
  }

  // 2. Gọi hàm handleKeyDown gốc từ props (để xử lý phím mũi tên)
  if (handleKeyDown) {
    handleKeyDown(e, i, gridCol); // Prop này vẫn dùng gridCol
  }
};

const handleInputChange = async (e, i, j, currInitPosition) => {
  if (disabledRows[i]) return;

  const reward = 10;
  const newValue = (e.target.value || "").toUpperCase().slice(-1);

  setInputAns((prev) => {
    const copy = prev.map((r) => r.slice());
    if (!copy[i]) copy[i] = Array((answers[i] || "").length).fill("");
    copy[i][j] = newValue;
    return copy;
  });

  // ================================================================
  // === BẮT ĐẦU: LOGIC TỰ ĐỘNG CHUYỂN Ô TIẾP THEO ===
  // ================================================================
  if (newValue && inputRefs.current && inputRefs.current[i]) {
    const rowWordLength = (answers[i] || "").length;
    let nextWordIndex = j + 1;

    // Vòng lặp để tìm ô tiếp theo không bị vô hiệu hóa
    while (nextWordIndex < rowWordLength) {
      const nextGridCol = currInitPosition + nextWordIndex;
      const nextInput = inputRefs.current[i][nextGridCol];

      if (nextInput && !nextInput.disabled) {
        nextInput.focus();
        nextInput.select(); // Bôi đen text (nếu có)
        break; // Dừng lại khi đã tìm thấy và focus
      }
      nextWordIndex++; // Thử ô tiếp theo nữa
    }
  }
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
      alert('Bạn đã hoàn thành tất cả hàng, hãy sắp xếp các kí tự hàng dọc thành từ có nghĩa');
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
                  onChange={(e) => handleInputChange(e, i, j, currInitPosition)}
                  maxLength={1}
                  disabled={!!disabledRows[i] || !userInfo.rows.includes(String(i + 1))}
                  // disabled={!userInfo.rows.includes(String(i + 1))}
                  ref={el => {
                    if (inputRefs && inputRefs.current) {
                      if (!inputRefs.current[i]) inputRefs.current[i] = Array(36).fill(null);
                      inputRefs.current[i][currInitPosition + j] = el;
                    }
                  }}
                  onKeyDown={(e) => internalHandleKeyDown(e, i, j, currInitPosition)}
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

// 30 Oct 2025 23:00 -> 31 Oct 2025 01:00
const START_TIME = new Date("2025-11-01T14:05:00").getTime();
const END_TIME   = new Date("2025-11-01T16:35:00").getTime();

// const START_TIME = new Date("2025-10-30T14:05:00").getTime();
// const END_TIME   = new Date("2025-11-01T16:35:00").getTime();

// ========================================


// Hàm format thời gian
function formatTime(ms) {
  if (!ms || ms <= 0) return "00:00:00";
  let total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  total %= 3600;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// CrosswordContainer component (ĐÃ THÊM LOGIC RENDER BUTTON HINT)
const CrosswordContainer = ({ puzzleId, userInfo, setScoreFromServer }) => {
  const { getPuzzleById, showAnswers, loadingPuzzles, puzzlesError } = useContext(AppContext);
  const [count, setCount] = useState(0);
  const [verticalGuess, setVerticalGuess] = useState('');
  const [disableInput, setDisableInput] = useState(false);
  
    // thay thế dòng: const [inTimeRange, setInTimeRange] = useState(true);
  const [inTimeRange, setInTimeRange] = useState(() => {
    const now = Date.now();
    return now >= START_TIME && now <= END_TIME;
  });

  // --- Khai báo START_TIME / END_TIME ở đầu file --- 
  // (giữ nguyên chỗ bạn đã khai báo START_TIME / END_TIME)

  // States
  
  
  
  const [localUserInfo, setLocalUserInfo] = useState(userInfo);
  
  useEffect(() => { setLocalUserInfo(userInfo); }, [userInfo]);
  
  useProfileRealtime(userInfo?.id, (newRow) => {
    if (!newRow) return;
    
    if (typeof setScoreFromServer === 'function' && newRow.point != null) {
      setScoreFromServer(Number(newRow.point));
    }
    setLocalUserInfo(prev => ({ ...(prev || {}), ...newRow }));
  });
  
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
  
  const TrueVword = useMemo(() => {
    if (!puzzle) return '';
    return typeof puzzle.true_vword === 'string' ? puzzle.true_vword : (Array.isArray(puzzle.true_vword) ? puzzle.true_vword.join('') : '');
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
    const state = hintState[rowIndex];
    
    // Nếu đang pending -> không bấm lại
    if (state === "pending") return;
    
    // Nếu đã mua -> không mua nữa
    const bought1 = localUserInfo?.hints?.includes((rowIndex).toString());
    
    if (bought1 && countOccurrences(userInfo.hints, rowIndex) > 1)
      return;
    
    // Đặt pending
    setHintState(prev => ({ ...prev, [rowIndex]: "pending" }));
    startPendingTimeout(rowIndex);
    
    try {
      await axiosInstance.post("/request-buy-hint", {
        userId: userInfo.id,
        rowId: rowIndex,
        hintCost: bought1 ? 5 : 3,
        userName: userInfo.name
      });
      
      // Không đặt submitted tại đây — chờ realtime trả về
    } catch (err) {
      console.error(err);
      setHintState(prev => ({ ...prev, [rowIndex]: "error" }));
      
      if (timeoutRefs.current[rowIndex]) {
        clearTimeout(timeoutRefs.current[rowIndex]);
        delete timeoutRefs.current[rowIndex];
      }
      
      setTimeout(() => {
        if (!mountedRef.current) return;
        setHintState(prev => ({ ...prev, [rowIndex]: "idle" }));
      }, 1500);
    }
  };
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = Date.now();
    if (now < START_TIME) return Math.max(0, START_TIME - now);
    if (now <= END_TIME) return Math.max(0, END_TIME - now);
    return 0;
  });
  const [timePhase, setTimePhase] = useState(() => {
    const now = Date.now();
    if (now < START_TIME) return 'before';
    if (now <= END_TIME) return 'during';
    return 'after';
  });

  const timerRef = useRef(null);

  useEffect(() => {
    // cleanup existing (safety)
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const tick = () => {
      const now = Date.now();

      // cập nhật phase + timeLeft
      if (now < START_TIME) {
        setTimePhase('before');
        setTimeLeft(Math.max(0, START_TIME - now)); // thời gian đến lúc bắt đầu
      } else if (now <= END_TIME) {
        setTimePhase('during');
        setTimeLeft(Math.max(0, END_TIME - now)); // thời gian còn lại
      } else {
        setTimePhase('after');
        setTimeLeft(0);
      }

      // **RẤT QUAN TRỌNG**: cập nhật inTimeRange để UI phản ánh đúng
      setInTimeRange(now >= START_TIME && now <= END_TIME);
    };

    // chạy ngay lập tức để UI không chờ 1s
    tick();

    // tạo interval và lưu ref để clear on unmount
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // nếu START_TIME/END_TIME thay đổi runtime thì thêm dependency: [START_TIME, END_TIME]
  }, []);
  const [hintState, setHintState] = useState(() =>
    answers.reduce((acc, _, index) => ({ ...acc, [index + 1]: "idle" }), {})
  );
  const timeoutRefs = useRef({});
  const mountedRef = useRef(true);
  
  useEffect(() => {
  mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(timeoutRefs.current).forEach((t) => clearTimeout(t));
    };
  }, []);
  const startPendingTimeout = (rowIndex) => {
    if (timeoutRefs.current[rowIndex]) {
      clearTimeout(timeoutRefs.current[rowIndex]);
      delete timeoutRefs.current[rowIndex];
  }
  
  timeoutRefs.current[rowIndex] = setTimeout(() => {
    setHintState(prev => {
      if (prev[rowIndex] === "pending") {
        return { ...prev, [rowIndex]: "idle" };
      }
      return prev;
    });
    delete timeoutRefs.current[rowIndex];
  }, 20000); // 20s rollback
  };
  
  useEffect(() => {
    if (!localUserInfo?.hints || !Array.isArray(localUserInfo.hints)) return;
  
    answers.forEach((_, idx) => {
      const id = puzzleId * 10 + (idx + 1);
      const hasHint =
        localUserInfo.hints.includes(String(id)) || localUserInfo.hints.includes(id);
  
      if (hasHint) {
        setHintState(prev => {
          if (prev[idx + 1] !== "submitted") {
            if (timeoutRefs.current[idx + 1]) {
              clearTimeout(timeoutRefs.current[idx + 1]);
              delete timeoutRefs.current[idx + 1];
            }
            return { ...prev, [idx + 1]: "submitted" };
          }
          return prev;
        });
      }
    });
  }, [localUserInfo?.hints, answers, puzzleId]);
  
  if (loadingPuzzles) return <div>Loading puzzles…</div>;
  if (puzzlesError) return <div>Error loading puzzles.</div>;
  if (!puzzle) return <div>Puzzle not found.</div>;
  
  function countOccurrences(array, item) {
    const vitem = item.toString();
    return array.reduce((count, current) => {
      return current === vitem ? count + 1 : count;
    }, 0);
  }
  
  // console.log(countOccurrences(userInfo.hints, "111"));
  
  const handleVerticalSubmit = async () => {
    if (!verticalGuess.trim()) {
      alert('Vui lòng nhập chữ hàng dọc.');
      return;
    }
    const normalizedGuess = verticalGuess.trim().toLowerCase();
    const correctVWord = TrueVword.toLowerCase();
    
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
      try {
        const res = await axiosInstance.put('/minus-point', {
          userId: userInfo.id,
          point: 10
        })
      if(res?.data){
        console.log(res?.data);
        setScoreFromServer(Number(res?.data?.data));
      }
    }catch(error){
      console.error('Error completing vertical word:', error);
      alert('Đã xảy ra lỗi khi gửi đáp án. Vui lòng thử lại.');
    }
    alert('Sai rồi, bạn bị trừ 10 điểm 😅');
  }
};



return (
    <div className='page-root'>
      {inTimeRange ? 
      <div>
        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '10px' }}>
          Thời gian còn lại: {formatTime(timeLeft)}
        </div>
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
                userInfo={localUserInfo}
                setScoreFromServer={setScoreFromServer}
                setCount={setCount}
                setDisableInput={setDisableInput}
              />

              {/* // // THÊM MỚI: Cột 2: Các button hint */}
              <div className="hint-button-column">
                {/* Lặp qua 'answers' để tạo số lượng button tương ứng */}
                {answers.map((_, i) => {
                  const bought1 = localUserInfo?.hints?.includes(String((i + 1)));
                  // const bought2 = countOccurrences(userInfo?.hints, String((i + 1)));
                  return (
                    <div key={`hint-btn-wrapper-${i}`} className="hint-button-wrapper">
                      <button
                        type="button"
                        disabled={hintState[i + 1] === "pending" || hintState[i + 1] === "submitted"}
                        className={`btn hint-button ${hintState[i + 1]}`}
                        onClick={() => handleBuyHint(i + 1)}
                      >
                        {hintState[i + 1] === "pending"
                          ? "Đang xử lý..."
                          : hintState[i + 1] === "submitted"
                          ? "Đã mua"
                          : bought1
                          ? "Mua hint 2 (-5 điểm)"
                          : "Mua hint 1 (-3 điểm)"}
                      </button>
                    </div>
                  );
                })}
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
    </div> :

      <div style={{ textAlign: 'center', color: 'red', fontWeight: 'bold', margin: '10px' }}>
        Ngoài thời gian làm bài — hiện tại không thể nhập đáp án.
      </div>
  }
  </div>
  );
};

export default CrosswordContainer