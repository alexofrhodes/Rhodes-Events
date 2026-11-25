@echo off & cd /d "%~dp0" & (where python >nul 2>&1 || (echo Python was not found on PATH. Install Python or add it to PATH, then run this again. & pause & exit /b 1)) & python -x "%~f0" & goto :eof
# The line above is the Windows part; Python skips it (-x) and runs the rest of this file.
# Serves this folder on the first free port from BASE up, so two sites never share a port
# (a shared port would mix up their service workers and saved settings).
import functools, http.server, os, socket, sys, webbrowser

NAME = "Rhodes Events"
BASE = 8088


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = False  # Python's default would let us silently share a busy port on Windows

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        socket.socket.bind(self.socket, self.server_address)
        self.server_address = self.socket.getsockname()
        self.server_name, self.server_port = self.server_address[0], self.server_address[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".webmanifest": "application/manifest+json",
                      ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".md": "text/markdown"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always see your latest edits
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


root = os.path.dirname(os.path.abspath(__file__))
handler = functools.partial(Handler, directory=root)
for port in range(BASE, BASE + 50):
    try:
        httpd = Server(("127.0.0.1", port), handler)
        break
    except OSError:
        continue
else:
    input(f"No free port between {BASE} and {BASE + 49}. Press Enter to close.")
    sys.exit(1)

url = f"http://127.0.0.1:{port}/"
print(f"Serving {NAME} at {url}" + ("" if port == BASE else f"  (port {BASE} was busy)"))
print("Close this window or press Ctrl+C to stop.")
webbrowser.open(url)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
