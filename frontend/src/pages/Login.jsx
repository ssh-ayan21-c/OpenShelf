import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import { loginUser, clearError, signInWithGoogle } from '../store/slices/authSlice';
import { BookOpen, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {

  // Redux dispatch function to trigger actions
  const dispatch = useDispatch();

  // Extract authentication-related state from Redux store
  const { isAuthenticated, loading, error, bootstrapped } = useSelector((state) => state.auth);

  // Local state for email input
  const [email, setEmail] = useState('');

  // Local state for password input
  const [password, setPassword] = useState('');

  // If authentication state is still loading (e.g., checking session)
  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        Loading session...
      </div>
    );
  }

  // If user is already logged in, redirect to dashboard
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  // Handle form submission for login
  const handleSubmit = (e) => {
    e.preventDefault(); // prevent page reload

    dispatch(clearError()); // clear any previous errors

    // Dispatch login action with email and password
    dispatch(loginUser({ email, password }));
  };

  // Handle Google login
  const handleGoogleLogin = () => {
    dispatch(clearError()); // clear previous errors

    // Dispatch Google sign-in action
    dispatch(signInWithGoogle());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">

      {/* Background gradient blur effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo and heading */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 items-center justify-center mb-4 shadow-xl shadow-emerald-500/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold gradient-text">
            OpenShelf
          </h1>

          <p className="text-gray-500 mt-2">
            Sign in to your library account
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">

          {/* Show error message if login fails */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Email input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Email
            </label>

            <div className="relative">
              {/* Email icon */}
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)} // update email state
                placeholder="you@example.com"
                className="input-field pl-10"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Password
            </label>

            <div className="relative">
              {/* Password icon */}
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)} // update password state
                placeholder="••••••••"
                className="input-field pl-10"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading} // disable while loading
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              // Show spinner while logging in
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              // Show text + icon
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Google login button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full rounded-xl border border-gray-700/70 bg-gray-800/50 px-4 py-2.5 text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            Continue with Google
          </button>

          {/* Link to registration page */}
          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Register
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}
