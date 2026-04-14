// Import React hooks
import { useEffect, useState } from 'react';

// Import routing
import { Link } from 'react-router-dom';

// Import toast for notifications
import { toast } from 'react-toastify';

// Import axios instance for API calls
import api from '../api/axios';

// Import auth hook
import { useAuth } from '../hooks/useAuth';

// Import icons
import { RefreshCw, BookOpen, FileText, Edit2, X, Check } from 'lucide-react';

export default function BorrowedBooks() {

  // Get user from auth
  const { user } = useAuth();

  // State to store borrowed book records
  const [records, setRecords] = useState([]);

  // State for loading spinner
  const [loading, setLoading] = useState(true);

  // State for selected book details modal
  const [selectedBook, setSelectedBook] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(false);
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [editData, setEditData] = useState({});
  const [editingLoading, setEditingLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Function to fetch borrowed books data
  const fetchData = async () => {
    try {
      // API call to get user's borrowed books
      const { data } = await api.get('/circulation/my');

      // Store data in state (handle both formats)
      setRecords(data.data || data);
    } catch (err) {
      // Show error message
      toast.error('Failed to load borrowed books');
    } finally {
      // Stop loading spinner
      setLoading(false);
    }
  };

  // Call fetchData when component mounts
  useEffect(() => {
    fetchData();
  }, []);


  // Function to renew a book
  const handleRenew = async (id) => {
    try {
      // API call to renew book
      await api.put(`/circulation/renew/${id}`);

      // Success message
      toast.success('Book renewed!');

      // Refresh data
      fetchData();
    } catch (err) {
      // Error message
      toast.error(err.response?.data?.message || 'Renewal failed');
    }
  };

  // Function to view PDF for borrowed book
  const handleViewPdf = async (bookId) => {
    try {
      setViewingPdf(true);
      const { data } = await api.get(`/books/${bookId}/read`);
      const signedUrl = data?.data?.signedUrl;
      if (!signedUrl) throw new Error('Missing signed read URL.');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Unable to open PDF.');
    } finally {
      setViewingPdf(false);
    }
  };

  // Function to save description for admin
  const handleSaveBook = async () => {
    try {
      setEditingLoading(true);
      const bookId = selectedBook.bookId || selectedBook.book?.id;
      await api.put(`/books/${bookId}`, editData);
      // Update the selected book
      setSelectedBook({
        ...selectedBook,
        book: { ...selectedBook.book, ...editData }
      });
      setIsEditingBook(false);
      toast.success('Book details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update book details.');
    } finally {
      setEditingLoading(false);
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
      const bookId = selectedBook.bookId || selectedBook.book?.id;
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      
      const { data } = await api.put(`/books/${bookId}/pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSelectedBook({
        ...selectedBook,
        book: data.data
      });
      setPdfFile(null);
      toast.success('PDF uploaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload PDF.');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Show loading spinner while fetching data
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

  // Filter active borrowed books (not returned yet)
  const active = records.filter(c => !c.returnDate && c.type === 'BORROW');

  // Filter returned books
  const returned = records.filter(c => c.returnDate && c.type === 'BORROW');

  return (
    <div className="space-y-6">

      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-100">
        My Borrowed Books
      </h1>

      {/* Active borrowed books table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">

          {/* Table header */}
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Borrowed</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Due Date</th>
              <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-right p-4 text-sm font-semibold text-gray-400">Actions</th>
            </tr>
          </thead>

          <tbody>

            {/* Loop through active borrowed books */}
            {active.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">

                {/* Book details - clickable */}
                <td className="p-4">
                  <button
                    onClick={() => {
                      setSelectedBook(c);
                      setIsEditingBook(false);
                      setEditData({
                        title: c.book?.title || '',
                        author: c.book?.author || '',
                        description: c.book?.description || '',
                        genre: c.book?.genre || '',
                        publisher: c.book?.publisher || '',
                        year: c.book?.year || '',
                        edition: c.book?.edition || '',
                        isbn: c.book?.isbn || '',
                        price: c.book?.price || '',
                      });
                    }}
                    className="text-left hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <p className="font-medium text-gray-200 hover:underline">{c.book?.title}</p>
                    <p className="text-sm text-gray-500">{c.book?.author}</p>
                  </button>
                </td>

                {/* Borrow date */}
                <td className="p-4 text-sm text-gray-400">
                  {new Date(c.borrowDate).toLocaleDateString()}
                </td>

                {/* Due date */}
                <td className="p-4 text-sm text-gray-400">
                  {c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString()
                    : 'N/A'}
                </td>

                {/* Status (Active / Overdue) */}
                <td className="p-4">
                  {c.dueDate && new Date(c.dueDate) < new Date() ? (
                    <span className="badge badge-danger">Overdue</span>
                  ) : (
                    <span className="badge badge-success">Active</span>
                  )}
                </td>

                {/* Action buttons - only Renew for users, Return is admin-only */}
                <td className="p-4 text-right">

                  {/* Renew button */}
                  <button
                    onClick={() => handleRenew(c.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Renew
                  </button>
                </td>
              </tr>
            ))}

            {/* If no active books */}
            {active.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  No active borrows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Returned books section */}
      {returned.length > 0 && (
        <div className="glass-card overflow-hidden">

          {/* Section header */}
          <div className="p-4 border-b border-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-300">
              Returned Books
            </h2>
          </div>

          {/* Returned books table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Book</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Borrowed</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Returned</th>
              </tr>
            </thead>

            <tbody>

              {/* Show only last 10 returned books */}
              {returned.slice(0, 10).map((c) => (
                <tr key={c.id} className="border-b border-gray-800/30">

                  {/* Book title */}
                  <td className="p-4">
                    <p className="text-gray-200">{c.book?.title}</p>
                  </td>

                  {/* Borrow date */}
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(c.borrowDate).toLocaleDateString()}
                  </td>

                  {/* Return date */}
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(c.returnDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      )}

      {/* Book details modal */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            {/* Close button */}
            <div className="flex items-center justify-between sticky top-0 bg-gray-900/80 p-4 -m-4 mb-0 border-b border-gray-700">
              <h2 className="text-xl font-bold text-gray-100">{selectedBook.book?.title}</h2>
              <button
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all"
              >
                Close
              </button>
            </div>

            {/* Book content */}
            <div className="p-4 space-y-4">
              {/* Book metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Author</p>
                  <p className="text-gray-200 font-medium">{selectedBook.book?.author || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Genre</p>
                  <p className="text-gray-200 font-medium">{selectedBook.book?.genre || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Publisher</p>
                  <p className="text-gray-200 font-medium">{selectedBook.book?.publisher || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Year</p>
                  <p className="text-gray-200 font-medium">{selectedBook.book?.year || 'N/A'}</p>
                </div>
              </div>

              {/* Description */}
              {!isEditingBook ? (
                <div className="space-y-2 border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Description
                    </h3>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => setIsEditingBook(true)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit All
                      </button>
                    )}
                  </div>
                  {selectedBook.book?.description ? (
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedBook.book?.description}</p>
                  ) : (
                    <p className="text-gray-400 italic">No description available for this book.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold text-gray-200">Edit Book Details</h3>

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

                    {/* Year and Edition */}
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
                        rows="4"
                        placeholder="Enter book description..."
                      />
                    </div>

                    {/* PDF Upload for Digital Books */}
                    {selectedBook.book?.isDigital && (
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
                        {selectedBook.book?.pdfUrl && <p className="text-xs text-gray-400 mt-1">✓ PDF already uploaded</p>}
                      </div>
                    )}

                    {/* Save and Cancel buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveBook}
                        disabled={editingLoading}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {editingLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingBook(false);
                          setEditData({
                            title: selectedBook.book?.title || '',
                            author: selectedBook.book?.author || '',
                            description: selectedBook.book?.description || '',
                            genre: selectedBook.book?.genre || '',
                            publisher: selectedBook.book?.publisher || '',
                            year: selectedBook.book?.year || '',
                            edition: selectedBook.book?.edition || '',
                            isbn: selectedBook.book?.isbn || '',
                            price: selectedBook.book?.price || '',
                          });
                        }}
                        disabled={editingLoading}
                        className="flex-1 btn-secondary flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Digital book option */}
              {selectedBook.book?.isDigital && (
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold text-gray-200">Digital Copy</h3>
                  <button
                    onClick={() => handleViewPdf(selectedBook.bookId || selectedBook.book?.id)}
                    disabled={viewingPdf}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    {viewingPdf ? 'Opening PDF...' : 'View PDF'}
                  </button>
                </div>
              )}

              {/* Borrow info */}
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold text-gray-200">Borrow Info</h3>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>
                    <strong>Borrowed:</strong> {new Date(selectedBook.borrowDate).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Due Date:</strong> {selectedBook.dueDate ? new Date(selectedBook.dueDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

