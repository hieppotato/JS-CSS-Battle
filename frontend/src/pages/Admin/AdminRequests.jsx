// src/pages/AdminRequests.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosInstance from "../../utils/axiosInstance";
import "../Home/home.css";
import { supabase } from "../../utils/supabaseClient";
import { useNavigate } from "react-router-dom";

const AdminRequests = ({ userInfo }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});
  const mountedRef = useRef(true);
  const navigate = useNavigate();

  // convert timestamp -> safe sorting
  const createdAtTs = (r) => {
    const v = r?.created_at || r?.createdAt;
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  };

  const sortRequestsAsc = (arr) =>
    arr.slice().sort((a, b) => createdAtTs(a) - createdAtTs(b));

  // ✅ Only fetch pending submit-css
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/get-requests");

      const pendingCss = (res.data || []).filter(
        (r) =>
          r.status === "pending" &&
          (r.type === "submit_css" || r.type === "submit-css")
      );

      const sorted = sortRequestsAsc(pendingCss);

      if (mountedRef.current) setRequests(sorted);
    } catch (err) {
      console.error("Fetch requests error:", err);
      alert("Không thể tải danh sách request");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchRequests();

    // ✅ Realtime chỉ xử lý submit-css
    const channel = supabase
      .channel("public:requests")
      // INSERT
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "requests" },
        (payload) => {
          const newRow = payload.new;
          if (
            newRow?.status !== "pending" ||
            !["submit_css", "submit-css"].includes(newRow.type)
          )
            return;

          setRequests((prev) => {
            if (prev.some((r) => r.id === newRow.id)) return prev;
            return sortRequestsAsc([...prev, newRow]);
          });
        }
      )
      // UPDATE
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests" },
        (payload) => {
          const newRow = payload.new;
          if (!newRow) return;

          setRequests((prev) => {
            const exists = prev.some((r) => r.id === newRow.id);

            // still pending submit-css → add/update
            if (
              newRow.status === "pending" &&
              ["submit_css", "submit-css"].includes(newRow.type)
            ) {
              if (exists) {
                return sortRequestsAsc(
                  prev.map((r) => (r.id === newRow.id ? newRow : r))
                );
              }
              return sortRequestsAsc([...prev, newRow]);
            }

            // no longer pending → remove
            return prev.filter((r) => r.id !== newRow.id);
          });
        }
      )
      // DELETE
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "requests" },
        (payload) => {
          const oldRow = payload.old;
          if (!oldRow) return;

          setRequests((prev) => prev.filter((r) => r.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, []);

  // ✅ Approve only submit-css
  const handleApprove = async (reqItem) => {
    if (approving[reqItem.id]) return;
    setApproving((prev) => ({ ...prev, [reqItem.id]: true }));

    // Optimistic UI remove
    setRequests((prev) => prev.filter((r) => r.id !== reqItem.id));

    try {
      await axiosInstance.put("/approve-css-submission", {
        requestId: reqItem.id,
        userId: reqItem.userId,
        rowId: reqItem.questionId ?? reqItem.rowId,
        cssPoint: reqItem.cssPoint,
      });
    } catch (err) {
      console.error("Approve error:", err);
      alert("Duyệt thất bại!");

      // rollback
      setRequests((prev) => sortRequestsAsc([...prev, reqItem]));
    } finally {
      setApproving((prev) => {
        const c = { ...prev };
        delete c[reqItem.id];
        return c;
      });
    }
  };

  // ✅ block non-admin
  useEffect(() => {
    if (!userInfo) return;
    if (userInfo.role !== "admin") navigate("/home", { replace: true });
  }, [userInfo, navigate]);

  return (
    <div className="home-container">
      <div className="css-section" style={{ width: "100%" }}>
        <h1 className="section-title">🛠️ Request Nộp Bài CSS chờ duyệt</h1>

        {loading ? (
          <div className="text-center text-gray-300 text-lg mt-10">Đang tải...</div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CSS Row</th>
                  <th>Question ID</th>
                  <th>Điểm CSS</th>
                  <th>Tên đội</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-gray-400">
                      ✅ Không có request nộp bài đang chờ duyệt
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.id}</td>
                      <td>{req.cssRowId}</td>
                      <td>{req.questionId ?? "-"}</td>
                      <td>{req.cssPoint ?? "-"}</td>
                      <td className="text-xs">{req.userName ?? req.userId}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={approving[req.id]}
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
