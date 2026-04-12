import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function MyFines() {

  // State to store fines data
  const [fines, setFines] = useState([]);

  // State to handle loading spinner
  const [loading, setLoading] = useState(true);

  // Function to fetch user's fines from backend
  const fetchData = async () => {
    try {
      // API call to get fines
      const { data } = await api.get('/fines/my');

      // Store response data (handles nested or direct format)
      setFines(data.data || data);
    } catch {
      // Show error message if API fails
      toast.error('Failed to load');
    } finally {
      // Stop loading spinner
      setLoading(false);
    }
  };

  // Run fetchData once when component mounts
  useEffect(() => { fetchData(); }, []);

  // Function to handle fine payment
  const handlePay = async (id) => {
    try {
      // API call to pay fine
      await api.post(`/fines/${id}/pay`);

      // Show success message
      toast.success('Fine paid!');

      // Refresh fines list
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

  // Separate unpaid and paid fines
  const unpaid = fines.filter(f => !f.isPaid);
  const paid = fines.filter(f => f.isPaid);

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <h1 className="text-2xl font-bold text-gray-100">
        My Fines
      </h1>

      {/* Show summary of unpaid fines */}
      {unpaid.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">
            You have {unpaid.length} unpaid fine(s) totalling ₹
            {unpaid.reduce((sum, f) => sum + f.amount, 0).toFixed(2)}
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">

        {/* Table to display fines */}
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Amount</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Date</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Action</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody>

            {/* Loop through all fines */}
            {fines.map((f) => (

              <tr
                key={f.id}
                className="border-b border-gray-800/30 hover:bg-gray-800/20 transition"
              >

                {/* Book title */}
                <td className="p-4 text-gray-200">
                  {f.circulation?.book?.title || 'N/A'}
                </td>

                {/* Fine amount */}
                <td className="p-4 font-semibold text-gray-200">
                  ₹{f.amount.toFixed(2)}
                </td>

                {/* Payment status */}
                <td className="p-4">
                  <span className={`badge ${f.isPaid ? 'badge-success' : 'badge-danger'}`}>
                    {f.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>

                {/* Fine date */}
                <td className="p-4 text-sm text-gray-400">
                  {new Date(f.createdAt).toLocaleDateString()}
                </td>

                {/* Action button */}
                <td className="p-4 text-right">

                  {/* Show Pay button only if fine is unpaid */}
                  {!f.isPaid && (
                    <button
                      onClick={() => handlePay(f.id)}
                      className="btn-primary text-sm !px-4 !py-1.5"
                    >
                      Pay
                    </button>
                  )}

                </td>

              </tr>
            ))}

            {/* Show message if no fines exist */}
            {fines.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  No fines. 🎉
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}
