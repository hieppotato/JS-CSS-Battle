// src/pages/AdminRequests.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosInstance from "../../utils/axiosInstance";
import dayjs from "dayjs";
import "../Home/home.css";
import { supabase } from "../../utils/supabaseClient"; // <-- import supabase client

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});
  const mountedRef = useRef(true);

  // helper: convert array -> map keyed by id for dedupe/update
  const toMap = (arr) => {
    const map = new Map();
    (arr || []).forEach((r) => map.set(String(r.id), r));
    return map;
  };

  // initial load (only pending)
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/get-requests");
      const pendingOnly = (res.data || []).filter((r) => r.status === "pending");
      if (!mountedRef.current) return;
      setRequests(pendingOnly);
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

    // subscribe realtime to requests table
    const channel = supabase
      .channel("public:requests") // tên channel tuỳ ý
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "requests" },
        (payload) => {
          try {
            const newRow = payload.new;
            if (!newRow) return;
            // only care pending requests
            if (newRow.status === "pending") {
              setRequests((prev) => {
                // dedupe by id
                if (prev.some((r) => String(r.id) === String(newRow.id))) return prev;
                return [newRow, ...prev];
              });
            }
          } catch (e) {
            console.error("Realtime INSERT handler error:", e);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests" },
        (payload) => {
          try {
            const newRow = payload.new;
            const oldRow = payload.old;
            if (!newRow) return;

            setRequests((prev) => {
              // if new status is pending -> add or update
              if (newRow.status === "pending") {
                const exists = prev.some((r) => String(r.id) === String(newRow.id));
                if (exists) {
                  // update existing
                  return prev.map((r) => (String(r.id) === String(newRow.id) ? newRow : r));
                } else {
                  // add to top
                  return [newRow, ...prev];
                }
              } else {
                // if it was pending before and now not pending -> remove
                return prev.filter((r) => String(r.id) !== String(newRow.id));
              }
            });
          } catch (e) {
            console.error("Realtime UPDATE handler error:", e);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "requests" },
        (payload) => {
          try {
            const oldRow = payload.old;
            if (!oldRow) return;
            setRequests((prev) => prev.filter((r) => String(r.id) !== String(oldRow.id)));
          } catch (e) {
            console.error("Realtime DELETE handler error:", e);
          }
        }
      )
      .subscribe((status) => {
        // optional: log subscribe status for debug
        console.log("Supabase requests channel status:", status);
      });

    return () => {
      mountedRef.current = false;
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // approve handler (optimistic UI: remove row immediately)
  const handleApprove = async (reqItem) => {
    if (approving[reqItem.id]) return;
    setApproving((prev) => ({ ...prev, [reqItem.id]: true }));

    // optimistic remove so admin sees immediate feedback
    setRequests((prev) => prev.filter((r) => String(r.id) !== String(reqItem.id)));

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

      // Server should update request.status -> realtime will also reflect;
      // we already removed it optimistically. If server returns updated row and you want to reinsert, handle here.
    } catch (err) {
      console.error("Approve error:", err);
      alert("Duyệt thất bại!");
      // rollback: re-add the request if approval failed
      setRequests((prev) => {
        // avoid duplicate
        if (prev.some((r) => String(r.id) === String(reqItem.id))) return prev;
        return [reqItem, ...prev];
      });
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
                      <td className="text-xs">{req.userName ?? req.userId}</td>
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
