import { useState } from "react";
import { ActionPanel, List, Action, Icon, Color } from "@raycast/api";
import { showToast, Toast } from "@raycast/api";
import { setTimeout } from "timers/promises";
import { PRIORITY, CATEGORY, TCategoryKey, Todo } from "./todo";
import { getRelativeDate } from "./date";

export default function TodoList({ todos, reloadTodos }: { todos: Todo[]; reloadTodos: () => void }) {
  const [filter, setFilter] = useState<TCategoryKey | "ALL">("ALL");

  const notifyCompletion = async (completedTodo: Todo) => {
    const toast = await showToast({
      style: Toast.Style.Success,
      title: "Completed Task: " + completedTodo.content,
      primaryAction: {
        title: "Undo",
        onAction: (toast) => {
          completedTodo.uncomplete();
          toast.hide();
          reloadTodos();
        },
      },
    });

    await setTimeout(3000);

    await toast.hide();
    completedTodo.commit();
    reloadTodos();
  };

  const getTodoById = (taskId: Todo["id"]) => {
    const todo = todos.find((task) => task.id === taskId);
    if (!todo) {
      console.error("Task not found", taskId);
      throw new Error("Task not found");
    }
    return todo;
  };

  const completeTask = (taskId: Todo["id"]) => {
    const todo = getTodoById(taskId);
    todo.complete();
    reloadTodos();
    notifyCompletion(todo);
  };

  const changePriority = (taskId: Todo["id"], priority: keyof typeof PRIORITY) => {
    const todo = getTodoById(taskId);
    todo.setPriority(priority);
    todo.commit();
    reloadTodos();
  };

  const changeDueDate = (taskId: Todo["id"], dueDate: Date | null) => {
    const todo = getTodoById(taskId);
    todo.setDueDate(dueDate || undefined);
    todo.commit();
    reloadTodos();
  };

  const filteredTasks = todos.filter((task) => {
    return filter === "ALL" || task.category === filter;
  });

  const tasksByPriority = ((tasks: Todo[]): Record<keyof typeof PRIORITY, Todo[]> => {
    const result: Record<string, Todo[]> = {};
    result["NONE"] = [];
    for (const priority of Object.keys(PRIORITY)) {
      result[priority as keyof typeof PRIORITY] = [];
    }

    for (const task of tasks) {
      result[task.priority].push(task);
    }

    return result;
  })(filteredTasks);

  return (
    <List
      isLoading={todos.length === 0}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by category"
          onChange={(value) => {
            setFilter(value as keyof typeof CATEGORY);
          }}
        >
          <List.Dropdown.Item value="ALL" title="🪐 All" />
          {Object.entries(CATEGORY).map(([category, config]) => {
            return <List.Dropdown.Item key={category} value={category} title={`${config.icon} ${config.name}`} />;
          })}
        </List.Dropdown>
      }
    >
      {Object.entries(tasksByPriority).map(([priority, tasks]) => {
        const currentPriority = PRIORITY[priority as keyof typeof tasksByPriority];
        return (
          <List.Section title={currentPriority.name} key={priority}>
            {tasks.map((task) => {
              type TTags = NonNullable<Parameters<typeof List.Item>[0]["accessories"]>;
              const tags: TTags = [
                { tag: { value: task.priority, color: PRIORITY[task.priority].color } },
                {
                  tag: { value: CATEGORY[task.category].icon, color: Color.Blue },
                  tooltip: CATEGORY[task.category].name,
                },
              ];

              if (task.due_date) {
                tags.push({
                  tag: {
                    value: getRelativeDate(task.due_date),
                    color: task.is_overdue ? Color.Red : Color.SecondaryText,
                  },
                  tooltip: task.due_date.toISOString().split("T")[0],
                });
              }

              for (const project of task.projects) {
                tags.push({ tag: { value: project, color: Color.Green } });
              }

              for (const assginee of task.assignees) {
                tags.push({ icon: Icon.Person, tag: { value: assginee }});
              }

              return (
                <List.Item
                  title={task.content}
                  icon={task.is_pending_completion ? Icon.Check : Icon.Circle}
                  accessories={tags}
                  key={task.id}
                  actions={
                    <ActionPanel>
                      <Action title="Complete Task" onAction={() => completeTask(task.id)} />
                      <Action.PickDate
                        title="Set Due Date"
                        type="Date"
                        onChange={(date) => changeDueDate(task.id, date)}
                      />
                      {Object.keys(PRIORITY)
                        .filter((priority) => priority !== "NONE")
                        .map((priority, i) => {
                          return (
                            <Action
                              title={`Change Priority to: "${currentPriority.name}"`}
                              onAction={() => changePriority(task.id, priority as keyof typeof PRIORITY)}
                              // @ts-expect-error No idea how to cast this
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
