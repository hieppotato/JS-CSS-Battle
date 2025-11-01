import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { useCallback, useEffect, useState } from 'react'
import axiosInstance from './utils/axiosInstance';

import Home from './pages/Home/Home';
import Login from './pages/Auth/Login';
import CreateContest from './pages/Contest/CreateContest';
import Contest from './pages/Contest/Contest';
import PuzzleGame from "./pages/PuzzleGame/PuzzleGame";
import { supabase } from "./utils/supabaseClient";
import PrivateRoute from './components/PrivateRoute';
import CreatePuzzle from "./pages/PuzzleGame/CreatePuzzle";
// import UserDashboard from './pages/Home/UserDashboard';
import AdminRequests from "./pages/Admin/AdminRequests";
import AdminRequestsHints from "./pages/Admin/AdminRequestsHints";
import TimeLeftClock from "./pages/Home/TimeCountDown";

import { decryptPayloadWithBase64Key } from "../src/utils/decrypt"; // dùng khi ENCRYPT_SECRET là base64 raw key

// helper: kiểm tra payload có kiểu {iv,ct,tag} không
function looksEncrypted(obj) {
  return obj && typeof obj === "object" && obj.iv && obj.ct && obj.tag;
}

// helper: decide which decrypt fn to use based on ENCRYPT_SECRET format
function isBase64Key(str) {
  if (!str || typeof str !== "string") return false;
  try {
    const decoded = atob(str); // may throw for invalid base64
    // decoded length should be 32 bytes for a raw AES-256 key
    return decoded.length === 32;
  } catch (e) {
    return false;
  }
}

async function decryptIfNeeded(maybeEncrypted) {
  if (!looksEncrypted(maybeEncrypted)) {
    // not encrypted
    return maybeEncrypted;
  }

  const secret = process.env.REACT_APP_ENCRYPT_SECRET || "f3Z/7dXN2pDZq7o5sD4KcPt1SxEJH4Vq6g/p2kE3L9M=";

  // choose method
  if (isBase64Key(secret)) {
    // ENCRYPT_SECRET is base64 raw key
    return await decryptPayloadWithBase64Key(maybeEncrypted, secret);
  } else {
    // ENCRYPT_SECRET is passphrase -> derive sha256 on frontend (matches server.createHash('sha256').update(secret).digest())
    return await decryptPayload(maybeEncrypted, secret);
  }
}


const App = () => {

  const [userInfo, SetUserInfo] = useState(null);

   const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session?.access_token) {
    console.error("Refresh token error:", error);
    return null;
  }

  const newToken = data.session.access_token;
  const newRefreshToken = data.session.refresh_token;
  localStorage.setItem("token", newToken);
  localStorage.setItem("refresh_token", newRefreshToken);
  return newToken;
};

const [puzzles, setPuzzles] = useState([]);
const fetchPuzzles = async () => {
  let token = localStorage.getItem("token");
  try {
    const response = await axiosInstance.get('/chunk-dd12a0af', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // if encrypted, decrypt; otherwise return plain data
    const maybe = response.data;
    const decrypted = looksEncrypted(maybe) ? await decryptIfNeeded(maybe) : maybe;

    // decrypted could be array or { puzzles: [...] } depending server
    const list = Array.isArray(decrypted) ? decrypted : (decrypted?.puzzles || []);

    setPuzzles(list);

  } catch (error) {
    console.error('Error fetching puzzles:', error);
  }
};



const fetchProfile = useCallback(async () => {
  let token = localStorage.getItem("token");
  try {
    if (!token) {
      SetUserInfo(null);
      return;
    }

    const res = await axiosInstance.get("/get-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    SetUserInfo(res.data.user);

  } catch (err) {
    if (err.response?.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        SetUserInfo(null);
        return;
      }

      // Retry request với token mới
      try {
        const res = await axiosInstance.get("/get-profile", {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        SetUserInfo(res.data.user);
      } catch (retryErr) {
        console.error("Retry fetchProfile failed:", retryErr);
        SetUserInfo(null);
      }
    } else {
      SetUserInfo(null);
    }
  }
}, []);

  useEffect(() => {
    fetchProfile();
    fetchPuzzles();
    const handleStorageChange = () => {
      fetchProfile();
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <div>
      <Router>
        <Routes>
          <Route path="/" element={<PrivateRoute><Home userInfo={userInfo} puzzles={puzzles}/></PrivateRoute>}/>
          <Route path="/home" element={<PrivateRoute><Home userInfo={userInfo} puzzles={puzzles} setPuzzles={setPuzzles}/></PrivateRoute>}/>
          <Route path="/login" element={<Login fetchProfile = {fetchProfile}/>}/>
          <Route path="/create-contest" element={<PrivateRoute><CreateContest userInfo={userInfo}/></PrivateRoute>}/>
          <Route path="/contest/:contestId" element={<PrivateRoute><Contest userInfo={userInfo}/></PrivateRoute>}/>
          <Route path="/puzzle-game/:id" element={<PrivateRoute><PuzzleGame userInfo={userInfo}/></PrivateRoute>}/>
          <Route path="/create-puzzle" element={<CreatePuzzle/>} />
          <Route path="/home" element={<Home/>}/>
          <Route path="/login" element={<Login/>}/>
          {/* <Route path="/dashboard" element={<UserDashboard/>}/> */}
          <Route path="/admin/requests" element={<PrivateRoute><AdminRequests userInfo={userInfo}/></PrivateRoute>}/>
          <Route path="/admin/hints" element={<PrivateRoute><AdminRequestsHints userInfo={userInfo}/></PrivateRoute>}/>
          <Route path="/time-left" element={<PrivateRoute><TimeLeftClock initialTime={300}/></PrivateRoute>}/>
        </Routes>
      </Router>
    </div>
  )
}

export default App