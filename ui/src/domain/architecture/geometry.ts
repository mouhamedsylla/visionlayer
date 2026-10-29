import { NODE_SIZE, type Placed } from "./layout";

type Point = [number, number];

export interface LinkGeometry {
  d: string;
  /** Un point du trait, de 0 (départ) à 1 (arrivée) : là où poser son étiquette. */
  at: (t: number) => Point;
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point): (t: number) => Point {
  return (t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    return [
      k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0],
      k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1],
    ];
  };
}

/**
 * Le trait d'un bloc à un autre, d'un bord au bord d'en face. `offset` écarte
 * les deux sens d'une même paire (l'API appelle Stripe, Stripe appelle l'API).
 */
export function linkGeometry(a: Placed, b: Placed, offset = 0): LinkGeometry {
  const W = NODE_SIZE.width;
  const y1 = a.y + a.height / 2 + offset;
  const y2 = b.y + b.height / 2 + offset;
  let pts: [Point, Point, Point, Point];
  if (a.x === b.x) {
    const x = a.x + W;
    pts = [[x, y1], [x + 48, y1], [x + 48, y2], [x, y2]];
  } else {
    const forward = b.x > a.x;
    const x1 = forward ? a.x + W : a.x;
    const x2 = forward ? b.x : b.x + W;
    const mid = (x1 + x2) / 2;
    pts = [[x1, y1], [mid, y1], [mid, y2], [x2, y2]];
  }
  const [p0, p1, p2, p3] = pts;
  return { d: `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`, at: cubic(p0, p1, p2, p3) };
}
