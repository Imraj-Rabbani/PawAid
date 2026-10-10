import { useState, useEffect } from "react";
import api from "../../services/api";

const MAX_MATCHES = 5;

// Active volunteers can send part of their wallet to another active volunteer (PRD §13)
export default function TransferForm({ balance, ownVolunteerId, onTransferred }) {
  const [open, setOpen] = useState(false);
  const [volunteers, setVolunteers] = useState(null);
  const [search, setSearch] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // the public volunteer list only has active volunteers
  useEffect(() => {
    if (!open || volunteers) return;

    const fetchVolunteers = async () => {
      try {
        const res = await api.get("/volunteer");
        setVolunteers(res.data.data.filter((v) => v.id !== ownVolunteerId));
      } catch (err) {
        console.error(err);
        setError("Couldn't load volunteers");
      }
    };
    fetchVolunteers();
  }, [open, volunteers, ownVolunteerId]);

  const term = search.trim().toLowerCase();
  const matches = (volunteers || [])
    .filter((v) => !term || v.user.name.toLowerCase().includes(term) || v.rescueArea?.name.toLowerCase().includes(term))
    .slice(0, MAX_MATCHES);
  const overBalance = Number(amount) > balance;

  const close = () => {
    setOpen(false);
    setSearch("");
    setRecipient(null);
    setAmount("");
    setNote("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipient) {
      setError("Please choose a volunteer.");
      return;
    }
    const value = Number(amount);
    if (!confirm(`Send ৳${value.toLocaleString()} to ${recipient.user.name}? This can't be undone.`)) return;

    try {
      setSaving(true);
      setError("");
      const res = await api.post("/wallet/transfer", {
        volunteerId: recipient.id,
        amount: value,
        note: note.trim() || undefined,
      });
      setSuccess(res.data.message);
      close();
      onTransferred?.(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Send to a volunteer</h3>
          <p className="text-sm text-gray-500">Move rescue funds to another volunteer's wallet.</p>
        </div>
        {!open && (
          <button
            onClick={() => {
              setOpen(true);
              setSuccess("");
            }}
            disabled={balance === 0}
            title={balance === 0 ? "Your wallet is empty" : undefined}
            className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Transfer
          </button>
        )}
      </div>

      {success && (
        <p className="mt-3 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">{success}</p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">To</label>
            {recipient ? (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
                <img
                  src={recipient.user.profilePictureUrl || "/default-avatar.png"}
                  alt={recipient.user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{recipient.user.name}</p>
                  <p className="text-xs text-gray-500">{recipient.rescueArea?.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipient(null)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or area"
                  aria-label="Search volunteers"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {volunteers === null ? (
                  <p className="mt-2 text-sm text-gray-500">Loading volunteers...</p>
                ) : matches.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No volunteers found.</p>
                ) : (
                  <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {matches.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipient(v);
                            setError("");
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <img
                            src={v.user.profilePictureUrl || "/default-avatar.png"}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-900 truncate">{v.user.name}</span>
                            <span className="block text-xs text-gray-500">{v.rescueArea?.name}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="transfer-amount" className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Amount (৳)
            </label>
            <input
              id="transfer-amount"
              required
              type="number"
              min={1}
              max={Math.min(balance, 1000000)}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className={`mt-1 text-xs ${overBalance ? "text-amber-600" : "text-gray-500"}`}>
              {overBalance ? "That's more than your balance. " : ""}Available: ৳{balance.toLocaleString()}
            </p>
          </div>

          <div>
            <label htmlFor="transfer-note" className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Note (optional)
            </label>
            <input
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. For the Mirpur cat's vet bill"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !recipient || !amount || overBalance}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Sending..." : "Send"}
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
