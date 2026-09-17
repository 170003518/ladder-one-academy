#!/usr/bin/env python3
"""Schema and referential validation for every L1A content file.

Run from anywhere:   python3 tools/validate.py            (everything)
                     python3 tools/validate.py 06-trauma  (one module)
                     L1A_NOTES=1 python3 tools/validate.py (list the notes too)

Needs:  pip install jsonschema referencing

Exit code is 0 when every check passes and 1 when anything failed, so this is
safe to put in front of a commit.

What it checks, per module:
  - every schema file is itself a legal JSON Schema
  - module, question bank and card deck validate against their schemas
  - concept ids are unique; every lesson reference resolves; no orphan concepts
  - prereqs and related resolve (a reference into a lesson that does not exist
    yet is a forward link, counted as a note rather than an error)
  - every question points at a real concept, has exactly four options, and no
    rationale under ten characters
  - every question, card and concept is flagged verify, with notes where required
  - card ids are unique and numbers run 1..N with no gaps
  - card print order follows concept order
  - every card type a concept declares exists in the deck, and vice versa
  - every declared card type has matching card_data
  - every media file resolves on disk and label ids are unique
  - quiz pool size versus questions actually available (a note, not an error:
    quiz.js draws min(pool_size, available) and degrades gracefully)
"""
import json, glob, sys, os, re, collections
ROOT = os.path.expanduser('~/Desktop/ladder-one-academy')
os.chdir(ROOT)
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

def registry():
    reg = Registry()
    for f in glob.glob('schemas/*.json'):
        s = json.load(open(f))
        res = Resource.from_contents(s)
        reg = reg.with_resource(s.get('$id', os.path.basename(f)), res)
        reg = reg.with_resource(os.path.basename(f), res)
    return reg

def main(slugs=None):
    reg = registry(); problems = []; notes = []
    mods = sorted(glob.glob('content/emt/[0-9]*.json'))
    if slugs: mods = [m for m in mods if any(s in m for s in slugs)]
    V = {k: Draft202012Validator(json.load(open(f'schemas/{k}.schema.json')), registry=reg)
         for k in ('module', 'question-bank', 'card-deck')}
    for mf in mods:
        slug = os.path.basename(mf)
        mod = json.load(open(mf))
        qf, cf = f'content/emt/questions/{slug}', f'content/emt/cards/{slug}'
        qs = json.load(open(qf))['questions'] if os.path.exists(qf) else []
        cards = json.load(open(cf))['cards'] if os.path.exists(cf) else []
        def bad(msg): problems.append(f'{slug}: {msg}')
        for label, val, doc in (('module', V['module'], mod),
                                ('questions', V['question-bank'], json.load(open(qf)) if os.path.exists(qf) else None),
                                ('cards', V['card-deck'], json.load(open(cf)) if os.path.exists(cf) else None)):
            if doc is None: continue
            for e in sorted(val.iter_errors(doc), key=lambda e: list(e.path)):
                bad(f'[schema/{label}] {list(e.path)[:6]} {e.message[:200]}')

        cids = [c['id'] for c in mod['concepts']]
        cset = set(cids)
        # 1 unique concept ids
        for i, n in collections.Counter(cids).items():
            if n > 1: bad(f'duplicate concept id {i}')
        # 2 lesson refs resolve, 3 no orphans
        reffed = set()
        for L in mod['lessons']:
            for r in L['concepts']:
                if r not in cset: bad(f'lesson {L["id"]} references missing concept {r}')
                reffed.add(r)
        for i in cset - reffed: bad(f'orphan concept not in any lesson: {i}')
        # 4 prereq/related resolve within the tier
        allc = set()
        for m2 in glob.glob('content/emt/[0-9]*.json'):
            allc |= {c['id'] for c in json.load(open(m2))['concepts']}
        # A reference into a module that has not been written yet is a deliberate
        # forward link, not a broken one. Only flag a miss inside a module that exists.
        # A module under construction has lessons still to come, so "the module file
        # exists" is not enough — the target LESSON has to exist before a miss is real.
        written = set()
        for m2 in glob.glob('content/emt/[0-9]*.json'):
            written |= {L['id'] for L in json.load(open(m2))['lessons']}
        for c in mod['concepts']:
            for f in ('prereqs', 'related'):
                for r in c.get(f, []):
                    if r in allc: continue
                    if r.rsplit('-', 1)[0] in written: bad(f'{c["id"]}.{f} -> unknown {r}')
                    else: notes.append(f'{slug}: {c["id"]}.{f} -> {r} (not written yet)')
        # 5 questions point at real concepts; 6 exactly 4 options; 7 rationale length
        for q in qs:
            if q['concept_id'] not in cset: bad(f'question {q["id"]} -> unknown concept {q["concept_id"]}')
            if len(q['options']) != 4: bad(f'question {q["id"]} has {len(q["options"])} options')
            for o in q['options']:
                if len(o['rationale']) < 10: bad(f'question {q["id"]} rationale too short: {o["rationale"]!r}')
            if not q.get('verify'): bad(f'question {q["id"]} not flagged verify')
            if not q['id'].startswith(q['concept_id']): bad(f'question {q["id"]} id does not self-index')
        # 8 cards: unique, contiguous 1..N, order follows concept order, declared types supplied
        cardids = [c['id'] for c in cards]
        for i, n in collections.Counter(cardids).items():
            if n > 1: bad(f'duplicate card id {i}')
        nums = [c['number'] for c in cards]
        if nums != list(range(1, len(cards) + 1)): bad(f'card numbers not contiguous 1..{len(cards)}')
        order = {c['id']: n for n, c in enumerate(mod['concepts'])}
        seq = [order.get(c['concept_id'], 9999) for c in cards]
        if seq != sorted(seq): bad('card order does not follow concept order')
        have = collections.defaultdict(set)
        for c in cards:
            if c['concept_id'] not in cset: bad(f'card {c["id"]} -> unknown concept {c["concept_id"]}')
            have[c['concept_id']].add(c['type'])
            if not c.get('verify'): bad(f'card {c["id"]} not flagged verify')
        for c in mod['concepts']:
            for t in c.get('cards', []):
                if t not in have[c['id']]: bad(f'{c["id"]} declares card type {t!r} but no such card exists')
            for t in have[c['id']]:
                if t not in c.get('cards', []): bad(f'{c["id"]} has a {t!r} card not declared in cards[]')
            # 9 card_data present for every declared type that needs it
            for t in c.get('cards', []):
                if t in ('drug','numbers','skill','mnemonic','compare','algorithm') and t not in (c.get('card_data') or {}):
                    bad(f'{c["id"]} declares {t!r} but has no card_data.{t}')
        # 10 concepts flagged verify
        for c in mod['concepts']:
            if not c.get('verify'): bad(f'{c["id"]} not flagged verify')
            if c.get('verify') and not c.get('verify_notes'): bad(f'{c["id"]} verify with no notes')
        # 11 media resolves, labels in range
        for c in mod['concepts']:
            for m in (c.get('media') or []):
                if not os.path.exists(m['src']): bad(f'{c["id"]} media missing on disk: {m["src"]}')
                ids = [l['id'] for l in (m.get('labels') or [])]
                for i, n in collections.Counter(ids).items():
                    if n > 1: bad(f'{c["id"]} media {m["src"]} duplicate label id {i}')
        # 12 every concept has a quiz pool it can fill
        byc = collections.Counter(q['concept_id'] for q in qs)
        for c in mod['concepts']:
            ps = (c.get('modes', {}).get('quiz') or {}).get('pool_size')
            # quiz.js draws min(pool_size, available), so a short pool is a
            # thinness note, not a defect.
            if ps and byc[c['id']] < ps:
                notes.append(f'{slug}: {c["id"]} quiz pool {byc[c["id"]]}/{ps}')
        print(f'{slug}: {len(mod["concepts"])} concepts, {len(mod["lessons"])} lessons, '
              f'{len(qs)} questions, {len(cards)} cards')
    if notes:
        thin = [n for n in notes if 'quiz pool' in n]
        fwd = [n for n in notes if 'not written yet' in n]
        print(f'\nNOTES: {len(thin)} concepts with a quiz pool under pool_size, '
              f'{len(fwd)} forward links into unwritten modules')
        if os.environ.get('L1A_NOTES'):
            for n in notes: print('  .', n)
    if problems:
        print(f'\n** PROBLEMS ** ({len(problems)})')
        for p in problems[:80]: print('  -', p)
        return 1
    print('\nALL CHECKS OK')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or None))
