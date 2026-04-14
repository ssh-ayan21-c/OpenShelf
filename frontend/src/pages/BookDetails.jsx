import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BookOpen, Crown, MapPin, Layers, FileText, Edit2, X, Check } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

export default function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [hasBorrowed, setHasBorrowed] = useState(false);
  const [borrowedData, setBorrowedData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const userTier = user?.subscription_tier || 'free';

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        console.log(`[BookDetails] Loading book with ID: ${id}`);
        
        // Fetch book details
        const { data: bookData } = await api.get(`/books/${id}`);
        console.log('[BookDetails] Book data received:', bookData?.data);
        if (!mounted) return;
        setBook(bookData?.data || null);
        if (bookData?.data) {
          setEditData({
            title: bookData.data.title || '',
            author: bookData.data.author || '',
            description: bookData.data.description || '',
            genre: bookData.data.genre || '',
            publisher: bookData.data.publisher || '',
            year: bookData.data.year || '',
            edition: bookData.data.edition || '',
            isbn: bookData.data.isbn || '',
            price: bookData.data.price || '',
          });
        }

        // Check if user has borrowed this book (only if user is logged in)
        if (user?.id) {
          console.log('[BookDetails] Checking borrowed books for user:', user.id);
          try {
            const { data: circData } = await api.get(`/circulation/my`);
            console.log('[BookDetails] Circulation data received:', circData?.data);
            if (circData?.data && Array.isArray(circData.data)) {
              // Find book by matching bookId or book.id, excluding returned books
              const foundBorrowed = circData.data.find(item => {
                const itemBookId = item?.bookId || item?.book?.id;
                const itemStatus = item?.status;
                console.log(`[BookDetails] Checking item - bookId: ${itemBookId}, status: ${itemStatus}, match: ${(itemBookId === id || itemBookId === parseInt(id)) && itemStatus !== 'RETURNED'}`);
                return (itemBookId === id || itemBookId === parseInt(id)) && 
                       itemStatus !== 'RETURNED';
              });
              console.log('[BookDetails] Found borrowed book:', foundBorrowed);
              if (foundBorrowed) {
                setHasBorrowed(true);
                setBorrowedData(foundBorrowed);
              }
            }
          } catch (borrowErr) {
            // Don't fail if borrowed check fails - this is not critical
            console.warn('Failed to check borrowed books:', borrowErr?.message);
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error loading book:', err);
        toast.error(err.response?.data?.message || 'Failed to load book details.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, user?.id]);

  const normalizedFormat = useMemo(() => {
    if (!book) return 'physical';
    // Check if book has format field first, otherwise use isDigital flag
    if (book.format) return book.format;
    // Default to determining format from isDigital flag
    return book.isDigital ? 'digital' : 'physical';
  }, [book]);

  const isPhysical = !!(book?.physicalCount > 0 || normalizedFormat === 'physical' || normalizedFormat === 'hybrid');
  const isDigital = !!(book?.isDigital || normalizedFormat === 'digital' || normalizedFormat === 'hybrid');
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
    navigate(`/books/${id}/read`);
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

  const handleSaveChanges = async () => {
    try {
      setActionLoading(true);
      await api.put(`/books/${id}`, editData);
      setBook({ ...book, ...editData });
      setIsEditing(false);
      toast.success('Book details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update book details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const handlePdfFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      toast.error('Please select a valid PDF file.');
      setPdfFile(null);
    }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file first.');
      return;
    }

    try {
      setUploadingPdf(true);
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      
      const { data } = await api.put(`/books/${id}/pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setBook(data.data);
      setPdfFile(null);
      toast.success('PDF uploaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload PDF.');
    } finally {
      setUploadingPdf(false);
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
          {/* Book metadata badges */}
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

          {/* Book metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Genre</p>
              <p className="text-gray-200 font-medium">{book.genre || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Publisher</p>
              <p className="text-gray-200 font-medium">{book.publisher || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Year</p>
              <p className="text-gray-200 font-medium">{book.year || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Edition</p>
              <p className="text-gray-200 font-medium">{book.edition || 'N/A'}</p>
            </div>
          </div>

          {/* Book description */}
          {!isEditing ? (
            <div className="space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-200">Book Information</h2>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
                <div className="space-y-3 text-sm text-gray-400">
                  <p><strong className="text-gray-200">Title:</strong> {book.title || 'N/A'}</p>
                  <p><strong className="text-gray-200">Author:</strong> {book.author || 'N/A'}</p>
                  <p><strong className="text-gray-200">ISBN:</strong> {book.isbn || 'N/A'}</p>
                  <p><strong className="text-gray-200">Price:</strong> ${book.price || 'N/A'}</p>
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Description
                </h2>
                {book?.description ? (
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{book.description}</p>
                ) : (
                  <p className="text-gray-400 italic">No description available for this book.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-200">Edit Book Details</h2>
              </div>

              {/* Edit Form Fields */}
              <div className="space-y-3">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => handleEditChange('title', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Book title..."
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Author</label>
                  <input
                    type="text"
                    value={editData.author}
                    onChange={(e) => handleEditChange('author', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Author name..."
                  />
                </div>

                {/* ISBN */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={editData.isbn}
                    onChange={(e) => handleEditChange('isbn', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="ISBN..."
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Price</label>
                  <input
                    type="number"
                    value={editData.price}
                    onChange={(e) => handleEditChange('price', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Price..."
                  />
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Genre</label>
                  <input
                    type="text"
                    value={editData.genre}
                    onChange={(e) => handleEditChange('genre', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Genre..."
                  />
                </div>

                {/* Publisher */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={editData.publisher}
                    onChange={(e) => handleEditChange('publisher', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Publisher..."
                  />
                </div>

                {/* Year and Edition in a row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Year</label>
                    <input
                      type="text"
                      value={editData.year}
                      onChange={(e) => handleEditChange('year', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                      placeholder="Year..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Edition</label>
                    <input
                      type="text"
                      value={editData.edition}
                      onChange={(e) => handleEditChange('edition', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                      placeholder="Edition..."
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => handleEditChange('description', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-none"
                    rows="5"
                    placeholder="Enter book description..."
                  />
                </div>

                {/* PDF Upload for Digital Books */}
                {isDigital && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Upload PDF (Optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfFileChange}
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm file:bg-emerald-600 file:text-white file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded"
                        disabled={uploadingPdf}
                      />
                      {pdfFile && (
                        <button
                          onClick={handleUploadPdf}
                          disabled={uploadingPdf}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                          {uploadingPdf ? 'Uploading...' : 'Upload PDF'}
                        </button>
                      )}
                    </div>
                    {pdfFile && <p className="text-xs text-emerald-400 mt-1">Selected: {pdfFile.name}</p>}
                    {book?.pdfUrl && <p className="text-xs text-gray-400 mt-1">✓ PDF already uploaded</p>}
                  </div>
                )}

                {/* Save and Cancel buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveChanges}
                    disabled={actionLoading}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        title: book.title || '',
                        author: book.author || '',
                        description: book.description || '',
                        genre: book.genre || '',
                        publisher: book.publisher || '',
                        year: book.year || '',
                        edition: book.edition || '',
                        isbn: book.isbn || '',
                        price: book.price || '',
                      });
                    }}
                    disabled={actionLoading}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Physical book details */}
          {isPhysical && (
            <div className="space-y-3 border-t border-gray-700 pt-4">
              <h2 className="text-lg font-semibold text-gray-200">Physical Copy Details</h2>
              <div className="text-sm text-gray-400 space-y-2">
                <p className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Shelf Location:</strong> {shelfLocation || 'Not assigned yet'}
                  </span>
                </p>
                <p className="inline-flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Available Copies:</strong> {availableCopies}
                  </span>
                </p>
              </div>
              {availableCopies > 0 ? (
                <button
                  onClick={handleReservePhysical}
                  disabled={actionLoading}
                  className="btn-primary w-full"
                >
                  Reserve Physical Copy
                </button>
              ) : (
                <button className="btn-secondary opacity-70 cursor-not-allowed w-full" disabled>
                  Currently Unavailable
                </button>
              )}
            </div>
          )}

          {/* Digital book details */}
          {isDigital && (
            <div className="space-y-3 border-t border-gray-700 pt-4">
              <h2 className="text-lg font-semibold text-gray-200">Digital Copy Access</h2>
              
              {/* If user has borrowed the digital copy */}
              {hasBorrowed && isDigital && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <p className="text-emerald-300 font-medium">✓ You have borrowed this book</p>
                  </div>
                  <button
                    onClick={handleReadPdf}
                    disabled={actionLoading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    View PDF
                  </button>
                  {borrowedData?.returnDate && (
                    <p className="text-sm text-emerald-300/70">
                      Return by: {new Date(borrowedData.returnDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* If user can read directly (premium or free book) */}
              {!hasBorrowed && canReadDirectly && (
                <button
                  onClick={handleReadPdf}
                  disabled={actionLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Read PDF
                </button>
              )}

              {/* If premium upgrade needed */}
              {!hasBorrowed && showRentUpgrade && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">This is a premium book. Rent or upgrade to access.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRentDigital}
                      disabled={actionLoading}
                      className="btn-primary flex-1"
                    >
                      Rent Digital Copy
                    </button>
                    <button
                      onClick={() => navigate('/profile')}
                      className="btn-secondary flex-1"
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              )}

              {/* If no access at all */}
              {!hasBorrowed && !canReadDirectly && !showRentUpgrade && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-300">This digital book is currently unavailable.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
