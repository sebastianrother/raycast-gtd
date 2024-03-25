import { useEffect, useState } from "react";
import { List, getPreferenceValues } from "@raycast/api";
import { getAllCompletedTodos, Todo } from "./todo";
import { formatDate } from "./date";

interface Preferences {
  gtd__directory: string;
}

export default function Summary() {
  const { gtd__directory } = getPreferenceValues<Preferences>();
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    setTodos(getAllCompletedTodos(gtd__directory));
  }, []);

  const groupedTodos = groupByCompletionDate(todos);
  const completionDates = Object.keys(groupedTodos).sort((a, b) => b.localeCompare(a));
  console.log(completionDates);

  return (
    <List isLoading={todos.length === 0} searchBarPlaceholder="Filter todos by name...">
      {completionDates.map((completionDate) => (
        <List.Section
          title={`${completionDate} --- Completed: ${groupedTodos[completionDate].length}`}
          key={completionDate}
        >
          {groupedTodos[completionDate].map((todo) => (
            <List.Item title={todo.content} key={todo.id} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function groupByCompletionDate(todos: Todo[]) {
  const result: Record<string, Todo[]> = {};
  for (const todo of todos) {
    const completionDate = formatDate(todo.completion_date || new Date(2000, 0, 1));
    if (!result[completionDate]) {
      result[completionDate] = [];
    }
    result[completionDate].push(todo);
  }
  return result;
}
