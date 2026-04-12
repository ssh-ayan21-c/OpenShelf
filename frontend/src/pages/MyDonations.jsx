import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Gift, Plus } from 'lucide-react';

export default function MyDonations() {

  // State to store user's donation requests
  const [donations, setDonations] = useState([]);

  // State to handle loading spinner
  const [loading, setLoading] = useState(true);

  // Fetch user's donations when component mounts
  useEffect(() => {
    api.get('/donations/my') // API call
      .then(r => setDonations(r.data.data || r.data)) // store response data
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

  // Map donation status to badge colors
  const statusColors = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-info',
    REJECTED: 'badge-danger',
    COMPLETED: 'badge-success'
  };

  return (
    <div className="space-y-6">

      {/* Header with title and button */}
      <div className="flex items-center justify-between">

        {/* Page title */}
        <h1 className="text-2xl font-bold text-gray-100">
          My Donations
        </h1>

        {/* Button to navigate to donation form */}
        <Link
          to="/donations/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Donate a Book
        </Link>
      </div>

      {/* List of donation cards */}
      <div className="grid gap-4">

        {/* Loop through all donations */}
        {donations.map(d => (

          <div
            key={d.id} // unique key for each card
            className="glass-card p-5 card-hover flex items-center justify-between"
          >

            {/* Left section: icon + book details */}
            <div className="flex items-center gap-4">

              {/* Gift icon */}
              <Gift className="w-8 h-8 text-emerald-400/50" />

              <div>
                {/* Book title */}
                <h3 className="font-semibold text-gray-200">
                  {d.title}
                </h3>

                {/* Author and condition */}
                <p className="text-sm text-gray-500">
                  by {d.author} • {d.condition}
                </p>
              </div>
            </div>

            {/* Right section: status + date */}
            <div className="text-right">

              {/* Status badge */}
              <span className={`badge ${statusColors[d.status]}`}>
                {d.status}
              </span>

              {/* Created date */}
              <p className="text-xs text-gray-600 mt-1">
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </div>

          </div>
        ))}

        {/* Show message if no donations exist */}
        {donations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No donation requests yet.
          </div>
        )}

      </div>
    </div>
  );
}
