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
      window.location.href = '/home';
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
    <div className={classes.loginWrapper}>
      <div className={classes.header}>
        <h1 className={classes.title}>Welcome back!</h1>
      </div>
      <div className={classes.formContainer}>
          <div className={classes.inputGroup}>
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              placeholder="you@example.dev"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={classes.inputGroup}>
            <label htmlFor="password">Password *</label>
            <div className={classes.passwordWrapper}>
                <input
                    type="password"
                    id="password"
                    placeholder="Your password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
          </div>

          <div className={classes.options}>
            <div className={classes.rememberMe}>
              <input className='cursor-pointer' type="checkbox" id="remember" />
              <label className='cursor-pointer' htmlFor="remember">Remember me</label>
            </div>
          </div>

          <button className={classes.signInButton} onClick={handleLogin}>
            Sign in
          </button>
          {error && <p className={classes.errorMessage}>{error}</p>}
      </div>
    </div>
  )
}

export default Login