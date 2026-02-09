import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import AnnotatorHome from './pages/AnnotatorHome';
import AnnotationPage from './pages/AnnotationPage';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  return <Navigate to="/annotator" />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/annotator"
          element={
            <ProtectedRoute role="annotator">
              <AnnotatorHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/annotator/category/:categoryId"
          element={
            <ProtectedRoute role="annotator">
              <AnnotationPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
