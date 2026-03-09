export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** seed에서 HSL 색상 추출 (결정론적) */
export function seedToColors(seed: number): { body: string; accent: string; detail: string } {
  const hue1 = seed % 360
  const hue2 = (seed * 137 + 50) % 360
  const hue3 = (seed * 73 + 120) % 360
  return {
    body: `hsl(${hue1}, 60%, 55%)`,
    accent: `hsl(${hue2}, 55%, 50%)`,
    detail: `hsl(${hue3}, 45%, 65%)`,
  }
}
