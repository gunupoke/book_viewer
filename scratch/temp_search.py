import urllib.request, json, urllib.parse

def search_rakuten(title):
    url = f'https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=1021422709664539169&title={urllib.parse.quote(title)}&hits=1'
    try:
        with urllib.request.urlopen(url) as res:
            data = json.loads(res.read().decode())
            if 'Items' in data and len(data['Items']) > 0:
                item = data['Items'][0]['Item']
                print(f'Title: {item.get("title")}')
                print(f'Author: {item.get("author")}')
                print(f'Publisher: {item.get("publisherName")}')
                print(f'Date: {item.get("salesDate")}')
                print(f'ISBN: {item.get("isbn")}')
                print(f'Desc: {item.get("itemCaption", "")[:100]}')
            else:
                print(f'NOT FOUND in Rakuten: {title}')
    except Exception as e:
        print(f'Error Rakuten: {e}')

def search_rakuten_mag(title):
    url = f'https://app.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId=1021422709664539169&title={urllib.parse.quote(title)}&hits=1'
    try:
        with urllib.request.urlopen(url) as res:
            data = json.loads(res.read().decode())
            if 'Items' in data and len(data['Items']) > 0:
                item = data['Items'][0]['Item']
                print(f'[MAG] Title: {item.get("title")}')
                print(f'[MAG] Publisher: {item.get("publisherName")}')
                print(f'[MAG] Date: {item.get("salesDate")}')
                print(f'[MAG] JAN: {item.get("jan")}')
            else:
                print(f'NOT FOUND in Rakuten Mag: {title}')
    except Exception as e:
        print(f'Error Rakuten Mag: {e}')

titles = ['知識検定事典', 'SAVE THE CATの法則', '謎検対策問題集2024春', '真・バトル奥義']
for t in titles:
    search_rakuten(t)
    search_rakuten_mag(t)
    print('---')
