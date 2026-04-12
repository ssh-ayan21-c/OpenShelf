import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { Undo2 } from 'lucide-react';

export default function AllBorrowedBooks() {

  // State to store all borrowed book records
  const [records, setRecords] = useState([]);

  // State to handle loading spinner
  const [loading, setLoading] = useState(true);

  // Function to fetch all borrowed records from backend
  const fetchData = async () => {
    try {
      // API call to get all borrow data
      const { data } = await api.get('/circulation/all');

      // Store data in state (handles both nested and direct response)
      setRecords(data.data || data);
    } catch {
      // Show error if API fails
      toast.error('Failed to load');
    } finally {
      // Stop loading spinner
      setLoading(false);
    }
  };

  // Run fetchData once when component mounts
  useEffect(() => { fetchData(); }, []);

  // Function to mark a book as returned by admin
  const handleAdminReturn = async (id) => {
    try {
      // API call to update return status
      await api.put(`/circulation/admin-return/${id}`);

      // Show success message
      toast.success('Book returned!');

      // Refresh data after update
      fetchData();
    } catch (err) {
      // Show error message if request fails
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // Show loading spinner while data is being fetched
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        {/* Spinner UI */}
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <h1 className="text-2xl font-bold text-gray-100">All Active Borrows</h1>

      <div className="glass-card overflow-hidden">

        {/* Table to display borrowed records */}
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">User</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Borrowed</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Due</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Action</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody>

            {/* Loop through each record */}
            {records.map((c) => (

              <tr
                key={c.id} // unique identifier for each row
                className="border-b border-gray-800/30 hover:bg-gray-800/20 transition"
              >

                {/* Book title */}
                <td className="p-4">
                  <p className="font-medium text-gray-200">
                    {c.book?.title}
                  </p>
                </td>

                {/* User name and email */}
                <td className="p-4 text-sm text-gray-400">
                  {c.user?.name} ({c.user?.email})
                </td>

                {/* Borrow date formatted */}
                <td className="p-4 text-sm text-gray-400">
                  {new Date(c.borrowDate).toLocaleDateString()}
                </td>

                {/* Due date or N/A if not present */}
                <td className="p-4 text-sm text-gray-400">
                  {c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString()
                    : 'N/A'}
                </td>

                {/* Status: Overdue or Active */}
                <td className="p-4">
                  {c.dueDate && new Date(c.dueDate) < new Date()
                    ? <span className="badge badge-danger">Overdue</span>
                    : <span className="badge badge-success">Active</span>}
                </td>

                {/* Return button */}
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleAdminReturn(c.id)} // trigger return action
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
                  >
                    {/* Icon */}
                    <Undo2 className="w-3.5 h-3.5" />
                    Return
                  </button>
                </td>

              </tr>
            ))}

            {/* Show message if no records */}
            {records.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  No active borrows.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}
