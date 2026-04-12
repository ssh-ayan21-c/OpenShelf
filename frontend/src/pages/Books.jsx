// Import React hooks
import { useEffect, useState } from 'react';

// Import Redux hooks
import { useSelector, useDispatch } from 'react-redux';

// Import async action to fetch books
import { fetchBooks } from '../store/slices/bookSlice';
import { fetchMe } from '../store/slices/authSlice';

// Import toast notifications
import { toast } from 'react-toastify';

// Import axios instance
import api from '../api/axios';

import { BookOpen, Search, Filter, BookCopy, Bookmark, UploadCloud, MessageSquare } from 'lucide-react';
import ReviewsModal from '../components/ReviewsModal';
export default function Books() {
  const dispatch = useDispatch(); // used to dispatch Redux actions

  // Get books data and loading state from Redux store
  const { books, loading } = useSelector((state) => state.books);

  // Get logged-in user info (not used here directly)
  const { user } = useSelector((state) => state.auth);

  // State for search input
  const [search, setSearch] = useState('');

  // State for genre filter
  const [genreFilter, setGenreFilter] = useState('');
  const [dragOverId, setDragOverId] = useState(null);

  // State for reviews modal
  const [selectedBookForReviews, setSelectedBookForReviews] = useState(null);

  // Fetch books when component loads
  useEffect(() => {
    dispatch(fetchBooks());
  }, [dispatch]);

  // Extract unique genres from books
  const genres = [...new Set(books.map(b => b.genre).filter(Boolean))];

  // Filter books based on search text and selected genre
  const filtered = books.filter(b => {
    // Check if title or author matches search text
    const matchSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());

    // Check if genre matches selected filter
    const matchGenre = !genreFilter || b.genre === genreFilter;

    return matchSearch && matchGenre;
  });

  // Function to borrow a book
  const handleBorrow = async (bookId) => {
    try {
      // API call to borrow book
      await api.post('/circulation/borrow', { bookId });

      // Show success message
      toast.success('Book borrowed successfully!');

      // Refresh book list and user profile
      dispatch(fetchBooks());
      dispatch(fetchMe());
    } catch (err) {
      // Show error message
      toast.error(err.response?.data?.message || 'Failed to borrow');
    }
  };

  // Function to reserve a book
  const handleReserve = async (bookId) => {
    try {
      // API call to reserve book
      await api.post('/reservations', { bookId });

      // Show success message
      toast.success('Reservation placed!');
    } catch (err) {
      // Show error message
      toast.error(err.response?.data?.message || 'Failed to reserve');
    }
  };

  const handleDragOver = (e, bookId) => {
    e.preventDefault();
    if (user?.role === 'ADMIN') setDragOverId(bookId);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverId(null);
  };

  const handleDrop = async (e, bookId) => {
    e.preventDefault();
    setDragOverId(null);
    if (user?.role !== 'ADMIN') return;

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please drop a valid image file for the cover');
      return;
    }

    const formData = new FormData();
    formData.append('cover', file);

    try {
      await api.put(`/books/${bookId}/cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Cover uploaded successfully!');
      dispatch(fetchBooks());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload cover');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">

      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Library Catalog</h1>
          <p className="text-gray-500 mt-1">
            {filtered.length} books available
          </p>
        </div>
      </div>

      {/* Filters section */}
      <div className="flex gap-3 flex-wrap">

        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)} // update search state
            placeholder="Search by title or author..."
            className="input-field pl-10"
          />
        </div>

        {/* Genre filter dropdown */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)} // update genre filter
            className="input-field pl-10 pr-8 appearance-none cursor-pointer"
          >
            <option value="">All Genres</option>

            {/* Populate genres dynamically */}
            {genres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Book grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {/* Loop through filtered books */}
        {filtered.map((book) => (
          <div key={book.id} className="glass-card overflow-hidden card-hover group">
            {/* Cover */}
            <div
              className={`h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden transition-all ${dragOverId === book.id ? 'ring-2 ring-emerald-500 scale-105' : ''}`}
              onDragOver={(e) => handleDragOver(e, book.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, book.id)}
            >
              {book.coverUrl ? (
                <>
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  {dragOverId === book.id && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center fade-in">
                      <UploadCloud className="w-8 h-8 text-emerald-400 mb-2" />
                      <span className="text-sm font-medium text-emerald-400">Replace Cover</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <BookOpen className={`w-12 h-12 text-gray-700 transition-colors ${dragOverId === book.id ? 'opacity-0' : 'group-hover:text-gray-600'}`} />
                  {(user?.role === 'ADMIN' && dragOverId !== book.id) && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                      <UploadCloud className="w-6 h-6 text-gray-300 mb-1" />
                      <span className="text-xs font-medium text-gray-300">Drop image here</span>
                    </div>
                  )}
                  {dragOverId === book.id && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center fade-in">
                      <UploadCloud className="w-8 h-8 text-emerald-400 mb-2" />
                      <span className="text-sm font-medium text-emerald-400">Drop Cover</span>
                    </div>
                  )}
                </>
              )}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {book.isDigital && (
                  <span className="badge badge-info text-[10px]">Digital</span>
                )}

                <span
                  className={`badge text-[10px] ${book.status === 'AVAILABLE'
                      ? 'badge-success'
                      : book.status === 'BORROWED'
                        ? 'badge-warning'
                        : 'badge-neutral'
                    }`}
                >
                  {book.status}
                </span>
              </div>
            </div>

            {/* Book details */}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-200 line-clamp-1">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-1">
                  {book.author}
                </p>
              </div>

              {/* Genre and copies */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{book.genre || 'N/A'}</span>
                <span>{book.physicalCount} copies</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">

                {/* Borrow button */}
                <button
                  onClick={() => handleBorrow(book.id)}
                  disabled={book.status !== 'AVAILABLE'} // disable if not available
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <BookCopy className="w-3.5 h-3.5" /> Borrow
                </button>

                {/* Reserve button */}
                <button
                  onClick={() => handleReserve(book.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all"
                >
                  <Bookmark className="w-3.5 h-3.5" /> Reserve
                </button>
                
                {/* Reviews Button */}
                <button
                  onClick={() => setSelectedBookForReviews(book)}
                  className="flex items-center justify-center p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                  title="View Reviews"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* If no books match filter */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No books found matching your search.
        </div>
      )}

      {/* Render Reviews Modal dynamically if selected */}
      {selectedBookForReviews && (
          <ReviewsModal 
             book={selectedBookForReviews} 
             onClose={() => setSelectedBookForReviews(null)} 
          />
      )}
    </div>
  );
}
