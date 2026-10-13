import Icon from "../Icon";

export default function QuantityStepper({ value, max, onChange, disabled = false, label = "Quantity" }) {
  const stepButton = "p-2 text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition";

  return (
    <div className="inline-flex items-center rounded-lg border border-surface-container-highest bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={`${stepButton} rounded-l-lg`}
      >
        <Icon name="remove" className="text-[18px]" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const next = parseInt(e.target.value);
          if (Number.isFinite(next)) onChange(Math.max(Math.min(next, max), 1));
        }}
        className="w-12 py-1.5 text-center text-sm font-semibold text-on-surface bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={`${stepButton} rounded-r-lg`}
      >
        <Icon name="add" className="text-[18px]" />
      </button>
    </div>
  );
}
