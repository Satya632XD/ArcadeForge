export class PreviewService {
  constructor({
    iframe,
    consoleOutput,
    onStatus = () => {}
  }) {
    this.iframe = iframe;
    this.consoleOutput = consoleOutput;
    this.onStatus = onStatus;
    this.currentBlobUrl = null;
    this.messageHandler = null;
  }

  clearConsole() {
    if (this.consoleOutput) {
      this.consoleOutput.innerHTML = "";
    }
  }

  log(type, message) {
    if (!this.consoleOutput) {
      return;
    }

    const row = document.createElement("div");
    row.className = `preview-console-line ${type}`;
    row.textContent = `[${type}] ${message}`;

    this.consoleOutput.appendChild(row);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }

  buildDocument(files = {}) {
    let html = files["index.html"] || files["index.htm"];

    if (!html) {
      html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArcadeForge Preview</title>
</head>
<body>
</body>
</html>`;
    }

    const cssFiles = [];
    if (files["style.css"]) cssFiles.push(files["style.css"]);
    if (files["styles.css"]) cssFiles.push(files["styles.css"]);
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith(".css") && path !== "style.css" && path !== "styles.css") {
        cssFiles.push(content);
      }
    }
    const css = cssFiles.join("\n\n");

    const jsFiles = [];
    if (files["app.js"]) jsFiles.push(files["app.js"]);
    if (files["main.js"]) jsFiles.push(files["main.js"]);
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith(".js") && path !== "app.js" && path !== "main.js" && !path.endsWith(".test.js")) {
        jsFiles.push(content);
      }
    }
    const js = jsFiles.join("\n\n");

    if (css) {
      const styleTag = `<style>\n${css}\n</style>`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${styleTag}\n</head>`);
      } else {
        html = `${styleTag}\n${html}`;
      }
    }

    if (js) {
      const scriptTag = `<script>
        window.addEventListener("error", function(event) {
          parent.postMessage({
            source: "nova-preview",
            type: "error",
            message: event.message || "Script execution error"
          }, "*");
        });

        (function() {
          var origLog = console.log;
          var origError = console.error;
          var origWarn = console.warn;
          console.log = function() {
            var args = Array.prototype.slice.call(arguments);
            parent.postMessage({
              source: "nova-preview",
              type: "log",
              message: args.map(function(a) {
                return typeof a === "object" ? JSON.stringify(a) : String(a);
              }).join(" ")
            }, "*");
            if (origLog) origLog.apply(console, arguments);
          };
          console.error = function() {
            var args = Array.prototype.slice.call(arguments);
            parent.postMessage({
              source: "nova-preview",
              type: "error",
              message: args.map(function(a) {
                return typeof a === "object" ? JSON.stringify(a) : String(a);
              }).join(" ")
            }, "*");
            if (origError) origError.apply(console, arguments);
          };
          console.warn = function() {
            var args = Array.prototype.slice.call(arguments);
            parent.postMessage({
              source: "nova-preview",
              type: "warn",
              message: args.map(function(a) {
                return typeof a === "object" ? JSON.stringify(a) : String(a);
              }).join(" ")
            }, "*");
            if (origWarn) origWarn.apply(console, arguments);
          };
        })();

        try {
          ${js}
        } catch (err) {
          parent.postMessage({
            source: "nova-preview",
            type: "error",
            message: String(err && err.message ? err.message : err)
          }, "*");
        }
      <\/script>`;

      if (html.includes("</body>")) {
        html = html.replace("</body>", `${scriptTag}\n</body>`);
      } else {
        html += `\n${scriptTag}`;
      }
    }

    return html;
  }

  render(files) {
    if (!this.iframe) {
      return;
    }

    this.clearConsole();
    this.onStatus("Updating preview…");

    const html = this.buildDocument(files);

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    this.currentBlobUrl = url;

    this.iframe.onload = () => {
      this.onStatus("Live");
    };

    this.iframe.src = url;
  }

  attachMessageListener() {
    this.detachMessageListener();

    this.messageHandler = event => {
      if (!event.data || event.data.source !== "nova-preview") {
        return;
      }

      const { type, message } = event.data;
      this.log(type === "error" ? "error" : type === "warn" ? "warn" : "log", message);
    };

    window.addEventListener("message", this.messageHandler);
  }

  detachMessageListener() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
  }

  destroy() {
    this.detachMessageListener();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}
