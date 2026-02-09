import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function AnnotationPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [task, setTask] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isDuplicate, setIsDuplicate] = useState(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allDone, setAllDone] = useState(false);

  const savingRef = useRef(false);

  const loadTask = useCallback(async (index) => {
    setLoading(true);
    setError('');
    setAllDone(false);
    try {
      const res = await api.get(`/annotator/categories/${categoryId}/task/${index}`);
      const data = res.data;
      setTask(data);
      setQueueIndex(index);
      // Restore previous selections if any
      if (data.current_annotation) {
        setSelectedOptions(data.current_annotation.selected_option_ids || []);
        setIsDuplicate(data.current_annotation.is_duplicate);
      } else {
        setSelectedOptions([]);
        setIsDuplicate(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Could be "all done" or "index out of range"
        const detail = err.response?.data?.detail || '';
        if (detail.includes('all completed') || detail.includes('No images')) {
          setAllDone(true);
        } else {
          setError(detail || 'No more images.');
        }
      } else {
        setError(err.response?.data?.detail || 'Failed to load task');
      }
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    // Resume from where the annotator left off
    api.get(`/annotator/categories/${categoryId}/resume-index`)
      .then((res) => loadTask(res.data.index))
      .catch(() => loadTask(0));
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOption = (optionId) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  };

  const saveAnnotation = async (status) => {
    if (!task || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await api.put(`/annotator/categories/${categoryId}/images/${task.image_id}/annotate`, {
        selected_option_ids: selectedOptions,
        is_duplicate: isDuplicate,
        status,
      });
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
      return false;
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const handleNext = async () => {
    const ok = await saveAnnotation('completed');
    if (!ok) return;

    // The completed image stays in the queue (annotator touched it),
    // so advance to the next index.
    const nextIndex = queueIndex + 1;
    try {
      const res = await api.get(`/annotator/categories/${categoryId}/queue-size`);
      const newSize = res.data.queue_size;

      if (newSize === 0 || nextIndex >= newSize) {
        // Check if there are unannotated images left via resume-index
        const resumeRes = await api.get(`/annotator/categories/${categoryId}/resume-index`);
        if (resumeRes.data.queue_size === 0) {
          setAllDone(true);
          return;
        }
        // If all images in the queue are completed, we're done
        const resumeIdx = resumeRes.data.index;
        // Check if the resume image is already completed (meaning all are done)
        loadTask(resumeIdx);
        return;
      }

      loadTask(nextIndex);
    } catch {
      navigate('/annotator');
    }
  };

  const handleSkip = async () => {
    // Only save as "skipped" if the image is NOT already completed.
    // Otherwise just navigate without overwriting the completed annotation.
    const alreadyCompleted = task?.current_annotation?.status === 'completed';
    if (!alreadyCompleted) {
      const ok = await saveAnnotation('skipped');
      if (!ok) return;
    }

    // Move to next image
    if (queueIndex < task.total_images - 1) {
      loadTask(queueIndex + 1);
    } else {
      // Past the end — use resume-index to find next unannotated, or finish
      try {
        const res = await api.get(`/annotator/categories/${categoryId}/resume-index`);
        if (res.data.queue_size === 0) {
          setAllDone(true);
        } else {
          loadTask(res.data.index);
        }
      } catch {
        navigate('/annotator');
      }
    }
  };

  const handleBack = () => {
    if (queueIndex > 0) {
      loadTask(queueIndex - 1);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (savingRef.current) return;
      if ((e.key === 'ArrowRight' || e.key === 'Enter') && selectedOptions.length > 0) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold text-gray-900">All done!</h2>
          <p className="text-gray-500 mt-1">All images for this category have been annotated.</p>
        </div>
        <button
          onClick={() => navigate('/annotator')}
          className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer text-sm font-medium"
        >
          Back to categories
        </button>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={() => navigate('/annotator')} className="text-indigo-600 hover:underline cursor-pointer">
          Back to categories
        </button>
      </div>
    );
  }

  const progress = task ? Math.round(((queueIndex + 1) / task.total_images) * 100) : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/annotator')}
              className="text-gray-500 hover:text-gray-900 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">{task?.category_name}</h1>
              <p className="text-xs text-gray-500">
                Image {queueIndex + 1} of {task?.total_images} remaining &middot; {user?.username}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 py-2 min-h-0" style={{ height: 'calc(100vh - 58px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-full">
          {/* Left: Image — fills all remaining space */}
          <div className="bg-gray-900 rounded-xl overflow-hidden relative min-h-0">
            <img
              src={task?.image_url}
              alt={task?.image_filename}
              className="absolute inset-0 w-full h-full object-contain"
              loading="eager"
            />
          </div>

          {/* Right: Options form — fixed width sidebar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col overflow-y-auto min-h-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{task?.category_name}</h2>
            <p className="text-sm text-gray-500 mb-5">Select all that apply</p>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {/* Options as pill-like checkboxes */}
            <div className="flex-1 space-y-2.5">
              {task?.options.map((opt) => {
                const isSelected = selectedOptions.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(opt.id)}
                      className="sr-only"
                    />
                    <div
                      className={`
                        w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all
                        ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}
                      `}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    {opt.is_typical && (
                      <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        typical
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Is Duplicate */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Is Duplicate?</p>
              <div className="flex gap-3">
                {[
                  { value: null, label: 'Not set', color: 'gray' },
                  { value: false, label: 'No', color: 'green' },
                  { value: true, label: 'Yes', color: 'red' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setIsDuplicate(opt.value)}
                    className={`
                      px-4 py-1.5 rounded-full text-sm font-medium border-2 transition cursor-pointer
                      ${isDuplicate === opt.value
                        ? opt.color === 'red'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : opt.color === 'green'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-400 bg-gray-100 text-gray-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Already annotated indicator */}
            {task?.current_annotation?.status === 'completed' && (
              <div className="mt-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
                You already completed this image. Changes will update your annotation.
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={handleBack}
                disabled={queueIndex === 0 || saving}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-medium"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSkip}
                disabled={saving}
                className="px-5 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition disabled:opacity-50 cursor-pointer text-sm font-medium"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={saving || selectedOptions.length === 0}
                className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Save & Next \u2192'}
              </button>
            </div>

            {/* Keyboard shortcut hints */}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">&larr;</kbd> Back</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">S</kbd> Skip</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">&rarr;</kbd> Save & Next</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
