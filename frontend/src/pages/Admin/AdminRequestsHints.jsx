// src/pages/AdminRequests.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosInstance from "../../utils/axiosInstance";
import "../Home/home.css";
import { supabase } from "../../utils/supabaseClient";
import { useNavigate } from "react-router-dom";

const AdminRequestsHints = ({ userInfo }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});
  const mountedRef = useRef(true);
  const navigate = useNavigate();

  // convert timestamp safely
  const createdAtTs = (r) => {
    const v = r?.created_at || r?.createdAt || null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  };

  const sortRequestsAsc = (arr) =>
    (arr || []).slice().sort((a, b) => createdAtTs(a) - createdAtTs(b));

  // ✅ Fetch only buy_hint requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/get-requests");

      const pendingBuyHints = (res.data || [])
        .filter(
          (r) =>
            r.status === "pending" &&
            (r.type === "buy_hint" || r.type === "buy-hint")
        );

      const sorted = sortRequestsAsc(pendingBuyHints);
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

    // ✅ Realtime channel
    const channel = supabase
      .channel("public:requests")
      /** INSERT */
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "requests" },
        (payload) => {
          const newRow = payload.new;
          if (
            !newRow ||
            newRow.status !== "pending" ||
            !["buy_hint", "buy-hint"].includes(newRow.type)
          )
            return;

          setRequests((prev) => {
            if (prev.some((r) => String(r.id) === String(newRow.id))) return prev;
            const updated = [...prev, newRow];
            return sortRequestsAsc(updated);
          });
        }
      )
      /** UPDATE */
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests" },
        (payload) => {
          const newRow = payload.new;
          if (!newRow) return;

          setRequests((prev) => {
            const exists = prev.some((r) => String(r.id) === String(newRow.id));

            if (
              newRow.status === "pending" &&
              ["buy_hint", "buy-hint"].includes(newRow.type)
            ) {
              if (exists) {
                const updated = prev.map((r) =>
                  String(r.id) === String(newRow.id) ? newRow : r
                );
                return sortRequestsAsc(updated);
              }
              return sortRequestsAsc([...prev, newRow]);
            }

            // nếu không còn pending hoặc không phải buy_hint → remove
            return prev.filter((r) => String(r.id) !== String(newRow.id));
          });
        }
      )
      /** DELETE */
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "requests" },
        (payload) => {
          const oldRow = payload.old;
          if (!oldRow) return;
          setRequests((prev) =>
            prev.filter((r) => String(r.id) !== String(oldRow.id))
          );
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

  /** ✅ Approve buy hint only */
  const handleApprove = async (reqItem) => {
    if (approving[reqItem.id]) return;
    setApproving((prev) => ({ ...prev, [reqItem.id]: true }));

    // Remove from UI immediately (optimistic)
    setRequests((prev) => prev.filter((r) => String(r.id) !== String(reqItem.id)));

    try {
      await axiosInstance.put("/approve-buy-hint", {
        requestId: reqItem.id,
        userId: reqItem.userId,
        hintCost: reqItem.hintCost,
        questionId: reqItem.questionId,
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

  // Block non-admin
  useEffect(() => {
    if (!userInfo) return;
    if (userInfo.role !== "admin") navigate("/home", { replace: true });
  }, [userInfo, navigate]);

  return (
    <div className="home-container">
      <div className="css-section" style={{ width: "100%" }}>
        <h1 className="section-title">🛠️ Request Mua Hint đang chờ duyệt</h1>

        {loading ? (
          <div className="text-center text-gray-300 text-lg mt-10">Đang tải...</div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hàng cần gửi mật thư</th>
                  <th>Question ID</th>
                  <th>Tên đội</th>
                  <th>Hint Cost</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-gray-400">
                      ✅ Không có request mua hint đang chờ duyệt
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.id}</td>
                      <td>{req.cssRowId}</td>
                      <td>{req.questionId ?? "-"}</td>
                      <td>{req.userName ?? req.userId}</td>
                      <td>{req.hintCost}</td>
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

export default AdminRequestsHints;
