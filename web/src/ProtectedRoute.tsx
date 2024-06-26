import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from './api';

const ProtectedRoute = () => {
  const { isLoading, isSuccess } = api.useProfileQuery({});

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isSuccess) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
