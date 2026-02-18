"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FaEye, FaEyeSlash } from "react-icons/fa"; 
import { customerLogin } from "../../api/auth"; 
import "./Login.css";
import LoadingSpinner from "../ui/LoadingSpinner";
import { setStorageItem, setEncryptedStorageItem, getStorageItem, removeStorageItem } from "../../utils/storage";

/**
 * Login Component
 * Handles user authentication via credentials and Google.
 * Implements Base64 obfuscation for Local Storage data.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter(); 
  const { data: session, status } = useSession();

  /* =========================================
      EASY ENCRYPTION HELPERS
  ========================================= */
  
  /**
   * Decodes the backend payload.
   */
  const decodePayload = (payload) => {
    try {
      return JSON.parse(atob(payload));
    } catch (e) {
      console.error("Payload decoding failed:", e);
      return null;
    }
  };

  /* =========================================
      SESSION SYNC & REDIRECT
  ========================================= */
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // Obfuscate Google session data before it enters Local Storage
      // For Google Login, we might default to localStorage (Remember Me = true) behavior
      // or we could respect the checkbox if the user clicked it before Google Login?
      // Typically Social Logins are persistent.
      setEncryptedStorageItem("userEmail", session.user.email);
      setEncryptedStorageItem("userName", session.user.name);
      setEncryptedStorageItem("userId", session.user.id);
      
      router.push("/userprofile");
    }
  }, [status, session, router]);

  // Check for existing manual login token
  useEffect(() => {
    const token = getStorageItem("token");
    if (token) {
      router.push("/userprofile");
    }
  }, [router]);

  const isEmailValid = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  /* =========================================
      MANUAL LOGIN HANDLER
  ========================================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!isEmailValid(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // Call the backend login route
      const response = await customerLogin({ email: email.trim(), password });
      const data = response?.data ?? response;

      // Save the JWT token normally for the interceptor to use
      if (data?.token) {
        setStorageItem("token", data.token, rememberMe);
      }

      // Handle the encrypted payload from the backend
      if (data?.payload) {
        const decodedUser = decodePayload(data.payload);

        // Clear old plain-text data if any exists
        removeStorageItem("userId");
        removeStorageItem("userEmail");
        removeStorageItem("userName");

        // Save new data in scrambled format to hide it from "Inspect"
        setEncryptedStorageItem("userId", decodedUser.id, rememberMe);
        setEncryptedStorageItem("userEmail", decodedUser.email, rememberMe);
        setEncryptedStorageItem("userName", decodedUser.name, rememberMe);
      }

      router.push("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Prevent flicker during session check
  if (status === "loading") return <LoadingSpinner message="Verifying session..." />;

  return (
    <div className="login-page">
      {loading && <LoadingSpinner message="Authenticating..." />}

      <div className="login-box">
        <div className="login-header">
          <h1 className="brand-heading">Core2Cover</h1>
          <p className="login-subtitle">Welcome back! Please enter your details.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message" style={{ color: '#d9534f', marginBottom: '15px', fontWeight: '600' }}>
              {error}
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              id="rememberMe"
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="rememberMe" style={{ margin: 0, cursor: 'pointer', fontSize: '14px', color: '#555' }}>Remember Me</label>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>

          <div className="login-divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="google-btn-premium"
            onClick={() => {
              setLoading(true);
              signIn("google", { callbackUrl: "/" });
            }}
          >
            <div className="google-icon-wrapper">
              <svg viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <span className="btn-text">Login with Google</span>
            <div className="btn-shimmer"></div>
          </button>
        </form>

        <div className="login-footer">
          Don't have an account? <Link href="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
