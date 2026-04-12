import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function MyTransactions() {

  // State to store user's transactions
  const [txns, setTxns] = useState([]);

  // State to handle loading spinner
  const [loading, setLoading] = useState(true);

  // Fetch transactions when component mounts
  useEffect(() => {
    api.get('/transactions/my') // API call
      .then(r => setTxns(r.data.data || r.data)) // store response data
      .catch(() => {}) // ignore errors
      .finally(() => setLoading(false)); // stop loading
  }, []);

  // Show loading spinner while fetching data
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        {/* Spinner UI */}
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

  // Map transaction types to badge colors
  const typeColors = {
    BORROW: 'badge-info',
    RETURN: 'badge-success',
    FINE_PAYMENT: 'badge-warning',
    BOOK_PURCHASE: 'badge-neutral',
    DONATION: 'badge-success',
    RENEWAL: 'badge-info'
  };

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <h1 className="text-2xl font-bold text-gray-100">
        My Transactions
      </h1>

      <div className="glass-card overflow-hidden">

        {/* Table to display transactions */}
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Type</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Description</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Amount</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Date</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody>

            {/* Loop through all transactions */}
            {txns.map(t => (

              <tr
                key={t.id} // unique key for each row
                className="border-b border-gray-800/30 hover:bg-gray-800/20 transition"
              >

                {/* Transaction type with colored badge */}
                <td className="p-4">
                  <span className={`badge ${typeColors[t.type] || 'badge-neutral'}`}>
                    {t.type}
                  </span>
                </td>

                {/* Description of transaction */}
                <td className="p-4 text-sm text-gray-300">
                  {t.description}
                </td>

                {/* Book related to transaction */}
                <td className="p-4 text-sm text-gray-400">
                  {t.book?.title || '-'}
                </td>

                {/* Transaction amount */}
                <td className="p-4 text-sm text-gray-300">
                  {t.amount > 0 ? `₹${t.amount.toFixed(2)}` : '-'}
                </td>

                {/* Transaction date */}
                <td className="p-4 text-sm text-gray-500">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>

              </tr>
            ))}

            {/* Show message if no transactions exist */}
            {txns.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  No transactions yet.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}
