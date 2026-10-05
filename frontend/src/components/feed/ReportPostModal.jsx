import { useState } from "react";
import api from "../../services/api";

// keep in sync with REPORT_REASONS in backend/src/modules/report/report.controller.js
const REPORT_REASONS = [
  "Spam",
  "Fake or misleading",
  "Inappropriate content",
  "Scam or fraud",
  "Other",
];

export default function ReportPostModal({ postId, onClose, onReported }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post(`/rescue-post/${postId}/report`, {
        reason,
        description: description.trim() || undefined,
      });
      onReported();
    } catch (err) {
      console.error(err);
      const errors = err.response?.data?.errors;
      setError(
        errors?.reason?.[0] ||
          errors?.description?.[0] ||
          err.response?.data?.message ||
          "Failed to submit report"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Report post</h2>
          <p className="text-sm text-gray-500">
            Tell us what's wrong. An admin will review it.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {REPORT_REASONS.map((option) => (
            <label
              key={option}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm ${
                reason === option ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
              />
              {option}
            </label>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details (optional)"
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </form>
    </div>
  );
}
