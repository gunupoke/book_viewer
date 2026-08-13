from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time
import os
import http.server
import socketserver
import threading

# Start a simple HTTP server in the background
PORT = 8086
Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("", PORT), Handler)
server_thread = threading.Thread(target=httpd.serve_forever)
server_thread.daemon = True
server_thread.start()
print("Server started on port", PORT)

options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=375,812') # iPhone X size for mobile view
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

try:
    driver = webdriver.Chrome(options=options)
    driver.get(f"http://localhost:{PORT}")
    time.sleep(1)

    # Show the scanner modal (Step 2 Confirm)
    js_script = """
    document.getElementById('scannerModal').classList.add('show');
    document.getElementById('step1Scanning').style.display = 'none';
    
    // Simulate API returning only year/month
    showConfirmDetails("映像の原則", "富野由悠季", "9784873767369", "キネマ旬報社", "2011-09", "映像の原則についての詳細な解説...");
    """
    driver.execute_script(js_script)
    time.sleep(1)

    # Take screenshot of the scanner confirmation modal
    os.makedirs('artifacts', exist_ok=True)
    driver.save_screenshot('artifacts/scanner_confirm_modal.png')

    print("Screenshots taken successfully!")
    driver.quit()
except Exception as e:
    print("Error:", e)
finally:
    httpd.shutdown()
