import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useLocal } from "../../hooks/useLocal";

type Task = { id: string; title: string; due: string; priority: "Normal" | "High"; done: boolean };
export default function FocusTasks() {
  const [tasks, setTasks] = useLocal<Task[]>("pd:careeros:tasks", []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const open = tasks.filter((task) => !task.done).sort((a,b) => Number(b.priority === "High") - Number(a.priority === "High") || a.due.localeCompare(b.due));
  const patch = (id: string, change: Partial<Task>) => setTasks(tasks.map((task) => task.id === id ? { ...task, ...change } : task));
  return <div className="career-tasks"><div className="career-tasks-heading"><strong>Your focus tasks</strong><button type="button" onClick={() => setAdding(!adding)}><Plus size={15} /> Add task</button></div>{adding && <form className="career-task-form" onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; setTasks([{ id: crypto.randomUUID(), title: title.trim(), due, priority: "Normal", done: false }, ...tasks]); setTitle(""); setDue(""); setAdding(false); }}><input aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Your next step" required /><input aria-label="Task due date" type="date" value={due} onChange={(event) => setDue(event.target.value)} /><button type="submit">Save</button></form>}{open.length ? open.map((task) => <div className="career-task" key={task.id}><button type="button" className="career-task-check" aria-label={`Complete ${task.title}`} onClick={() => patch(task.id, { done: true })}><Check size={14} /></button><input aria-label="Task title" value={task.title} onChange={(event) => patch(task.id, { title: event.target.value })} /><input aria-label={`Due date for ${task.title}`} type="date" value={task.due} onChange={(event) => patch(task.id, { due: event.target.value })} /><select aria-label={`Priority for ${task.title}`} value={task.priority} onChange={(event) => patch(task.id, { priority: event.target.value as Task["priority"] })}><option>Normal</option><option>High</option></select><button type="button" className="career-task-delete" aria-label={`Delete ${task.title}`} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))}><Trash2 size={15} /></button></div>) : <p className="career-muted">No open tasks. Add a specific next step when you're ready.</p>}{tasks.some((task) => task.done) && <p className="career-muted">{tasks.filter((task) => task.done).length} completed · <button type="button" onClick={() => setTasks(tasks.filter((task) => !task.done))}>Clear completed</button></p>}</div>;
}
