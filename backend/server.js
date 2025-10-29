require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { supabase } = require('./config/db');
const app = express();

const allowedOrigins = [
  "https://js-css-battle.vercel.app",
  "http://localhost:5173"
];

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true); // allow mobile apps or curl
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));


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
    
    await supabase.from('profiles').insert([{id: data.user.id, name, point: 0, role: "user", hints: [], puzzles: [], rows: []}]);

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
  // console.log("Fetching question with id:", id);
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

    // console.log('Buying image:', { userId, imageCost, image_url });

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

app.post("/save-puzzle", async (req, res) => {
  try {
    const { answers, vword, true_vword } = req.body;
    if (!answers || !vword) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const { data, error } = await supabase
      .from("puzzles")
      .insert([{ answers, vword, true_vword }])
      .select()
      .maybeSingle();
    if (error) throw error;
    res.status(201).json({ message: "Puzzle saved", data: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/puzzles/:id", async (req, res) => {
  try {
    const id = req.params.id; 
    const { data, error } = await supabase
      .from("puzzles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Puzzle not found" });
    // console.log(typeof data.vword);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/puzzles', async (req, res) => {
  // const { user } = req.body;
  try {
    const { data, error } = await supabase  
      .from('puzzles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { throw error; }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/approve-buy-hint', async (req, res) => {
  try {
    const { requestId, userId, hintCost, questionId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Missing requestId" });
    }

    const { data, error } = await supabase
      .rpc('buy_hint_rpc', {
        p_user_id: userId,
        p_image_id: questionId,
        p_image_cost: Number(hintCost)
      });
    if (error) throw error;

    const updated = Array.isArray(data) ? data[0] : data;
    const { data: request, error: requestError } = await supabase
      .from("requests")
      .update({ status: 'approved' })
      .eq("id", requestId)
      .select()
      .maybeSingle();
    if (requestError) throw requestError;
    res.json({ message: "Hint purchase approved", request, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/request-buy-hint', async (req, res) => {
  try {
    const { userId, rowId, hintCost, userName } = req.body;
    if (!userId || rowId == null) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const { data, error } = await supabase
      .from('requests')
      .insert([{ userName, userId, questionId: rowId, type: 'buy_hint', status: 'pending', hintCost }])
      .select()
      .maybeSingle();
    if (error) throw error;
    res.status(201).json({ message: 'Request created', request: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/update-user-point', async (req, res) => {
  try {
    const { userId, points } = req.body;
    if (!userId || points == null) {
      return res.status(400).json({ error: "Missing parameters" });
    } 

    // Lấy điểm hiện tại
    const { data: user, error: selectError } = await supabase
      .from('profiles')
      .select('point')
      .eq('id', userId)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cộng điểm
    const newPoint = (user.point || 0) + Number(points);

    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({ point: newPoint })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    res.json({ message: 'User points updated', user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// routes.js (Express)
app.post('/complete-row', async (req, res) => {
  try {
    const { userId, puzzleId, rowIndex, reward = 10 } = req.body;
    if (!userId || puzzleId == null || rowIndex == null) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const insertResp = await supabase
      .from('completed_rows')
      .insert({ user_id: userId, puzzle_id: puzzleId, row_index: rowIndex })
      .select()
      .maybeSingle();
    // console.log('Insert completed_rows response:', insertResp);
    if (insertResp.error) {
      const errMessage = insertResp.error.message || '';
      if (errMessage.includes('duplicate key')) {
        return res.json({ message: 'Already completed', already: true });
      } else {
        console.error('Insert completed_rows error', insertResp.error);
        return res.status(500).json({ error: 'DB error inserting completed_rows' });
      }
    }

    // 2) Insert succeeded (new completion) => award points
    // Get current point
    const sel = await supabase
      .from('profiles')
      .select('point')
      .eq('id', userId)
      .maybeSingle();

    if (sel.error) throw sel.error;
    const current = (sel.data?.point || 0);
    const newPoint = current + Number(reward);

    const upd = await supabase
      .from('profiles')
      .update({ point: newPoint })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (upd.error) throw upd.error;

    return res.json({ message: 'Row completed, points awarded', points: newPoint, completed: insertResp.data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/user-completed-rows', async (req, res) => {
  try {
    const { userId, puzzleId } = req.query;
    if (!userId || !puzzleId) return res.status(400).json({ error: 'Missing params' });

    const { data, error } = await supabase
      .from('completed_rows')
      .select('row_index')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzleId);

    if (error) throw error;
    // return array of row_index values
    const rows = (data || []).map(r => Number(r.row_index));
    res.json({ completedRows: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post("/complete-vword", async (req, res) => {
  try {
    const { userId, puzzleId, reward } = req.body;
    if (!userId || !puzzleId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const len = await supabase
      .from("ranking")
      .select("*")
      .order("created_at", { ascending: false });

    const newReward = (len.data.length < 4 ? 100 - Math.max(len.data.length, 0) * 25 : 30);
    console.log(len.data.length);
    // console.log(newReward);

    const sel = await supabase
      .from('profiles')
      .select('point, puzzles')
      .eq('id', userId)
      .maybeSingle();

    if (sel.error) throw sel.error;
    const profile = sel.data || {};
    const currentPoints = Number(profile.point || 0);
    const puzzlesArr = Array.isArray(profile.puzzles) ? profile.puzzles : [];

    const pid = typeof puzzleId === 'number' ? puzzleId : puzzleId;
    const already = puzzlesArr.includes(pid);

    if (already) {
      return res.json({ already: true, points: currentPoints, message: 'Already completed' });
    }

    const r = Number(newReward) || 0;
    const newPoint = currentPoints + r;
    const newPuzzles = [...puzzlesArr, pid];

    const upd = await supabase
      .from('profiles')
      .update({ point: newPoint, puzzles: newPuzzles })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (upd.error) throw upd.error;

    const rank = await supabase
    .from("ranking")
    .insert({userId : userId})

    return res.json({
      already: false,
      points: Number(upd.data?.point ?? newPoint),
      puzzles: upd.data?.puzzles ?? newPuzzles,
      message: 'Vertical word completed, points awarded'
    });
  } catch (err) {
    console.error('complete-vword error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get("/get-requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: true }); 
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/request-submit-css", async (req, res) => { 
  try {
    const { userId, questionId, cssPoint, userName } = req.body;
    if (!userId || !questionId || cssPoint == null) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const { data, error } = await supabase
      .from("requests")
      .insert([{ userName, userId, questionId, type: "submit_css", status: "pending", cssPoint }])
      .select()
      .maybeSingle();
    if (error) throw error;
    res.status(201).json({ message: "Request created", request: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } 
});

app.put("/approve-css-submission", async (req, res) => {
  try{
    const { userId, requestId, rowId, cssPoint } = req.body;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*") 
      .eq("id", userId)
      .maybeSingle();
    if(profileError) throw profileError;

    // console.log("userData", profile);

    const rowArr = Array.isArray(profile.rows) ? profile.rows : [];
    const newPoint = profile.point + Number(cssPoint);
    const newRow = [...rowArr, String(rowId)];

    // console.log(profile.point, newPoint);

    const {data, error} = await supabase
    .from("profiles")
    .update({point: newPoint, rows: newRow})
    .eq("id", userId)
    .select()
    .maybeSingle()
    if(error) throw error;
    
    const { updatedRequest, ErrorRequest} = await supabase
    .from("requests")
    .update({status: "approve"})
    .eq("id", requestId)
    if(ErrorRequest) throw ErrorRequest;

    res.json({user : data, request: updatedRequest});
    
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put("/minus-point", async (req, res) => {
  try{
    const {userId, point} = req.body;

    const response = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
    
    const newPoint = Number(response.data.point) - point;
    // console.log(newPoint);

    const {data, error} = await supabase
    .from("profiles")
    .update({point: newPoint})
    .eq("id", userId)
    .select()
    .maybeSingle()
    if(error) throw error;

    res.status(201).json({ data: data.point });

  }catch(error){
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/ping', (req,res)=>res.json({ok:true}));

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});