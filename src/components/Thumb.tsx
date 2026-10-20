/* eslint-disable @next/next/no-img-element */
/** Foto do prato; sem foto, mostra um cartão tipográfico na paleta da marca. */
export function Thumb({ src, name, className = '' }: { src: string | null; name: string; className?: string }) {
  if (src) return <img src={src} alt={name} loading="lazy" className={`object-cover ${className}`} />;
  return (
    <div aria-hidden className={`grid place-items-center bg-forest-900 ${className}`}>
      <span className="title text-5xl text-cream-300/70">{name.trim().charAt(0)}</span>
    </div>
  );
}
