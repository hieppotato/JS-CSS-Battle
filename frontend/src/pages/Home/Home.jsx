// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import "./home.css";
import useProfileRealtime from "../../hooks/useProfileRealtime";

const cssQuestions = [1, 2, 3, 4, 5, 6, 7];

const Home = ({ puzzles, userInfo, setUserInfo }) => {
  const navigate = useNavigate();
  const userId = userInfo?.id;

  // localUser: giữ state cục bộ để realtime cập nhật
  const [localUser, setLocalUser] = useState(userInfo ?? null);

  // sync khi parent truyền userInfo mới (ví dụ khi login)
  useEffect(() => {
    setLocalUser(userInfo ?? null);
  }, [userInfo]);

  // Hook realtime: khi có payload mới => merge vào localUser và (nếu có) setUserInfo của parent
  const handleRealtimeUpdate = (newRow) => {
    if (!newRow) return;
    setLocalUser((prev) => {
      const merged = { ...(prev || {}), ...newRow };
      // đồng bộ lại lên parent nếu setUserInfo được truyền
      if (typeof setUserInfo === "function") {
        try {
          setUserInfo((p) => ({ ...(p || {}), ...newRow }));
        } catch (e) {
          // nếu parent không muốn/có lỗi, ignore
          console.warn("setUserInfo failed:", e);
        }
      }
      return merged;
    });
  };

  // sử dụng hook realtime (implement của bạn nên nhận (userId, callback))
  useProfileRealtime(userId, handleRealtimeUpdate);

  const [cssPoints, setCssPoints] = useState({});
  const [loading, setLoading] = useState(null);

  const handlePointChange = (questionId, value) => {
    setCssPoints((prevPoints) => ({
      ...prevPoints,
      [questionId]: value,
    }));
  };

  const handleSubmitCss = async (questionId) => {
    const effectiveUserId = localUser?.id ?? userInfo?.id;
    const effectiveUserName = localUser?.name ?? userInfo?.name;

    if (!effectiveUserId) return alert("Vui lòng đăng nhập.");

    const cssPoint = 0;
    if (cssPoint === undefined || cssPoint === "" || cssPoint === null)
      return alert("Nhập điểm trước khi nộp.");

    setLoading(questionId); // hiện "Đang nộp..."
    try {
      await axiosInstance.post("/request-submit-css", {
        userId: effectiveUserId,
        questionId,
        cssPoint: Number(cssPoint),
        userName: effectiveUserName,
      });

      handlePointChange(questionId, "");
    } catch (err) {
      console.error("Submit CSS error:", err);
      alert(
        `Lỗi khi nộp bài ${questionId}: ${
          err?.response?.data?.error || err?.message || "Unknown error"
        }`
      );
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

              return (
                <div key={id} className="css-item">
                  <div className="css-input-group">
                    <label>Bài {id}</label>
                    {/* nếu sau muốn hiện input điểm, mở comment bên dưới */}
                    {/* <input
                      type="number"
                      placeholder="Nhập điểm"
                      value={cssPoints[id] ?? ""}
                      onChange={(e) => handlePointChange(id, e.target.value)}
                      disabled={isSubmitted || loading === id}
                    /> */}
                  </div>

                  {!isSubmitted && (
                    <button
                      onClick={() => handleSubmitCss(id)}
                      disabled={loading === id}
                      className="submit-btn"
                    >
                      {loading === id ? "Đang nộp..." : "Nộp"}
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
