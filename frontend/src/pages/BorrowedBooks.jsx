// Import React hooks
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchMe } from '../store/slices/authSlice';

// Import toast for notifications
import { toast } from 'react-toastify';

// Import axios instance for API calls
import api from '../api/axios';

// Import icons
import { RefreshCw, Undo2 } from 'lucide-react';

export default function BorrowedBooks() {
  const dispatch = useDispatch();

  // State to store borrowed book records
  const [records, setRecords] = useState([]);

  // State for loading spinner
  const [loading, setLoading] = useState(true);

  // Function to fetch borrowed books data
  const fetchData = async () => {
    try {
      // API call to get user's borrowed books
      const { data } = await api.get('/circulation/my');

      // Store data in state (handle both formats)
      setRecords(data.data || data);
    } catch (err) {
      // Show error message
      toast.error('Failed to load borrowed books');
    } finally {
      // Stop loading spinner
      setLoading(false);
    }
  };

  // Call fetchData when component mounts
  useEffect(() => {
    fetchData();
  }, []);


  // Function to renew a book
  const handleRenew = async (id) => {
    try {
      // API call to renew book
      await api.put(`/circulation/renew/${id}`);

      // Success message
      toast.success('Book renewed!');

      // Refresh data
      fetchData();
    } catch (err) {
      // Error message
      toast.error(err.response?.data?.message || 'Renewal failed');
    }
  };

  // Function to return a book
  const handleReturn = async (id) => {
    try {
      await api.post('/circulation/return', { circulationId: id });
      toast.success('Book returned!');
      fetchData();
      dispatch(fetchMe()); // Instantly update user profile rank
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed');
    }
  };

  // Show loading spinner while fetching data
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

  // Filter active borrowed books (not returned yet)
  const active = records.filter(c => !c.returnDate && c.type === 'BORROW');

  // Filter returned books
  const returned = records.filter(c => c.returnDate && c.type === 'BORROW');

  return (
    <div className="space-y-6">

      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-100">
        My Borrowed Books
      </h1>

      {/* Active borrowed books table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Borrowed</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Due Date</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Actions</th>
            </tr>
          </thead>

          <tbody>

            {/* Loop through active borrowed books */}
            {active.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">

                {/* Book details */}
                <td className="p-4">
                  <p className="font-medium text-gray-200">{c.book?.title}</p>
                  <p className="text-sm text-gray-500">{c.book?.author}</p>
                </td>

                {/* Borrow date */}
                <td className="p-4 text-sm text-gray-400">
                  {new Date(c.borrowDate).toLocaleDateString()}
                </td>

                {/* Due date */}
                <td className="p-4 text-sm text-gray-400">
                  {c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString()
                    : 'N/A'}
                </td>

                {/* Status (Active / Overdue) */}
                <td className="p-4">
                  {c.dueDate && new Date(c.dueDate) < new Date() ? (
                    <span className="badge badge-danger">Overdue</span>
                  ) : (
                    <span className="badge badge-success">Active</span>
                  )}
                </td>

                {/* Action buttons */}
                <td className="p-4 text-right space-x-2">

                  <button
                    onClick={() => handleReturn(c.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Return
                  </button>

                  {/* Renew button */}
                  <button
                    onClick={() => handleRenew(c.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Renew
                  </button>
                </td>
              </tr>
            ))}

            {/* If no active books */}
            {active.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  No active borrows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Returned books section */}
      {returned.length > 0 && (
        <div className="glass-card overflow-hidden">

          {/* Section header */}
          <div className="p-4 border-b border-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-300">
              Returned Books
            </h2>
          </div>

          {/* Returned books table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Borrowed</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Returned</th>
              </tr>
            </thead>

            <tbody>

              {/* Show only last 10 returned books */}
              {returned.slice(0, 10).map((c) => (
                <tr key={c.id} className="border-b border-gray-800/30">

                  {/* Book title */}
                  <td className="p-4">
                    <p className="text-gray-200">{c.book?.title}</p>
                  </td>

                  {/* Borrow date */}
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(c.borrowDate).toLocaleDateString()}
                  </td>

                  {/* Return date */}
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(c.returnDate).toLocaleDateString()}
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
