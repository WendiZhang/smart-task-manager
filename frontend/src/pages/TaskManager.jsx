import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function TaskManager() {
  const navigate = useNavigate();
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [aiSteps, setAiSteps] = useState("");
  const [expandedTasks, setExpandedTasks] = useState({});
  const token = getToken();
  const API = `${import.meta.env.VITE_API_URL}/tasks/`;
  const authHeaders = (includeJson = false) => {
    const token = getToken();

    return {
      ...(includeJson && { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
    };
  };

  useEffect(() => {    
    if (!token) {
      navigate("/login");
      return;
    }

    loadTasks();
  }, [token]);

  const loadTasks = async () => {
    try {
      const res = await fetch(API, {
        headers: authHeaders()
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        setTasks([]);
      }

    } catch (err) {
      console.error(err);
      setTasks([]);
    }
  };

  const addTask = async () => {
    if (!title.trim()) {
      return;
    }

    if (!token) return;

    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks/`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
            title: title
        }),
        });

        const data = await res.json();
        console.log(data);

        loadTasks();
        setTitle("");

    } catch (err) {
        console.error("Fetch error:", err);
    }
    };

  const deleteTask = async (id) => {
    await fetch(`${API}${id}`, { method: "DELETE",
      headers: authHeaders()
     });
    loadTasks();
  };

  const startEdit = (task) => {
    setEditId(task.id);
    setEditText(task.title);
  };

  const updateTask = async () => {
    if (!editText.trim()) {
      alert("Task title cannot be empty");
      return;
    }
    try {
      const res = await fetch(`${API}${editId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ title: editText }),
      });

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      setEditId(null);
      setEditText("");
      loadTasks();
    } catch (err) {
      console.error(err);
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

      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/breakdown`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ 
          task: task.title, 
          task_id: task.id
        }),
      });

      let data;

      try {
        data = await res.json();
      } catch {
        data = {};
      } 

      if (!res.ok) {
        setAiSteps(data.error || "Something went wrong");
        return;
      }

      setAiSteps(data.steps);
      loadTasks();

    } catch (err) {
      console.error(err);
      setAiSteps("Network error");
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const toggleSubtask = async (subtask) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/tasks/subtasks/${subtask.id}`,
      {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
          completed: !subtask.completed
        })
      }
    );

    loadTasks();
  };

  const clearSteps = async (taskId) => {
    if (!window.confirm("Delete all generated steps?")) {
      return;
    }

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/tasks/${taskId}/subtasks`,
        {
          method: "DELETE",
          headers: authHeaders()
        }
      );

      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTask = async (id) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/tasks/${id}/complete`,
      {
        method: "PUT",
        headers: authHeaders()
      }
    );

    loadTasks();
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = [...tasks];

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
  };
  

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-gray-100 to-slate-200 flex justify-center p-6">
      
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Task Manager
          </h1>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition shadow-sm"
          >
            Logout
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Completed:
          {" "}
          {tasks.filter(t => t.completed).length}
          {" / "}
          {tasks.length}
        </div>

        {/* Add Task Card */}
        <div className="bg-white p-4 rounded-2xl shadow-md mb-6 flex gap-3">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            className="bg-blue-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-blue-700 transition shadow-sm"
          >
            Add
          </button>
        </div>

        {/* Task List */}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="tasks">
            {(provided) => (
              <div
                className="flex flex-col"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >

                {Array.isArray(tasks) && tasks.map((t, index) => (
                  <Draggable key={`task-${t.id}`} draggableId={`task-${t.id}`} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={provided.draggableProps.style}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 p-4 hover:shadow-md cursor-grab min-h-16"
                      >

                        {/* Task Header */}
                        <div className="flex justify-between items-center">

                          <div className="flex items-center gap-3">

                            <input
                              type="checkbox"
                              checked={t.completed}
                              onChange={() => toggleTask(t.id)}
                              className="w-4 h-4"
                            />

                            <span
                              className={`text-base font-medium ${
                                t.completed
                                  ? "line-through text-gray-400"
                                  : "text-gray-800"
                              }`}
                            >
                              {t.title}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">

                            <button
                              disabled={loadingTaskId === t.id}
                              onClick={() => generateSteps(t)}
                              className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-sm hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              {loadingTaskId === t.id ? "Generating..." : "AI"}
                            </button>

                            {t.subtasks?.length > 0 && (
                              <button
                                onClick={() => clearSteps(t.id)}
                                className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm hover:bg-green-200"
                              >
                                Clear Steps
                              </button>
                            )}

                            <button
                              onClick={() => startEdit(t)}
                              className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm hover:bg-blue-200 transition"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm("Delete this task?")) {
                                  deleteTask(t.id);
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm hover:bg-red-200 transition"
                            >
                              Delete
                            </button>

                          </div>
                        </div>

                        {/* Edit Mode */}
                        {editId === t.id && (
                          <div className="flex gap-2 mt-3">
                            <input
                              className="flex-1 border rounded-xl px-3 py-2"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />

                            <button
                              onClick={updateTask}
                              className="bg-green-500 text-white px-4 rounded-xl hover:bg-green-600 transition"
                            >
                              Save
                            </button>
                          </div>
                        )}

                        {t.subtasks?.length > 0 && (
                          <button
                            onClick={() => toggleExpanded(t.id)}
                            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {expandedTasks[t.id]
                              ? "▲ Hide Steps"
                              : `▼ Show Steps (${t.subtasks.length})`}
                          </button>
                        )}

                        {/* Subtasks */}
                        {expandedTasks[t.id] && t.subtasks?.length > 0 && (
                          <div className="mt-4 pl-6 border-l border-gray-100 space-y-2">

                            {t.subtasks.map((s) => (
                              <div key={s.id} className="flex items-center gap-2">

                                <input
                                  type="checkbox"
                                  checked={s.completed}
                                  onChange={() => toggleSubtask(s)}
                                />

                                <span className="text-sm text-gray-600">
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
                onClick={() => setAiSteps("")}
                className="text-sm text-gray-500 hover:text-gray-700"
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