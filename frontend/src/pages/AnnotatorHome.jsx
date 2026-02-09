import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function AnnotatorHome() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/annotator/categories');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Photo Pets Annotation Tool</h1>
            <p className="text-sm text-gray-500">Welcome, {user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Your Assigned Categories</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-5xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-700">No categories assigned yet</h3>
            <p className="text-gray-500 mt-1">Ask your admin to assign categories to you.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const total = cat.total_images;
              const done = cat.completed_images;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/annotator/category/${cat.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-indigo-300 transition group cursor-pointer"
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                    {cat.name}
                  </h3>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>{done} / {total} images</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {cat.skipped_images > 0 && (
                    <p className="text-xs text-amber-600 mt-2">{cat.skipped_images} skipped</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
