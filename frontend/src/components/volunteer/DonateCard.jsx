import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const QUICK_AMOUNTS = [100, 500, 1000];

export default function DonateCard({ volunteer, onDonated }) {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [walletBalance, setWalletBalance] = useState(null);

  // load the donor's balance when the form opens (only signed in users can open it),
  // so it is fresh after each donation
  useEffect(() => {
    if (!open) return;
    api
      .get("/wallet/me")
      .then((res) => setWalletBalance(res.data.data.balance))
      .catch((err) => console.error(err));
  }, [open]);

  // volunteers can't donate to themselves
  if (currentUser?.id === volunteer.user.id) return null;

  // donations are paid only from the donor's wallet
  const overBalance = walletBalance !== null && Number(amount) > walletBalance;
  const topUpLink = (
    <Link to={`/profile/${currentUser?.id}`} className="font-medium text-blue-600 hover:underline">
      Top up from your profile
    </Link>
  );

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
      await api.post(`/donations/volunteer/${volunteer.id}`, { amount: Number(amount) });
      setSuccess(`Thank you! You donated ৳${Number(amount).toLocaleString()} to ${volunteer.user.name}.`);
      close();
      onDonated?.();
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Donation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900">Support {volunteer.user.name}</h2>
      <p className="mt-1 text-sm text-gray-500">
        Donations are paid from your wallet and go to their wallet to fund their rescues.
      </p>

      {success && (
        <p className="mt-3 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
          {success}
        </p>
      )}

      {!currentUser ? (
        <Link
          to="/signin"
          className="mt-4 block w-full px-4 py-2 text-sm font-medium text-center text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Sign in to donate
        </Link>
      ) : !open ? (
        <button
          onClick={() => {
            setOpen(true);
            setSuccess("");
          }}
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Donate
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex gap-2 mb-3">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={`flex-1 px-2 py-1.5 text-sm rounded-lg border transition ${
                  Number(amount) === value
                    ? "border-green-600 bg-green-50 text-green-700 font-medium"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                ৳{value}
              </button>
            ))}
          </div>

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

          <p className="mt-2 text-sm text-gray-500">
            Your wallet:{" "}
            <span className="font-medium text-gray-900">
              {walletBalance === null ? "Loading..." : `৳${walletBalance.toLocaleString()}`}
            </span>
          </p>
          {walletBalance === 0 ? (
            <p className="mt-1.5 text-sm text-amber-600">
              Your wallet is empty. {topUpLink} to donate.
            </p>
          ) : (
            overBalance && (
              <p className="mt-1.5 text-sm text-amber-600">
                That's more than your wallet balance. {topUpLink} first.
              </p>
            )
          )}
          {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving || walletBalance === null || walletBalance === 0 || overBalance}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Donating..." : "Donate"}
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

