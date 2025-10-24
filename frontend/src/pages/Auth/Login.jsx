import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css"; // Dùng lại style chung (có style cho login luôn)

const Login = ({ fetchProfile }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axiosInstance.post("/login", { email, password });
      if (res.data?.session?.access_token) {
        localStorage.setItem("token", res.data.session.access_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        localStorage.setItem("refresh_token", res.data.session.refresh_token);
        await fetchProfile();
        window.location.href = "/home";
      } else {
        setError("Login failed: No token returned");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) navigate("/home");
  }, [navigate]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Welcome back 👋</h1>

        <div className="login-form">
          <div className="input-group">
            <label>Email *</label>
            <input
              type="email"
              placeholder="you@example.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label>Password *</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="remember-me">
            <input type="checkbox" id="remember" />
            <label htmlFor="remember">Remember me</label>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="submit-btn"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
