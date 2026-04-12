import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { UploadCloud } from 'lucide-react';

export default function AddBook() {
  const navigate = useNavigate(); // used to redirect user after success

  // State to store form input values
  const [form, setForm] = useState({ title: '', author: '', description: '' });

  // State to store uploaded PDF file
  const [pdfFile, setPdfFile] = useState(null);

  // State to store cover image file
  const [coverImage, setCoverImage] = useState(null);

  // Loading state for submit button
  const [loading, setLoading] = useState(false);

  // State to track drag & drop UI effect
  const [isDragging, setIsDragging] = useState(false);

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent page reload

    // Check if PDF file is selected
    if (!pdfFile) {
      toast.error('Please select a PDF file.');
      return;
    }

    setLoading(true); // start loading

    try {
      // Create FormData object to send files + text data
      const formData = new FormData();

      // Append text fields
      formData.append('title', form.title);
      formData.append('author', form.author);
      formData.append('description', form.description);

      // Append PDF file
      formData.append('pdf', pdfFile);

      // Append cover image only if exists
      if (coverImage) {
        formData.append('cover', coverImage);
      }

      // Send POST request to backend API
      await api.post('/books/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Success message
      toast.success('Book added successfully!');

      // Redirect to books page
      navigate('/books');

    } catch (err) {
      // Show error message from backend if exists
      toast.error(err.response?.data?.message || 'Failed to add book');
    } finally {
      setLoading(false); // stop loading
    }
  };

  // Function to update form state dynamically
  const update = (key, val) => setForm({ ...form, [key]: val });

  // When user drags file over drop area
  const handleDragOver = (e) => {
    e.preventDefault(); // allow drop
    setIsDragging(true); // change UI
  };

  // When user leaves drop area
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // When user drops file
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0]; // get dropped file

    // Check if file is an image
    if (file && file.type.startsWith('image/')) {
      setCoverImage(file);
    } else {
      toast.error('Please drop a valid image file');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-100">Add New Book</h1>

      {/* Form starts */}
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">

        {/* Title & Author fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Author *</label>
            <input
              className="input-field"
              value={form.author}
              onChange={(e) => update('author', e.target.value)}
              required
            />
          </div>
        </div>

        {/* PDF upload */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">PDF File *</label>
          <input
            type="file"
            accept="application/pdf" // only allow PDF
            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            className="input-field"
            required
          />
        </div>

        {/* Cover Image Upload with Drag & Drop */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Cover Image</label>
          <div className="relative">

            {/* Hidden file input */}
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setCoverImage(e.target.files[0])} 
              className="hidden" 
              id="coverUpload" 
            />

            {/* Drag & Drop UI */}
            <label 
              htmlFor="coverUpload" 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex items-center justify-center gap-2 input-field cursor-pointer border-dashed border-2 transition-colors ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'hover:border-emerald-500/50'
              }`}
            >
              {/* Upload icon */}
              <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-emerald-400' : 'text-gray-400'}`} />

              {/* Dynamic text based on state */}
              <span className={isDragging ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
                {isDragging 
                  ? 'Drop image here...' 
                  : (coverImage ? coverImage.name : 'Choose or drop a cover image...')
                }
              </span>
            </label>
          </div>
        </div>

        {/* Description field */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            className="input-field h-24 resize-none"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Adding...' : 'Add Book'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/books')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
