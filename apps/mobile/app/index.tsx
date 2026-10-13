import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/auth-store';

/** Điểm vào: có token → Trang chủ, chưa có → Đăng nhập. */
export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return <Redirect href={accessToken ? '/(app)/home' : '/(auth)/login'} />;
}
