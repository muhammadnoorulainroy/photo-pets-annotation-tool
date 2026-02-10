import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const PAGE_SIZE = 20;

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        &larr; Prev
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 text-sm rounded-lg cursor-pointer transition ${
              p === currentPage
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        Next &rarr;
      </button>
    </div>
  );
}

export default function AnnotatorHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadImages();
  }, [page, filter]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('page_size', PAGE_SIZE);
      if (filter !== 'all') params.set('filter_status', filter);
      
      const res = await api.get(`/annotator/images?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const totalCompleted = data?.images?.filter(img => img.overall_status === 'completed').length || 0;
  const totalPending = data?.images?.filter(img => img.overall_status !== 'completed').length || 0;
  const progressPct = data?.total > 0 && data?.images ? Math.round((totalCompleted / data.images.length) * 100) : 0;

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="glass sticky top-0 z-10 border-b border-white/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white text-lg">🐾</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Photo Pets</h1>
              <p className="text-sm text-gray-500">Welcome back, <span className="font-medium text-indigo-600">{user?.username}</span></p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-xl transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading && !data ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading images...</p>
          </div>
        ) : !data || data.assigned_categories.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700">No categories assigned yet</h3>
            <p className="text-gray-500 mt-1">Ask your admin to assign categories to you.</p>
          </div>
        ) : data.images.length === 0 && data.total === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700">No images available</h3>
            <p className="text-gray-500 mt-1">All images have been claimed by other annotators.</p>
            <p className="text-sm text-gray-400 mt-2">Check back later for new images.</p>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger-children">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 opacity-10 rounded-bl-[32px] -mr-1 -mt-1" />
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm mb-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.total}</p>
                <p className="text-xs text-gray-500 font-medium">Total Images</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-10 rounded-bl-[32px] -mr-1 -mt-1" />
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white text-sm mb-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
                <p className="text-xs text-gray-500 font-medium">Completed</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 opacity-10 rounded-bl-[32px] -mr-1 -mt-1" />
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm mb-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
                <p className="text-xs text-gray-500 font-medium">Remaining</p>
              </div>
            </div>

            {/* Filters & Categories */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Your Images</h2>
                <p className="text-sm text-gray-500">
                  {data.total} images &middot; {data.assigned_categories.length} categories assigned
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {['all', 'pending', 'completed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer capitalize ${
                      filter === f
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-500 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned Categories */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/30 rounded-xl border border-indigo-100 p-4 mb-6 animate-fade-in">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Assigned Categories</p>
              <div className="flex flex-wrap gap-2">
                {data.assigned_categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="px-3 py-1.5 bg-white/80 text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200/60 shadow-sm"
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Image Grid */}
            {data.images.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700">
                  {filter === 'pending' ? 'All images annotated!' : 'No images found'}
                </h3>
                <p className="text-gray-500 mt-1">
                  {filter === 'pending' ? 'Great work! Check back later for new images.' : 'Try changing the filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 stagger-children">
                {data.images.map((img) => {
                  const isComplete = img.overall_status === 'completed';
                  const isPartial = img.overall_status === 'partial';
                  const isImproper = img.is_improper;
                  
                  return (
                    <button
                      key={img.id}
                      onClick={() => navigate(`/annotator/image/${img.id}`)}
                      className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm card-glow cursor-pointer text-left animate-slide-up"
                    >
                      <div className="relative aspect-square">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Status badge */}
                        {isImproper && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full shadow-sm">
                              Improper
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          {isComplete ? (
                            <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-full shadow-sm">
                              Done
                            </span>
                          ) : isPartial ? (
                            <span className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-full shadow-sm">
                              {img.completed_count}/{img.total_categories}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-800/70 text-white text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">
                              Pending
                            </span>
                          )}
                        </div>
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                          <span className="px-4 py-2 bg-white text-indigo-600 text-sm font-semibold rounded-lg shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {isComplete ? 'View / Edit' : 'Annotate'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Footer */}
                      <div className="px-3 py-2.5 border-t border-gray-100">
                        <p className="text-xs text-gray-500 truncate font-medium">{img.filename}</p>
                        {/* Category completion indicators */}
                        <div className="flex gap-1 mt-1.5">
                          {data.assigned_categories.map((cat) => {
                            const status = img.category_status[String(cat.id)];
                            return (
                              <div
                                key={cat.id}
                                title={`${cat.name}: ${status}`}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  status === 'completed' || status === 'completed_by_other'
                                    ? 'bg-emerald-500'
                                    : status === 'skipped'
                                      ? 'bg-amber-400'
                                      : 'bg-gray-300'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between animate-fade-in">
                <span className="text-sm text-gray-500">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
                </span>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
