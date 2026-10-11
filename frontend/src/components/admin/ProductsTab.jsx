import { useState, useEffect } from "react";
import api from "../../services/api";
import Icon from "../Icon";
import ProductFormModal from "./ProductFormModal";
import { Badge, Button, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import { PRODUCT_STATUS, errorMessage, optionsFrom, taka, useAdminList, useDebounced } from "./adminUtils";

const LOW_STOCK = 5;

const byName = (a, b) => a.name.localeCompare(b.name);

export default function ProductsTab() {
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/products", { search: debouncedSearch, categoryId, status });
  const [busyId, setBusyId] = useState(null);
  // null = closed, {} = adding, { product } = editing
  const [form, setForm] = useState(null);

  // product counts per category change whenever a product is saved
  const [categoriesKey, setCategoriesKey] = useState(0);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/admin/categories");
        setCategories(res.data.data);
      } catch (err) {
        console.error(err);
        setCategoriesError(errorMessage(err, "Failed to load categories"));
      }
    };
    fetchCategories();
  }, [categoriesKey]);

  const handleSaved = (saved) => {
    if (form.product) {
      list.replaceItem(saved);
    } else {
      // a new product is newest, so it belongs on page 1
      list.page === 1 ? list.reload() : list.setPage(1);
    }
    setForm(null);
    setCategoriesKey((k) => k + 1);
  };

  const toggleActive = async (product) => {
    if (product.active && !confirm(`Hide "${product.name}" from the marketplace?`)) return;

    try {
      setBusyId(product.id);
      const res = await api.patch(`/admin/products/${product.id}`, { active: !product.active });
      list.replaceItem(res.data.data);
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to update product"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Marketplace products"
        description="Profit from every sale (selling price minus cost) goes to the rescue fund."
        actions={
          <Button
            variant="primary"
            icon="add"
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Add a category first" : undefined}
            onClick={() => setForm({})}
          >
            Add product
          </Button>
        }
      >
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search products" />
          <SelectFilter
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <SelectFilter label="Status" value={status} onChange={setStatus} options={optionsFrom(PRODUCT_STATUS, "All statuses")} />
        </Toolbar>

        <ListBody list={list} empty={categories.length === 0 ? "Add a category below, then add your first product." : "No products match these filters."}>
          <ul className="divide-y divide-surface-container-high">
            {list.items.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                busy={busyId === product.id}
                onEdit={() => setForm({ product })}
                onToggle={() => toggleActive(product)}
              />
            ))}
          </ul>
        </ListBody>
      </Panel>

      <CategoriesPanel
        categories={categories}
        error={categoriesError}
        onAdded={(category) => setCategories((prev) => [...prev, category].sort(byName))}
      />

      {form && (
        <ProductFormModal
          product={form.product}
          categories={categories}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function ProductRow({ product, busy, onEdit, onToggle }) {
  const profit = product.sellingPrice - product.costPrice;
  const status = product.active ? "active" : "inactive";

  return (
    <li className={`py-4 flex flex-col md:flex-row md:items-center gap-3 ${product.active ? "" : "opacity-70"}`}>
      <div className="flex gap-3 min-w-0 flex-1">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
            <Icon name="inventory_2" className="text-[22px] text-on-surface-variant" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface truncate">{product.name}</p>
            <Badge status={PRODUCT_STATUS[status]} />
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {product.category.name} · {product._count.orderItems} orders
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-on-surface-variant">
            <span>
              Price <span className="font-semibold text-on-surface">{taka(product.sellingPrice)}</span>
            </span>
            <span>Cost {taka(product.costPrice)}</span>
            <span>Profit {taka(profit)}</span>
            <span className={product.stockQty <= LOW_STOCK ? "font-semibold text-error" : ""}>
              {product.stockQty === 0 ? "Out of stock" : `${product.stockQty} in stock`}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" icon="edit" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        {product.active ? (
          <Button variant="danger" icon="visibility_off" disabled={busy} onClick={onToggle}>
            Deactivate
          </Button>
        ) : (
          <Button variant="success" icon="visibility" disabled={busy} onClick={onToggle}>
            Activate
          </Button>
        )}
      </div>
    </li>
  );
}

function CategoriesPanel({ categories, error, onAdded }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      setAdding(true);
      setAddError("");
      const res = await api.post("/admin/categories", { name: trimmed });
      onAdded(res.data.data);
      setName("");
    } catch (err) {
      console.error(err);
      setAddError(errorMessage(err, "Failed to add category"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Panel title="Product categories" description="Every product belongs to one category.">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (addError) setAddError("");
          }}
          maxLength={60}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-container-low text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
          placeholder="New category, e.g. Medical supplies"
          aria-label="New category name"
        />
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-container disabled:opacity-50"
        >
          <Icon name="add" className="text-[18px]" />
          {adding ? "Adding..." : "Add category"}
        </button>
      </form>
      {addError && <p className="mt-1.5 text-sm text-error">{addError}</p>}

      {error ? (
        <div className="mt-4 p-4 bg-error-container rounded-xl">
          <p className="text-sm text-on-error-container">{error}</p>
        </div>
      ) : categories.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="px-3 py-1.5 rounded-full bg-surface-container-low text-xs font-medium text-on-surface">
              {c.name} <span className="text-on-surface-variant">({c._count.products})</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
