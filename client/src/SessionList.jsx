export default function SessionList({ sessions, onSelect, onDelete }) {
  return (
    <div className="w-64 border-r bg-white overflow-y-auto">
      <div className="p-4 font-semibold text-indigo-700">
        Sessions
      </div>

      {sessions.map((s) => (
        <div
          key={s.sessionId}
          className="flex items-center justify-between px-4 py-3 border-b hover:bg-indigo-50"
        >
          <button
            onClick={() => onSelect(s.sessionId)}
            className="text-left flex-1"
          >
            <div className="text-sm font-medium">
              {s.title || "Untitled Session"}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(s.createdAt).toLocaleString()}
            </div>
          </button>

          <button
            onClick={() => onDelete(s.sessionId)}
            className="text-red-400 hover:text-red-600 text-sm ml-2"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
