# rc10 — verified backup before any data or schema change

Taken 2026-11-02 from `main` @ `c427be25c9beb61d43a11a299097c1071cae7537`
(the same tree as `audit/rc10/baseline.json`).

```
audit/rc10/backup/data-pre-rc10.tgz
sha256 579f74fb6da97ebab25726b95fe1aa03a21622a5ffee8ed13eb52a38ca254631
bytes  3121172  (3.0 MB)
```

Contents (verified with `tar tzf`):

```
data/vocabulary.json
data/phrases.json
Learned_Vocabulary_List.md
Learned_Phrase_List.md
index.html
```

Per-file digests are the ones recorded in `audit/rc10/baseline.json`:

| File | sha256 | bytes |
| --- | --- | --- |
| `data/vocabulary.json` | `dc3a646f042fec3b9bf86905efb5220c0155d538b04a742fe217adad62b66f63` | 4,972,549 |
| `data/phrases.json` | `8ac412e710e6c6691bf5ef67ecc09752c6f09a86e8b2dce8e31e975083ca7dad` | 575,198 |
| `index.html` | `f49f8b6e8916b924d398f143581d9073f8516a47f93193e9e77ba42ae7cf7a8d` | 17,108,221 |
| `Learned_Vocabulary_List.md` | `4dceeea0e5fb4cbc814697016c061c9a5e981ab467356a7b4f87894de923cb32` | 2,796,250 |
| `Learned_Phrase_List.md` | `63d2be7fcc501e0676819fa6650c4e5dd862d2533284b0c2a33604e73a2db6e4` | 382,131 |

`audit/` is untracked and never staged, so the backup is part of the workspace
snapshot but not of the repository history. If the workspace is ever restored,
re-derive the tarball from the commit above (`git archive c427be2` of those five
paths) rather than trusting a copy of a copy.

Restore procedure for a data change gone wrong:

```
tar xzf audit/rc10/backup/data-pre-rc10.tgz -C <repo>
git diff --stat          # expected: empty for the five files above
```
