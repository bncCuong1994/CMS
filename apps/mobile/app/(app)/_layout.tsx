import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/features/auth/auth-store';

/** Chặn vùng (app): chưa có token hợp lệ → về màn Đăng nhập. */
export default function AppLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
