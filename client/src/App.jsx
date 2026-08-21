import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HOME_FOR, useAuth } from './lib/auth.jsx';
import { Spinner } from './components/ui.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminApplication from './pages/AdminApplication.jsx';
import AdminProject from './pages/AdminProject.jsx';
import LeaderDashboard from './pages/LeaderDashboard.jsx';
import MemberDashboard from './pages/MemberDashboard.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="console grid min-h-screen place-items-center">
        <Spinner label="Restoring your session" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to={HOME_FOR[user.role]} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
      <Route
        path="/admin/applications/:id"
        element={<Protected role="admin"><AdminApplication /></Protected>}
      />
      <Route
        path="/admin/projects/:id"
        element={<Protected role="admin"><AdminProject /></Protected>}
      />

      <Route path="/leader" element={<Protected role="leader"><LeaderDashboard /></Protected>} />
      <Route path="/member" element={<Protected role="member"><MemberDashboard /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
