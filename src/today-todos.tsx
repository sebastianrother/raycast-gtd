import { useEffect, useState } from "react";
import { getPreferenceValues } from "@raycast/api";
import { getAllUncheckedTodos, Todo } from "./todo";
import TodoList from "./TodoList";

interface Preferences {
  gtd__directory: string;
}

export default function TodayTodos() {
  const { gtd__directory } = getPreferenceValues<Preferences>();
  const [todos, setTodos] = useState<Todo[]>([]);
  const reloadTodos = () => setTodos(getAllUncheckedTodos(gtd__directory));

  useEffect(() => {
    setTodos(getAllUncheckedTodos(gtd__directory));
  }, []);

  const todayTodos = todos.filter((todo) => todo.is_due);
  console.log(todayTodos);

  return <TodoList todos={todayTodos} reloadTodos={reloadTodos} />;
}
