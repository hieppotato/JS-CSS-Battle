import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import "./home.css";
import useProfileRealtime from "../../hooks/useProfileRealtime";

const cssQuestions = [1, 2, 3, 4, 5, 6, 7];

const Home = ({ puzzles, userInfo, setUserInfo }) => {
  const navigate = useNavigate();
  const userId = userInfo?.id;

  const [clickNumber, setClickNumber] = useState({}); // đếm click từng bài
  const [loading, setLoading] = useState(null);
  const [cssPoints, setCssPoints] = useState({});

  // localUser để realtime cập nhật userInfo.rows
  const [localUser, setLocalUser] = useState(userInfo ?? null);

  useEffect(() => {
    setLocalUser(userInfo ?? null);
  }, [userInfo]);

  const handleRealtimeUpdate = (newRow) => {
    if (!newRow) return;
    setLocalUser((prev) => {
      const merged = { ...(prev || {}), ...newRow };
      if (typeof setUserInfo === "function") {
        setUserInfo((p) => ({ ...(p || {}), ...newRow }));
      }
      return merged;
    });
  };

  useProfileRealtime(userId, handleRealtimeUpdate);

  const handleSubmitCss = async (questionId) => {
    if (!userId) return alert("Vui lòng đăng nhập.");

    // nếu đã click trước đó → không cho click lại
    if (clickNumber[questionId]) return;

    // đánh dấu đã click
    setClickNumber((prev) => ({ ...prev, [questionId]: true }));
    setLoading(questionId);

    try {
      await axiosInstance.post("/request-submit-css", {
        userId,
        questionId,
        cssPoint: 0, // mặc định 0
        userName: userInfo.name,
      });
    } catch (err) {
      console.error("Submit CSS error:", err);
      alert(
        `Lỗi khi nộp bài ${questionId}: ${
          err?.response?.data?.error || err?.message || "Unknown error"
        }`
      );

      // nếu lỗi thì cho click lại
      setClickNumber((prev) => ({ ...prev, [questionId]: false }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="home-container">
      <div className="home-sections">
        {/* ===== NỘP BÀI CSS ===== */}
        <div className="css-section">
          <h1 className="section-title">Nộp bài CSS</h1>
          <div className="css-list">
            {cssQuestions.map((id) => {
              const rows = localUser?.rows ?? userInfo?.rows ?? [];
              const isSubmitted =
                Array.isArray(rows) &&
                (rows.includes(id.toString()) || rows.includes(id));

              const isClicking = clickNumber[id]; // đang xử lý

              return (
                <div key={id} className="css-item">
                  <div className="css-input-group">
                    <label>Bài {id}</label>
                  </div>

                  {!isSubmitted && (
                    <button
                      onClick={() => handleSubmitCss(id)}
                      disabled={loading === id || isClicking}
                      className="submit-btn"
                    >
                      {loading === id || isClicking ? "Đang nộp..." : "Nộp"}
                    </button>
                  )}

                  {isSubmitted && <span className="submitted-label">Đã nộp</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== PUZZLE GAME ===== */}
        <div className="puzzle-section">
          <h1 className="section-title">Danh sách Puzzle</h1>
          <ul className="puzzle-list">
            {puzzles.map((puzzle) => (
              <li key={puzzle.id}>
                <button
                  onClick={() => navigate(`/puzzle-game/${puzzle.id}`)}
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
