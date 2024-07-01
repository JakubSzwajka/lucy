import React from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Root from './routes/layouts/root';
import NotFound from './routes/notFound';
import Home from './routes/home/home';
import { Provider } from 'react-redux';
import { store } from './store';
import AuthLayout from './routes/layouts/auth';
import Register from './routes/auth/register';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from './routes/auth/login';
import ProtectedRoute from './ProtectedRoute';
import { TooltipProvider } from '@/components/ui/tooltip';
import Messages from './routes/app/messages/messages';
import { ThemeProvider } from '@/components/theme-provider';

export const ROUTES = {
  base: '/',
  auth: {
    base: '/',
    login: '/login',
    register: '/register',
  },
  app: {
    base: '/app',
    messages: '/app/messages',
  },
  all: '*',
};

const router = createBrowserRouter([
  {
    path: ROUTES.auth.base,
    element: <AuthLayout />,
    children: [
      {
        path: ROUTES.auth.login,
        element: <LoginPage />,
      },
      {
        path: ROUTES.auth.register,
        element: <Register />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.base,
        element: <Root />,
        children: [
          {
            path: ROUTES.app.base,
            element: <Home />,
          },
          {
            path: ROUTES.app.messages,
            element: <Messages />,
          },
        ],
      },
    ],
  },
  {
    path: ROUTES.all,
    element: <NotFound />,
  },
]);

function App() {
  return (
    <React.StrictMode>
      <Provider store={store}>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <TooltipProvider>
            <Toaster />
            <RouterProvider router={router} />
          </TooltipProvider>
        </ThemeProvider>
      </Provider>
    </React.StrictMode>
  );
}

export default App;
