import fs from "fs";
import path from "path";
import { Color } from "@raycast/api";
import { getCurrentDate } from "./date";

const TODO_STATE = {
  TODO: "TODO",
  PENDING_COMPLETION: "PENDING_COMPLETION",
  COMPLETED: "COMPLETED",
} as const;
type TTodoState = (typeof TODO_STATE)[keyof typeof TODO_STATE];

/**
 * Syntax
 * "- [ ]": Uncompleted task
 * "- [x]": Completed task
 * "{PRIORITY}": Priority of the task. Can be one of `p1` - `p4` or `NONE`
 * "CATEGORY EMOJI": Category of the task. Can be one of the following 💬 📚 💾 ✏️ 💡 🔭 👔 ❌
 * "-> YYYY-MM-DD": Due date of the task
 * "✅ YYYY-MM-DD": Completion date of the task
 * `@[[LABEL]]`: Assignee of the task
 * `#{LABEL}`: Project of the task
 *
 */
export class Todo {
  id: string;
  path: string;
  line: number;
  content: string;
  raw_content: string;
  priority: keyof typeof PRIORITY;
  category: keyof typeof CATEGORY;
  due_date?: Date;
  completion_date?: Date;
  projects: string[] = [];
  assignees: string[] = [];
  private _pending_completion: boolean = false;

  constructor(path: string, line: number, content: string) {
    let parsedContent = content.trim();
    parsedContent = parsedContent.replace("- [ ]", "");

    const isMarkedComplete = content.includes("- [x]");
    parsedContent = parsedContent.replace("- [x]", "");
    const completionDateRegex = /✅ (\d{4}-\d{2}-\d{2})/;
    const completionDateMatch = content.match(completionDateRegex);
    if (completionDateMatch) {
      const [, timeStamp] = completionDateMatch;
      this.completion_date = new Date(timeStamp);
    }
    if (isMarkedComplete && !completionDateMatch) {
      this.completion_date = new Date(2000, 0, 1);
    }
    parsedContent = parsedContent.replace(completionDateRegex, "");

    const priorityRegex = /\{(.*?)\}/;
    const priority = (content.match(priorityRegex)?.[1] || "NONE") as keyof typeof PRIORITY;
    parsedContent = parsedContent.replace(priorityRegex, "");

    let category: TCategoryKey = "NONE";
    for (const categoryIcon of Object.keys(ICON_TO_CATEGORY)) {
      if (!content.includes(categoryIcon)) {
        continue;
      }
      category = ICON_TO_CATEGORY[categoryIcon as TCategoryIcon];
    }
    parsedContent = parsedContent.replace(CATEGORY[category].icon, "");

    const dueDateRegex = /-> (\d{4}-\d{2}-\d{2})/;
    const dueDateMatch = content.match(dueDateRegex);
    if (dueDateMatch) {
      const [, timeStamp] = dueDateMatch;
      this.due_date = new Date(timeStamp);
    }
    parsedContent = parsedContent.replace(dueDateRegex, "");

    const projectRegex = /#(\S+)/g;
    const projects = Array.from(content.matchAll(projectRegex));
    if (projects.length > 0) {
      this.projects = projects.map((match) => match[1]);
    }
    parsedContent = parsedContent.replaceAll(projectRegex, "");

    const assigneeRegex = /@\[\[([^\]]+)\]\]/g;
    const assignees = Array.from(content.matchAll(assigneeRegex));
    if (assignees.length > 0) {
      this.assignees = assignees.map((match) => match[1]);
    }
    parsedContent = parsedContent.replaceAll(assigneeRegex, "");

    parsedContent = parsedContent.trim();

    this.id = `${path}:${line}`;
    this.path = path;
    this.line = line;
    this.raw_content = content;
    this.content = parsedContent;
    this.priority = priority;
    this.category = category;
  }

  get is_overdue() {
    if (!this.due_date) {
      return false;
    }

    return this.due_date < getCurrentDate();
  }

  get is_due() {
    if (!this.due_date) {
      return false;
    }

    console.log(this.content, this.due_date, getCurrentDate(), this.due_date <= getCurrentDate());

    return this.due_date <= getCurrentDate();
  }

  get is_completed() {
    return this.state === TODO_STATE.COMPLETED;
  }
  get is_pending_completion() {
    return this.state === TODO_STATE.PENDING_COMPLETION;
  }

  complete() {
    this._pending_completion = true;
  }

  uncomplete() {
    this._pending_completion = false;
  }

  setPriority(newPriority: keyof typeof PRIORITY) {
    this.priority = newPriority;
  }

  setDueDate(newDueDate?: Date) {
    this.due_date = newDueDate;
  }

  get state(): TTodoState {
    if (this.completion_date) {
      return TODO_STATE.COMPLETED;
    }

    if (this._pending_completion) {
      return TODO_STATE.PENDING_COMPLETION;
    }

    return TODO_STATE.TODO;
  }

  commit() {
    // Commits the completion of the todo to the file

    if (this.state === TODO_STATE.PENDING_COMPLETION) {
      this.completion_date = new Date();
    }

    const completion_date = this.completion_date?.toISOString().split("T")[0];
    const newContent = [
      this.state === TODO_STATE.COMPLETED ? "- [x]" : "- [ ]",
      CATEGORY[this.category].icon,
      this.content,
      this.priority === "NONE" ? "" : `{${this.priority}}`,
      this.due_date ? `-> ${this.due_date.toISOString().split("T")[0]}` : "",
      this.projects.map((project) => `#${project}`).join(" "),
      this.assignees.map((assignee) => `@[[${assignee}]]`).join(" "),
      this.state === TODO_STATE.COMPLETED ? `✅ ${completion_date}` : "",
    ].filter(Boolean).join(" ");

    replaceLine(this.path, this.line, newContent);
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

function getTodosOfFile(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const uncheckedTodos: Todo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTodo = line.startsWith("- [ ]") || line.startsWith("- [x]");
    if (!isTodo) {
      continue;
    }

    uncheckedTodos.push(new Todo(filePath, i + 1, line));
  }

  return uncheckedTodos;
}

function getAllTodos(directory: string, filter: (todo: Todo) => boolean = () => true) {
  const markdownFiles = getMarkdownFilesOfDirectory(directory);
  let allTodos: Todo[] = [];

  for (const filePath of markdownFiles) {
    const todosInFile = getTodosOfFile(filePath).filter(filter);
    allTodos = allTodos.concat(todosInFile);
  }

  return allTodos;
}

export function getAllUncheckedTodos(directory: string) {
  return getAllTodos(directory, (todo) => !todo.is_completed);
}

export function getAllCompletedTodos(directory: string) {
  return getAllTodos(directory, (todo) => todo.is_completed);
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
