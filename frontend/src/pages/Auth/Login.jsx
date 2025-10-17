import React from 'react'
import classes from './AuthenticationTitle.module.css';

export default function Login() {
  return (
    <div className={classes.loginWrapper}>
      <div className={classes.header}>
        <h1 className={classes.title}>Welcome back!</h1>
      </div>

      <div className={classes.formContainer}>
        <form>
          <div className={classes.inputGroup}>
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              placeholder="you@example.dev"
              required
            />
          </div>

          <div className={classes.inputGroup}>
            <label htmlFor="password">Password *</label>
            <div className={classes.passwordWrapper}>
                <input
                    type="password"
                    id="password"
                    placeholder="Your password"
                    required
                />
            </div>
          </div>

          <div className={classes.options}>
            <div className={classes.rememberMe}>
              <input className='cursor-pointer' type="checkbox" id="remember" />
              <label className='cursor-pointer' htmlFor="remember">Remember me</label>
            </div>
          </div>

          <button type="submit" className={classes.signInButton}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}