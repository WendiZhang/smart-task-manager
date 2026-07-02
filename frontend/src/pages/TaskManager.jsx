import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const API = `${import.meta.env.VITE_API_URL}/tasks/`;

const authHeaders = (includeJson = false) => ({
  ...(includeJson && { "Content-Type": "application/json" }),
  Authorization: `Bearer ${getToken()}`,
});

export default function TaskManager() {
  const navigate = useNavigate();
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [aiSteps, setAiSteps] = useState("");
  const [expandedTasks, setExpandedTasks] = useState({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [pageError, setPageError] = useState("");
  const [filter, setFilter] = useState("all");
  const token = getToken();

  const completedCount = tasks.filter((task) => task.completed).length;
  const completionPercent = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;
  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  const apiFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 422) {
      localStorage.removeItem("token");
      navigate("/login");
      throw new Error("Your session expired. Please log in again.");
    }

    if (!res.ok) {
      throw new Error(data.error || data.msg || "Something went wrong");
    }

    return data;
  }, [navigate]);

  const loadTasks = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingTasks(true);
      setPageError("");
    }

    try {
      const data = await apiFetch(API, {
        headers: authHeaders(),
      });

      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPageError(err.message || "Unable to load tasks");
    } finally {
      if (showLoading) {
        setIsLoadingTasks(false);
      }
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const loadTimer = window.setTimeout(loadTasks, 0);

    return () => window.clearTimeout(loadTimer);
  }, [token, navigate, loadTasks]);

  const addTask = async () => {
    if (!title.trim()) {
      setPageError("Enter a task title first.");
      return;
    }

    if (!token) return;

    setIsAddingTask(true);
    setPageError("");

    try {
      await apiFetch(API, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          title: title.trim(),
        }),
      });

      setTitle("");
      await loadTasks(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setPageError(err.message || "Unable to add task");
    } finally {
      setIsAddingTask(false);
    }
  };

  const deleteTask = async (id) => {
    setPageError("");

    try {
      await apiFetch(`${API}${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadTasks(false);
    } catch (err) {
      setPageError(err.message || "Unable to delete task");
    }
  };

  const startEdit = (task) => {
    setEditId(task.id);
    setEditText(task.title);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditText("");
  };

  const closeMobileMenu = (event) => {
    const menu = event.currentTarget.closest("details");
    if (menu) menu.open = false;
  };

  const updateTask = async () => {
    if (!editText.trim()) {
      setPageError("Task title cannot be empty.");
      return;
    }

    setPageError("");

    try {
      await apiFetch(`${API}${editId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ title: editText.trim() }),
      });

      setEditId(null);
      setEditText("");
      await loadTasks(false);
    } catch (err) {
      console.error(err);
      setPageError(err.message || "Unable to update task");
    }
  };

  const toggleExpanded = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const generateSteps = async (task) => {
    try {
      setLoadingTaskId(task.id);
      setPageError("");

      const data = await apiFetch(`${import.meta.env.VITE_API_URL}/ai/breakdown`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ 
          task: task.title, 
          task_id: task.id
        }),
      });

      setAiSteps(data.steps);
      await loadTasks(false);
    } catch (err) {
      console.error(err);
      setPageError(err.message || "Unable to generate steps");
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const toggleSubtask = async (subtask) => {
    const previousTasks = tasks;

    setTasks((currentTasks) => currentTasks.map((task) => ({
      ...task,
      subtasks: task.subtasks?.map((item) => (
        item.id === subtask.id
          ? { ...item, completed: !item.completed }
          : item
      )),
    })));
    setPageError("");

    try {
      await apiFetch(
        `${import.meta.env.VITE_API_URL}/tasks/subtasks/${subtask.id}`,
        {
          method: "PUT",
          headers: authHeaders(true),
          body: JSON.stringify({
            completed: !subtask.completed,
          }),
        },
      );

    } catch (err) {
      setTasks(previousTasks);
      setPageError(err.message || "Unable to update subtask");
    }
  };

  const clearSteps = async (taskId) => {
    if (!window.confirm("Delete all generated steps?")) {
      return;
    }

    setPageError("");

    try {
      await apiFetch(
        `${import.meta.env.VITE_API_URL}/tasks/${taskId}/subtasks`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );

      await loadTasks(false);
    } catch (err) {
      console.error(err);
      setPageError(err.message || "Unable to clear steps");
    }
  };

  const toggleTask = async (id) => {
    const previousTasks = tasks;

    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id === id ? { ...task, completed: !task.completed } : task
    )));
    setPageError("");

    try {
      await apiFetch(
        `${import.meta.env.VITE_API_URL}/tasks/${id}/complete`,
        {
          method: "PUT",
          headers: authHeaders(),
        },
      );

    } catch (err) {
      setTasks(previousTasks);
      setPageError(err.message || "Unable to update task");
    }
  };

  const onDragEnd = async (result) => {
    if (filter !== "all") return;
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const previousTasks = tasks;
    const items = [...previousTasks];

    const [reorderedItem] = items.splice(
      result.source.index,
      1
    );

    items.splice(
      result.destination.index,
      0,
      reorderedItem
    );

    setTasks(items);

    try {
      setPageError("");
      await apiFetch(`${API}reorder`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
          ordered_ids: items.map((task) => task.id),
        }),
      });
    } catch (err) {
      setTasks(previousTasks);
      setPageError(err.message || "Unable to save task order");
    }
  };
  

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-gray-100 to-slate-200 flex justify-center p-3 sm:p-6">
      
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="flex justify-between items-center gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
            Task Manager
          </h1>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition shadow-sm"
          >
            Logout
          </button>
        </div>

        {pageError && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{pageError}</span>
            <button
              type="button"
              onClick={() => setPageError("")}
              className="font-semibold text-red-700 hover:text-red-900"
              aria-label="Dismiss error"
            >
              Close
            </button>
          </div>
        )}

        {isLoadingTasks && (
          <div
            aria-live="polite"
            className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"
          >
            Loading tasks...
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Your progress</span>
            <span className="text-gray-500">
              {completedCount} of {tasks.length} completed
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={completionPercent}
            aria-label="Task completion"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Add Task Card */}
        <div className="bg-white p-4 rounded-2xl shadow-md mb-6 flex flex-col sm:flex-row gap-3">
          <input
            className="w-full min-w-0 flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTask();
              }
            }}
            placeholder="Write a new task..."
          />

          <button
            onClick={addTask}
            disabled={isAddingTask}
            className="w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-blue-700 transition shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isAddingTask ? "Adding..." : "Add"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm" aria-label="Filter tasks">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["completed", "Completed"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  filter === value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filter !== "all" && tasks.length > 1 && (
            <span className="text-xs text-gray-500">
              Switch to All to reorder tasks.
            </span>
          )}
        </div>

        {!isLoadingTasks && filteredTasks.length === 0 && !pageError && (
          <div className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-white/70 px-5 py-10 text-center text-gray-500">
            {tasks.length === 0
              ? "No tasks yet. Add your first one above."
              : `No ${filter} tasks right now.`}
          </div>
        )}

        {/* Task List */}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="tasks">
            {(provided) => (
              <div
                className="flex flex-col"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >

                {filteredTasks.map((t, index) => (
                  <Draggable
                    key={`task-${t.id}`}
                    draggableId={`task-${t.id}`}
                    index={index}
                    isDragDisabled={isLoadingTasks || filter !== "all"}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 p-4 hover:shadow-md min-h-16"
                      >

                        {/* Task Header */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">

                          <div className="flex items-start sm:items-center gap-3 min-w-0">

                            <span
                              {...provided.dragHandleProps}
                              aria-disabled={filter !== "all"}
                              aria-label={`Drag to reorder ${t.title}`}
                              title={filter === "all" ? "Drag to reorder" : "Switch to All to reorder"}
                              className={`mt-0.5 inline-flex shrink-0 select-none touch-none rounded-lg px-1.5 py-1 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                filter === "all"
                                  ? "cursor-grab text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
                                  : "cursor-not-allowed text-gray-300"
                              }`}
                            >
                              ⠿
                            </span>

                            <input
                              type="checkbox"
                              checked={t.completed}
                              onChange={() => toggleTask(t.id)}
                              aria-label={`Mark ${t.title} as ${t.completed ? "active" : "completed"}`}
                              className="w-4 h-4 mt-1 sm:mt-0 shrink-0 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            />

                            <span
                              className={`min-w-0 wrap-break-word text-base font-medium ${
                                t.completed
                                  ? "line-through text-gray-400"
                                  : "text-gray-800"
                              }`}
                            >
                              {t.title}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 w-full sm:w-auto">

                            <button
                              type="button"
                              disabled={loadingTaskId === t.id}
                              onClick={() => generateSteps(t)}
                              className="px-3 py-2 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium hover:bg-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              {loadingTaskId === t.id ? "Generating..." : "AI"}
                            </button>

                            <div className="hidden sm:flex items-center gap-2">
                              {t.subtasks?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => clearSteps(t.id)}
                                  className="px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-sm hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                                >
                                  Clear Steps
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => startEdit(t)}
                                className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Delete this task?")) {
                                    deleteTask(t.id);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition"
                              >
                                Delete
                              </button>
                            </div>

                            <details className="relative ml-auto sm:hidden">
                              <summary className="list-none cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                More ···
                              </summary>
                              <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    closeMobileMenu(event);
                                    startEdit(t);
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                  Edit task
                                </button>
                                {t.subtasks?.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      closeMobileMenu(event);
                                      clearSteps(t.id);
                                    }}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                                  >
                                    Clear steps
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    closeMobileMenu(event);
                                    if (window.confirm("Delete this task?")) {
                                      deleteTask(t.id);
                                    }
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                >
                                  Delete task
                                </button>
                              </div>
                            </details>

                          </div>
                        </div>

                        {/* Edit Mode */}
                        {editId === t.id && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-3">
                            <input
                              className="w-full min-w-0 flex-1 border rounded-xl px-3 py-2"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updateTask();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              aria-label={`Edit ${t.title}`}
                            />

                            <button
                              type="button"
                              onClick={updateTask}
                              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="w-full sm:w-auto border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {t.subtasks?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(t.id)}
                            className="mt-3 rounded text-sm text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {expandedTasks[t.id]
                              ? "▲ Hide Steps"
                              : `▼ Show Steps (${t.subtasks.length})`}
                          </button>
                        )}

                        {/* Subtasks */}
                        {expandedTasks[t.id] && t.subtasks?.length > 0 && (
                          <div className="mt-4 pl-4 sm:pl-6 border-l border-gray-100 space-y-2">

                            {t.subtasks.map((s) => (
                              <div key={s.id} className="flex items-center gap-2">

                                <input
                                  type="checkbox"
                                  checked={s.completed}
                                  onChange={() => toggleSubtask(s)}
                                  aria-label={`Mark ${s.title} as ${s.completed ? "active" : "completed"}`}
                                  className="shrink-0 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                />

                                <span className="min-w-0 wrap-break-word text-sm text-gray-600">
                                  {s.title}
                                </span>

                              </div>
                            ))}

                          </div>
                        )}

                      </div>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* AI Panel */}
        {aiSteps && (
          <div className="mt-6 bg-linear-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-4 shadow-sm">

            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-purple-700">
                AI Breakdown
              </h2>

              <button
                type="button"
                onClick={() => setAiSteps("")}
                className="rounded text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Close
              </button>
            </div>

            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {aiSteps}
            </pre>

          </div>
        )}

      </div>
    </div>
  );
}
