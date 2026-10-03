#!/usr/bin/env python3
"""从 ECDICT 提取雅思核心词（按词频排序取前 4000），生成 data/ielts.json。

用法: python3 scripts/build_ielts.py /path/to/ecdict.csv data/ielts.json
输出: [["word", "phonetic", "translation"], ...] 按词频从高到低
"""
import csv
import json
import sys

MAX_WORDS = 4000


def rank_of(row):
    frq = int(row['frq'] or 0)
    bnc = int(row['bnc'] or 0)
    if frq:
        return frq
    if bnc:
        return bnc + 100000
    return 999999


def main(src, dst):
    rows = []
    with open(src, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if not row['tag'] or 'ielts' not in row['tag'].split():
                continue
            if not row['translation'] or not row['word'].isalpha():
                continue
            t = '\\n'.join(ln for ln in row['translation'].split('\\n')
                           if ln.strip() and not ln.startswith('[网络]'))
            if t:
                rows.append((rank_of(row), row['word'].lower(), row['phonetic'], t))

    rows.sort(key=lambda r: r[0])
    out = [[w, p, t] for _, w, p, t in rows[:MAX_WORDS]]
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'ielts words={len(out)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
