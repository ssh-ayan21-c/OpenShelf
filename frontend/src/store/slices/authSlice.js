import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';
import { supabase } from '../../supabaseClient';

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;

    await api.post('/users/bootstrap-profile', {
      name: authData.user?.user_metadata?.name || credentials.email.split('@')[0],
    });

    const { data } = await api.get('/users/me');
    const user = data.data || data;
    localStorage.setItem('user', JSON.stringify(user));
    return { user, token: authData.session?.access_token || null };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: { name: userData.name },
      },
    });
    if (error) throw error;

    const sessionToken = authData.session?.access_token;
    if (!authData.user) throw new Error('Supabase sign up did not return a user.');

    if (!sessionToken) {
      return {
        user: null,
        token: null,
        requiresEmailVerification: true,
        message: 'Signup successful. Please verify your email, then sign in.',
      };
    }

    await api.post('/users/bootstrap-profile', { name: userData.name });
    const { data } = await api.get('/users/me');
    const user = data.data || data;
    localStorage.setItem('user', JSON.stringify(user));

    return { user, token: sessionToken, requiresEmailVerification: false };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message || 'Registration failed');
  }
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/users/me');
    return data.data || data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch user');
  }
});

export const initializeAuth = createAsyncThunk('auth/initialize', async (_, { rejectWithValue }) => {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return { user: null, token: null, isAuthenticated: false };

    await api.post('/users/bootstrap-profile', {
      name: session.user?.user_metadata?.name,
    });
    const me = await api.get('/users/me');
    const user = me.data.data || me.data;
    localStorage.setItem('user', JSON.stringify(user));

    return { user, token: session.access_token, isAuthenticated: true };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message || 'Failed to initialize auth');
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
    isAuthenticated: !!storedUser,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
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
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = !!action.payload.user;
        if (action.payload.requiresEmailVerification) {
          state.error = action.payload.message;
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
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
