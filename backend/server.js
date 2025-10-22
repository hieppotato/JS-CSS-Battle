require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { supabase } = require('./config/db');
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
  console.log('supabase', Object.keys(supabase || {}));
  console.log('supabase.auth', supabase && supabase.auth, typeof supabase?.auth);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Login successful",
      user: data.user,
      session: data.session, 
    });
  } catch (err) {
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

app.get('/images', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('id, image_id, image_url, filename, width, height, bytes, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'DB error' });
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/create-question', async (req, res) => {
  const { title, images, answer_css } = req.body;
  try{
    const { data, error } = await supabase
      .from('questions')
      .insert([
        { title, images, answer_css: answer_css }
      ])
      .select()
      .maybeSingle();
    if (error) { throw error; }
    res.status(201).json({ message: 'Question created', question: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { throw error; }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } 
});

app.post('/saved_code', async (req, res) => {
  const { question_id, user_id, saved_html } = req.body;
  try {
    const { data, error } = await supabase
      .from('saved_code')
      .insert([
        { question_id, user_id, saved_html }
      ])
      .select()
      .maybeSingle();
    if (error) { throw error; }
    res.status(201).json({ message: 'Code saved', savedCode: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/saved_code', async (req, res) => {
  const question_id = req.query.question_id || req.body?.question_id || req.params?.question_id;
  const user_id = req.query.user_id || req.body?.user_id || req.params?.user_id;

  if (!question_id || !user_id) {
    return res.status(400).json({ error: 'Missing question_id or user_id' });
  }

  try {
    const { data, error } = await supabase
      .from('saved_code')
      .select('*')
      .eq('question_id', question_id)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false }) 
      .limit(1)
      .maybeSingle(); 

    if (error) { throw error; }
    res.json(data || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/questions/:id', async (req, res) => {
  const id = req.params.id;
  console.log("Fetching question with id:", id);
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) { throw error; }

    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/images/:id', async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase
    .from('images')
    .select('id, image_id, image_url, filename, width, height, bytes, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) { console.error(error); return res.status(500).json({ error: 'DB error' }); }
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ data });
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

app.put("/buy-image", async (req, res) => {
  try {
    const { userId, imageCost, image_url, userPoint } = req.body;
    if (!userId || imageCost == null || !image_url) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    console.log('Buying image:', { userId, imageCost, image_url });

    const { data, error } = await supabase
      .rpc('buy_image_rpc', {
        p_user_id: userId,
        p_image_id: image_url,
        p_image_cost: Number(imageCost)
      });

      // const row = Array.isArray(data) ? data[0] : data;
      // console.log(row.out_id, row.out_point, row.out_images);

      const {user_point, out_error} = await supabase
      .from('profiles')
      .select('point')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (error.message && error.message.includes('insufficient_points_or_not_found')) {
        return res.status(400).json({ error: "Không đủ điểm để mua" });
      }
      console.error('RPC error', error);
      return res.status(500).json({ error: "Server error" });
    }

    // console.log('Buy image RPC result:', user_point);

    const updated = Array.isArray(data) ? data[0] : data;
    // console.log('Buy image successful, updated user:', updated);
    return res.json({
      message: "Mua ảnh thành công",
      user: updated,
      point: updated?.remaining_points || 0
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
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

app.get('/ping', (req,res)=>res.json({ok:true}));

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});