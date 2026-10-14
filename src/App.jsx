import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientRequest from './pages/ClientRequest';
import Warehouse from './pages/Warehouse';
import Stock from './pages/Stock';
import Logs from './pages/Logs';
import Users from './pages/Users';
import { getSession } from './session';
import { TRANSPORT_ROLE } from './utils/roles';

// Route guards. They only decide what the UI shows; the backend checks the
// session token and role on every request.
// New Request (needs the stock list): every logged-in role except Transportator.
function RequireOrderer({ children }) {
  const { token, role } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  if (role === TRANSPORT_ROLE) return <Navigate to="/tickets" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { token, role } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to={role === TRANSPORT_ROLE ? '/tickets' : '/client'} replace />;
  return children;
}

// /tickets: read-only ticket list for Type A / B / C and Transportator. Admins use /warehouse (Management).
function TicketsView() {
  const { token, role } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/warehouse" replace />;
  return <Warehouse readOnly />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
        <Route path="/client" element={<RequireOrderer><ClientRequest /></RequireOrderer>} />
        <Route path="/warehouse" element={<RequireAdmin><Warehouse /></RequireAdmin>} />
        <Route path="/tickets" element={<TicketsView />} />
        <Route path="/stock" element={<RequireAdmin><Stock /></RequireAdmin>} />
        <Route path="/logs" element={<RequireAdmin><Logs /></RequireAdmin>} />
        <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}