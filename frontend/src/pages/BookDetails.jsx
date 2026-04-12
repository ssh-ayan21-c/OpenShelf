import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BookOpen, Crown, MapPin, Layers } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

function bookFormatLabel(format, isDigital) {
  if (format) return format;
  return isDigital ? 'digital' : 'physical';
}

export default function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const userTier = user?.subscription_tier || 'free';

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/books/${id}`);
        if (!mounted) return;
        setBook(data?.data || null);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load book details.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const normalizedFormat = useMemo(() => {
    if (!book) return 'physical';
    return book.format || bookFormatLabel(book.format, book.isDigital);
  }, [book]);

  const isPhysical = normalizedFormat === 'physical' || normalizedFormat === 'hybrid';
  const isDigital = normalizedFormat === 'digital' || normalizedFormat === 'hybrid' || !!book?.isDigital;
  const availableCopies = book?.availableCopies ?? book?.available_copies ?? book?.physicalCount ?? 0;
  const shelfLocation = book?.shelfLocation ?? book?.shelf_location ?? null;
  const isPremiumBook = !!(book?.isPremium ?? book?.is_premium);

  const canReadDirectly = isDigital && (!isPremiumBook || userTier === 'premium');
  const showRentUpgrade = isDigital && isPremiumBook && userTier !== 'premium';

  const handleReservePhysical = async () => {
    try {
      setActionLoading(true);
      await api.post('/reservations', { bookId: id });
      toast.success('Reservation placed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reserve physical copy.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReadPdf = async () => {
    try {
      setActionLoading(true);
      const { data } = await api.get(`/books/${id}/read`);
      const signedUrl = data?.data?.signedUrl;
      if (!signedUrl) throw new Error('Missing signed read URL.');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Unable to open PDF.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRentDigital = async () => {
    try {
      setActionLoading(true);
      await api.post(`/books/${id}/rent`);
      toast.success('Digital rental activated.');
      await handleReadPdf();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rent digital copy.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="glass-card p-6 text-gray-400">
        Book not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{book.title}</h1>
          <p className="text-gray-500 mt-1">by {book.author}</p>
        </div>
        <Link to="/books" className="btn-secondary">
          Back to Catalog
        </Link>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="h-60 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
          {(book.thumbnailUrl || book.coverUrl || book.cover_url) ? (
            <img
              src={book.thumbnailUrl || book.coverUrl || book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="w-16 h-16 text-gray-700" />
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {isPhysical && (
              <span className="badge badge-info text-xs inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Physical
              </span>
            )}
            {isDigital && (
              <span className="badge badge-success text-xs inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Digital
              </span>
            )}
            {isPremiumBook && (
              <span className="badge badge-warning text-xs inline-flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Premium
              </span>
            )}
          </div>

          {isPhysical && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-200">Physical Access</h2>
              <div className="text-sm text-gray-400 space-y-1">
                <p className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shelf Location: {shelfLocation || 'Not assigned yet'}
                </p>
                <p>Available Copies: {availableCopies}</p>
              </div>
              {availableCopies > 0 ? (
                <button
                  onClick={handleReservePhysical}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Reserve Physical Copy
                </button>
              ) : (
                <button className="btn-secondary opacity-70 cursor-not-allowed" disabled>
                  Currently Unavailable
                </button>
              )}
            </div>
          )}

          {isDigital && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-200">Digital Access</h2>
              {canReadDirectly && (
                <button
                  onClick={handleReadPdf}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Read PDF
                </button>
              )}

              {showRentUpgrade && (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRentDigital}
                    disabled={actionLoading}
                    className="btn-primary"
                  >
                    Rent Digital Copy
                  </button>
                  <button
                    onClick={() => navigate('/profile')}
                    className="btn-secondary"
                  >
                    Upgrade to Premium
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
