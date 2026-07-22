import csv
import io
import re

input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_3.txt'
output_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_4.txt'

def enrich_summary(title, original_summary):
    t = title.lower()
    # 漫画シリーズ等の充実した要約
    if '天 ' in t or '天和通り' in t:
        return "麻雀の代打ちとして生きる主人公・天を中心に、個性豊かな勝負師たちの死闘を描いた福本伸行の代表作。人間の生き様や信念が交錯するドラマチックな展開が見どころ。"
    if 'アカギ' in t:
        return "伝説の雀士・赤木しげるの若き日を描いた麻雀漫画の金字塔。卓越した洞察力と度胸で闇の権力者たちから勝利をもぎ取る、息詰まる心理戦が展開される。"
    if 'steins;gate' in t or 'シュタインズ・ゲート' in t:
        return "秋葉原を舞台に、過去へメールを送れるタイムマシンを発見した若者たちの過酷な運命を描くSFサスペンスアドベンチャーの関連作品。予測不能な展開と伏線回収が高く評価されている。"
    if 'occultic;nine' in t:
        return "オカルト系ブログを運営する主人公を中心に、様々な変わり者たちが不可解な事件や超常現象に巻き込まれていく様子を描いた志倉千代丸の超常科学ノベル。"
    if '週刊文春エンタ' in t:
        return "アニメやゲーム、特撮など、エンタメ業界の最前線を独自の視点で切り取る週刊文春の特集ムック。クリエイターへのインタビューや詳細な作品解説が収録されている。"
    if 'スノウボールアース' in t:
        return "怪獣との戦いで氷の星となった地球に帰還した少年と、巨大ロボットの過酷なサバイバルを描くSF冒険漫画。人類の生き残りをかけた壮大で熱い物語が展開する。"
    if '涼宮ハルヒ' in t:
        return "宇宙人や未来人を巻き込んだ非日常を望む女子高生・涼宮ハルヒと、それに巻き込まれるキョンたちSOS団のドタバタを描く、谷川流の大人気ライトノベルシリーズ。"
    if 'コードギアス' in t:
        return "大ヒットアニメ『コードギアス 反逆のルルーシュ』の主人公ルルーシュ（ゼロ）に焦点を当て、その魅力を多角的に掘り下げたファン必携のムック本。"
    
    # 以前のハードコードで薄すぎたものの強化
    if '母性のディストピア' in t:
        return "宇野常寛が、宮崎駿や富野由悠季などのアニメ作品を紐解きながら、日本社会における「母性」の病理と戦後サブカルチャーの変遷を論じた気鋭の批評書。"
    if 'die with zero' in t:
        return "「ゼロで死ね」という過激なテーマを掲げ、資産をただ貯め込むのではなく、人生の充実のために最適なタイミングでお金と時間を使い切る方法を説くベストセラー。"

    return original_summary

def main():
    rows = []
    with open(input_file, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fieldnames = list(reader.fieldnames)
        for row in reader:
            title = row.get('Title', '')
            summary = row.get('Gemini_Summary', '')
            
            # 1. 改行の除去 (タブ区切りなのでタブも念のため除去)
            summary = re.sub(r'[\r\n]+', ' ', summary)
            summary = summary.replace('\t', ' ')
            
            # 2. より統一感のある充実した要約へアップデート
            summary = enrich_summary(title, summary)
            
            row['Gemini_Summary'] = summary.strip()
            rows.append(row)

    with io.open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

if __name__ == '__main__':
    main()
