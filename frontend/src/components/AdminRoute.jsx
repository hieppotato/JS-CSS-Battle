// src/components/AdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const AdminRoute = ({ userInfo, children }) => {
    console.log(userInfo);
  if (!userInfo) {
    // not logged in
    return <Navigate to="/login" replace />;
  }

  if (String(userInfo.role).toLowerCase() !== "admin") {
    // not admin
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default AdminRoute;
