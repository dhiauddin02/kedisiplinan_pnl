import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Clustering from './components/Clustering';
import HasilClustering from './components/HasilClustering';
import Laporan from './components/Laporan';
import ClusteringPribadi from './components/ClusteringPribadi';
import LengkapiData from './components/LengkapiData';
import GantiPassword from './components/GantiPassword';
import { getCurrentUser } from './lib/auth';

function App() {
  const user = getCurrentUser();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
          {/* Admin Routes */}
          {user?.level_user === 1 && (
            <>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clustering" element={<Clustering />} />
              <Route path="hasil-clustering" element={<HasilClustering />} />
              <Route path="laporan" element={<Laporan />} />
            </>
          )}
          
          {/* Student Routes */}
          {user?.level_user === 2 && (
            <>
              <Route index element={<Navigate to="/clustering-pribadi" replace />} />
              <Route path="clustering-pribadi" element={<ClusteringPribadi />} />
              <Route path="lengkapi-data" element={<LengkapiData />} />
            </>
          )}
          
          {/* Common Routes */}
          <Route path="ganti-password" element={<GantiPassword />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;