"""Preview server for the portfolio: serves a folder with caching off.
Usage: python3 serve.py <folder> [port]"""
import http.server, os, sys

os.chdir(sys.argv[1])
port = int(os.environ.get('PORT') or (sys.argv[2] if len(sys.argv) > 2 else 5176))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
