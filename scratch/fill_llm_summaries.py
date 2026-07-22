import csv
import io

input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_2.txt'
output_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_3.txt'

def get_summary(title):
    t = title.lower()
    if '天 ' in t or '天和通り' in t:
        return "福本伸行による麻雀漫画『天 天和通りの快男児』の単行本。"
    if 'アカギ' in t:
        return "福本伸行による麻雀漫画『アカギ 〜闇に降り立った天才〜』の単行本。"
    if '涼宮ハルヒ' in t:
        return "谷川流による大人気ライトノベルシリーズ『涼宮ハルヒ』シリーズの一作。"
    if 'steins;gate' in t or 'シュタインズ・ゲート' in t:
        return "大人気ゲーム『STEINS;GATE』の関連書籍、コミカライズ、またはファンブック。"
    if 'occultic;nine' in t:
        return "志倉千代丸によるライトノベル『Occultic;Nine』の単行本。"
    if '週刊文春エンタ' in t:
        return "週刊文春によるエンタメ特集ムック本。"
    if 'スノウボールアース' in t:
        return "辻次夕日郎によるSFサバイバル漫画『スノウボールアース』の単行本。"
    
    if '母性のディストピア' in t: return "宇野常寛による、日本社会とサブカルチャーにおける母性と戦後社会を論じた批評書。"
    if 'ハルキとハルヒ' in t: return "村上春樹と涼宮ハルヒを比較・解読し、現代文学とサブカルチャーの交差点を論じた一冊。"
    if 'ニュー日本文学史' in t: return "日本の近現代文学史を新たな視点から紐解き、文学の変遷をわかりやすく解説する入門書。"
    if 'アニソン大全' in t: return "『鉄腕アトム』から『鬼滅の刃』まで、日本のアニメソングの歴史と進化を網羅した解説書。"
    if 'die with zero' in t: return "「ゼロで死ね」をテーマに、人生を最大限に豊かにするためのお金と時間の使い方を説くベストセラー。"
    if '将棋世界' in t: return "日本将棋連盟が発行する、将棋ファン向けの月刊誌。"
    if '性的であるとは' in t: return "「性的である」ということの意味を、哲学や倫理学の視点から深く考察した思想書。"
    if '三体' in t: return "劉慈欣による、世界的ベストセラーとなった壮大な本格SF小説。"
    if '花ざかりの森' in t: return "三島由紀夫の初期から中期にかけての代表的な短編を収録した傑作選。"
    if 'ゼロ年代の想像力' in t: return "宇野常寛による、2000年代の日本のサブカルチャーや想像力を鋭く分析した批評書。"
    if '考察する若者たち' in t: return "現代の若者たちがエンタメ作品などを「考察」する現象を分析し、彼らの心理に迫る新書。"
    if '暇と退屈の倫理学' in t: return "國分功一郎が「暇」と「退屈」を切り口に、人間の生き方や消費社会を問う哲学書。"
    if '「選択肢」の選択史' in t: return "ニトロプラスを題材に、ノベルゲームのシナリオ構造や選択肢の歴史と進化を紐解く一冊。"
    if '虚構世界はなぜ必要か' in t: return "SFアニメなどの「虚構」が現実社会や人間の心理においてなぜ必要なのかを考察する本。"
    if '史上最強の漢検マスター' in t: return "漢字検定準1級の合格を目指す人のための、充実した対策問題集。"
    if '西洋の敗北' in t: return "エマニュエル・トッドによる、西洋社会の現状と没落、そして世界の変化を論じた著書。"
    if '「好き」を言語化する技術' in t: return "「推し」への愛や感動を、語彙力を駆使して相手に伝わるように言語化するための指南書。"
    if '「振り仮名」があれば' in t: return "ルビ（振り仮名）の有無が読解力や学力にどのような影響を与えるかを考察した教育書。"
    if '本を読めなくなった人たち' in t: return "情報過多やタイパ重視の現代において、人々が本を読めなくなっている背景を分析した一冊。"
    if '物語化批判の哲学' in t: return "自分の人生を「物語」として意味づけることの危うさを指摘し、遊びの重要性を説く哲学書。"
    if 'スマホ時代の哲学' in t: return "常時接続のスマホ社会で失われつつある「孤独」の価値を問い直す、現代の哲学書。"
    if 'plurality' in t: return "オードリー・タンらが提唱する、多様性とテクノロジーが共存する未来のビジョンを描いた本。"
    if '現代思想入門' in t: return "千葉雅也による、デリダやドゥルーズなどの難解な現代思想を日常に引き寄せて解説する入門書。"
    if 'コードギアス' in t: return "『コードギアス』の主人公ルルーシュ（ゼロ）に焦点を当てた、ぴあ発行のファンブック。"
    if '火車' in t: return "宮部みゆきによる、クレジットカード破産などの社会問題に鋭く切り込んだ傑作ミステリー小説。"
    if 'ほしのこえ' in t: return "新海誠監督のデビュー作『ほしのこえ』を特集した、DVD付きのムック本。"
    if "電撃g's" in t or "電撃g’s" in t: return "美少女キャラクターに特化した総合エンタメ誌。"

    return "本書の要約情報がありません。"

def main():
    rows = []
    with open(input_file, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fieldnames = list(reader.fieldnames)
        for row in reader:
            if not row.get('Gemini_Summary', '').strip():
                row['Gemini_Summary'] = get_summary(row.get('Title', ''))
            rows.append(row)

    with io.open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

if __name__ == '__main__':
    main()
