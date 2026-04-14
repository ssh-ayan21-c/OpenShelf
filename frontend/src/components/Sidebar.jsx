import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  BookOpen, LayoutDashboard, BookCopy, Clock, DollarSign,
  ListChecks, Gift, Lightbulb, BarChart3, AlertTriangle,
  Users, Bot, Bookmark, ArrowLeftRight, Library
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/books', icon: BookOpen, label: 'Books' },
  { to: '/borrowed', icon: BookCopy, label: 'My Borrowed' },
  { to: '/reservations', icon: Bookmark, label: 'My Reservations' },
  { to: '/fines', icon: DollarSign, label: 'My Fines' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'My Transactions' },
  { to: '/suggestions', icon: Lightbulb, label: 'Suggestions' },
  { to: '/donations', icon: Gift, label: 'My Donations' },
  { to: '/rag', icon: Bot, label: 'AI Assistant' },
];

const adminItems = [
  { to: '/books/add', icon: Library, label: 'Add Book' },
  { to: '/borrowed/all', icon: BookCopy, label: 'All Borrowed' },
  { to: '/reservations/manage', icon: Bookmark, label: 'Manage Reservations' },
  { to: '/fines/manage', icon: DollarSign, label: 'Manage Fines' },
  { to: '/transactions/all', icon: ArrowLeftRight, label: 'All Transactions' },
  { to: '/donations/manage', icon: Gift, label: 'Manage Donations' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/inventory', icon: AlertTriangle, label: 'Inventory Issues' },
  { to: '/users', icon: Users, label: 'Manage Users' },
];

export default function Sidebar() {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass border-r border-gray-800/50 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">OpenShelf</h1>
            <p className="text-xs text-gray-500">Library System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`
            }
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`
                }
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
