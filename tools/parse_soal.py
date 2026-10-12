#!/usr/bin/env python3
"""Urai soal Word (.docx) panitia -> JSON bank soal. Pakai: parse_soal.py file.docx out.json"""
import sys, re, json, subprocess, docx
DASH = re.compile(r'^\s+-{3,}( +-{3,})*\s*$')
def rapi(s): return re.sub(r'\s+', ' ', s).strip()

def kunci_tabel(d):
    tok = []
    for t in d.tables:
        for r in t.rows:
            seen = []
            for c in r.cells:
                if c._tc in seen: continue
                seen.append(c._tc); tok.append(rapi(c.text))
    key = {}; i = 0
    while i < len(tok):
        m = re.fullmatch(r'(\d{1,2})\s*\.?\s*([A-Da-d])', tok[i])
        if m: key[int(m[1])] = m[2].upper(); i += 1; continue
        if re.fullmatch(r'\d{1,2}', tok[i]) and i + 1 < len(tok) and re.fullmatch(r'[A-Da-d]', tok[i + 1]):
            key[int(tok[i])] = tok[i + 1].upper(); i += 2; continue
        i += 1
    return key

def data_tables(d):
    out = []
    for t in d.tables:
        rows = [[rapi(c.text) for c in r.cells] for r in t.rows]
        flat = [x for r in rows for x in r]
        if sum(bool(re.fullmatch(r'(\d{1,2}\s*\.?\s*)?[A-D]|No\.?|Jawaban', x)) or bool(re.fullmatch(r'\d{1,2}', x)) for x in flat if x) >= 0.8 * max(1, len([x for x in flat if x])):
            continue  # tabel kunci
        out.append(rows)
    return out

def urai(path):
    d = docx.Document(path)
    txt = subprocess.run(['pandoc', path, '-t', 'plain', '--wrap=none'], capture_output=True, text=True, check=True).stdout
    lines = txt.split('\n')
    # potong di bagian kunci
    cut = len(lines)
    for i, l in enumerate(lines):
        if re.match(r'^\s*([A-Z]{1,2}\.\s*)?kunci jawaban', l, re.I) and i > 40: cut = i; break
    lines = lines[:cut]
    # buang blok tabel (ganti penanda)
    out = []; i = 0; ntab = 0
    while i < len(lines):
        if DASH.match(lines[i]):
            j = i + 1; dash = 1
            while j < len(lines) and dash < 3:
                if DASH.match(lines[j]): dash += 1
                j += 1
            out.append('@@TABEL@@'); i = j; continue
        out.append(lines[i]); i += 1
    lines = out
    qs = re.compile(r'^\s{0,4}(\d{1,2})\.\s*(.*)$')
    def blok(n0):
        # cari awal soal n0 yang valid: blok sampai penanda n0+1 punya opsi A.
        cands = [i for i, l in enumerate(lines) if (m := qs.match(l)) and int(m[1]) == n0]
        return cands
    hasil = []; pos = 0; tabs = data_tables(d); ti = 0
    for n in range(1, 51):
        cands = [i for i in blok(n) if i >= pos]
        mulai = None
        for c in cands:
            nxt = [i for i in blok(n + 1) if i > c]
            akhir = nxt[0] if nxt else len(lines)
            if any(re.match(r'^\s*[Aa]\.\s', l) or re.search(r'(^|\s)[Aa]\.\s', l) for l in lines[c:akhir]): mulai = c; akhir_ = akhir; break
        if mulai is None: raise SystemExit(f'soal {n}: tidak ditemukan')
        # akhir sebenarnya: awal soal n+1 yang valid
        b = lines[mulai:akhir_]; pos = akhir_
        b[0] = re.sub(r'^\s*\d{1,2}\.\s*', '', b[0])
        # paragraf
        par = []; cur = []
        for l in b:
            if l.strip() == '': 
                if cur: par.append(' '.join(x.strip() for x in cur)); cur = []
            else: cur.append(l)
        if cur: par.append(' '.join(x.strip() for x in cur))
        # cari paragraf awal opsi
        ia = next((k for k, p in enumerate(par) if re.match(r'^[Aa]\.\s', p)), None)
        if ia is None: raise SystemExit(f'soal {n}: opsi A tidak ada')
        stem = [p for p in par[:ia] if p != '.']
        # kumpulkan opsi dari paragraf ia.. sampai D tercapai
        gabung = ''; 
        for p in par[ia:]:
            gabung += ' ' + p
            if re.search(r'(^|\s)[Dd]\.\s', gabung): break
        m = list(re.finditer(r'(?:^|\s)([A-Da-d])\.\s+', gabung))
        pilih = []; huruf = 'ABCD'; k = 0
        for mm in m:
            if mm[1].upper() == huruf[k]: pilih.append(mm); k += 1
            if k == 4: break
        if k < 4: raise SystemExit(f'soal {n}: opsi tak lengkap: {gabung[:120]}')
        opsi = []
        for x in range(4):
            a = pilih[x].end(); e = pilih[x + 1].start() if x < 3 else len(gabung)
            opsi.append(rapi(gabung[a:e]))
        tb = None
        if any('@@TABEL@@' in p for p in stem):
            tb = tabs[ti]; ti += 1; stem = [p for p in stem if '@@TABEL@@' not in p]
        # sisa teks setelah D pada paragraf yang sama? (abaikan)
        q = {'id': f'q{n:02d}', 't': '\n\n'.join(rapi(p) for p in stem), 'o': [{'t': o} for o in opsi]}
        if tb: q['tb'] = ['|'.join(r) for r in tb]
        hasil.append(q)
    key = kunci_tabel(d)
    miss = [n for n in range(1, 51) if n not in key]
    if miss: raise SystemExit(f'kunci hilang: {miss}')
    for n, q in enumerate(hasil, 1): q['k'] = 'ABCD'.index(key[n])
    return hasil

if __name__ == '__main__':
    r = urai(sys.argv[1]); json.dump(r, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1); print(len(r), 'soal ->', sys.argv[2])
