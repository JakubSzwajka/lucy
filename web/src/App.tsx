import React from 'react';
import './App.css';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Root from './routes/layouts/root';
import NotFound from './routes/notFound';
import Home from './routes/home';
import { Provider } from 'react-redux';
import { store } from './store';
import AuthLayout from './routes/layouts/auth';
import Register from './routes/auth/register';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from './routes/auth/login';
import ProtectedRoute from './ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <Register />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: <Root />,
        children: [
          {
            path: '/app/home',
            element: <Home />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

function App() {
  return (
    <React.StrictMode>
      <Provider store={store}>
        <Toaster />
        <RouterProvider router={router} />
      </Provider>
    </React.StrictMode>
  );
}

export default App;
