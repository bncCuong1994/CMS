import { router } from 'expo-router';
import { LoginScreen } from '@/features/auth/login-screen';

/** Route Đăng nhập: màn mở app (panda) + form; thành công → Trang chủ. */
export default function LoginRoute() {
  return <LoginScreen onSuccess={() => router.replace('/(app)/home')} />;
}
