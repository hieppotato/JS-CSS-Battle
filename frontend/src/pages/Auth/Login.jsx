import React, { useEffect, useState } from 'react'
import classes from './AuthenticationTitle.module.css';
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Login = ({fetchProfile}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
  try {
    const res = await axiosInstance.post('/login', { email, password });
    if (res.data?.session?.access_token) {
      localStorage.setItem('token', res.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem("refresh_token", res.data.session.refresh_token);
      await fetchProfile();
      navigate('/home');
    } else {
      setError('Login failed: No token returned');
    }
  } catch (err) {
    console.error(err);
    setError(err.response?.data?.error || 'Login failed');
  }
};

  useEffect(() => {
    const user = localStorage.getItem('user');
      if (user) {
        navigate('/home');
      }
  }, [navigate]);

  return (
    <>
    <div className='flex lexend justify-center items-center h-screen'>
      <div className='w-96 p-6 border rounded-lg shadow-lg'>
        <h2 className='text-2xl font-bold mb-4 text-center'>Login</h2>
        <input type="email" placeholder='Email' className='w-full p-2 mb-4 border rounded' value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder='Password' className='w-full p-2 mb-4 border rounded' value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className='w-full bg-blue-500 text-white p-2 rounded cursor-pointer' onClick={handleLogin}> Login </button>
        {error && <p className="text-red-500 text-xs pb-1">{error}</p>}
        <p className='mt-4 text-center'>Don't have an account? <span className='text-blue-500 cursor-pointer' onClick={() => navigate('/signup')}>Sign Up</span></p>
      </div>
    </div>
    </>
  )
}

export default Login