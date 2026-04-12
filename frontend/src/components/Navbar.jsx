import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import { LogOut, User, Search } from 'lucide-react';

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 glass border-b border-gray-800/50 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search books, authors..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800/30 border border-gray-700/50 rounded-xl text-sm text-gray-300
                       placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
          />
        </div>

        {/* User Info + Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-gray-800/50 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-200">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.role === 'ADMIN' ? 'Admin' : 'Member'}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Logout"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
