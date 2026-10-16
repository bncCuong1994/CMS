import { Fragment, memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

interface Stalk {
  /** Vị trí theo tỉ lệ chiều ngang màn hình (0–1). */
  at: number;
  w: number;
  fill: string;
  node: string;
  seg: number;
  leaf: string;
}

const STALKS: Stalk[] = [
  // Lớp xa: mảnh, nhạt.
  ...[0.04, 0.17, 0.31, 0.46, 0.61, 0.75, 0.9].map((at) => ({ at, w: 10, fill: '#DDF1E2', node: '#CBE8D3', seg: 64, leaf: '#D2EDD9' })),
  // Lớp giữa.
  ...[0.1, 0.37, 0.6, 0.84].map((at) => ({ at, w: 17, fill: '#A6DCB3', node: '#86C998', seg: 86, leaf: '#8FD3A1' })),
  // Lớp gần: to, đậm.
  ...[0.0, 0.5].map((at) => ({ at, w: 28, fill: '#4DB173', node: '#36955B', seg: 112, leaf: '#3FA866' })),
];

interface BambooBackdropProps {
  width: number;
  height: number;
  /** Toạ độ y của mặt đất nơi panda bước. */
  groundY: number;
}

/** Nền rừng trúc trời trắng của màn mở app (thuần trang trí). */
function BambooBackdropBase({ width, height, groundY }: BambooBackdropProps) {
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
      {STALKS.map((s, i) => {
        const x = Math.round(s.at * width) - (i % 2) * 6;
        const nodes = [];
        for (let y = s.seg - 4 - (i % 3) * 14; y < groundY; y += s.seg) nodes.push(y);
        const leafY = 90 + ((i * 53) % 160);
        return (
          <Fragment key={i}>
            <Rect x={x} y={-10} width={s.w} height={groundY + 20} rx={s.w / 2} fill={s.fill} />
            {nodes.map((y) => (
              <Rect key={y} x={x} y={y} width={s.w} height={4} fill={s.node} />
            ))}
            <Path
              d={`M${x + s.w - 2} ${leafY} q${s.w * 1.2} ${-s.w * 0.9} ${s.w * 2} ${-s.w * 0.3} q${-s.w * 0.9} ${s.w * 0.8} ${-s.w * 2} ${s.w * 0.3} z`}
              fill={s.leaf}
            />
            <Path
              d={`M${x + 2} ${leafY + 150} q${-s.w * 1.2} ${-s.w * 0.9} ${-s.w * 2} ${-s.w * 0.3} q${s.w * 0.9} ${s.w * 0.8} ${s.w * 2} ${s.w * 0.3} z`}
              fill={s.leaf}
            />
          </Fragment>
        );
      })}
      <Path
        d={`M-40 ${groundY + 46} Q ${width / 2} ${groundY - 46} ${width + 40} ${groundY + 46} L ${width + 40} ${height} L -40 ${height} Z`}
        fill="#E4F4E8"
      />
    </Svg>
  );
}

/**
 * Memo hoá: nền chỉ vẽ lại khi kích thước màn thực sự đổi (xoay máy), KHÔNG vẽ lại
 * khi cha re-render lúc mở bàn phím — tránh làm TextInput rớt focus.
 */
export const BambooBackdrop = memo(BambooBackdropBase);
