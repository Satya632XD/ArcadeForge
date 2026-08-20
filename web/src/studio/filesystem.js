export const DIR_MARKER_SUFFIX = ".novadir";

export const DEFAULT_FILES = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArcadeForge Game</title>
</head>
<body>
  <div id="game-container">
    <canvas id="gameCanvas"></canvas>
  </div>
</body>
</html>`,

  "style.css": `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #05060a;
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

#game-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background: #0b1020;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-width: 100%;
  max-height: 100%;
}`,

  "app.js": `// ArcadeForge Canvas Starter
const canvas = document.getElementById("gameCanvas") || document.createElement("canvas");
if (!canvas.parentElement) document.body.appendChild(canvas);

canvas.width = 720;
canvas.height = 420;
canvas.style.width = "100%";
canvas.style.maxWidth = "720px";

const ctx = canvas.getContext("2d");
let x = 360;
let y = 210;
let angle = 0;

function loop(t) {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Animated pulse orb
  x = 360 + Math.sin(t / 600) * 220;
  y = 210 + Math.cos(t / 400) * 80;
  const radius = 28 + Math.sin(t / 200) * 6;

  ctx.fillStyle = "#7df0b4";
  ctx.shadowColor = "#7df0b4";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
console.log("Game initialized and running!");`
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class FileSystemService {
  constructor(initialFiles = null, projectName = "ArcadeForge Game") {
    this.project = {
      name: projectName,
      files: initialFiles ? clone(initialFiles) : clone(DEFAULT_FILES)
    };
  }

  loadFromFiles(files, projectName = "ArcadeForge Game") {
    if (files && typeof files === "object" && Object.keys(files).length > 0) {
      this.project = {
        name: projectName,
        files: clone(files)
      };
    } else {
      this.project = {
        name: projectName,
        files: clone(DEFAULT_FILES)
      };
    }
  }

  listFiles() {
    return Object.keys(this.project.files).filter(
      key => !key.endsWith(`/${DIR_MARKER_SUFFIX}`)
    ).sort();
  }

  exists(fileName) {
    const normalized = FileSystemService.normalizePath(fileName);
    return Object.prototype.hasOwnProperty.call(
      this.project.files,
      normalized
    );
  }

  readFile(fileName) {
    const normalized = FileSystemService.normalizePath(fileName);
    return this.project.files[normalized] ?? "";
  }

  writeFile(fileName, content) {
    const normalized = FileSystemService.normalizePath(fileName);
    this.project.files[normalized] = content;
  }

  createFile(fileName, content = "") {
    if (!fileName) {
      throw new Error("File name is required.");
    }

    const normalized = FileSystemService.normalizePath(fileName);
    if (!normalized) {
      throw new Error("Invalid file name.");
    }

    if (this.exists(normalized)) {
      throw new Error(`File "${normalized}" already exists.`);
    }

    this.project.files[normalized] = content;
  }

  renameFile(oldName, newName) {
    const oldNorm = FileSystemService.normalizePath(oldName);
    const newNorm = FileSystemService.normalizePath(newName);

    if (!this.exists(oldNorm)) {
      throw new Error(`File "${oldName}" does not exist.`);
    }

    if (oldNorm !== newNorm && this.exists(newNorm)) {
      throw new Error(`File "${newName}" already exists.`);
    }

    const content = this.project.files[oldNorm];
    delete this.project.files[oldNorm];
    this.project.files[newNorm] = content;
  }

  deleteFile(fileName) {
    const normalized = FileSystemService.normalizePath(fileName);
    if (!this.exists(normalized)) {
      return;
    }

    delete this.project.files[normalized];
  }

  snapshot() {
    return clone(this.project.files);
  }

  reset() {
    this.project.files = clone(DEFAULT_FILES);
  }

  static normalizePath(path) {
    if (!path) return "";

    let normalized = String(path)
      .replace(/\\/g, "/")
      .replace(/\/{2,}/g, "/");

    if (normalized.startsWith("./")) {
      normalized = normalized.slice(2);
    }

    if (normalized.startsWith("/")) {
      normalized = normalized.slice(1);
    }

    if (normalized.endsWith("/") && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  static resolvePath(cwd, inputPath) {
    if (!inputPath || inputPath === ".") {
      return FileSystemService.normalizePath(cwd);
    }

    const isAbsolute = inputPath.startsWith("/");

    const base = isAbsolute
      ? []
      : FileSystemService.normalizePath(cwd)
          .split("/")
          .filter(Boolean);

    const parts = inputPath
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);

    const stack = [...base];

    for (const part of parts) {
      if (part === "." || part === "") {
        continue;
      }

      if (part === "..") {
        stack.pop();
        continue;
      }

      stack.push(part);
    }

    return stack.join("/");
  }

  directoryExists(dirPath) {
    const normalized = FileSystemService.normalizePath(dirPath);

    if (normalized === "") {
      return true;
    }

    const prefix = `${normalized}/`;

    for (const key of Object.keys(this.project.files)) {
      if (key === `${normalized}/${DIR_MARKER_SUFFIX}`) {
        return true;
      }

      if (key.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  fileExists(filePath) {
    const normalized = FileSystemService.normalizePath(filePath);

    return (
      this.exists(normalized) &&
      !normalized.endsWith(`/${DIR_MARKER_SUFFIX}`)
    );
  }

  listDirectory(dirPath) {
    const normalized = FileSystemService.normalizePath(dirPath);

    if (normalized !== "" && !this.directoryExists(normalized)) {
      throw new Error(`No such directory: "${dirPath}"`);
    }

    const prefix = normalized === "" ? "" : `${normalized}/`;

    const dirs = new Set();
    const files = [];

    for (const key of Object.keys(this.project.files)) {
      if (prefix && !key.startsWith(prefix)) {
        continue;
      }

      const rest = key.slice(prefix.length);

      if (!rest) {
        continue;
      }

      const slashIndex = rest.indexOf("/");

      if (slashIndex === -1) {
        if (rest !== DIR_MARKER_SUFFIX) {
          files.push(rest);
        }
      } else {
        dirs.add(rest.slice(0, slashIndex));
      }
    }

    return {
      directories: [...dirs].sort(),
      files: files.sort()
    };
  }

  makeDirectory(dirPath, { recursive = true } = {}) {
    const normalized = FileSystemService.normalizePath(dirPath);

    if (!normalized) {
      throw new Error("Directory name is required.");
    }

    if (this.fileExists(normalized)) {
      throw new Error(`A file named "${dirPath}" already exists.`);
    }

    const segments = normalized.split("/");

    if (!recursive) {
      const parent = segments.slice(0, -1).join("/");

      if (parent && !this.directoryExists(parent)) {
        throw new Error(`No such directory: "${parent}"`);
      }
    }

    if (this.directoryExists(normalized)) {
      return;
    }

    const markerKey = `${normalized}/${DIR_MARKER_SUFFIX}`;
    this.project.files[markerKey] = "";
  }

  removePath(targetPath, { recursive = false } = {}) {
    const normalized = FileSystemService.normalizePath(targetPath);

    if (this.fileExists(normalized)) {
      this.deleteFile(normalized);
      return;
    }

    if (!this.directoryExists(normalized)) {
      throw new Error(`No such file or directory: "${targetPath}"`);
    }

    if (!recursive) {
      throw new Error(`"${targetPath}" is a directory (use recursive removal).`);
    }

    const prefix = `${normalized}/`;

    for (const key of Object.keys(this.project.files)) {
      if (key.startsWith(prefix) || key === normalized) {
        delete this.project.files[key];
      }
    }
  }

  copyFile(sourcePath, destinationPath) {
    const from = FileSystemService.normalizePath(sourcePath);
    let to = FileSystemService.normalizePath(destinationPath);

    if (!this.fileExists(from)) {
      throw new Error(`No such file: "${sourcePath}"`);
    }

    if (this.directoryExists(to)) {
      const baseName = from.split("/").pop();
      to = to === "" ? baseName : `${to}/${baseName}`;
    }

    this.project.files[to] = this.project.files[from];
  }

  moveFile(sourcePath, destinationPath) {
    const from = FileSystemService.normalizePath(sourcePath);
    let to = FileSystemService.normalizePath(destinationPath);

    if (!this.fileExists(from)) {
      throw new Error(`No such file: "${sourcePath}"`);
    }

    if (this.directoryExists(to)) {
      const baseName = from.split("/").pop();
      to = to === "" ? baseName : `${to}/${baseName}`;
    }

    if (to !== from && this.exists(to)) {
      throw new Error(`"${destinationPath}" already exists.`);
    }

    this.project.files[to] = this.project.files[from];
    delete this.project.files[from];
  }

  touchFile(filePath) {
    const normalized = FileSystemService.normalizePath(filePath);

    if (!normalized) {
      throw new Error("File name is required.");
    }

    if (this.directoryExists(normalized)) {
      throw new Error(`"${filePath}" is a directory.`);
    }

    if (!this.exists(normalized)) {
      this.project.files[normalized] = "";
    }
  }
}
