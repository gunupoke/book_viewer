import urllib.request
import json

isbn = "9784042224314"
try:
    req = urllib.request.urlopen(f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}")
    data = json.loads(req.read())
    if "items" in data:
        print("Google Books:", data["items"][0]["volumeInfo"].get("publishedDate"))
    else:
        print("Google Books: Not found")
except Exception as e:
    print("Google Books error:", e)
