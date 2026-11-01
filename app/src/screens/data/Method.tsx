/** Le verbe d'une route en badge (MethodBadge du design système) : plein pour une écriture, en creux pour une lecture. */
export function Method({ verb }: { verb: string }) {
  return <span className={`vl-method${/^(GET|HEAD|OPTIONS)$/.test(verb) ? " vl-method--read" : ""}`}>{verb}</span>;
}
