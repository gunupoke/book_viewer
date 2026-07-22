import csv
input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_2.txt'

with open(input_file, encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for i, row in enumerate(reader):
        if not row.get('Gemini_Summary'):
            print(f"{i}::{row.get('Title')}")
