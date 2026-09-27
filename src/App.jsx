import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientRequest from './pages/ClientRequest';
import Warehouse from './pages/Warehouse';
import Stock from './pages/Stock';
import Logs from './pages/Logs';
import Users from './pages/Users';
import { getSession } from './session';

// Route guards. They only decide what the UI shows; the backend checks the
// session token and role on every request.
function RequireAuth({ children }) {
  if (!getSession().token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { token, role } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/client" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
        <Route path="/client" element={<RequireAuth><ClientRequest /></RequireAuth>} />
        <Route path="/warehouse" element={<RequireAdmin><Warehouse /></RequireAdmin>} />
        <Route path="/stock" element={<RequireAdmin><Stock /></RequireAdmin>} />
        <Route path="/logs" element={<RequireAdmin><Logs /></RequireAdmin>} />
        <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}