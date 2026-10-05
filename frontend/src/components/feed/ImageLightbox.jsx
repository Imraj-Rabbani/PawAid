import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const SWIPE_DISTANCE = 50;

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export default function ImageLightbox({ images, startIndex, alt, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [touchStartX, setTouchStartX] = useState(null);

  const hasMany = images.length > 1;
  const showPrev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const showNext = () => setIndex((i) => (i + 1) % images.length);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", handleKey);

    // stop the feed scrolling behind the viewer
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [images.length, onClose]);

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const distance = e.changedTouches[0].clientX - touchStartX;
    if (distance > SWIPE_DISTANCE) showPrev();
    if (distance < -SWIPE_DISTANCE) showNext();
    setTouchStartX(null);
  };

  // rendered on <body> so the card's overflow and stacking can't clip it
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
    >
      {/* ── Top bar ── */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">
          {hasMany && `${index + 1} / ${images.length}`}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* ── Image ── */}
      <img
        key={images[index].id}
        src={images[index].imageUrl}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[78vh] rounded-lg object-contain shadow-2xl select-none animate-pop-in"
      />

      {/* ── Arrows ── */}
      {hasMany && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            aria-label="Previous image"
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg hover:bg-white transition-colors"
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            aria-label="Next image"
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg hover:bg-white transition-colors"
          >
            <ArrowIcon direction="right" />
          </button>
        </>
      )}

      {/* ── Thumbnails ── */}
      {hasMany && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 inset-x-0 flex justify-center gap-2 px-4 overflow-x-auto"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden ring-2 transition ${
                i === index ? "ring-white opacity-100" : "ring-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={image.imageUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
