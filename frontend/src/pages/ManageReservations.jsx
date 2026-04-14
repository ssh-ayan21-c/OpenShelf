import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { Check, X } from 'lucide-react';

export default function ManageReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchReservations = async () => {
    try {
      const { data } = await api.get('/reservations/all');
      setReservations(data.data || data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === 'PENDING').length,
    [reservations]
  );

  const updateStatus = async (reservationId, status) => {
    try {
      setProcessingId(reservationId);
      await api.patch(`/reservations/${reservationId}/status`, { status });
      toast.success(`Reservation ${status.toLowerCase()} successfully`);
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update reservation');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Manage Reservations</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount} pending request{pendingCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">User</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Queue</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Requested</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition">
                <td className="p-4">
                  <p className="font-medium text-gray-200">{r.book?.title || 'Unknown book'}</p>
                  <p className="text-xs text-gray-500">{r.book?.author || '-'}</p>
                </td>
                <td className="p-4">
                  <p className="text-sm text-gray-300">{r.user?.name || 'Unknown user'}</p>
                  <p className="text-xs text-gray-500">{r.user?.email || '-'}</p>
                </td>
                <td className="p-4 text-sm text-gray-400">#{r.position}</td>
                <td className="p-4">
                  <span
                    className={`badge ${
                      r.status === 'PENDING'
                        ? 'badge-warning'
                        : r.status === 'FULFILLED'
                        ? 'badge-success'
                        : 'badge-neutral'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  {r.status === 'PENDING' ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => updateStatus(r.id, 'FULFILLED')}
                        disabled={processingId === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Handed Over
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'CANCELLED')}
                        disabled={processingId === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">No action</span>
                  )}
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  No reservations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
