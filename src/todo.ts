import fs from "fs";
import path from "path";
import { Color } from "@raycast/api";
import { formatDate, getCurrentDate } from "./date";

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
 * "-> DD-MM-YYYY": Due date of the task
 * "✅ DD-MM-YYYY": Completion date of the task
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
  due_date?: Date;
  completion_date?: Date;
  projects: string[] = [];
  assignees: string[] = [];
  modified_date: Date;
  private _pending_completion: boolean = false;

  constructor({
    path,
    line,
    content,
    modified_date,
  }: {
    path: string;
    line: number;
    content: string;
    modified_date: Date;
  }) {
    let parsedContent = content.trim();
    parsedContent = parsedContent.replace("- [ ]", "");

    const isMarkedComplete = content.includes("- [x]");
    parsedContent = parsedContent.replace("- [x]", "");
    const completionDateRegex = /✅ (\d{2}-\d{2}-\d{4})/;
    const completionDateMatch = content.match(completionDateRegex);
    if (completionDateMatch) {
      const [, timeStamp] = completionDateMatch;
      this.completion_date = parseDate(timeStamp);
    }
    if (isMarkedComplete && !completionDateMatch) {
      this.completion_date = new Date(2000, 0, 1);
    }
    parsedContent = parsedContent.replace(completionDateRegex, "");

    const priorityRegex = /!!([1-4])/;
    const priority = (content.match(priorityRegex)?.[0] || "NONE") as keyof typeof PRIORITY;
    parsedContent = parsedContent.replace(priorityRegex, "");

    const dueDateRegex = /-> (\d{2}-\d{2}-\d{4})/;
    const dueDateMatch = content.match(dueDateRegex);
    if (dueDateMatch) {
      const [, timeStamp] = dueDateMatch;
      this.due_date = parseDate(timeStamp);
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
    this.modified_date = modified_date;
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

    const completion_date = this.completion_date ? formatDate(this.completion_date) : "";
    const newContent = [
      this.state === TODO_STATE.COMPLETED ? "- [x]" : "- [ ]",
      this.content,
      this.priority === "NONE" ? "" : this.priority,
      this.due_date ? `-> ${formatDate(this.due_date)}` : "",
      this.projects.map((project) => `#${project}`).join(" "),
      this.assignees.map((assignee) => `@[[${assignee}]]`).join(" "),
      this.state === TODO_STATE.COMPLETED ? `✅ ${completion_date}` : "",
    ]
      .filter(Boolean)
      .join(" ");

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
  "!!1": { color: Color.Red, name: "Urgent & Important" },
  "!!2": { color: Color.Orange, name: "Urgent & Not Important " },
  "!!3": { color: Color.Yellow, name: "Not Urgent & Important" },
  "!!4": { color: Color.Green, name: "Not Urgent & Not Important" },
  NONE: { color: Color.Blue, name: "No Priority" },
} as const;

function getTodosOfFile(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const stats = fs.statSync(filePath);
  const mtime = stats.mtime;
  const uncheckedTodos: Todo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTodo = line.startsWith("- [ ]") || line.startsWith("- [x]");
    if (!isTodo) {
      continue;
    }

    uncheckedTodos.push(new Todo({ path: filePath, line: i + 1, content: line, modified_date: mtime }));
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

function parseDate(dateString: string) {
  const [day, month, year] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}
