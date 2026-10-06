// Material Symbols glyph; size is a Tailwind text-[..] class
export default function Icon({ name, filled = false, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${filled ? "icon-filled" : ""} ${className}`}
    >
      {name}
    </span>
  );
}
