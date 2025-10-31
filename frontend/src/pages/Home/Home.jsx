// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import "./home.css";
import useProfileRealtime from "../../hooks/useProfileRealtime";

const cssQuestions = ["1. LIGHTSABER", "2. THELOVELYTREE", "3. MYLILTREE", "4. SAKURA", "5. DARWIN", "6. FLOWER", "7. FUJI", " NGÔI SAO HY VỌNG"];
const TIMEOUT_MS = 1800000; // nếu realtime im lặng, rollback sau 15s

const Home = ({ puzzles, userInfo, setUserInfo, setPuzzles }) => {
  const navigate = useNavigate();
  const userId = userInfo?.id;
  // console.log(userId);

  // localUser: giữ state cục bộ để realtime cập nhật
  const [localUser, setLocalUser] = useState(userInfo ?? null);

  useEffect(() => {
    setLocalUser(userInfo ?? null);
  }, [userInfo]);

  // submitState: { [questionId]: 'idle' | 'pending' | 'error' | 'submitted' }
  const [submitState, setSubmitState] = useState(() =>
    cssQuestions.reduce((acc, id) => ({ ...acc, [id]: "idle" }), {})
  );
  const timeoutRefs = useRef({}); // refs để clear timeout per question
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // clear all timeouts on unmount
      Object.values(timeoutRefs.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // realtime handler: merge new row then update submitState -> 'submitted' if rows contains id
  const handleRealtimeUpdate = (newRow) => {
    if (!newRow) return;
    setLocalUser((prev) => {
      const merged = { ...(prev || {}), ...newRow };
      // sync parent if provided
      if (typeof setUserInfo === "function") {
        try {
          setUserInfo((p) => ({ ...(p || {}), ...newRow }));
        } catch (e) {
          console.warn("setUserInfo failed:", e);
        }
      }
      return merged;
    });

    // check rows array => mark submitted accordingly
    const rows = newRow?.rows ?? [];
    if (Array.isArray(rows)) {
      cssQuestions.forEach((qid) => {
        const included =
          rows.includes(qid) || rows.includes(String(qid)) || false;
        if (included) {
          setSubmitState((prev) => {
            if (prev[qid] !== "submitted") {
              // clear any timeout for this question
              if (timeoutRefs.current[qid]) {
                clearTimeout(timeoutRefs.current[qid]);
                delete timeoutRefs.current[qid];
              }
              return { ...prev, [qid]: "submitted" };
            }
            return prev;
          });
        }
      });
    }
  };

  // subscribe realtime (hook của bạn)
  useProfileRealtime(userId, handleRealtimeUpdate);

  const startPendingTimeout = (questionId) => {
    // clear previous
    if (timeoutRefs.current[questionId]) {
      clearTimeout(timeoutRefs.current[questionId]);
      delete timeoutRefs.current[questionId];
    }
    // set rollback timeout
    timeoutRefs.current[questionId] = setTimeout(() => {
      // rollback to idle (tự động cho phép submit lại)
      setSubmitState((prev) => {
        // only rollback if still pending (avoid clobbering submitted)
        if (prev[questionId] === "pending") {
          return { ...prev, [questionId]: "idle" };
        }
        return prev;
      });
      delete timeoutRefs.current[questionId];
    }, TIMEOUT_MS);
  };

  const handleSubmitCss = async (questionId) => {
    const effectiveUserId = localUser?.id ?? userInfo?.id;
    const effectiveUserName = localUser?.name ?? userInfo?.name;

    if (!effectiveUserId) return alert("Vui lòng đăng nhập.");

    // nếu đã submitted thì không làm gì
    const rows = localUser?.rows ?? userInfo?.rows ?? [];
    const already =
      Array.isArray(rows) &&
      (rows.includes(questionId) || rows.includes(String(questionId)));
    if (already) return;

    // nếu đang pending thì ko gửi lại
    if (submitState[questionId] === "pending") return;

    // mark pending
    setSubmitState((prev) => ({ ...prev, [questionId]: "pending" }));

    // start fallback timeout waiting for realtime/version confirmation
    startPendingTimeout(questionId);
    const cssRowId = puzzles?.filter((p) => p.userId.includes(userId));
    // console.log(cssRowId[0].answers[questionId]);
    try {
      // send request (server sẽ tạo request row; admin duyệt sau)
      await axiosInstance.post("/request-submit-css", {
        userId: effectiveUserId,
        questionId,
        cssPoint: 0,
        userName: effectiveUserName,
        cssRowId : cssRowId[0].answers[questionId - 1]
      });

      // do NOT immediately set to idle — keep 'pending' while waiting for realtime.
      // If you want to reflect server response differently, you could set a flag here.
    } catch (err) {
      console.error("Submit CSS error:", err);
      alert(
        `Lỗi khi nộp bài ${questionId}: ${
          err?.response?.data?.error || err?.message || "Unknown error"
        }`
      );
      // reset state to allow retry
      setSubmitState((prev) => ({ ...prev, [questionId]: "error" }));
      // clear pending timeout (if any)
      if (timeoutRefs.current[questionId]) {
        clearTimeout(timeoutRefs.current[questionId]);
        delete timeoutRefs.current[questionId];
      }
      // optional: after short delay, reset from 'error' to 'idle' so user can try again
      setTimeout(() => {
        if (!mountedRef.current) return;
        setSubmitState((prev) => ({ ...prev, [questionId]: "idle" }));
      }, 1500);
    }
  };

  // Utility to check if a question is submitted
  const isSubmittedFor = (qid) => {
    const rows = localUser?.rows ?? userInfo?.rows ?? [];
    return Array.isArray(rows) && (rows.includes(qid) || rows.includes(String(qid)));
  };

  return (
    <div className="home-container">
      <div className="home-sections">
        {/* ===== NỘP BÀI CSS ===== */}
        <div className="css-section">
          <h1 className="section-title">Nộp bài CSS</h1>
          <div className="css-list">
            {cssQuestions.map((id) => {
              const submitted = isSubmittedFor(id);
              const state = submitState[id] ?? "idle";
              const isPending = state === "pending";
              const isError = state === "error";

              return (
                <div key={id} className="css-item">
                  <div className="css-input-group">
                    <label>Bài {id}</label>
                  </div>

                  {!submitted && (
                    <button
                      onClick={() => handleSubmitCss(id)}
                      disabled={isPending}
                      className={`submit-btn ${isError ? "error" : ""}`}
                    >
                      {isPending ? "Đang nộp..." : isError ? "Lỗi, thử lại" : "Nộp"}
                    </button>
                  )}

                  {submitted && <span className="submitted-label">Đã nộp</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== PUZZLE GAME ===== */}
        <div className="puzzle-section">
          <h1 className="section-title">Danh sách Puzzle</h1>
          <ul className="puzzle-list">
            {puzzles
              ?.filter((p) => p.userId.includes(userId)) // ⬅ chỉ lấy puzzle của user hiện tại
              .map((puzzle) => (
                <li key={puzzle.id}>
                  <button
                    onClick={() => window.location.href = `/puzzle-game/${puzzle.id}`}
                    className="puzzle-btn"
                  >
                    🧩 Puzzle {puzzle.name || puzzle.id}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Home;
