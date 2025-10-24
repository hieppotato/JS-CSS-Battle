import axios from "axios";
import { handleLogout } from "./logout";

const axiosInstance = axios.create({
  baseURL: "https://js-css-battle.onrender.com", // backend APIk
  // baseURL: "http://localhost:8000", // backend APIk
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("⚠️ Token expired or invalid, logging out...");
      await handleLogout();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;