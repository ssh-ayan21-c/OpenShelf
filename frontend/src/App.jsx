import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Suspense, lazy } from 'react';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeAuth } from './store/slices/authSlice';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Books = lazy(() => import('./pages/Books'));
const AddBook = lazy(() => import('./pages/AddBook'));
const BorrowedBooks = lazy(() => import('./pages/BorrowedBooks'));
const AllBorrowedBooks = lazy(() => import('./pages/AllBorrowedBooks'));
const MyReservations = lazy(() => import('./pages/MyReservations'));
const MyFines = lazy(() => import('./pages/MyFines'));
const ManageFines = lazy(() => import('./pages/ManageFines'));
const MyTransactions = lazy(() => import('./pages/MyTransactions'));
const AllTransactions = lazy(() => import('./pages/AllTransactions'));
const BookSuggestions = lazy(() => import('./pages/BookSuggestions'));
const SuggestBook = lazy(() => import('./pages/SuggestBook'));
const DonateBook = lazy(() => import('./pages/DonateBook'));
const MyDonations = lazy(() => import('./pages/MyDonations'));
const ManageDonations = lazy(() => import('./pages/ManageDonations'));
const Reports = lazy(() => import('./pages/Reports'));
const InventoryIssues = lazy(() => import('./pages/InventoryIssues'));
const Users = lazy(() => import('./pages/Users'));
const Profile = lazy(() => import('./pages/Profile'));
const RagChatbot = lazy(() => import('./pages/RagChatbot'));

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, user, bootstrapped } = useSelector((state) => state.auth);
  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading session...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500">Loading modules...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="books" element={<Books />} />
            <Route path="books/add" element={<ProtectedRoute adminOnly><AddBook /></ProtectedRoute>} />
            <Route path="borrowed" element={<BorrowedBooks />} />
            <Route path="borrowed/all" element={<ProtectedRoute adminOnly><AllBorrowedBooks /></ProtectedRoute>} />
            <Route path="reservations" element={<MyReservations />} />
            <Route path="fines" element={<MyFines />} />
            <Route path="fines/manage" element={<ProtectedRoute adminOnly><ManageFines /></ProtectedRoute>} />
            <Route path="transactions" element={<MyTransactions />} />
            <Route path="transactions/all" element={<ProtectedRoute adminOnly><AllTransactions /></ProtectedRoute>} />
            <Route path="suggestions" element={<BookSuggestions />} />
            <Route path="suggestions/new" element={<SuggestBook />} />
            <Route path="donations/new" element={<DonateBook />} />
            <Route path="donations" element={<MyDonations />} />
            <Route path="donations/manage" element={<ProtectedRoute adminOnly><ManageDonations /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute adminOnly><InventoryIssues /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="profile" element={<Profile />} />
            <Route path="rag" element={<RagChatbot />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
