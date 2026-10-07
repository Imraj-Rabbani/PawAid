import { useState, useEffect } from "react";
import api from "../../services/api";

export const taka = (amount) => `৳${(amount ?? 0).toLocaleString()}`;

export const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const errorMessage = (err, fallback) => {
  const errors = err.response?.data?.errors;
  const firstFieldError = errors && Object.values(errors).flat()[0];
  return firstFieldError || err.response?.data?.message || fallback;
};

// label + badge tone for every status the admin tables show
export const USER_STATUS = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export const ROLE = {
  USER: { label: "Member", tone: "neutral" },
  VOLUNTEER: { label: "Volunteer", tone: "info" },
  ADMIN: { label: "Admin", tone: "warning" },
};

export const VOLUNTEER_STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  SUSPENDED: { label: "Revoked", tone: "danger" },
};

export const POST_STATUS = {
  OPEN: { label: "Awaiting Volunteer", tone: "warning" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_PROGRESS: { label: "In Progress", tone: "info" },
  RESOLVED: { label: "Rescued", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  CANCELLED: { label: "Taken Down", tone: "danger" },
};

export const REPORT_STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  REVIEWED: { label: "Reviewed", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REJECTED: { label: "Dismissed", tone: "neutral" },
};

export const TRANSACTION_TYPE = {
  INCOME: { label: "Top up", tone: "success" },
  DONATION: { label: "Donation", tone: "info" },
  TRANSFER: { label: "Transfer", tone: "neutral" },
  EXPENSE: { label: "Expense", tone: "danger" },
  ORDER_PAYMENT: { label: "Order", tone: "warning" },
  REFUND: { label: "Refund", tone: "neutral" },
};

// value -> { label } map as <select> options, with an "All" entry first
export const optionsFrom = (map, allLabel) => [
  { value: "", label: allLabel },
  ...Object.entries(map).map(([value, { label }]) => ({ value, label })),
];

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

// A paged admin table. Changing a filter goes back to page 1; the previous rows
// stay on screen while the next page loads.
export function useAdminList(path, filters) {
  const filtersKey = JSON.stringify(filters);
  const [page, setPage] = useState(1);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], pagination: null, body: null, error: "" });

  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
  }

  const requestKey = `${path}|${filtersKey}|${page}|${reloadKey}`;

  useEffect(() => {
    // a slow response for old filters must not overwrite the current ones
    let ignore = false;
    const params = Object.fromEntries(
      Object.entries(JSON.parse(filtersKey)).filter(([, v]) => v !== "" && v !== false && v != null)
    );

    const fetchList = async () => {
      try {
        const res = await api.get(path, { params: { ...params, page } });
        if (ignore) return;
        setResult({
          key: requestKey,
          items: res.data.data,
          pagination: res.data.pagination,
          body: res.data,
          error: "",
        });
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setResult((prev) => ({ ...prev, key: requestKey, error: errorMessage(err, "Failed to load") }));
        }
      }
    };
    fetchList();

    return () => {
      ignore = true;
    };
  }, [path, filtersKey, page, requestKey]);

  const replaceItem = (updated) =>
    setResult((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === updated.id ? updated : item)),
    }));

  return {
    items: result.items,
    pagination: result.pagination,
    body: result.body,
    error: result.error,
    loading: result.key !== requestKey,
    initialLoading: result.key === null,
    page,
    setPage,
    reload: () => setReloadKey((k) => k + 1),
    replaceItem,
  };
}
