// What the player walks on, filled in by the chapter that's loaded: the ground height, round
// things you can't walk through (stones, houses), and how far you may wander from the middle.
export function makeWorld() {
  return {
    height: () => 0,
    blockers: [],   // { x, z, r }
    bounds: 150,
  };
}
