from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=375,812') # iPhone X size for mobile view
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

try:
    driver = webdriver.Chrome(options=options)
    driver.get("http://localhost:8085")
    time.sleep(1)

    # Inject mock data and render
    js_script = """
    allBooks = [
      {
        Title: "やっぱりチンチランド 2",
        Author: "大川ぶくぶ",
        Publisher: "KADOKAWA",
        Year: "2026-03-27",
        Status: "読み終わった",
        ISBN13: "9781234567890"
      },
      {
        Title: "やっぱりチンチランド 1",
        Author: "大川ぶくぶ",
        Publisher: "KADOKAWA",
        Year: "2025-01-15",
        Status: "読み終わった",
        ISBN13: "9780987654321"
      }
    ];
    renderBooks(allBooks);
    """
    driver.execute_script(js_script)
    time.sleep(1)

    # Take screenshot of the main list view
    os.makedirs('artifacts', exist_ok=True)
    driver.save_screenshot('artifacts/main_list_view.png')

    # Open detail modal
    js_script2 = """
    openDetailModal(allBooks[0], 'https://images-na.ssl-images-amazon.com/images/P/9781234567890.09.LZZZZZZZ.jpg');
    """
    driver.execute_script(js_script2)
    time.sleep(1)

    # Take screenshot of the modal
    driver.save_screenshot('artifacts/modal_view.png')

    print("Screenshots taken successfully!")
    driver.quit()
except Exception as e:
    print("Error:", e)
