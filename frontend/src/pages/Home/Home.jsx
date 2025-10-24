import React, { useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import "./home.css"; // ✅ import file CSS riêng

const cssQuestions = [1, 2, 3, 4, 5, 6, 7];

const Home = ({ puzzles, userInfo }) => {
  const navigate = useNavigate();
  const userId = userInfo?.id;
  const [cssPoints, setCssPoints] = useState({});
  const [loading, setLoading] = useState(null);

  const handlePointChange = (questionId, value) => {
    setCssPoints((prevPoints) => ({
      ...prevPoints,
      [questionId]: value,
    }));
  };

  const handleSubmitCss = async (questionId) => {
    setLoading(questionId);
    const cssPoint = cssPoints[questionId];

    if (!userId) {
      alert("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
      setLoading(null);
      return;
    }
    if (!cssPoint && cssPoint !== 0) {
      alert("Vui lòng nhập điểm CSS trước khi nộp.");
      setLoading(null);
      return;
    }

    try {
      const { data } = await axiosInstance.post("/request-submit-css", {
        userId,
        questionId,
        cssPoint: Number(cssPoint),
      });
      alert(`Yêu cầu nộp bài ${questionId} đã được gửi thành công!`);
      handlePointChange(questionId, "");
      console.log("Request created:", data.request);
    } catch (err) {
      console.error("Lỗi khi nộp bài CSS:", err);
      alert(
        `Lỗi khi nộp bài ${questionId}: ${
          err.response?.data?.error || err.message
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
              const isSubmitted =
                userInfo?.rows?.includes(id.toString()) ||
                userInfo?.rows?.includes(id);
              return (
                <div key={id} className="css-item">
                  <div className="css-input-group">
                    <label>Bài {id}</label>
                    <input
                      type="number"
                      placeholder="Nhập điểm"
                      value={cssPoints[id] || ""}
                      onChange={(e) => handlePointChange(id, e.target.value)}
                      disabled={isSubmitted}
                    />
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
                  {isSubmitted && (
                    <span className="submitted-label">Đã nộp</span>
                  )}
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
