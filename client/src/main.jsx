import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { session } from './api.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AssistantChat from './pages/AssistantChat.jsx';

function Protected({ children }) {
  return session.get() ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        {/* Public, no login: this is what the iframe / embed script loads */}
        <Route path="/assistant/:token" element={<AssistantChat />} />
        <Route path="*" element={<Navigate to={session.get() ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
