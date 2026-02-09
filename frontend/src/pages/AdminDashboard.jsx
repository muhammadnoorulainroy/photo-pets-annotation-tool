import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const PAGE_SIZE = 10;

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
    <div className="flex items-center justify-center gap-1 pt-4">
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
                ? 'bg-indigo-600 text-white font-medium'
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

function Tabs({ active, onChange, tabs }) {
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            px-5 py-3 text-sm font-medium transition border-b-2 cursor-pointer
            ${active === tab.key
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null); // user id
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'annotator' });
  const [showPassword, setShowPassword] = useState(false);
  const [assignedCats, setAssignedCats] = useState([]);
  const [loading, setLoading] = useState(true);

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pw = '';
    for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: pw }));
    setShowPassword(true);
  };

  const load = async () => {
    try {
      const [usersRes, catsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/categories'),
      ]);
      setUsers(usersRes.data);
      setCategories(catsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      setShowCreate(false);
      setShowPassword(false);
      setForm({ username: '', password: '', full_name: '', role: 'annotator' });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const toggleActive = async (user) => {
    await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
    load();
  };

  const openAssignment = (user) => {
    setEditingAssignment(user.id);
    setAssignedCats(user.assigned_category_ids || []);
  };

  const saveAssignment = async () => {
    await api.put(`/admin/users/${editingAssignment}/categories`, { category_ids: assignedCats });
    setEditingAssignment(null);
    load();
  };

  const toggleCat = (catId) => {
    setAssignedCats((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Users</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition cursor-pointer"
        >
          + New Annotator
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createUser} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="annotator">Annotator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 cursor-pointer">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Categories</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                <td className="px-5 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-5 py-3 text-gray-600">{u.full_name || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">
                  {u.role === 'annotator' ? (
                    <div className="flex flex-wrap gap-1">
                      {u.assigned_category_ids.length === 0 ? (
                        <span className="text-gray-400">None</span>
                      ) : (
                        u.assigned_category_ids.map((catId) => {
                          const cat = categories.find((c) => c.id === catId);
                          return (
                            <span key={catId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                              {cat?.name || catId}
                            </span>
                          );
                        })
                      )}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    {u.role === 'annotator' && (
                      <button
                        onClick={() => openAssignment(u)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium cursor-pointer"
                      >
                        Assign
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-medium cursor-pointer ${u.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assignment modal */}
      {editingAssignment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Categories
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {categories.map((cat) => {
                const checked = assignedCats.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${
                      checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCat(cat.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${
                      checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'
                    }`}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveAssignment}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setEditingAssignment(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────

function ProgressTab() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/progress').then((res) => {
      setProgress(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  if (progress.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p className="text-lg">No assignments yet.</p>
        <p className="text-sm mt-1">Create annotators and assign categories to see progress here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Annotation Progress</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-5 py-3 font-medium">Annotator</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 font-medium">Completed</th>
              <th className="px-5 py-3 font-medium">Skipped</th>
              <th className="px-5 py-3 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {progress.map((p, i) => {
              const pct = p.total_images > 0 ? Math.round((p.completed / p.total_images) * 100) : 0;
              return (
                <tr key={i}>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.annotator_username}</td>
                  <td className="px-5 py-3 text-gray-600">{p.category_name}</td>
                  <td className="px-5 py-3 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-green-600 font-medium">{p.completed}</td>
                  <td className="px-5 py-3 text-amber-600">{p.skipped}</td>
                  <td className="px-5 py-3 text-gray-500">{p.pending}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Image Completion Tab ─────────────────────────────────────

function ImageCompletionTab() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, complete, incomplete
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/admin/images/completion').then((res) => {
      setImages(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  const filtered = images.filter((img) => {
    if (filter === 'complete') return img.is_fully_complete;
    if (filter === 'incomplete') return !img.is_fully_complete;
    return true;
  });

  const totalComplete = images.filter((img) => img.is_fully_complete).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedImages = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Image Completion Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalComplete} / {images.length} images fully annotated across all categories
          </p>
        </div>
        <div className="flex gap-2">
          {['all', 'incomplete', 'complete'].map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {f === 'all' ? `All (${images.length})` : f === 'complete' ? `Complete (${totalComplete})` : `Incomplete (${images.length - totalComplete})`}
            </button>
          ))}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Completion</span>
          <span>{images.length > 0 ? Math.round((totalComplete / images.length) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${images.length > 0 ? (totalComplete / images.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Image cards */}
      <div className="space-y-3">
        {paginatedImages.map((img) => {
          const pct = img.total_categories > 0
            ? Math.round((img.completed_categories / img.total_categories) * 100)
            : 0;
          return (
            <div key={img.image_id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-4">
                <img
                  src={img.image_url}
                  alt={img.image_filename}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{img.image_filename}</span>
                      {img.is_fully_complete ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Complete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          {img.completed_categories}/{img.total_categories} categories
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                    <div
                      className={`h-1.5 rounded-full transition-all ${img.is_fully_complete ? 'bg-green-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {img.category_details.map((cat) => (
                      <span
                        key={cat.category_id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          cat.status === 'completed'
                            ? 'bg-green-50 text-green-700'
                            : cat.status === 'skipped'
                              ? 'bg-amber-50 text-amber-700'
                              : cat.status === 'in_progress'
                                ? 'bg-blue-50 text-blue-700'
                                : cat.status === 'unassigned'
                                  ? 'bg-red-50 text-red-500 border border-red-200 border-dashed'
                                  : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {cat.status === 'completed' && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {cat.category_name}
                        {cat.annotator_username && (
                          <span className="opacity-60">({cat.annotator_username})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

// ─── Images Tab ───────────────────────────────────────────────

function ImagesTab() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const imagesPerPage = 20;

  useEffect(() => {
    api.get('/admin/images').then((res) => {
      setImages(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  const totalPages = Math.max(1, Math.ceil(images.length / imagesPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedImages = images.slice((safePage - 1) * imagesPerPage, safePage * imagesPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Images ({images.length})</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {paginatedImages.map((img) => (
          <div key={img.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <img src={img.url} alt={img.filename} className="w-full h-32 object-cover" />
            <div className="px-3 py-2">
              <p className="text-xs text-gray-500 truncate">{img.filename}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {((safePage - 1) * imagesPerPage) + 1}–{Math.min(safePage * imagesPerPage, images.length)} of {images.length}</span>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

// ─── Review Tab ──────────────────────────────────────────────

function CellEditPopover({ cell, onSave, onApprove, onClose }) {
  const [selections, setSelections] = useState(cell.selected_options.map((o) => o.id));
  const [isDuplicate, setIsDuplicate] = useState(cell.is_duplicate);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const toggleOpt = (id) => {
    setSelections((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const hasChanges = () => {
    const origIds = new Set(cell.selected_options.map((o) => o.id));
    if (selections.length !== origIds.size) return true;
    for (const id of selections) { if (!origIds.has(id)) return true; }
    if (isDuplicate !== cell.is_duplicate) return true;
    return false;
  };

  return (
    <div ref={popoverRef} className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold text-gray-700 mb-2">Edit selections:</p>
      <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
        {cell.all_options.map((opt) => {
          const checked = selections.includes(opt.id);
          return (
            <label key={opt.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition text-xs ${checked ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleOpt(opt.id)} className="sr-only" />
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                {checked && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span>{opt.label}</span>
              {opt.is_typical && <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full">typical</span>}
            </label>
          );
        })}
      </div>
      <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200 cursor-pointer text-xs mb-3">
        <input type="checkbox" checked={isDuplicate || false} onChange={() => setIsDuplicate((v) => !v)} className="accent-red-500 w-3.5 h-3.5" />
        <span className="text-gray-700">Is Duplicate?</span>
      </label>
      <div className="flex gap-2">
        {hasChanges() ? (
          <button onClick={() => onSave(cell.annotation_id, selections, isDuplicate)} className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 cursor-pointer">Save & Approve</button>
        ) : (
          <button onClick={() => onApprove(cell.annotation_id)} className="flex-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 cursor-pointer">Approve</button>
        )}
        <button onClick={onClose} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

// ─── Image Detail Modal (split-view) ─────────────────────────

function ImageDetailModal({ row, categories, tableImages, onApprove, onSaveEdits, onClose, onNavigate }) {
  // Local edit state: map of category_id -> { selections: [...], isDuplicate }
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset edits when image changes
  useEffect(() => {
    setEdits({});
  }, [row.image_id]);

  const getEditsForCat = (catId) => {
    if (edits[catId]) return edits[catId];
    const cell = row.annotations[String(catId)];
    if (!cell) return null;
    return {
      selections: cell.selected_options.map((o) => o.id),
      isDuplicate: cell.is_duplicate,
    };
  };

  const setEditForCat = (catId, field, value) => {
    setEdits((prev) => {
      const cell = row.annotations[String(catId)];
      const current = prev[catId] || {
        selections: cell.selected_options.map((o) => o.id),
        isDuplicate: cell.is_duplicate,
      };
      return { ...prev, [catId]: { ...current, [field]: value } };
    });
  };

  const toggleOption = (catId, optId) => {
    const current = getEditsForCat(catId);
    if (!current) return;
    const newSels = current.selections.includes(optId)
      ? current.selections.filter((id) => id !== optId)
      : [...current.selections, optId];
    setEditForCat(catId, 'selections', newSels);
  };

  const hasChangesForCat = (catId) => {
    const cell = row.annotations[String(catId)];
    if (!cell || !edits[catId]) return false;
    const origIds = new Set(cell.selected_options.map((o) => o.id));
    const newIds = edits[catId].selections;
    if (newIds.length !== origIds.size) return true;
    for (const id of newIds) { if (!origIds.has(id)) return true; }
    if (edits[catId].isDuplicate !== cell.is_duplicate) return true;
    return false;
  };

  const hasAnyChanges = categories.some((cat) => hasChangesForCat(cat.id));

  const pendingAnnotations = categories
    .filter((cat) => {
      const cell = row.annotations[String(cat.id)];
      return cell && !cell.review_status;
    })
    .map((cat) => row.annotations[String(cat.id)]);

  const handleApproveAll = async () => {
    setSaving(true);
    try {
      for (const cell of pendingAnnotations) {
        if (hasChangesForCat(String(cell.annotation_id))) continue;
        await onApprove(cell.annotation_id);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save changed categories
      for (const cat of categories) {
        if (hasChangesForCat(cat.id)) {
          const cell = row.annotations[String(cat.id)];
          const e = edits[cat.id];
          await onSaveEdits(cell.annotation_id, e.selections, e.isDuplicate);
        }
      }
      // Approve unchanged pending ones
      for (const cell of pendingAnnotations) {
        const catId = categories.find((c) => row.annotations[String(c.id)]?.annotation_id === cell.annotation_id)?.id;
        if (catId && !hasChangesForCat(catId)) {
          await onApprove(cell.annotation_id);
        }
      }
    } finally {
      setSaving(false);
      setEdits({});
    }
  };

  // Current index for navigation
  const currentIdx = tableImages.findIndex((img) => img.image_id === row.image_id);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div className="flex w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* Left panel: Large image */}
        <div className="w-[55%] bg-gray-900 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-white/80 text-sm font-medium">{row.image_filename}</span>
            <span className="text-white/50 text-xs">{currentIdx + 1} / {tableImages.length}</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 relative">
            {/* Nav arrows */}
            {currentIdx > 0 && (
              <button
                onClick={() => onNavigate(tableImages[currentIdx - 1])}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <img src={row.image_url} alt={row.image_filename} className="max-w-full max-h-full object-contain rounded-lg" />
            {currentIdx < tableImages.length - 1 && (
              <button
                onClick={() => onNavigate(tableImages[currentIdx + 1])}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Right panel: Categories + options */}
        <div className="w-[45%] bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Annotations</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">Esc to close</span>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Scrollable category list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {categories.map((cat) => {
              const cell = row.annotations[String(cat.id)];
              if (!cell) {
                return (
                  <div key={cat.id} className="opacity-50">
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">{cat.name}</h4>
                    <p className="text-xs text-gray-400 italic">Not annotated</p>
                  </div>
                );
              }
              const currentEdits = getEditsForCat(cat.id);
              const changed = hasChangesForCat(cat.id);
              return (
                <div key={cat.id} className={`rounded-xl border p-3 ${changed ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-semibold text-gray-800">{cat.name}</h4>
                    {cell.review_status === 'approved' ? (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">Approved</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">Pending</span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">{cell.annotator_username}</span>
                  </div>
                  <div className="space-y-1">
                    {cell.all_options.map((opt) => {
                      const checked = currentEdits?.selections.includes(opt.id);
                      return (
                        <label key={opt.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition text-xs ${checked ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={checked || false} onChange={() => toggleOption(cat.id, opt.id)} className="sr-only" />
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                            {checked && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span>{opt.label}</span>
                          {opt.is_typical && <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full">typical</span>}
                        </label>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 cursor-pointer text-xs">
                    <input type="checkbox" checked={currentEdits?.isDuplicate || false} onChange={() => setEditForCat(cat.id, 'isDuplicate', !currentEdits?.isDuplicate)} className="accent-red-500 w-3.5 h-3.5" />
                    <span className="text-gray-700">Is Duplicate?</span>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-gray-200 px-5 py-3 flex items-center gap-3 bg-gray-50">
            {hasAnyChanges ? (
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes & Approve All'}
              </button>
            ) : pendingAnnotations.length > 0 ? (
              <button
                onClick={handleApproveAll}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Approving...' : `Approve All Pending (${pendingAnnotations.length})`}
              </button>
            ) : (
              <span className="flex-1 text-center text-sm text-green-600 font-medium">All categories approved</span>
            )}
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">A = approve</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Keyboard shortcuts help ─────────────────────────────────

function ShortcutsHelp({ show, onClose }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-80" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Keyboard Shortcuts</h3>
        <div className="space-y-2 text-xs">
          {[
            ['Up / Down', 'Navigate table rows'],
            ['Enter', 'Open image detail modal'],
            ['Escape', 'Close modal / clear selection'],
            ['Left / Right', 'Prev / next image (in modal)'],
            ['A', 'Approve all pending (in modal)'],
            ['?', 'Show this help'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-[11px] font-mono font-medium text-gray-700 min-w-[80px] text-center">{key}</kbd>
              <span className="text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 cursor-pointer">Close</button>
      </div>
    </div>
  );
}

function ReviewTab() {
  const [viewMode, setViewMode] = useState('table'); // cards, table
  // ── Cards state ──
  const [annotations, setAnnotations] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [catFilter, setCatFilter] = useState('');
  const [annotatorFilter, setAnnotatorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editSelections, setEditSelections] = useState([]);
  const [editDuplicate, setEditDuplicate] = useState(null);
  // ── Table state ──
  const [tableData, setTableData] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  // ── Detail modal ──
  const [modalRow, setModalRow] = useState(null);
  // ── Bulk select ──
  const [selectedRows, setSelectedRows] = useState(new Set());
  // ── Keyboard navigation ──
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // ── Bulk approve in progress ──
  const [bulkApproving, setBulkApproving] = useState(false);

  // ── Cards data loader ──
  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('review_status', filter);
      params.set('page', page);
      params.set('page_size', '15');
      if (catFilter) params.set('category_id', catFilter);
      if (annotatorFilter) params.set('annotator_id', annotatorFilter);

      const [annRes, statsRes, catsRes, usersRes] = await Promise.all([
        api.get(`/admin/review?${params.toString()}`),
        api.get('/admin/review/stats'),
        api.get('/admin/categories'),
        api.get('/admin/users'),
      ]);
      setAnnotations(annRes.data);
      setStats(statsRes.data);
      setCategories(catsRes.data);
      setUsers(usersRes.data.filter((u) => u.role === 'annotator'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, catFilter, annotatorFilter, page]);

  // ── Table data loader ──
  const loadTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('review_status', filter);
      params.set('page', tablePage);
      params.set('page_size', '20');
      if (annotatorFilter) params.set('annotator_id', annotatorFilter);

      const [tableRes, statsRes, catsRes, usersRes] = await Promise.all([
        api.get(`/admin/review/table?${params.toString()}`),
        api.get('/admin/review/stats'),
        api.get('/admin/categories'),
        api.get('/admin/users'),
      ]);
      setTableData(tableRes.data);
      setStats(statsRes.data);
      setCategories(catsRes.data);
      setUsers(usersRes.data.filter((u) => u.role === 'annotator'));
      setSelectedRows(new Set());
      setHighlightedIdx(-1);
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }, [filter, annotatorFilter, tablePage]);

  useEffect(() => {
    if (viewMode === 'cards') loadCards();
    else loadTable();
  }, [viewMode, loadCards, loadTable]);

  const refreshData = useCallback(() => {
    if (viewMode === 'cards') loadCards(); else loadTable();
  }, [viewMode, loadCards, loadTable]);

  // ── Shared actions ──
  const handleApprove = async (annotationId) => {
    try {
      await api.put(`/admin/review/${annotationId}/approve`, {});
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleApproveAndRefresh = async (annotationId) => {
    await handleApprove(annotationId);
    refreshData();
  };

  const handleSaveEdits = async (annotationId, selectedIds, isDuplicate) => {
    try {
      await api.put(`/admin/review/${annotationId}/update`, {
        selected_option_ids: selectedIds,
        is_duplicate: isDuplicate,
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save');
    }
  };

  const handleSaveEditsAndRefresh = async (annotationId, selectedIds, isDuplicate) => {
    await handleSaveEdits(annotationId, selectedIds, isDuplicate);
    setEditingCell(null);
    cancelEditing();
    refreshData();
  };

  // ── Bulk approve ──
  const handleBulkApprove = async () => {
    if (!tableData) return;
    setBulkApproving(true);
    try {
      const promises = [];
      for (const imgId of selectedRows) {
        const row = tableData.images.find((r) => r.image_id === imgId);
        if (!row) continue;
        for (const cat of tableData.categories) {
          const cell = row.annotations[String(cat.id)];
          if (cell && !cell.review_status) {
            promises.push(api.put(`/admin/review/${cell.annotation_id}/approve`, {}));
          }
        }
      }
      await Promise.all(promises);
      setSelectedRows(new Set());
      refreshData();
    } catch (err) {
      alert('Some approvals failed');
    } finally {
      setBulkApproving(false);
    }
  };

  const toggleRowSelect = (imageId) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId); else next.add(imageId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!tableData) return;
    if (selectedRows.size === tableData.images.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableData.images.map((r) => r.image_id)));
    }
  };

  // Count pending annotations in selected rows
  const selectedPendingCount = useMemo(() => {
    if (!tableData) return 0;
    let count = 0;
    for (const imgId of selectedRows) {
      const row = tableData.images.find((r) => r.image_id === imgId);
      if (!row) continue;
      for (const cat of tableData.categories) {
        const cell = row.annotations[String(cat.id)];
        if (cell && !cell.review_status) count++;
      }
    }
    return count;
  }, [selectedRows, tableData]);

  // ── Cards edit helpers ──
  const startEditing = (a) => {
    setEditingId(a.id);
    setEditSelections(a.selected_options.map((o) => o.id));
    setEditDuplicate(a.is_duplicate);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSelections([]);
    setEditDuplicate(null);
  };

  const toggleEditOption = (optId) => {
    setEditSelections((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
    );
  };

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
    setTablePage(1);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      // Shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Modal-specific shortcuts
      if (modalRow && tableData) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setModalRow(null);
          return;
        }
        const idx = tableData.images.findIndex((r) => r.image_id === modalRow.image_id);
        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          setModalRow(tableData.images[idx - 1]);
          return;
        }
        if (e.key === 'ArrowRight' && idx < tableData.images.length - 1) {
          e.preventDefault();
          setModalRow(tableData.images[idx + 1]);
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          // Approve all pending for this image
          const pending = tableData.categories
            .map((cat) => modalRow.annotations[String(cat.id)])
            .filter((cell) => cell && !cell.review_status);
          if (pending.length > 0) {
            Promise.all(pending.map((cell) => handleApprove(cell.annotation_id))).then(() => refreshData());
          }
          return;
        }
        return;
      }

      // Table-specific shortcuts (no modal)
      if (viewMode === 'table' && tableData && tableData.images.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIdx((prev) => Math.min(prev + 1, tableData.images.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIdx((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === 'Enter' && highlightedIdx >= 0) {
          e.preventDefault();
          setModalRow(tableData.images[highlightedIdx]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedRows(new Set());
          setHighlightedIdx(-1);
          return;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalRow, tableData, viewMode, highlightedIdx, refreshData]);

  if ((viewMode === 'cards' ? loading : tableLoading) && !stats) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  const tableTotalPages = tableData ? Math.max(1, Math.ceil(tableData.total_images / tableData.page_size)) : 1;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Review', value: stats.pending_review, key: 'pending', active: 'border-amber-400 bg-amber-50' },
            { label: 'Approved', value: stats.approved, key: 'approved', active: 'border-green-400 bg-green-50' },
            { label: 'Total Completed', value: stats.total_completed, key: null, active: '' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => s.key && handleFilterChange(s.key)}
              className={`p-4 rounded-xl border text-left transition ${
                s.key === filter ? s.active : 'border-gray-200 bg-white hover:border-gray-300'
              } ${s.key ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[
            { key: 'table', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" /></svg>
            ), label: 'Table' },
            { key: 'cards', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            ), label: 'Cards' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                viewMode === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Status filters */}
        <div className="flex gap-1.5">
          {['pending', 'approved'].map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer capitalize ${
                filter === f
                  ? f === 'pending' ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Category filter — only in cards mode */}
        {viewMode === 'cards' && (
          <select
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select
          value={annotatorFilter}
          onChange={(e) => { setAnnotatorFilter(e.target.value); setPage(1); setTablePage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none"
        >
          <option value="">All Annotators</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
        </select>

        {/* Shortcuts hint */}
        <button
          onClick={() => setShowShortcuts(true)}
          className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 cursor-pointer"
        >
          ? Shortcuts
        </button>
      </div>

      {/* ─── TABLE VIEW ──────────────────────────────────── */}
      {viewMode === 'table' && (
        <>
          {tableLoading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : !tableData || tableData.images.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No annotations found for this filter.</div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-left">
                        {/* Select-all checkbox */}
                        <th className="px-2 py-3 w-10 sticky left-0 bg-gray-50 z-20">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRows.size === tableData.images.length && tableData.images.length > 0}
                              onChange={toggleSelectAll}
                              className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                            />
                          </label>
                        </th>
                        <th className="px-3 py-3 font-medium sticky left-10 bg-gray-50 z-20 min-w-[200px] border-r border-gray-200">Image</th>
                        {tableData.categories.map((cat) => (
                          <th key={cat.id} className="px-3 py-3 font-medium min-w-[170px] max-w-[240px]">
                            <span className="truncate block">{cat.name}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tableData.images.map((row, rowIdx) => {
                        const isHighlighted = rowIdx === highlightedIdx;
                        const isSelected = selectedRows.has(row.image_id);
                        return (
                          <tr
                            key={row.image_id}
                            className={`transition-colors ${isHighlighted ? 'bg-indigo-50/60' : isSelected ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}`}
                            onClick={() => setHighlightedIdx(rowIdx)}
                          >
                            {/* Row checkbox */}
                            <td className="px-2 py-2 sticky left-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRowSelect(row.image_id)}
                                  className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                                />
                              </label>
                            </td>
                            {/* Sticky image column */}
                            <td className="px-3 py-2 sticky left-10 bg-white z-10 border-r border-gray-200">
                              <div
                                className="flex items-center gap-2.5 cursor-zoom-in"
                                onClick={() => setModalRow(row)}
                              >
                                <img src={row.image_url} alt={row.image_filename} className="w-14 h-14 rounded-lg object-cover shrink-0 ring-1 ring-gray-200" />
                                <span className="text-xs font-medium text-gray-800 truncate max-w-[110px]">{row.image_filename}</span>
                              </div>
                            </td>
                            {/* Category cells */}
                            {tableData.categories.map((cat) => {
                              const cell = row.annotations[String(cat.id)];
                              const isEditingThis = editingCell && editingCell.imageId === row.image_id && editingCell.catId === cat.id;
                              if (!cell) {
                                return (
                                  <td key={cat.id} className="px-3 py-2 text-center">
                                    <span className="text-gray-300">--</span>
                                  </td>
                                );
                              }
                              return (
                                <td key={cat.id} className="px-3 py-2 relative">
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setEditingCell(isEditingThis ? null : { imageId: row.image_id, catId: cat.id }); }}
                                    className={`cursor-pointer rounded-lg p-1.5 transition border ${
                                      cell.review_status === 'approved'
                                        ? 'border-green-200 bg-green-50/50 hover:border-green-300'
                                        : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cell.review_status === 'approved' ? 'bg-green-500' : 'bg-amber-400'}`} />
                                      <span className="text-[10px] text-gray-500 truncate">{cell.annotator_username}</span>
                                      {cell.is_duplicate === true && (
                                        <span className="ml-auto px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded">D</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-0.5">
                                      {cell.selected_options.length === 0 ? (
                                        <span className="text-gray-400 italic">none</span>
                                      ) : (
                                        cell.selected_options.map((opt) => (
                                          <span key={opt.id} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-medium leading-tight">
                                            {opt.label}
                                          </span>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  {isEditingThis && (
                                    <CellEditPopover
                                      cell={cell}
                                      onSave={(annId, sels, dup) => handleSaveEditsAndRefresh(annId, sels, dup)}
                                      onApprove={(annId) => { setEditingCell(null); handleApproveAndRefresh(annId); }}
                                      onClose={() => setEditingCell(null)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  Showing {((tablePage - 1) * (tableData.page_size)) + 1}--{Math.min(tablePage * tableData.page_size, tableData.total_images)} of {tableData.total_images} images
                </span>
                <Pagination currentPage={tablePage} totalPages={tableTotalPages} onPageChange={setTablePage} />
              </div>
            </>
          )}
        </>
      )}

      {/* ─── CARDS VIEW ──────────────────────────────────── */}
      {viewMode === 'cards' && (
        <>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : annotations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No annotations found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {annotations.map((a) => {
                const isEditing = editingId === a.id;
                const selectedIds = a.selected_options.map((o) => o.id);
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-start gap-4 p-4">
                      <img
                        src={a.image_url}
                        alt={a.image_filename}
                        className="w-28 h-28 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{a.image_filename}</span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{a.category_name}</span>
                          {a.review_status === 'approved' ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Approved</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Pending</span>
                          )}
                          {a.is_duplicate === true && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Duplicate</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          Annotated by <span className="font-medium">{a.annotator_username}</span>
                        </p>

                        {!isEditing && (
                          <div className="flex flex-wrap gap-1.5">
                            {a.all_options.map((opt) => {
                              const isSelected = selectedIds.includes(opt.id);
                              return (
                                <span
                                  key={opt.id}
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    isSelected
                                      ? 'bg-indigo-100 text-indigo-800 font-medium'
                                      : 'bg-gray-50 text-gray-400'
                                  }`}
                                >
                                  {isSelected && '✓ '}{opt.label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {a.review_note && !isEditing && (
                          <div className="mt-2 px-3 py-1.5 bg-gray-50 rounded text-xs text-gray-600 border-l-2 border-gray-300">
                            <span className="font-medium">Note:</span> {a.review_note}
                            {a.reviewed_by_username && <span className="text-gray-400"> — {a.reviewed_by_username}</span>}
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="shrink-0 flex flex-col gap-2">
                          {!a.review_status && (
                            <button
                              onClick={() => handleApproveAndRefresh(a.id)}
                              className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => startEditing(a)}
                            className="px-3 py-1.5 border border-indigo-300 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 cursor-pointer"
                          >
                            Edit & Approve
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="border-t border-gray-200 px-4 py-4 bg-indigo-50/50">
                        <p className="text-xs font-medium text-gray-700 mb-3">Edit selections (changes will be saved and approved):</p>
                        <div className="space-y-1.5 mb-4">
                          {a.all_options.map((opt) => {
                            const checked = editSelections.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition text-sm ${
                                  checked
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEditOption(opt.id)}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'
                                }`}>
                                  {checked && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-sm">{opt.label}</span>
                                {opt.is_typical && (
                                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">typical</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSaveEditsAndRefresh(a.id, editSelections, editDuplicate)}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 cursor-pointer"
                          >
                            Save & Approve
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Floating bulk approve bar ──────────────────── */}
      {selectedRows.size > 0 && viewMode === 'table' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-sm">
            <span className="font-bold">{selectedRows.size}</span> image{selectedRows.size > 1 ? 's' : ''} selected
            {selectedPendingCount > 0 && <span className="text-gray-400 ml-1">({selectedPendingCount} pending annotations)</span>}
          </span>
          {selectedPendingCount > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkApproving}
              className="px-4 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer"
            >
              {bulkApproving ? 'Approving...' : `Approve ${selectedPendingCount} Annotations`}
            </button>
          )}
          <button
            onClick={() => setSelectedRows(new Set())}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* ─── Detail modal ──────────────────────────────── */}
      {modalRow && tableData && (
        <ImageDetailModal
          row={modalRow}
          categories={tableData.categories}
          tableImages={tableData.images}
          onApprove={async (annId) => { await handleApprove(annId); refreshData(); }}
          onSaveEdits={async (annId, sels, dup) => { await handleSaveEdits(annId, sels, dup); refreshData(); }}
          onClose={() => setModalRow(null)}
          onNavigate={(newRow) => setModalRow(newRow)}
        />
      )}

      {/* Shortcuts help */}
      <ShortcutsHelp show={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const { user, logout } = useAuth();

  const tabs = [
    { key: 'users', label: 'Users & Assignments' },
    { key: 'progress', label: 'Progress' },
    { key: 'review', label: 'Review' },
    { key: 'completion', label: 'Image Status' },
    { key: 'images', label: 'Images' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">{user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs bar */}
      <div className="mx-auto px-6 pt-6">
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0 overflow-hidden">
          <Tabs active={activeTab} onChange={setActiveTab} tabs={tabs} />
        </div>
      </div>

      {/* Tab content */}
      <main className="px-6 pb-6">
        <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl shadow-sm overflow-hidden">
          <div className={activeTab === 'review' ? 'p-4' : 'p-6'}>
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'progress' && <ProgressTab />}
            {activeTab === 'review' && <ReviewTab />}
            {activeTab === 'completion' && <ImageCompletionTab />}
            {activeTab === 'images' && <ImagesTab />}
          </div>
        </div>
      </main>
    </div>
  );
}
