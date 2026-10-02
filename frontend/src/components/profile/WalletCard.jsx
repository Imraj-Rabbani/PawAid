import { useState } from "react";
import api from "../../services/api";

export default function WalletCard({ wallet, canTopUp, onToppedUp }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setAmount("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const res = await api.post("/wallet/top-up", { amount: Number(amount) });
      onToppedUp?.(res.data.data);
      close();
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Failed to top up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Wallet Balance
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        ৳{wallet.balance.toLocaleString()}
      </p>

      {canTopUp && !open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Top Up
        </button>
      )}

      {canTopUp && open && (
        <form onSubmit={handleSubmit} className="mt-3">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
            Amount (৳)
          </label>
          <input
            required
            autoFocus
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="500"
          />
          {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
          <p className="mt-1.5 text-xs text-gray-400">
            Demo top up, no real payment is taken.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Money"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
