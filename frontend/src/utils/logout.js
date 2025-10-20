import axiosInstance from "./axiosInstance";

export const handleLogout = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  try {
    let token = localStorage.getItem("token");
    if (!token) {
      console.warn("No token found. Already logged out?");
      window.location.href = "/login";
      return;
    }

    await axiosInstance.post("/logout", { access_token: token });

    // Xoá dữ liệu trên client
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    // Chuyển về login
    window.location.href = "/login";
  } catch (err) {
    if (err.response?.status === 401 && refreshToken) {
      // Token hết hạn, gọi Supabase để refresh
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (!error && data?.session?.access_token) {
        let token = data.session.access_token;
        localStorage.setItem("token", token);
        await axiosInstance.post("/logout", { access_token: token });
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
      }
    console.error("Logout failed:", err);
    alert("Logout failed, please try again.");
  }
  }
};