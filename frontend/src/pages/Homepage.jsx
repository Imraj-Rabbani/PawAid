import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Homepage() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "null");

  const goToProfile = () => {
    if (!user) return;
    navigate(`/profile/${user.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome{user ? `, ${user.name}` : ""} 👋
        </h1>

        <p className="mt-4 text-gray-700">The count is: {count}</p>
        <button
          onClick={() => setCount(count + 1)}
          className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Add
        </button>

        <div className="mt-4">
          <button
            onClick={goToProfile}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Profile
          </button>
        </div>
      </main>
    </div>
  );
}