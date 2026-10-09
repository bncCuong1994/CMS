import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/features/auth/login-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { DepartmentsPage } from '@/features/departments/departments-page';
import { UsersPage } from '@/features/users/users-page';
import { AppLayout } from './app-layout';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'departments', element: <DepartmentsPage /> },
    ],
  },
]);
