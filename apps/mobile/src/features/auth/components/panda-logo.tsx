import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';
import { brand } from '@/lib/brand';

/** Viền đầu panda nhìn thẳng (hệ toạ độ gốc của bản thiết kế). */
const HEAD = 'M128 22 C 168 22, 192 30, 192 70 C 192 110, 170 126, 128 126 C 86 126, 64 110, 64 70 C 64 30, 88 22, 128 22 Z';
const VIEW_BOX = '48 -12 160 160';
const INK = '#111111';
const SHADE = '#D7ECD0';
const PAD = '#FF8FB1';

/** Mặt panda nhìn thẳng — dùng làm logo. */
export function PandaFace({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      <Defs>
        <ClipPath id="pandaFaceHead">
          <Path d={HEAD} />
        </ClipPath>
      </Defs>
      <Circle cx={82} cy={32} r={21} fill={INK} />
      <Circle cx={174} cy={32} r={21} fill={INK} />
      <Path d={HEAD} fill="#FFFFFF" />
      <G clipPath="url(#pandaFaceHead)">
        <Ellipse cx={72} cy={76} rx={16} ry={50} fill={SHADE} />
      </G>
      <Path d={HEAD} fill="none" stroke={INK} strokeWidth={5} />
      <Ellipse cx={106} cy={74} rx={21} ry={19} rotation={-12} origin="106, 74" fill={INK} />
      <Ellipse cx={150} cy={74} rx={21} ry={19} rotation={12} origin="150, 74" fill={INK} />
      <Circle cx={109} cy={71} r={6.5} fill="#FFFFFF" />
      <Circle cx={147} cy={71} r={6.5} fill="#FFFFFF" />
      <Path d="M121 92 Q128 88 135 92 Q132 99 128 100 Q124 99 121 92 Z" fill={INK} />
      <Path d="M114 106 q7 7 14 0 q7 7 14 0" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Hai bàn tay che mắt — cùng hệ toạ độ với PandaFace để chồng khít lên mắt. */
function PandaPaws({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      <Path d="M100 90 L92 156 M156 90 L164 156" stroke="#FFFFFF" strokeWidth={28} strokeLinecap="round" />
      <Path d="M100 90 L92 156 M156 90 L164 156" stroke="#2A2A2A" strokeWidth={22} strokeLinecap="round" />
      <Ellipse cx={104} cy={76} rx={25} ry={21} fill="#2A2A2A" stroke="#FFFFFF" strokeWidth={3} />
      <Ellipse cx={152} cy={76} rx={25} ry={21} fill="#2A2A2A" stroke="#FFFFFF" strokeWidth={3} />
      <Circle cx={92} cy={66} r={4} fill={PAD} />
      <Circle cx={104} cy={62} r={4} fill={PAD} />
      <Circle cx={116} cy={66} r={4} fill={PAD} />
      <Ellipse cx={104} cy={81} rx={9} ry={7} fill={PAD} />
      <Circle cx={140} cy={66} r={4} fill={PAD} />
      <Circle cx={152} cy={62} r={4} fill={PAD} />
      <Circle cx={164} cy={66} r={4} fill={PAD} />
      <Ellipse cx={152} cy={81} rx={9} ry={7} fill={PAD} />
    </Svg>
  );
}

interface PandaLogoProps {
  size?: number;
  /** true → panda đưa hai tay che mắt (đang nhập mật khẩu ở chế độ ẩn). */
  coverEyes?: boolean;
  /** Tăng giá trị này để panda lắc đầu một lần (đăng nhập thất bại). 0 = chưa lắc. */
  shakeKey?: number;
}

/** Logo Panda CMS: mặt panda trong ô xanh tre, biết che mắt và lắc đầu. */
function PandaLogoBase({ size = 84, coverEyes = false, shakeKey = 0 }: PandaLogoProps) {
  const [paw] = useState(() => new Animated.Value(coverEyes ? 1 : 0));
  const [shake] = useState(() => new Animated.Value(0));

  // Hai effect dưới chỉ điều khiển animation theo prop (không fetch dữ liệu).
  useEffect(() => {
    Animated.spring(paw, {
      toValue: coverEyes ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [coverEyes, paw]);

  useEffect(() => {
    if (!shakeKey) return;
    shake.setValue(0);
    Animated.timing(shake, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [shakeKey, shake]);

  const face = size * 0.9;
  const rotate = shake.interpolate({
    inputRange: [0, 0.12, 0.3, 0.48, 0.66, 0.84, 1],
    outputRange: ['0deg', '-16deg', '14deg', '-11deg', '7deg', '-3deg', '0deg'],
  });
  const pawY = paw.interpolate({ inputRange: [0, 1], outputRange: [face * 0.8, 0] });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Panda CMS"
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.27 }]}
    >
      <Animated.View
        style={{ width: face, height: face, transform: [{ rotate }], transformOrigin: '50% 85%' }}
      >
        <PandaFace size={face} />
        <Animated.View
          testID="panda-paws"
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: pawY }] }]}
        >
          <PandaPaws size={face} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Memo hoá để cha re-render (vd mở bàn phím) không bắt SVG logo vẽ lại vô ích. */
export const PandaLogo = memo(PandaLogoBase);

const styles = StyleSheet.create({
  badge: {
    backgroundColor: brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
