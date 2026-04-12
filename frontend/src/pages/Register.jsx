import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import { registerUser, clearError, signInWithGoogle } from '../store/slices/authSlice';
import { BookOpen, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function Register() {
  const dispatch = useDispatch();
  const { isAuthenticated, loading, error, bootstrapped } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        Loading session...
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearError());
    dispatch(registerUser(form));
  };

  const handleGoogleSignup = () => {
    dispatch(clearError());
    dispatch(signInWithGoogle());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 items-center justify-center mb-4 shadow-xl shadow-emerald-500/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Create Account</h1>
          <p className="text-gray-500 mt-2">Join OpenShelf today</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="input-field pl-10" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="input-field pl-10" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="input-field pl-10" required minLength={6} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full rounded-xl border border-gray-700/70 bg-gray-800/50 px-4 py-2.5 text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            Continue with Google
          </button>
          <p className="text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
