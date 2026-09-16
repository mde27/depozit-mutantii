import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientRequest from './pages/ClientRequest';
import Warehouse from './pages/Warehouse';
import Stock from './pages/Stock';
import Logs from './pages/Logs';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/client" element={<ClientRequest />} />
        <Route path="/warehouse" element={<Warehouse />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </BrowserRouter>
  );
}