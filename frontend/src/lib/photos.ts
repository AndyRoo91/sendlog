/** URL helpers for the /photos route. Originals live at /photos/{filename};
 *  the backend writes a matching {stem}_thumb.jpg next to every upload. */

export function photoUrl(filename: string): string {
  return `/photos/${filename}`;
}

export function thumbUrl(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  return `/photos/${stem}_thumb.jpg`;
}
