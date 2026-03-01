import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/authContext'; 
import Login from './pages/Login';
import Register from './pages/Register';

// 🚨 PRODUCTION FIX: Ensure this perfectly matches the actual file name case!
// If your file is 'Dashboard.jsx', this MUST be 'Dashboard', not 'dashboard'
import Dashboard from './pages/dashboard'; 
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider> 
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;