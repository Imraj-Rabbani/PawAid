import { useState, useCallback } from "react";
import Icon from "../Icon";
import ImageLightbox from "../feed/ImageLightbox";

// One big photo with where the rescue stands over it, and the rest as thumbnails.
// Clicking the big photo opens it full screen.
export default function PhotoGallery({ images, title, statusText }) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (images.length === 0) return null;
  const main = images[Math.min(selected, images.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label="View photo full screen"
        className="relative w-full h-72 sm:h-[360px] md:h-[420px] rounded-2xl overflow-hidden shadow-md group bg-surface-container cursor-zoom-in text-left"
      >
        <img
          src={main.imageUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-transparent flex items-end p-4">
          <div className="text-white">
            <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-md text-[11px] font-semibold uppercase tracking-wider">
              Current status
            </span>
            <p className="mt-1 font-display text-lg sm:text-xl font-semibold">{statusText}</p>
          </div>
        </div>
        <span className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-sm text-[11px] font-semibold text-on-surface">
          <Icon name="photo_camera" className="text-[16px] text-secondary" />
          {images.length} {images.length === 1 ? "photo" : "photos"}
        </span>
      </button>

      {images.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === selected}
              className={`h-20 sm:h-24 rounded-xl overflow-hidden shadow-sm transition ${
                index === selected ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100"
              }`}
            >
              <img src={image.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && <ImageLightbox images={images} startIndex={selected} alt={title} onClose={closeLightbox} />}
    </div>
  );
}
