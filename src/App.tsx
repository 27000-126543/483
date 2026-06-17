import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initializeAuth, useAuthStore } from './store/authStore.js';
import { useMessageStore } from './store/messageStore.js';
import { initSocket, disconnectSocket } from './lib/socket.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import Layout from './components/Layout.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Appointments from './pages/Appointments.js';
import Pets from './pages/Pets.js';
import Medical from './pages/Medical.js';
import Pharmacy from './pages/Pharmacy.js';
import Payments from './pages/Payments.js';
import Complaints from './pages/Complaints.js';
import Messages from './pages/Messages.js';
import Reports from './pages/Reports.js';

export default function App() {
  const user = useAuthStore(state => state.user);
  const initListener = useMessageStore(state => state.initListener);
  const getUnreadCount = useMessageStore(state => state.getUnreadCount);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      initSocket(user.id);
      const cleanup = initListener();
      getUnreadCount();
      return () => {
        cleanup();
        disconnectSocket();
      };
    }
  }, [user, initListener, getUnreadCount]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/appointments" element={
          <ProtectedRoute roles={['owner', 'doctor', 'manager']}>
            <Layout><Appointments /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/pets" element={
          <ProtectedRoute roles={['owner']}>
            <Layout><Pets /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/medical" element={
          <ProtectedRoute roles={['doctor', 'owner']}>
            <Layout><Medical /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/pharmacy" element={
          <ProtectedRoute roles={['pharmacist', 'manager']}>
            <Layout><Pharmacy /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/payments" element={
          <ProtectedRoute roles={['owner', 'manager']}>
            <Layout><Payments /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/complaints" element={
          <ProtectedRoute roles={['owner', 'manager']}>
            <Layout><Complaints /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/messages" element={
          <ProtectedRoute roles={['owner', 'doctor', 'pharmacist', 'manager']}>
            <Layout><Messages /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/reports" element={
          <ProtectedRoute roles={['manager']}>
            <Layout><Reports /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
