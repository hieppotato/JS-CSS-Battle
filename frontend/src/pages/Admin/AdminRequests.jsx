import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import dayjs from "dayjs";
import "../Home/home.css"; // ✅ Dùng lại style của Home

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});

  // ✅ Lấy danh sách request (chỉ lấy pending)
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/get-requests");
      const pendingOnly = (res.data || []).filter((r) => r.status === "pending");
      setRequests(pendingOnly);
    } catch (err) {
      console.error("Fetch requests error:", err);
      alert("Không thể tải danh sách request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // ✅ Hàm duyệt request
  const handleApprove = async (reqItem) => {
    if (approving[reqItem.id]) return;
    setApproving((prev) => ({ ...prev, [reqItem.id]: true }));

    try {
      if (reqItem.type === "buy_hint") {
        await axiosInstance.put("/approve-buy-hint", {
          requestId: reqItem.id,
          userId: reqItem.userId,
          hintCost: reqItem.hintCost,
          questionId: reqItem.questionId,
        });
      } else if (reqItem.type === "submit_css" || reqItem.type === "submit-css") {
        await axiosInstance.put("/approve-css-submission", {
          requestId: reqItem.id,
          userId: reqItem.userId,
          rowId: reqItem.questionId ?? reqItem.rowId,
          cssPoint: reqItem.cssPoint,
        });
      } else {
        throw new Error(`Unknown request type: ${reqItem.type}`);
      }

      // ✅ Ẩn ngay request đã duyệt khỏi bảng
      setRequests((prev) => prev.filter((r) => r.id !== reqItem.id));
    } catch (err) {
      console.error("Approve error:", err);
      alert("Duyệt thất bại!");
    } finally {
      setApproving((prev) => {
        const copy = { ...prev };
        delete copy[reqItem.id];
        return copy;
      });
    }
  };

  return (
    <div className="home-container">
      <div className="css-section" style={{ width: "100%" }}>
        <h1 className="section-title">🛠️ Quản lý Request đang chờ duyệt</h1>

        {loading ? (
          <div className="text-center text-gray-300 text-lg mt-10">Đang tải...</div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Created At</th>
                  <th>Question ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Hint Cost</th>
                  <th>User ID</th>
                  <th>CSS Point</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-6 text-gray-400">
                      ✅ Không có request đang chờ duyệt
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.id}</td>
                      <td>
                        {req.created_at
                          ? dayjs(req.created_at).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </td>
                      <td>{req.questionId ?? req.question_id ?? "-"}</td>
                      <td>{req.type}</td>
                      <td className="text-yellow-400 font-semibold">{req.status}</td>
                      <td>{req.hintCost ?? "-"}</td>
                      <td className="text-xs">{req.userName}</td>
                      <td>{req.cssPoint ?? "-"}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={!!approving[req.id]}
                          className={`submit-btn ${
                            approving[req.id] ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          {approving[req.id] ? "Đang duyệt..." : "Duyệt"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRequests;
