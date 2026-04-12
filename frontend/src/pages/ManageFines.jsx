import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function ManageFines() {

  // State to store fines and users with outstanding fines
  const [data, setData] = useState({ fines: [], usersWithFines: [] });

  // State to handle loading spinner
  const [loading, setLoading] = useState(true);

  // Function to fetch all fines data from backend
  const fetchData = async () => {
    try {
      // API call to get fines data
      const { data } = await api.get('/fines/all');

      // Store response data (handles nested or direct format)
      setData(data.data || data);
    } catch {
      // Show error message if API fails
      toast.error('Failed');
    } finally {
      // Stop loading spinner
      setLoading(false);
    }
  };

  // Run fetchData once when component mounts
  useEffect(() => { fetchData(); }, []);

  // Function to mark a fine as paid
  const markPaid = async (id) => {
    try {
      // API call to update fine status
      await api.put(`/fines/mark-paid/${id}`);

      // Show success message
      toast.success('Marked as paid');

      // Refresh data
      fetchData();
    } catch (err) {
      // Show error message if request fails
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // Function to halt fine accumulation for a circulation record
  const haltFine = async (circulationId) => {
    try {
      // API call to halt fine
      await api.put(`/fines/halt/${circulationId}`);

      // Show success message
      toast.success('Fine halted successfully');

      // Refresh data
      fetchData();
    } catch (err) {
      // Show error message if request fails
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // Show loading spinner while fetching data
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
      <h1 className="text-2xl font-bold text-gray-100">
        Manage Fines
      </h1>

      {/* Section showing users with outstanding fines */}
      {data.usersWithFines?.length > 0 && (
        <div className="glass-card p-4">

          {/* Section title */}
          <h2 className="text-lg font-semibold text-gray-300 mb-3">
            Users with Outstanding Fines
          </h2>

          <div className="space-y-2">

            {/* Loop through users with fines */}
            {data.usersWithFines.map(u => (
              <div
                key={u.id}
                className="flex justify-between p-3 bg-gray-800/30 rounded-xl"
              >
                {/* User name and email */}
                <span className="text-gray-300">
                  {u.name} ({u.email})
                </span>

                {/* Fine amount */}
                <span className="text-red-400 font-semibold">
                  ₹{u.fineBalance?.toFixed(2)}
                </span>
              </div>
            ))}

          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">

        {/* Table to display all fines */}
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">User</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Amount</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Action</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody>

            {/* Loop through all fines */}
            {(data.fines || []).map((f) => (

              <tr key={f.id} className="border-b border-gray-800/30">

                {/* User name */}
                <td className="p-4 text-gray-300">
                  {f.circulation?.user?.name || 'N/A'}
                </td>

                {/* Book title */}
                <td className="p-4 text-gray-300">
                  {f.circulation?.book?.title || 'N/A'}
                </td>

                {/* Fine amount */}
                <td className="p-4 font-semibold text-gray-200">
                  ₹{f.amount?.toFixed(2)}

                  {/* Show "Halted" badge if fine is halted */}
                  {f.circulation?.fineHalted && (
                    <span className="ml-2 inline-flex items-center font-medium bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full border border-orange-500/20">
                      Halted
                    </span>
                  )}
                </td>

                {/* Payment status */}
                <td className="p-4">
                  <span className={`badge ${f.isPaid ? 'badge-success' : 'badge-danger'}`}>
                    {f.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>

                {/* Action buttons */}
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">

                    {/* Show "Mark Paid" if fine is unpaid */}
                    {!f.isPaid && (
                      <button
                        onClick={() => markPaid(f.id)}
                        className="btn-primary text-sm !px-4 !py-1.5"
                      >
                        Mark Paid
                      </button>
                    )}

                    {/* Show "Halt Fine" if fine is unpaid and not already halted */}
                    {!f.isPaid && !f.circulation?.fineHalted && (
                      <button
                        onClick={() => haltFine(f.circulation.id)}
                        className="btn-secondary text-sm !px-4 !py-1.5 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      >
                        Halt Fine
                      </button>
                    )}

                  </div>
                </td>

              </tr>
            ))}

          </tbody>
        </table>
      </div>
    </div>
  );
}
