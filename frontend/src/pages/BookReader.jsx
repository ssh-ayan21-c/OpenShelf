import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MessageCircle } from 'lucide-react';
import api from '../api/axios';
import RagChatbot from './RagChatbot';

export default function BookReader() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const [bookRes, readRes] = await Promise.all([
          api.get(`/books/${id}`),
          api.get(`/books/${id}/read`),
        ]);
        if (!mounted) return;
        setBook(bookRes.data?.data || null);
        setSignedUrl(readRes.data?.data?.signedUrl || '');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Unable to open reader.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="glass-card p-6 text-gray-400">
        Could not load PDF reader for this book.
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{book?.title || 'Book Reader'}</h1>
          <p className="text-sm text-gray-500">{book?.author ? `by ${book.author}` : 'Digital Reader'}</p>
        </div>
        <Link to={`/books/${id}`} className="btn-secondary">Back to Details</Link>
      </div>

      <div className="glass-card overflow-hidden h-[calc(100vh-13rem)]">
        <iframe
          title={book?.title || 'PDF Reader'}
          src={signedUrl}
          className="w-full h-full border-0"
        />
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="glass-card p-3 shadow-2xl shadow-emerald-900/20">
            <RagChatbot bookId={id} compact onClose={() => setChatOpen(false)} />
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="rounded-full p-4 bg-emerald-500 text-white shadow-lg hover:bg-emerald-400 transition-colors"
            aria-label="Open book assistant"
            title="Open Book Assistant"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
