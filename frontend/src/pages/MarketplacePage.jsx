import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import ProductCard from "../components/marketplace/ProductCard";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

export default function MarketplacePage() {
  // filters live in the URL so a filtered view can be shared and survives back/forward
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";
  const inStock = searchParams.get("inStock") === "true";
  const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState({ key: null, products: [], pagination: null, error: "" });

  const updateParams = (changes) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === "" || value === false || value == null) next.delete(key);
        else next.set(key, value);
      });
      // any filter change starts again from the first page
      if (!("page" in changes)) next.delete("page");
      return next;
    });
  };

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const id = setTimeout(() => updateParams({ search: searchInput.trim() }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    api
      .get("/marketplace/categories")
      .then((res) => setCategories(res.data.data))
      .catch((err) => console.error(err));
  }, []);

  const requestKey = JSON.stringify({ search, categoryId, sort, inStock, page });

  useEffect(() => {
    // a slow response for old filters must not overwrite the current ones
    let ignore = false;
    const { search, categoryId, sort, inStock, page } = JSON.parse(requestKey);

    api
      .get("/marketplace/products", {
        params: {
          search: search || undefined,
          categoryId: categoryId || undefined,
          inStock: inStock || undefined,
          sort,
          page,
        },
      })
      .then((res) => {
        if (!ignore) setResult({ key: requestKey, products: res.data.data, pagination: res.data.pagination, error: "" });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) {
          setResult((prev) => ({
            ...prev,
            key: requestKey,
            error: err.response?.data?.message || "Failed to load products",
          }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [requestKey]);

  const loading = result.key !== requestKey;
  const { products, pagination, error } = result;
  const hasFilters = search || categoryId || inStock;

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  const goToPage = (next) => {
    updateParams({ page: next > 1 ? next : "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-surface-container-lowest border-b border-surface-container-high">
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">PawAid Marketplace</p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold text-on-surface">
              Supplies for every rescue
            </h1>
            <p className="mt-3 text-on-surface-variant">
              Medicine, food and rescue equipment. The profit from every sale goes straight into the rescue fund.
            </p>
          </div>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              updateParams({ search: searchInput.trim() });
            }}
            className="relative w-full md:w-96"
          >
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/70 border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition"
            />
          </form>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ── Category chips ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <CategoryChip active={!categoryId} onClick={() => updateParams({ category: "" })}>
            All products
          </CategoryChip>
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={categoryId === category.id}
              onClick={() => updateParams({ category: category.id })}
            >
              {category.name}
              <span className="opacity-70">{category.productCount}</span>
            </CategoryChip>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant" aria-live="polite">
            {pagination && !error
              ? `${pagination.total} ${pagination.total === 1 ? "product" : "products"}${search ? ` for "${search}"` : ""}`
              : " "}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => updateParams({ inStock: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              In stock only
            </label>

            <select
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value === "newest" ? "" : e.target.value })}
              aria-label="Sort products"
              className="px-3 py-2 text-sm font-medium bg-surface-container-lowest text-on-surface border border-surface-container-highest rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Grid ── */}
        {result.key === null ? (
          <ProductGridSkeleton />
        ) : error ? (
          <div className="mt-6 p-4 bg-error-container border border-error/20 rounded-2xl">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="mt-6 py-16 text-center bg-surface-container-lowest rounded-2xl">
            <Icon name="storefront" className="text-[48px] text-on-surface-variant/40" />
            <p className="mt-3 font-semibold text-on-surface">
              {hasFilters ? "No products match these filters" : "The marketplace is empty for now"}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {hasFilters ? "Try a different search or category." : "Check back soon for rescue supplies."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-xl hover:bg-primary-fixed/40 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}
              aria-busy={loading}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Icon name="chevron_left" className="text-[18px]" />
                  Previous
                </button>
                <span className="text-sm text-on-surface-variant">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pagination.totalPages || loading}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                  <Icon name="chevron_right" className="text-[18px]" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CategoryChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors ${
        active
          ? "bg-primary text-white font-semibold shadow-sm"
          : "bg-surface-container-lowest text-on-surface-variant font-medium shadow-sm hover:bg-surface-container-high"
      }`}
    >
      {children}
    </button>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" aria-label="Loading products">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden animate-pulse">
          <div className="aspect-square bg-surface-container-low" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-1/3 rounded bg-surface-container-high" />
            <div className="h-4 w-3/4 rounded bg-surface-container-high" />
            <div className="h-6 w-1/4 rounded bg-surface-container-high mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
