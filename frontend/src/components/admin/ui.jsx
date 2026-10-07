import Icon from "../Icon";

const TONES = {
  success: "bg-secondary-container text-on-secondary-container",
  info: "bg-surface-container-high text-on-surface",
  warning: "bg-primary-fixed text-on-primary-fixed",
  danger: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-low text-on-surface-variant",
};

// status is one entry of a *_STATUS map from adminUtils
export function Badge({ status, fallback = "Unknown" }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
        TONES[status?.tone] || TONES.neutral
      }`}
    >
      {status?.label || fallback}
    </span>
  );
}

export function Avatar({ user, size = "w-10 h-10" }) {
  return (
    <img
      src={user?.profilePictureUrl || "/default-avatar.png"}
      alt={user?.name || ""}
      className={`${size} rounded-full object-cover ring-2 ring-surface-container-high shrink-0`}
    />
  );
}

export function Panel({ title, description, actions, children, className = "" }) {
  return (
    <section className={`bg-surface-container-lowest rounded-2xl shadow-sm p-4 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-on-surface">{title}</h2>}
            {description && <p className="text-sm text-on-surface-variant">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toolbar({ children }) {
  return <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">{children}</div>;
}

const fieldClass =
  "px-3 py-2 text-sm bg-surface-container-low text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest";

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative flex-1 min-w-0 sm:min-w-56">
      <Icon
        name="search"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${fieldClass} w-full pl-9`}
      />
    </label>
  );
}

export function SelectFilter({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`${fieldClass} sm:w-auto`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Chips({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
              active
                ? "bg-primary text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container-high"
            }`}
          >
            {o.label}
            {o.count != null && <span className="ml-1 opacity-80">({o.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-container",
  secondary: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
  danger: "bg-error-container text-on-error-container hover:bg-error hover:text-white",
  success: "bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white",
  ghost: "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
};

export function Button({ variant = "secondary", icon, children, className = "", ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className="text-[16px]" />}
      {children}
    </button>
  );
}

// loading / error / empty states shared by every list, children render the rows
export function ListBody({ list, empty, children }) {
  if (list.initialLoading) {
    return <p className="py-10 text-center text-sm text-on-surface-variant">Loading...</p>;
  }
  if (list.error) {
    return (
      <div className="p-4 bg-error-container rounded-xl">
        <p className="text-sm text-on-error-container">{list.error}</p>
      </div>
    );
  }
  if (list.items.length === 0) {
    return <p className="py-10 text-center text-sm text-on-surface-variant">{empty}</p>;
  }
  return (
    <div className={`transition-opacity ${list.loading ? "opacity-50" : ""}`}>
      {children}
      <Pagination list={list} />
    </div>
  );
}

function Pagination({ list }) {
  const { pagination, page, setPage, loading } = list;
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? (
      <p className="mt-4 text-xs text-on-surface-variant">
        {pagination.total} {pagination.total === 1 ? "result" : "results"}
      </p>
    ) : null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-on-surface-variant">
        Page {page} of {pagination.totalPages} · {pagination.total} results
      </p>
      <div className="flex gap-2">
        <Button icon="chevron_left" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
          Prev
        </Button>
        <Button
          disabled={page >= pagination.totalPages || loading}
          onClick={() => setPage(page + 1)}
        >
          Next
          <Icon name="chevron_right" className="text-[16px]" />
        </Button>
      </div>
    </div>
  );
}
