import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, same as the backend limit

const emptyForm = {
  title: "",
  description: "",
  rescueAreaId: "",
  donationTarget: "",
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function CreatePost({ user, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]); // [{ file, url }]
  const [areas, setAreas] = useState([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const fetchAreas = async () => {
      try {
        const res = await api.get("/area");
        setAreas(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAreas();
  }, [open]);

  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-700">
          Seen an animal that needs help?{" "}
          <Link to="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign in
          </Link>{" "}
          to post a rescue request.
        </p>
      </div>
    );
  }

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    e.target.value = "";

    if (selected.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError("Each image must be 5MB or smaller.");
      return;
    }
    if (images.length + selected.length > MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} images.`);
      return;
    }

    setError("");
    setImages((prev) => [
      ...prev,
      ...selected.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removeImage = (url) => {
    URL.revokeObjectURL(url);
    setImages((prev) => prev.filter((image) => image.url !== url));
  };

  const reset = () => {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    setImages([]);
    setForm(emptyForm);
    setError("");
    setOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("description", form.description);
    formData.append("rescueAreaId", form.rescueAreaId);
    if (form.donationTarget) formData.append("donationTarget", form.donationTarget);
    images.forEach((image) => formData.append("images", image.file));

    try {
      setPosting(true);
      setError("");
      const res = await api.post("/rescue-post", formData);
      onCreated?.(res.data.data);
      reset();
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  if (!open) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
        <img
          src={user.profilePictureUrl || "/default-avatar.png"}
          alt={user.name}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
        />
        <button
          onClick={() => setOpen(true)}
          className="flex-1 text-left px-4 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition"
        >
          Seen an animal that needs help? Post a rescue request...
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900">Create a rescue post</h2>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Title</label>
          <input
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="Injured dog near Mirpur 10"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
            Description
          </label>
          <textarea
            required
            minLength={10}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            placeholder="Describe the animal, its condition and exactly where it is."
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
            Rescue Area
          </label>
          <select
            required
            value={form.rescueAreaId}
            onChange={(e) => setForm({ ...form, rescueAreaId: e.target.value })}
            className={`${inputClass} bg-white`}
          >
            <option value="">Select an area</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
            Donation Target (৳, optional)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={form.donationTarget}
            onChange={(e) => setForm({ ...form, donationTarget: e.target.value })}
            className={inputClass}
            placeholder="10000"
          />
        </div>
      </div>

      {/* ── Images ── */}
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
          {images.map((image) => (
            <div key={image.url} className="relative">
              <img
                src={image.url}
                alt="Selected"
                className="w-full h-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(image.url)}
                aria-label="Remove image"
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label
          className={`px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer ${
            images.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          Add Photos ({images.length}/{MAX_IMAGES})
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            disabled={images.length >= MAX_IMAGES}
            className="hidden"
          />
        </label>

        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={reset}
            disabled={posting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={posting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
