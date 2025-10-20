import React from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from './pages/Home/Home';
import Login from './pages/Auth/Login';
import UserDashboard from './pages/Home/UserDashboard';

const App = () => {
  return (
    <div><Router>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/home" element={<Home/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/dashboard" element={<UserDashboard/>}/>
        </Routes>
      </Router>
    </div>
  )
}

export default App