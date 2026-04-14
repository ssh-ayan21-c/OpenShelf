import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';
import { supabase } from '../../supabaseClient';

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    // First, authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    // If Supabase auth fails, return error
    if (authError) {
      return rejectWithValue(authError.message || 'Invalid email or password');
    }

    if (!authData?.user || !authData?.session) {
      return rejectWithValue('Login failed: No session returned');
    }

    const token = authData.session.access_token;
    const user = authData.user;

    // Try to bootstrap profile on backend
    try {
      await api.post('/users/bootstrap-profile', {
        name: user.user_metadata?.name || credentials.email.split('@')[0],
      });
    } catch (bootstrapErr) {
      console.warn('Profile bootstrap failed during login:', bootstrapErr);
      // Don't fail login just because bootstrap failed
    }

    // Try to fetch full user profile
    let userProfile = null;
    try {
      const { data } = await api.get('/users/me');
      userProfile = data.data || data;
    } catch (fetchErr) {
      console.warn('Failed to fetch user profile:', fetchErr);
      // If profile fetch fails but auth succeeded, use basic user info
      userProfile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || credentials.email.split('@')[0],
        role: 'USER',
        isPremium: false,
      };
    }

    // Store user and token
    localStorage.setItem('user', JSON.stringify(userProfile));
    return { user: userProfile, token };
  } catch (err) {
    console.error('Login error:', err);
    // Extract meaningful error message
    if (err.message?.includes('Invalid login credentials')) {
      return rejectWithValue('Invalid email or password');
    }
    return rejectWithValue(err.message || 'Login failed. Please try again.');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: { name: userData.name },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    
    // Handle Supabase signup errors
    if (error) {
      // Check if user already exists
      if (error.message?.includes('already registered') || error.message?.includes('User already exists')) {
        return rejectWithValue('This email is already registered. Please sign in instead.');
      }
      return rejectWithValue(error.message || 'Signup failed');
    }

    if (!authData.user) {
      return rejectWithValue('Signup failed: No user returned');
    }

    const sessionToken = authData.session?.access_token;

    // If email verification is required, don't try to bootstrap profile
    if (!sessionToken) {
      return {
        user: null,
        token: null,
        requiresEmailVerification: true,
        message: 'Signup successful! Please check your email to verify your account, then sign in.',
      };
    }

    // Try to bootstrap profile only if we have a session token
    try {
      await api.post('/users/bootstrap-profile', { name: userData.name });
      const { data } = await api.get('/users/me');
      const user = data.data || data;
      localStorage.setItem('user', JSON.stringify(user));
      return { user, token: sessionToken, requiresEmailVerification: false };
    } catch (apiErr) {
      // If profile bootstrap fails but auth succeeded, still mark as successful for email verification
      console.error('Profile bootstrap error:', apiErr);
      return {
        user: null,
        token: sessionToken,
        requiresEmailVerification: true,
        message: 'Account created! Please verify your email to complete setup.',
      };
    }
  } catch (err) {
    console.error('Registration error:', err);
    return rejectWithValue(err.message || 'Registration failed. Please try again.');
  }
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/users/me');
    return data.data || data;
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    if (err.code === 'ECONNABORTED') {
      return rejectWithValue('Request timeout. Backend may be unavailable.');
    }
    return rejectWithValue(errorMsg || 'Failed to fetch user');
  }
});

export const initializeAuth = createAsyncThunk('auth/initialize', async (_, { rejectWithValue }) => {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    
    if (!session) {
      localStorage.removeItem('user');
      return { user: null, token: null, isAuthenticated: false };
    }

    // Try to bootstrap profile
    try {
      await api.post('/users/bootstrap-profile', {
        name: session.user?.user_metadata?.name,
      });
    } catch (bootstrapErr) {
      console.warn('Profile bootstrap failed during initialization:', bootstrapErr);
      // Continue even if bootstrap fails
    }

    // Try to fetch user profile
    let user = null;
    try {
      const { data: userData } = await api.get('/users/me');
      user = userData.data || userData;
    } catch (fetchErr) {
      console.warn('Failed to fetch user profile during initialization:', fetchErr);
      // If fetch fails but session exists, create basic user info
      user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        role: 'USER',
        isPremium: false,
      };
    }

    localStorage.setItem('user', JSON.stringify(user));
    return { user, token: session.access_token, isAuthenticated: true };
  } catch (err) {
    console.error('Auth initialization error:', err);
    return rejectWithValue(err.message || 'Failed to initialize auth');
  }
});

export const signInWithGoogle = createAsyncThunk('auth/signInWithGoogle', async (_, { rejectWithValue }) => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    return true;
  } catch (err) {
    return rejectWithValue(err.message || 'Google sign-in failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('user');
});

const storedUser = localStorage.getItem('user');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: null,
    loading: false,
    error: null,
    successMessage: null,
    isAuthenticated: false,
    bootstrapped: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.bootstrapped = true;
      state.error = null;
      state.successMessage = null;
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; state.successMessage = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = !!action.payload.user;
        if (action.payload.requiresEmailVerification) {
          state.successMessage = action.payload.message;
        } else {
          state.successMessage = null;
        }
      })
      .addCase(registerUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(initializeAuth.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.bootstrapped = true;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.bootstrapped = true;
        state.error = action.payload;
      })
      .addCase(signInWithGoogle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInWithGoogle.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.bootstrapped = true;
        state.error = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
