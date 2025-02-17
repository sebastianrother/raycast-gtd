import { ActionPanel, List, Action, Icon, Color, useNavigation, Form } from "@raycast/api";
import { showToast, Toast } from "@raycast/api";
import { setTimeout } from "timers/promises";
import { PRIORITY, Todo } from "./todo";
import { getRelativeDate } from "./date";

export default function TodoList({ todos, reloadTodos }: { todos: Todo[]; reloadTodos: () => void }) {
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

  const tasksByPriority = ((tasks: Todo[]): Record<keyof typeof PRIORITY, Todo[]> => {
    const result: Record<string, Todo[]> = {};
    for (const priority of Object.keys(PRIORITY)) {
      result[priority as keyof typeof PRIORITY] = [];
    }

    result["NONE"] = [];

    for (const task of tasks) {
      result[task.priority].push(task);
    }

    return result;
  })(todos);

  return (
    <List isLoading={todos.length === 0}>
      {Object.entries(tasksByPriority).map(([priority, tasks]) => {
        const currentPriority = PRIORITY[priority as keyof typeof tasksByPriority];
        return (
          <List.Section title={currentPriority.name} key={priority}>
            {tasks.map((task) => {
              type TTags = NonNullable<Parameters<typeof List.Item>[0]["accessories"]>;
              const tags: TTags = [{ tag: { value: task.priority, color: PRIORITY[task.priority].color } }];

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
                tags.push({ icon: Icon.Person, tag: { value: assginee } });
              }

              return (
                <List.Item
                  title={task.content}
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
                      <Action.Push
                        icon={Icon.Pencil}
                        title="Edit Todo"
                        shortcut={{ modifiers: ["cmd"], key: "n" }}
                        target={
                          <EditTodoForm
                            todo={getTodoById(task.id)}
                            onEdit={(todo: Todo) => {
                              todo.commit();
                              reloadTodos();
                            }}
                          />
                        }
                      />
                      {Object.keys(PRIORITY)
                        .filter((priority) => priority !== "NONE")
                        .map((priority, i) => {
                          return (
                            <Action
                              title={`Change Priority to: "${PRIORITY[priority as keyof typeof PRIORITY].name}"`}
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

function EditTodoForm({ todo, onEdit }: { todo: Todo; onEdit: (todo: Todo) => void }) {
  const { pop } = useNavigation();

  function handleSubmit() {
    onEdit(todo);
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Todo" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="content" title="Content" value={todo.content} />
      <Form.DatePicker id="dueDate" title="dueDate" value={todo.due_date} />
      <Form.Dropdown id="priority" title="priority" value={todo.priority} />
      <Form.Dropdown id="category" title="category" value={todo.category} />
    </Form>
  );
}
