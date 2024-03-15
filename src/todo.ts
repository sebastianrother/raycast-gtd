import fs from "fs";
import path from "path";
import { Color } from "@raycast/api";

const TODO_STATE = {
  "TODO": "TODO",
  "PENDING_COMPLETION": "PENDING_COMPLETION",
  "COMPLETED": "COMPLETED",
} as const;
type TTodoState = typeof TODO_STATE[keyof typeof TODO_STATE];

export class Todo {
  id: string;
  path: string;
  line: number;
  content: string;
  raw_content: string;
  priority: keyof typeof PRIORITY;
  category: keyof typeof CATEGORY;
  private state: TTodoState;

  constructor(path: string, line: number, content: string) {
    const priority = (content.match(/\{(.*?)\}/)?.[1] || "NONE") as keyof typeof PRIORITY;

    let category: TCategoryKey = "NONE";
    for (const categoryIcon of Object.keys(ICON_TO_CATEGORY)) {
      if (!content.includes(categoryIcon)) {
        continue;
      }
      category = ICON_TO_CATEGORY[categoryIcon as TCategoryIcon];
    }

    const parsed_content = content
      .trim()
      .replace("- [ ]", "")
      .replace(CATEGORY[category as TCategoryKey].icon, "")
      .replace(`{${priority}}`, "")
      .trim();

    this.id = `${path}:${line}`;
    this.path = path;
    this.line = line;
    this.raw_content = content;
    this.content = parsed_content;
    this.priority = priority;
    this.category = category;
    this.state = TODO_STATE.TODO;
  }

  get is_completed() {
    return this.state === TODO_STATE.COMPLETED;
  }
  get is_pending_completion() {
    return this.state === TODO_STATE.PENDING_COMPLETION;
  }

  complete() {
    this.state = TODO_STATE.PENDING_COMPLETION;
  }

  uncomplete() {
    this.state = TODO_STATE.TODO;
  }

  commit() {
    // Commits the completion of the todo to the file
    
    if (this.state !== TODO_STATE.PENDING_COMPLETION) {
      return;
    }

    const completion_date = new Date().toISOString().split("T")[0];
    const newContent = this.raw_content.replace("- [ ]", `- [x]`) + ` ✅ ${completion_date}`;
    replaceLine(this.path, this.line, newContent);
    this.state = TODO_STATE.COMPLETED;
  }
}

function getMarkdownFilesOfDirectory(directory: string) {
  let markdownFiles: string[] = [];

  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      markdownFiles = markdownFiles.concat(getMarkdownFilesOfDirectory(filePath));
    } else if (file.endsWith(".md")) {
      markdownFiles.push(filePath);
    }
  }

  return markdownFiles;
}

export const PRIORITY = {
  p1: { color: Color.Red, name: "Urgent & Important" },
  p2: { color: Color.Orange, name: "Urgent & Not Important " },
  p3: { color: Color.Yellow, name: "Not Urgent & Important" },
  p4: { color: Color.Green, name: "Not Urgent & Not Important" },
  NONE: { color: Color.Blue, name: "No Priority" },
} as const;

export const CATEGORY = {
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
export type TCategoryKey = keyof typeof CATEGORY;

const ICON_TO_CATEGORY = (() => {
  const result = {} as Record<TCategoryIcon, keyof typeof CATEGORY>;
  const keys = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];

  for (const category of keys) {
    result[CATEGORY[category].icon] = category as keyof typeof CATEGORY;
  }

  return result;
})();

function getUncheckedTodosFOfFile(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const uncheckedTodos: Todo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("- [ ]")) {
      continue;
    }

    uncheckedTodos.push(new Todo(filePath, i + 1, line));
  }

  return uncheckedTodos;
}

export function getAllUncheckedTodos(directory: string) {
  const markdownFiles = getMarkdownFilesOfDirectory(directory);
  let allUncheckedTasks: Todo[] = [];

  for (const filePath of markdownFiles) {
    const uncheckedTasksInFile = getUncheckedTodosFOfFile(filePath);
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
