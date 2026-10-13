import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import ProductCard, { ProductImage, StockBadge } from "../components/marketplace/ProductCard";
import { taka } from "../components/marketplace/marketplaceUtils";

export default function ProductPage() {
  const { productId } = useParams();
  const [result, setResult] = useState({ id: null, product: null, error: "" });

  useEffect(() => {
    let ignore = false;

    api
      .get(`/marketplace/products/${productId}`)
      .then((res) => {
        if (!ignore) setResult({ id: productId, product: res.data.data, error: "" });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) {
          setResult({
            id: productId,
            product: null,
            error: err.response?.status === 404 ? "notFound" : err.response?.data?.message || "Failed to load product",
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [productId]);

  const loading = result.id !== productId;
  const { product, error } = result;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Back to marketplace
        </Link>

        {loading ? (
          <p className="py-16 text-center text-on-surface-variant">Loading product...</p>
        ) : error === "notFound" ? (
          <div className="mt-6 py-16 text-center bg-surface-container-lowest rounded-2xl">
            <Icon name="search_off" className="text-[48px] text-on-surface-variant/40" />
            <p className="mt-3 font-semibold text-on-surface">This product isn't available</p>
            <p className="mt-1 text-sm text-on-surface-variant">It may have been removed from the marketplace.</p>
          </div>
        ) : error ? (
          <div className="mt-6 p-4 bg-error-container border border-error/20 rounded-2xl">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        ) : (
          <>
            <ProductDetails product={product} />

            {product.related.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold text-on-surface">
                  More in {product.category.name}
                </h2>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {product.related.map((related) => (
                    <ProductCard key={related.id} product={related} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ProductDetails({ product }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 bg-surface-container-lowest rounded-2xl shadow-sm p-4 md:p-6">
      <div className="aspect-square rounded-xl overflow-hidden bg-surface-container-low">
        <ProductImage product={product} className="w-full h-full" />
      </div>

      <div className="flex flex-col">
        <Link
          to={`/marketplace?category=${product.category.id}`}
          className="self-start text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
        >
          {product.category.name}
        </Link>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold text-on-surface">{product.name}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-display text-3xl font-bold text-on-surface">{taka(product.sellingPrice)}</p>
          <StockBadge stockQty={product.stockQty} />
        </div>

        {product.rescueContribution > 0 && (
          <div className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-secondary-container/40">
            <Icon name="pets" className="text-[22px] text-secondary mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {taka(product.rescueContribution)} of this price funds rescues
              </p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Marketplace profit goes into the rescue fund, which pays for animal rescues.{" "}
                <Link to="/transparency" className="font-semibold text-secondary hover:underline">
                  See where it goes
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-surface-container-high">
          <h2 className="text-sm font-semibold text-on-surface">About this product</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant whitespace-pre-line">
            {product.description || "No description provided."}
          </p>
        </div>

        {product.stockQty > 0 && (
          <p className="mt-auto pt-6 flex items-center gap-2 text-sm text-on-surface-variant">
            <Icon name="inventory_2" className="text-[18px]" />
            {product.stockQty} {product.stockQty === 1 ? "unit" : "units"} available
          </p>
        )}
      </div>
    </div>
  );
}
