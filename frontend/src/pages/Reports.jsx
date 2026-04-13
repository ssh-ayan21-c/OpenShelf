import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { BarChart3, BookOpen, Users, DollarSign, Clock, Layers } from 'lucide-react';

const tabs = [
  { key: 'stats', label: 'Library Stats', icon: BarChart3, endpoint: '/reports/library-stats' },
  { key: 'popular', label: 'Popular Books', icon: BookOpen, endpoint: '/reports/popular-books' },
  { key: 'activity', label: 'User Activity', icon: Users, endpoint: '/reports/user-activity' },
  { key: 'financial', label: 'Financial', icon: DollarSign, endpoint: '/reports/financial' },
  { key: 'overdue', label: 'Overdue', icon: Clock, endpoint: '/reports/overdue' },
  { key: 'category', label: 'By Category', icon: Layers, endpoint: '/reports/category' },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-100">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
    </div>
  );
}

function EmptyState({ message = 'No data available for this report.' }) {
  return <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500">{message}</div>;
}

function StatsReport({ data }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="Total Books" value={data?.books?.total ?? 0} subtitle={`${data?.books?.available ?? 0} available`} />
      <MetricCard title="Total Users" value={data?.users?.total ?? 0} subtitle={`${data?.users?.admins ?? 0} admins`} />
      <MetricCard title="Active Borrows" value={data?.borrows?.active ?? 0} subtitle={`${data?.borrows?.overdue ?? 0} overdue`} />
      <MetricCard title="Unpaid Fines" value={formatCurrency(data?.fines?.unpaidFines)} subtitle={`${formatCurrency(data?.fines?.paidFines)} paid`} />
    </div>
  );
}

function PopularBooksReport({ data }) {
  if (!Array.isArray(data) || data.length === 0) return <EmptyState message="No borrowing records yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px]">
        <thead>
          <tr className="border-b border-gray-800/50">
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Book</th>
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Author</th>
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">ISBN</th>
            <th className="p-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Borrows</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.book?.id || entry.book?.isbn} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
              <td className="p-4 font-medium text-gray-200">{entry.book?.title || 'Untitled'}</td>
              <td className="p-4 text-sm text-gray-400">{entry.book?.author || 'Unknown'}</td>
              <td className="p-4 text-sm text-gray-500">{entry.book?.isbn || '-'}</td>
              <td className="p-4 text-right">
                <span className="badge badge-info">{entry.borrowCount ?? 0}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserActivityReport({ data }) {
  const topBorrowers = data?.topBorrowers || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard title="Active Users" value={data?.activeUsersCount ?? 0} subtitle="Distinct borrowers" />
        <MetricCard title="Top Borrowers" value={topBorrowers.length} subtitle="Users in ranking" />
      </div>

      {topBorrowers.length === 0 ? (
        <EmptyState message="No user borrowing activity yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                <th className="p-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Borrow Count</th>
              </tr>
            </thead>
            <tbody>
              {topBorrowers.map((entry) => (
                <tr key={entry.user?.id || entry.user?.email} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                  <td className="p-4 font-medium text-gray-200">{entry.user?.name || 'Unknown User'}</td>
                  <td className="p-4 text-sm text-gray-400">{entry.user?.email || '-'}</td>
                  <td className="p-4 text-right">
                    <span className="badge badge-success">{entry.borrowCount ?? 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FinancialReport({ data }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MetricCard
        title="Fine Revenue Collected"
        value={formatCurrency(data?.fineRevenue?.total)}
        subtitle={`${data?.fineRevenue?.count ?? 0} successful payments`}
      />
      <MetricCard
        title="Pending Fines"
        value={formatCurrency(data?.pendingFines?.total)}
        subtitle={`${data?.pendingFines?.count ?? 0} unpaid fines`}
      />
    </div>
  );
}

function OverdueReport({ data }) {
  const overdueBooks = data?.overdueBooks || [];

  if (overdueBooks.length === 0) {
    return (
      <div className="space-y-4">
        <MetricCard title="Overdue Books" value={data?.count ?? 0} subtitle="All clear right now" />
        <EmptyState message="No overdue books at the moment." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MetricCard title="Overdue Books" value={data?.count ?? overdueBooks.length} subtitle="Needs follow-up" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Book</th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Borrower</th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {overdueBooks.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                <td className="p-4">
                  <p className="font-medium text-gray-200">{entry.book?.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500">{entry.book?.author || 'Unknown author'}</p>
                </td>
                <td className="p-4">
                  <p className="text-sm text-gray-300">{entry.user?.name || 'Unknown user'}</p>
                  <p className="text-xs text-gray-500">{entry.user?.email || '-'}</p>
                </td>
                <td className="p-4 text-sm text-red-300">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryReport({ data }) {
  const categories = data?.booksByGenre || [];
  if (categories.length === 0) return <EmptyState message="No category data available yet." />;

  const maxCount = Math.max(...categories.map((item) => item.count || 0), 1);

  return (
    <div className="space-y-3">
      {categories.map((item) => {
        const width = ((item.count || 0) / maxCount) * 100;
        return (
          <div key={item.genre} className="rounded-xl border border-gray-700/40 bg-gray-900/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-200">{item.genre}</p>
              <span className="badge badge-neutral">{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-800/70">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('stats');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const endpoint = tabs.find((t) => t.key === tab)?.endpoint;

    if (!endpoint) {
      setLoading(false);
      return;
    }

    api
      .get(endpoint)
      .then((response) => setData(response.data.data))
      .catch(() => {
        setData(null);
        setError('Could not load this report right now.');
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-300">
          {error}
        </div>
      );
    }

    switch (tab) {
      case 'stats':
        return <StatsReport data={data} />;
      case 'popular':
        return <PopularBooksReport data={data} />;
      case 'activity':
        return <UserActivityReport data={data} />;
      case 'financial':
        return <FinancialReport data={data} />;
      case 'overdue':
        return <OverdueReport data={data} />;
      case 'category':
        return <CategoryReport data={data} />;
      default:
        return <EmptyState />;
    }
  }, [loading, error, tab, data]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Reports</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-gray-800/30 text-gray-400 hover:bg-gray-800/50'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      <div className="glass-card p-6">{content}</div>
    </div>
  );
}
