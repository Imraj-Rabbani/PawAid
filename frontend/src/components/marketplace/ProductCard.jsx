import { Link } from "react-router-dom";
import Icon from "../Icon";
import { taka } from "./marketplaceUtils";

// stock under this shows an "only N left" nudge
const LOW_STOCK = 5;

export function StockBadge({ stockQty, className = "" }) {
  if (stockQty <= 0) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container-high text-on-surface-variant ${className}`}>
        Out of stock
      </span>
    );
  }
  if (stockQty <= LOW_STOCK) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed ${className}`}>
        Only {stockQty} left
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary-container text-on-secondary-container ${className}`}>
      In stock
    </span>
  );
}

export function ProductImage({ product, className = "" }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-surface-container-low text-on-surface-variant/50 ${className}`}>
      <Icon name="inventory_2" className="text-[48px]" />
    </div>
  );
}

export default function ProductCard({ product }) {
  const soldOut = product.stockQty <= 0;

  return (
    <Link
      to={`/marketplace/${product.id}`}
      className="group flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-container-low">
        <ProductImage
          product={product}
          className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""}`}
        />
        <StockBadge stockQty={product.stockQty} className="absolute top-3 left-3 shadow-sm" />
      </div>

      <div className="flex flex-col flex-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {product.category.name}
        </p>
        <h3 className="mt-1 font-display font-semibold text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <div className="mt-auto pt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <p className="font-display text-xl font-bold text-on-surface">{taka(product.sellingPrice)}</p>
          {product.rescueContribution > 0 && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-secondary" title="Profit from this sale goes to the rescue fund">
              <Icon name="pets" className="text-[14px]" />
              {taka(product.rescueContribution)} to rescues
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
