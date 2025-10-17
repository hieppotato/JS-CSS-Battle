require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const supabase = require('./config/db');
const app = express();

app.use(cors());

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // user_metadata
      },
    });
    
    await supabase.from('profiles').insert([{id: data.user.id, name, point: 0}]);

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      message: "User registered successfully",
      user: data.user, // user.user_metadata sẽ chứa name, role
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}); 

app.post("/profile-update", async (req, res) => {
  try {
    const { userInfo } = req.body;

    if (!userInfo.id) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        name : userInfo.name,
        phoneNumber : userInfo.phoneNumber,
        address : userInfo.address,
        classes : userInfo.classes,
      })
      .eq("id", userInfo.id) // "id" là khóa chính của bảng profiles
      .select();

    if (error) throw error;

    res.json({ success: true, profile: data[0] });
  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ---------------- LOGIN ----------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Login successful",
      user: data.user,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/get-profile", async (req, res) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }
    const token = authHeader.split(" ")[1];

    // Xác thực user bằng token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*") 
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({
      user: profile
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // Gọi Supabase để xoá session
    const { error } = await supabase.auth.admin.signOut(access_token);

    if (error) {
      console.warn("⚠️ Supabase logout error:", error.message);
      // Nếu token không hợp lệ hoặc đã hết hạn, coi như logout thành công
      if (
        error.message.includes("Invalid") ||
        error.message.includes("expired") ||
        error.message.includes("not found") || 
        error.message.includes("missing")
      ) {
        return res.json({ message: "Already logged out (token invalid/expired)" });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/buy-hint", async (req, res) => {
  try {
    const { userID, hintCost, hintId} = req.body;
    if (!userID || !hintCost || !hintId) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const { data: userProfile, error: profileError } = await supabase
    .from("profiles")
    .update({
      point: supabase.raw('point - ?', [hintCost]),
      hints: supabase.raw('array_append(hints, ?)', [hintId])
    })
    .eq("id", userID)
    .select()
    .maybeSingle();
    if (profileError) throw profileError;
  }
  catch (err) { 
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  } 
  res.json({ message: "Hint purchased successfully" });
});

app.post("/submit-request", async (req, res) => {
  try {
    const { userId, questionId } = req.body;
    if (!userId || !questionId) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const { data, error } = await supabase
    .from("requests")
    .insert([{ userId, questionId, status: 'pending' }])
    .select()
    .maybeSingle();
    if (error) throw error;
    res.json({ message: "Request submitted successfully", request: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }       
});

app.put("/approve-submission", async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Missing requestId" });
    }
    const { data: request, error: requestError } = await supabase
    .from("requests")
    .update({ status: 'approved' })
    .eq("id", requestId)
    .select()
    .maybeSingle();
    if (requestError) throw requestError;
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }
    const { data: userProfile, error: profileError } = await supabase
    .from("profiles")
    .update({
      point: supabase.raw('point + 10'),
      submited: supabase.raw('array_append(submited, ?)', [request.questionId])
    })
    .eq("id", request.userId)
    .select()
    .maybeSingle();
    if (profileError) throw profileError;
    res.json({ message: "Submission approved and points awarded", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});