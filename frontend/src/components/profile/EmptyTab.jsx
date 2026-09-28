export default function EmptyTab({ title }) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-2xl text-gray-400">📭</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">Coming soon.</p>
      </div>
    );
  }