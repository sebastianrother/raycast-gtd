import { useEffect, useState } from "react";
import { ActionPanel, List, Action, Icon, Color } from "@raycast/api";
import fs from "fs";
import path from "path";
import { showToast, Toast } from "@raycast/api";
import { setTimeout } from "timers/promises";
import { getPreferenceValues } from "@raycast/api";

// TODO: Add timestamp to task completion

interface Preferences {
  gtd__directory: string;
}

function findMarkdownFiles(directory: string) {
  let markdownFiles: string[] = [];

  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      markdownFiles = markdownFiles.concat(findMarkdownFiles(filePath));
    } else if (file.endsWith(".md")) {
      markdownFiles.push(filePath);
    }
  }

  return markdownFiles;
}

type TTask = {
  id: string;
  path: string;
  line: number;
  content: string;
  raw_content: string;
  priority: keyof typeof PRIORITY;
  category: keyof typeof CATEGORY;
};

const PRIORITY = {
  p1: { color: Color.Red, name: "Urgent & Important" },
  p2: { color: Color.Orange, name: "Urgent & Not Important " },
  p3: { color: Color.Yellow, name: "Not Urgent & Important" },
  p4: { color: Color.Green, name: "Not Urgent & Not Important" },
  NONE: { color: Color.Blue, name: "No Priority" },
} as const;

const CATEGORY = {
  CHAT: { icon: "💬", name: "Talk to someone" },
  READING: { icon: "📚 ", name: "Reading" },
  CODING: { icon: "💾", name: "Coding" },
  WRITING: { icon: "✏️", name: "Writing" },
  THINKING: { icon: "💡", name: "Thinking" },
  RESEARCH: { icon: "🔭", name: "Research" },
  CHORE: { icon: "👔", name: "Chore" },
  NONE: { icon: "❌", name: "No Category" },
} as const;
type TCategoryIcon = (typeof CATEGORY)[keyof typeof CATEGORY]["icon"];
type TCategoryKey = keyof typeof CATEGORY;

const ICON_TO_CATEGORY = (() => {
  const result = {} as Record<TCategoryIcon, keyof typeof CATEGORY>;
  const keys = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];

  for (const category of keys) {
    result[CATEGORY[category].icon] = category as keyof typeof CATEGORY;
  }

  return result;
})();

function findUncheckedTasks(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const uncheckedTasks: TTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("- [ ]")) {
      continue;
    }
    const priority = (line.match(/\{(.*?)\}/)?.[1] || "NONE") as keyof typeof PRIORITY;

    let category: TCategoryKey = "NONE";
    for (const categoryIcon of Object.keys(ICON_TO_CATEGORY)) {
      if (!line.includes(categoryIcon)) {
        continue;
      }
      category = ICON_TO_CATEGORY[categoryIcon as TCategoryIcon];
    }

    const content = line
      .trim()
      .replace("- [ ]", "")
      .replace(CATEGORY[category as TCategoryKey].icon, "")
      .replace(`{${priority}}`, "")
      .trim();

    uncheckedTasks.push({
      id: `${filePath}:${i + 1}`,
      path: filePath,
      line: i + 1,
      raw_content: line,
      content: content,
      priority,
      category,
    });
  }

  return uncheckedTasks;
}

function findAllUncheckedTasks(directory: string) {
  const markdownFiles = findMarkdownFiles(directory);
  let allUncheckedTasks: TTask[] = [];

  for (const filePath of markdownFiles) {
    const uncheckedTasksInFile = findUncheckedTasks(filePath);
    allUncheckedTasks = allUncheckedTasks.concat(uncheckedTasksInFile);
  }

  return allUncheckedTasks;
}

function replaceLine(filePath: string, lineNumber: number, newContent: string) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  if (lineNumber < 1 || lineNumber > lines.length) {
    console.error(`Line number ${lineNumber} is out of bounds for file ${filePath}`);
    return;
  }

  lines[lineNumber - 1] = newContent;
  fs.writeFileSync(filePath, lines.join("\n"));
  console.log(`Line ${lineNumber} replaced successfully in ${filePath}`);
}

export default function Command() {
  const { gtd__directory } = getPreferenceValues<Preferences>();
  const [todos, setTodos] = useState<TTask[]>([]);
  const [filter, setFilter] = useState<keyof typeof CATEGORY | "ALL">("ALL");

  useEffect(() => {
    setTodos(findAllUncheckedTasks(gtd__directory));
  }, []);

  const notifyCompletion = async (task: TTask) => {
    const toast = await showToast({
      style: Toast.Style.Success,
      title: "Completed Task: " + task.content,
      primaryAction: {
        title: "Undo",
        onAction: (toast) => {
          // TODO: IMPLEMENT UNDO
          console.log("The toast action has been triggered");
          toast.hide();
        },
      },
    });

    await setTimeout(3000);

    await toast.hide();
  };

  const completeTask = (taskId: TTask["id"]) => {
    const task = todos.find((task) => task.id === taskId);
    if (!task) {
      console.error("Task not found", taskId);
      return;
    }
    replaceLine(task.path, task.line, task.raw_content.replace("- [ ]", "- [x]"));
    // Optimistic update
    setTodos(todos.filter((task) => task.id !== taskId));
    notifyCompletion(task);
  };

  const filteredTasks = todos.filter((task) => {
    return filter === "ALL" || task.category === filter;
  });

  const tasksByPriority = ((tasks: TTask[]) => {
    const result: Record<keyof typeof PRIORITY, TTask[]> = {};
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
                  icon={Icon.Circle}
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
