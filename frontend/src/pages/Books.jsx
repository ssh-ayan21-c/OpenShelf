// Import React hooks
import { useEffect, useState } from 'react';

// Import Redux hooks
import { useSelector, useDispatch } from 'react-redux';

// Import async action to fetch books
import { fetchBooks } from '../store/slices/bookSlice';

// Import toast notifications
import { toast } from 'react-toastify';

// Import axios instance
import api from '../api/axios';

// Import icons
import { BookOpen, Search, Filter, BookCopy, Bookmark } from 'lucide-react';

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

      // Refresh book list
      dispatch(fetchBooks());
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

  // Show loading spinner while fetching data
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

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

            {/* Book cover */}
            <div className="h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
              
              {/* If cover exists, show image else show icon */}
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen className="w-12 h-12 text-gray-700 group-hover:text-gray-600 transition-colors" />
              )}

              {/* Status badges */}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {book.isDigital && (
                  <span className="badge badge-info text-[10px]">Digital</span>
                )}

                <span
                  className={`badge text-[10px] ${
                    book.status === 'AVAILABLE'
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
    </div>
  );
}
