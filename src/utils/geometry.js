export function computeIntersection(eq1, eq2) {
  const det = eq1.a * eq2.b - eq2.a * eq1.b;
  if (Math.abs(det) < 1e-9) return null;
  const x = (eq2.b * (-eq1.c) - eq1.b * (-eq2.c)) / det;
  const y = (eq1.a * (-eq2.c) - eq2.a * (-eq1.c)) / det;
  return { x, y };
}
