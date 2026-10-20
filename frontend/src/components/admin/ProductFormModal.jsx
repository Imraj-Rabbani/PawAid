import { useState, useEffect } from "react";
import api from "../../services/api";
import Icon from "../Icon";
import { errorMessage, taka } from "./adminUtils";
import { IMAGE_ACCEPT, IMAGE_TYPE_ERROR, isAllowedImage } from "../../services/images";

const inputClass =
  "w-full px-3 py-2 bg-surface-container-low border border-transparent rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container";
const labelClass = "text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1 block";

// Adds a product, or edits one when `product` is given
export default function ProductFormModal({ product, categories, onClose, onSaved }) {
  const editing = Boolean(product);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    categoryId: product?.category.id ?? categories[0]?.id ?? "",
    costPrice: product ? String(product.costPrice) : "",
    sellingPrice: product ? String(product.sellingPrice) : "",
    stockQty: product ? String(product.stockQty) : "",
    active: product?.active ?? true,
  });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(product?.imageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // free the object URL made for a picked image once it's replaced or the modal closes
  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const cost = Number(form.costPrice) || 0;
  const price = Number(form.sellingPrice) || 0;
  const profit = price - cost;
  const showProfit = form.costPrice !== "" && form.sellingPrice !== "";

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isAllowedImage(file)) {
      setError(IMAGE_TYPE_ERROR);
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or smaller");
      e.target.value = "";
      return;
    }
    setError("");
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (price < cost) {
      setError("Selling price can't be lower than the cost price.");
      return;
    }

    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, typeof value === "string" ? value.trim() : value));
    if (image) body.append("image", image);

    try {
      setSaving(true);
      setError("");
      const res = editing
        ? await api.patch(`/admin/products/${product.id}`, body)
        : await api.post("/admin/products", body);
      onSaved(res.data.data);
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, editing ? "Failed to save product" : "Failed to add product"));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-2xl shadow-lg p-6 flex flex-col gap-4 animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="product-form-title" className="font-display text-lg font-bold text-on-surface">
            {editing ? "Edit product" : "Add product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1 -m-1 rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {preview ? (
            <img src={preview} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
              <Icon name="inventory_2" className="text-[28px] text-on-surface-variant" />
            </div>
          )}
          <div>
            <label className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest cursor-pointer">
              <Icon name="upload" className="text-[16px]" />
              {preview ? "Change image" : "Upload image"}
              <input type="file" accept={IMAGE_ACCEPT} onChange={handleImage} className="sr-only" />
            </label>
            <p className="mt-1 text-xs text-on-surface-variant">Optional · JPG, PNG, GIF or WebP up to 5MB</p>
          </div>
        </div>

        <div>
          <label htmlFor="product-name" className={labelClass}>Name</label>
          <input
            id="product-name"
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. First aid kit"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="product-category" className={labelClass}>Category</label>
          <select id="product-category" required value={form.categoryId} onChange={set("categoryId")} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="product-description" className={labelClass}>Description</label>
          <textarea
            id="product-description"
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={set("description")}
            placeholder="Optional"
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="product-cost" className={labelClass}>Cost price (৳)</label>
            <input
              id="product-cost"
              type="number"
              required
              min={0}
              step={1}
              value={form.costPrice}
              onChange={set("costPrice")}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="product-price" className={labelClass}>Selling price (৳)</label>
            <input
              id="product-price"
              type="number"
              required
              min={Math.max(cost, 1)}
              step={1}
              value={form.sellingPrice}
              onChange={set("sellingPrice")}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="product-stock" className={labelClass}>Stock</label>
            <input
              id="product-stock"
              type="number"
              required
              min={0}
              step={1}
              value={form.stockQty}
              onChange={set("stockQty")}
              className={inputClass}
            />
          </div>
        </div>

        {showProfit && (
          <p className={`text-sm ${profit < 0 ? "text-error" : "text-on-surface-variant"}`}>
            Profit per sale: <span className="font-semibold">{taka(profit)}</span>
            {profit >= 0 && " goes to the rescue fund."}
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="accent-primary"
          />
          Show in the marketplace
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant rounded-xl hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || categories.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-container disabled:opacity-50"
          >
            {saving ? "Saving..." : editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}
