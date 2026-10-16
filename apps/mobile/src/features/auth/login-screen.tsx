import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/lib/brand';
import { BambooBackdrop } from './components/bamboo-backdrop';
import { PandaLogo } from './components/panda-logo';
import {
  PandaWalker,
  WALKER_HEAD_CENTER,
  WALKER_HEIGHT,
  WALKER_WIDTH,
} from './components/panda-walker';
import { LoginForm } from './login-form';

const LOGO_SIZE = 84;
/** Kích thước ô logo trong hệ toạ độ hình panda đi bộ (để thu nhỏ khớp vào logo). */
const WALKER_BADGE = 184;
const SLOGAN = Array.from("Let's get to work");

// Mốc thời gian màn mở app (ms) — khớp bản thiết kế.
const WALK_MS = 1950;
const LETTERS_AT = 1350;
const MORPH_AT = 2900;
const MORPH_MS = 800;

interface LoginScreenProps {
  onSuccess: () => void;
}

/**
 * Màn mở app + đăng nhập:
 * panda xách laptop đi vào từ mép phải → dừng giữa màn hình, hiện "Let's get to work"
 * → thu nhỏ thành logo trên cùng → form đăng nhập trượt lên.
 * Bật "Giảm chuyển động" trong iOS thì bỏ qua đoạn mở đầu.
 */
export function LoginScreen({ onSuccess }: LoginScreenProps) {
  // Kích thước màn lấy MỘT LẦN cho nền trang trí + hiệu ứng mở đầu.
  // KHÔNG dùng useWindowDimensions(): giá trị đó co lại khi bàn phím mở, khiến
  // LoginScreen + BambooBackdrop vẽ lại ngay giữa lúc focus → TextInput rớt focus.
  // Bàn phím vẫn được KeyboardAvoidingView/ScrollView xử lý riêng bên dưới.
  const [{ width, height }] = useState(() => Dimensions.get('window'));
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'intro' | 'form'>('intro');
  const [walking, setWalking] = useState(true);
  const [coverEyes, setCoverEyes] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const [walkX] = useState(() => new Animated.Value(width));
  const [morph] = useState(() => new Animated.Value(0));
  const [formIn] = useState(() => new Animated.Value(0));
  const [letters] = useState(() => SLOGAN.map(() => new Animated.Value(0)));

  // Chạy chuỗi animation mở đầu một lần khi vào màn (animation thuần, không fetch dữ liệu).
  useEffect(() => {
    let cancelled = false;
    const running: Animated.CompositeAnimation[] = [];
    const run = (anim: Animated.CompositeAnimation, done?: () => void) => {
      running.push(anim);
      anim.start(({ finished }) => {
        if (finished && !cancelled) done?.();
      });
    };

    const showForm = () => {
      setPhase('form');
      run(
        Animated.timing(formIn, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      );
    };

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        setWalking(false);
        morph.setValue(1);
        formIn.setValue(1);
        setPhase('form');
        return;
      }

      run(
        Animated.timing(walkX, {
          toValue: 0,
          duration: WALK_MS,
          easing: Easing.bezier(0.3, 0.45, 0.45, 1),
          useNativeDriver: true,
        }),
        () => setWalking(false),
      );
      run(
        Animated.sequence([
          Animated.delay(LETTERS_AT),
          Animated.stagger(
            45,
            letters.map((v) =>
              Animated.timing(v, {
                toValue: 1,
                duration: 450,
                easing: Easing.out(Easing.back(1.6)),
                useNativeDriver: true,
              }),
            ),
          ),
        ]),
      );
      run(
        Animated.sequence([
          Animated.delay(MORPH_AT),
          Animated.timing(morph, {
            toValue: 1,
            duration: MORPH_MS,
            easing: Easing.bezier(0.65, 0, 0.35, 1),
            useNativeDriver: true,
          }),
        ]),
        showForm,
      );
    });

    return () => {
      cancelled = true;
      running.forEach((a) => a.stop());
    };
  }, [walkX, morph, formIn, letters]);

  // Vị trí: panda đứng trên mặt đất ~64% chiều cao; logo nằm sát mép trên (dưới tai thỏ).
  const groundY = Math.round(height * 0.64);
  const walkerTop = groundY - 266;
  const walkerLeft = width / 2 - WALKER_HEAD_CENTER.x;
  const logoTop = insets.top + 22;
  const logoCenterY = logoTop + LOGO_SIZE / 2;
  const morphDy = logoCenterY - (walkerTop + WALKER_HEAD_CENTER.y);
  const morphScale = LOGO_SIZE / WALKER_BADGE;

  const veil = morph.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] });
  const logoOpacity = morph.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] });
  const walkerOpacity = morph.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0, 0] });
  const sloganOpacity = morph.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });

  return (
    <View style={styles.root}>
      {/* Nền luôn trắng nên ép chữ thanh trạng thái màu tối, kể cả khi máy bật Dark Mode. */}
      <StatusBar style="dark" />
      <BambooBackdrop width={width} height={height} groundY={groundY} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, { opacity: veil }]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: logoTop, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={phase === 'form'}
        >
          <Animated.View style={[styles.logo, { opacity: logoOpacity }]}>
            <PandaLogo size={LOGO_SIZE} coverEyes={coverEyes} shakeKey={shakeKey} />
          </Animated.View>

          <Animated.View
            pointerEvents={phase === 'form' ? 'auto' : 'none'}
            style={[
              styles.body,
              {
                opacity: formIn,
                transform: [{ translateY: formIn.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
              },
            ]}
          >
            <Text style={styles.brandName}>
              Panda <Text style={styles.brandAccent}>CMS</Text>
            </Text>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                Chào mừng trở lại
              </Text>
              <Text style={styles.subtitle}>Đăng nhập để bắt đầu ngày làm việc.</Text>
            </View>
            <LoginForm
              onSuccess={onSuccess}
              onCoverEyesChange={setCoverEyes}
              onLoginFailed={() => setShakeKey((k) => k + 1)}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {phase === 'intro' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.walker,
              {
                left: walkerLeft,
                top: walkerTop,
                opacity: walkerOpacity,
                transformOrigin: [WALKER_HEAD_CENTER.x, WALKER_HEAD_CENTER.y, 0],
                transform: [
                  { translateY: morph.interpolate({ inputRange: [0, 1], outputRange: [0, morphDy] }) },
                  { scale: morph.interpolate({ inputRange: [0, 1], outputRange: [1, morphScale] }) },
                ],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ translateX: walkX }] }}>
              <PandaWalker walking={walking} />
            </Animated.View>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.slogan, { top: groundY + 28, opacity: sloganOpacity }]}
            accessible
            accessibilityLabel="Let's get to work"
          >
            {SLOGAN.map((ch, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.sloganChar,
                  {
                    opacity: letters[i],
                    transform: [
                      { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                    ],
                  },
                ]}
              >
                {ch === ' ' ? ' ' : ch}
              </Animated.Text>
            ))}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  veil: { backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  logo: { alignItems: 'center' },
  body: { gap: 16, marginTop: 10 },
  brandName: { textAlign: 'center', fontSize: 26, fontWeight: '800', color: brand.ink, letterSpacing: -0.3 },
  brandAccent: { color: brand.accent },
  heading: { gap: 4, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: brand.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: brand.sub },
  walker: { position: 'absolute', width: WALKER_WIDTH, height: WALKER_HEIGHT },
  slogan: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  sloganChar: { fontSize: 34, fontWeight: '800', color: brand.ink, letterSpacing: -0.3 },
});
