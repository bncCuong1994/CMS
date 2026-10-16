import { memo, type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Kích thước gốc của hình panda đi bộ (đơn vị = pt). */
export const WALKER_WIDTH = 260;
export const WALKER_HEIGHT = 280;
/** Tâm đầu panda trong hệ toạ độ của hình — dùng để thu nhỏ hình về đúng chỗ logo. */
export const WALKER_HEAD_CENTER = { x: 128, y: 68 };

const INK = '#111111';
const SHADE = '#D7ECD0';
const HEAD = 'M128 22 C 168 22, 192 30, 192 70 C 192 110, 170 126, 128 126 C 86 126, 64 110, 64 70 C 64 30, 88 22, 128 22 Z';
const STEP = [0, 0.25, 0.5, 0.75, 1];

/** Một lớp SVG phủ kín khung hình; mỗi bộ phận chuyển động nằm ở lớp riêng. */
function Layer({ children }: { children: ReactNode }) {
  return (
    <Svg
      width={WALKER_WIDTH}
      height={WALKER_HEIGHT}
      viewBox={`0 0 ${WALKER_WIDTH} ${WALKER_HEIGHT}`}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </Svg>
  );
}

interface PandaWalkerProps {
  /** true → chạy chu kỳ bước chân; false → đứng yên. */
  walking: boolean;
}

/**
 * Panda đi bộ sang trái: thân nhìn nghiêng, mặt xoay ba phần tư về phía người xem,
 * kẹp laptop bên hông và đeo cặp chéo xanh tre.
 */
function PandaWalkerBase({ walking }: PandaWalkerProps) {
  const [cycle] = useState(() => new Animated.Value(0));

  // Bật/tắt vòng lặp bước chân theo prop (animation thuần, không fetch dữ liệu).
  useEffect(() => {
    if (!walking) {
      cycle.stopAnimation();
      Animated.timing(cycle, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      return undefined;
    }
    cycle.setValue(0);
    const loop = Animated.loop(
      Animated.timing(cycle, {
        toValue: 1,
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [walking, cycle]);

  const legNear = cycle.interpolate({ inputRange: STEP, outputRange: ['0deg', '22deg', '0deg', '-22deg', '0deg'] });
  const legFar = cycle.interpolate({ inputRange: STEP, outputRange: ['0deg', '-22deg', '0deg', '22deg', '0deg'] });
  const bob = cycle.interpolate({ inputRange: STEP, outputRange: [0, -5, 0, -5, 0] });
  const lift = cycle.interpolate({ inputRange: STEP, outputRange: [0, 3, 0, 3, 0] });
  const sway = cycle.interpolate({ inputRange: STEP, outputRange: ['0deg', '2deg', '0deg', '-2deg', '0deg'] });
  const shadow = cycle.interpolate({ inputRange: STEP, outputRange: [1, 0.88, 1, 0.88, 1] });

  return (
    <View
      style={styles.frame}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Panda xách laptop đang đi làm"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleX: shadow }] }]}>
        <Layer>
          <Ellipse cx={128} cy={266} rx={58} ry={7} fill="rgba(17,17,17,0.14)" />
        </Layer>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: bob }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: legFar }], transformOrigin: [136, 207, 0] }]}>
          <Layer>
            <Ellipse cx={136} cy={232} rx={15} ry={25} fill="#333333" />
            <Ellipse cx={124} cy={255} rx={20} ry={10} fill="#333333" />
          </Layer>
        </Animated.View>

        <Layer>
          <Defs>
            <ClipPath id="pandaWalkerBody">
              <Ellipse cx={132} cy={164} rx={40} ry={50} />
            </ClipPath>
          </Defs>
          <Ellipse cx={132} cy={164} rx={40} ry={50} fill="#FFFFFF" />
          <G clipPath="url(#pandaWalkerBody)">
            <Ellipse cx={168} cy={160} rx={16} ry={48} fill={SHADE} />
            <Rect x={80} y={192} width={110} height={40} fill={INK} />
          </G>
          <Ellipse cx={132} cy={164} rx={40} ry={50} fill="none" stroke={INK} strokeWidth={5} />
        </Layer>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: legNear }], transformOrigin: [128, 207, 0] }]}>
          <Layer>
            <Ellipse cx={128} cy={232} rx={15} ry={25} fill={INK} />
            <Ellipse cx={116} cy={255} rx={20} ry={10} fill={INK} />
          </Layer>
        </Animated.View>

        <Layer>
          <Path d="M120 124 Q150 150 176 190" stroke={INK} strokeWidth={11} fill="none" strokeLinecap="round" />
          <Path d="M120 124 Q150 150 176 190" stroke="#2F9E5B" strokeWidth={5.5} fill="none" strokeLinecap="round" />
        </Layer>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: sway }], transformOrigin: [156, 190, 0] }]}>
          <Layer>
            <Path d="M156 196 Q156 186 166 186 L198 186 Q208 186 208 196 L206 222 Q205 230 196 230 L168 230 Q158 230 157 222 Z" fill="#2F9E5B" stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
            <Path d="M156 196 Q156 186 166 186 L198 186 Q208 186 208 196 L206 210 Q182 217 158 210 Z" fill="#3FB56C" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
            <Rect x={175} y={204} width={13} height={11} rx={3} fill="#FFC83D" stroke={INK} strokeWidth={3} />
          </Layer>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: lift }] }]}>
          <Layer>
            <Ellipse cx={117} cy={158} rx={12} ry={24} rotation={25} origin="117, 158" fill={INK} />
            <G rotation={-4} origin="117, 198">
              <Rect x={84} y={216} width={66} height={7} rx={3.5} fill="#A9AFB8" stroke={INK} strokeWidth={3} />
              <Rect x={84} y={176} width={66} height={44} rx={6} fill="#D3D7DD" stroke={INK} strokeWidth={4} />
              <Path d="M91 183 h34" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
              <Path d="M110 206 Q108 193 124 190 Q126 204 110 206 Z" fill="#2F9E5B" />
              <Path d="M111 205 L121 194" stroke="#1E7A45" strokeWidth={1.6} strokeLinecap="round" />
            </G>
            <Circle cx={108} cy={178} r={10} fill={INK} />
          </Layer>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: sway }], transformOrigin: [128, 120, 0] }]}>
          <Layer>
            <Defs>
              <ClipPath id="pandaWalkerHead">
                <Path d={HEAD} />
              </ClipPath>
            </Defs>
            <Circle cx={80} cy={32} r={21} fill={INK} />
            <Circle cx={170} cy={30} r={20} fill={INK} />
            <Path d={HEAD} fill="#FFFFFF" />
            <G clipPath="url(#pandaWalkerHead)">
              <Ellipse cx={188} cy={78} rx={18} ry={52} fill={SHADE} />
            </G>
            <Path d={HEAD} fill="none" stroke={INK} strokeWidth={5} />
            <Ellipse cx={96} cy={74} rx={20} ry={19} rotation={-12} origin="96, 74" fill={INK} />
            <Ellipse cx={139} cy={74} rx={19} ry={18} rotation={12} origin="139, 74" fill={INK} />
            <Circle cx={97} cy={71} r={6.5} fill="#FFFFFF" />
            <Circle cx={135} cy={71} r={6} fill="#FFFFFF" />
            <Path d="M108 92 Q115 88 122 92 Q119 99 115 100 Q111 99 108 92 Z" fill={INK} />
            <Path d="M101 106 q7 7 14 0 q7 7 14 0" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </Layer>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Memo hoá để cha re-render (vd mở bàn phím) không bắt SVG panda vẽ lại vô ích. */
export const PandaWalker = memo(PandaWalkerBase);

const styles = StyleSheet.create({
  frame: { width: WALKER_WIDTH, height: WALKER_HEIGHT },
});
