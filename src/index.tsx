import { useEffect, useState } from "react";
import { ActionPanel, List, Action, Icon, Color } from "@raycast/api";
import { showToast, Toast } from "@raycast/api";
import { setTimeout } from "timers/promises";
import { getPreferenceValues } from "@raycast/api";
import { PRIORITY, CATEGORY, TCategoryKey, getAllUncheckedTodos, Todo } from "./todo";

interface Preferences {
  gtd__directory: string;
}

export default function Command() {
  const { gtd__directory } = getPreferenceValues<Preferences>();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<TCategoryKey | "ALL">("ALL");
  const rerenderFn = useState({})[1];
  const rerender = () => rerenderFn({});

  useEffect(() => {
    setTodos(getAllUncheckedTodos(gtd__directory));
  }, []);

  const notifyCompletion = async (completedTodo: Todo) => {
    const toast = await showToast({
      style: Toast.Style.Success,
      title: "Completed Task: " + completedTodo.content,
      primaryAction: {
        title: "Undo",
        onAction: (toast) => {
          completedTodo.uncomplete();
          toast.hide();
          rerender();
        },
      },
    });

    await setTimeout(3000);

    await toast.hide();
    completedTodo.commit();
    setTodos(todos.filter((todo) => !todo.is_completed));
  };

  const completeTask = (taskId: Todo["id"]) => {
    const todo = todos.find((task) => task.id === taskId);
    if (!todo) {
      console.error("Task not found", taskId);
      return;
    }
    todo.complete();
    rerender();
    notifyCompletion(todo);
  };

  const changePriority = (taskId: Todo["id"], priority: keyof typeof PRIORITY) => {
    const todo = todos.find((task) => task.id === taskId);
    if (!todo) {
      console.error("Task not found", taskId);
      return;
    }

    todo.changePriority(priority);
    todo.commit();
    rerender();
  };

  const filteredTasks = todos.filter((task) => {
    return filter === "ALL" || task.category === filter;
  });

  const tasksByPriority = ((tasks: Todo[]) => {
    const result: Record<keyof typeof PRIORITY, Todo[]> = {};
    for (const priority of Object.keys(PRIORITY)) {
      result[priority as keyof typeof PRIORITY] = [];
    }
    result["NONE"] = [];

    for (const task of tasks) {
      result[task.priority].push(task);
    }

    return result;
  })(filteredTasks);

  return (
    <List
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by category"
          onChange={(value) => {
            setFilter(value);
          }}
        >
          <List.Dropdown.Item value="ALL" title="🪐 All" />;
          {Object.entries(CATEGORY).map(([category, config]) => {
            return <List.Dropdown.Item key={category} value={category} title={`${config.icon} ${config.name}`} />;
          })}
        </List.Dropdown>
      }
    >
      {Object.entries(tasksByPriority).map(([priority, tasks]) => {
        return (
          <List.Section title={PRIORITY[priority].name} key={priority}>
            {tasks.map((task) => {
              return (
                <List.Item
                  title={task.content}
                  icon={task.is_pending_completion ? Icon.Check : Icon.Circle}
                  accessories={[
                    { tag: { value: task.priority, color: PRIORITY[task.priority].color } },
                    {
                      tag: { value: CATEGORY[task.category].icon, color: Color.Blue },
                      tooltip: CATEGORY[task.category].name,
                    },
                  ]}
                  key={task.id}
                  actions={
                    <ActionPanel>
                      <Action title="Complete Task" onAction={() => completeTask(task.id)} />
                      {Object.keys(PRIORITY)
                        .filter((priority) => priority !== "NONE")
                        .map((priority, i) => {
                          return (
                            <Action
                              title={`Change Priority to: "${PRIORITY[priority].name}"`}
                              onAction={() => changePriority(task.id, priority)}
                              shortcut={{ modifiers: ["cmd"], key: (i + 1).toString() }}
                              key={`action-move-to-${priority}`}
                            />
                          );
                        })}
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        );
      })}
    </List>
  );
}
