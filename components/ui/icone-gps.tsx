import Svg, { Path, Text } from 'react-native-svg';

interface IconeGpsProps {
  size?: number;
  color?: string;
}

export function IconeGps({ size = 24, color = '#FF6B00' }: IconeGpsProps) {
  const s = size / 60;
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 60 78">
      <Path
        d="M30,2 C16,2 2,16 2,30 C2,50 30,76 30,76 C30,76 58,50 58,30 C58,16 44,2 30,2 Z"
        fill={color}
      />
      <Text
        x="30"
        y="42"
        textAnchor="middle"
        fontSize="32"
        fontWeight="700"
        fill="white"
      >R</Text>
    </Svg>
  );
}
