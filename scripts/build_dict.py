#!/usr/bin/env python3
"""从 ECDICT 全量 CSV 提取高频词，生成 PWA 内置词典 dict.json。

用法: python3 scripts/build_dict.py /path/to/ecdict.csv data/dict.json
输出: {"v": 版本, "dict": {单词: [音标, 释义]}, "forms": {变形: 原型}}
ECDICT 项目: https://github.com/skywind3000/ECDICT (MIT License)
"""
import csv
import json
import sys

MAX_WORDS = 40000


def rank_of(row):
    frq = int(row['frq'] or 0)
    bnc = int(row['bnc'] or 0)
    if frq:
        return frq
    if bnc:
        return bnc + 100000
    return 999999


def clean_translation(t):
    lines = [ln for ln in t.split('\\n') if ln.strip() and not ln.startswith('[网络]')]
    return '\\n'.join(lines[:4])


def main(src, dst):
    rows = []
    with open(src, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if not row['translation']:
                continue
            if not (row['collins'] and row['collins'] != '0') and row['oxford'] != '1' \
                    and not (row['frq'] and row['frq'] != '0') and not (row['bnc'] and row['bnc'] != '0'):
                continue
            rows.append(row)

    rows.sort(key=rank_of)
    rows = rows[:MAX_WORDS]

    dictionary = {}
    forms = {}
    for row in rows:
        w = row['word'].lower()
        if not w.isalpha():
            continue
        t = clean_translation(row['translation'])
        if not t:
            continue
        dictionary[w] = [row['phonetic'], t]
        # 变形映射：过去式/过去分词/现在分词/三单/复数/比较级/最高级
        for item in (row['exchange'] or '').split('/'):
            if ':' not in item:
                continue
            kind, form = item.split(':', 1)
            form = form.lower()
            if kind in 'spdi3rt' and form and form.isalpha() and form != w:
                forms.setdefault(form, w)

    out = {'v': 1, 'dict': dictionary, 'forms': forms}
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'words={len(dictionary)} forms={len(forms)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
