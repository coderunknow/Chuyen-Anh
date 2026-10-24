#!/usr/bin/env python3
"""Build the current, source-aligned dev5 vocabulary audit from reviewed evidence."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from learned_vocabulary import parse_table  # noqa: E402

SOURCE_PATH = ROOT / "Learned_Vocabulary_List.md"
DATA_PATH = ROOT / "data" / "vocabulary.json"
DEV4_PATH = ROOT / "docs" / "vocabulary-audit-dev4.json"
OUT_JSON = ROOT / "docs" / "vocabulary-audit-dev5.json"
OUT_MD = ROOT / "docs" / "vocabulary-audit-dev5.md"
REVIEW_DATE = "2026-10-20"
SOURCE_FIELDS = (
    "word", "pos", "meaning", "tags", "wordFamily", "synonyms", "antonyms",
    "collocations", "register", "connotation", "notes",
)

# Values captured from the canonical source before the dev5 edits. Only fields
# that changed are kept here, so every correction has an auditable before value.
BEFORE: dict[str, dict[str, str]] = {
    "153": {"meaning": "thâm sâu, chỉ dành cho người có chuyên môn"},
    "232": {"meaning": "che giấu, phủ nhận hoặc trái với vẻ bề ngoài"},
    "256": {"meaning": "chiều lòng người khác, quá dễ làm vừa lòng", "register": ""},
    "271": {"meaning": "béo phì, đẫy đà", "register": ""},
    "274": {"meaning": "mang tính quốc tế, cởi mở / người có tầm nhìn quốc tế", "connotation": ""},
    "341": {"meaning": "bất khuất, không chịu thỏa hiệp", "register": "", "connotation": ""},
    "357": {"meaning": "mọt sách, quá chú trọng tiểu tiết hoặc quy tắc học thuật", "connotation": ""},
    "456": {
        "meaning": "cấu trúc giả định: S + suggest/demand/insist/It is essential... + that + S + V-bare (không chia)",
        "notes": "",
    },
    "459": {
        "word": "Check out with",
        "meaning": "khớp với, ăn khớp với (thông tin, lời khai, dữ liệu)",
        "notes": "",
    },
    "460": {"meaning": "lan man, tản mạn, nhảy từ ý này sang ý khác", "register": ""},
    "565": {
        "meaning": "nội dung do AI tạo hàng loạt, chất lượng thấp, vô giá trị",
        "register": "", "connotation": "",
    },
    "579": {
        "meaning": "ý thức trách nhiệm xã hội mãnh liệt, luôn day dứt thôi thúc",
        "notes": "",
    },
    "582": {"meaning": "chói tai, gay gắt; (quan điểm) quyết liệt, hùng hổ đến khó chịu"},
    "584": {"meaning": "thịt ba chỉ xông khói (nạc mỡ xen kẽ)", "notes": ""},
    "591": {"meaning": "ngân sách nhà nước, tiền thuế của dân", "register": ""},
    "617": {
        "meaning": "dự đoán và chuẩn bị đón trước; mong đợi.",
        "notes": "**Phân biệt:** Anticipate thường bao hàm chuẩn bị trước; expect chỉ tin rằng điều gì sẽ xảy ra. **Nguồn:** [2024/tp-ho-chi-minh/so.md:107](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L107) (dạng trong nguồn: anticipate).",
    },
}

CAMBRIDGE = "https://dictionary.cambridge.org/dictionary/english/"
CAMBRIDGE_US = "https://dictionary.cambridge.org/us/dictionary/english/"
GRAMMAR = "https://dictionary.cambridge.org/grammar/british-grammar/"
LEARNER_US = "https://dictionary.cambridge.org/us/dictionary/learner-english/"

# Exact source fragments captured by direct fetch_page inspection on REVIEW_DATE.
# Multiple senses are separate strings: no inserted ellipsis or paraphrase is
# presented as a verbatim excerpt. The short "fat" definition for corpulent is
# retained literally; the example is recorded separately.
DIRECT_EVIDENCE: dict[str, dict[str, Any]] = {
    "1": {
        "url": CAMBRIDGE + "adversity", "headword": "adversity", "partOfSpeech": "noun [U or C]",
        "definitionExcerpt": "a difficult or unlucky situation or event", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": [], "notes": "Directly inspected Cambridge on 2026-10-20; exact definition supports the source gloss 'nghịch cảnh'.",
        "basis": "dev5-direct-revalidation",
    },
    "153": {
        "url": CAMBRIDGE + "esoteric", "headword": "esoteric", "partOfSpeech": "adjective",
        "definitionExcerpt": "very unusual and understood or liked by only a small number of people, especially those with special knowledge",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; the definition centers on restricted understanding/audience, not simply profundity.",
        "basis": "dev5-direct-new-check",
    },
    "232": {
        "url": CAMBRIDGE + "belie", "headword": "belie", "partOfSpeech": "verb [T]",
        "definitionExcerpt": "to show something to be false, or to hide something such as an emotion",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; preserves the false/contradicted and concealed-emotion senses without equating belie with deny.",
        "basis": "dev5-direct-new-check",
    },
    "256": {
        "url": CAMBRIDGE + "complaisant", "headword": "complaisant", "partOfSpeech": "adjective (formal)",
        "definitionExcerpt": "willing to satisfy others by being polite and fitting in with their plans",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; Cambridge labels the adjective formal and does not define it as necessarily excessive.",
        "basis": "dev5-direct-new-check",
    },
    "271": {
        "url": CAMBRIDGE + "corpulent", "headword": "corpulent", "partOfSpeech": "adjective (formal)",
        "definitionExcerpt": "fat", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": ["a corpulent gentleman"],
        "notes": "Directly inspected Cambridge on 2026-10-20; the concise definition is literally 'fat', with the displayed example 'a corpulent gentleman'. Cambridge labels the adjective formal.",
        "basis": "dev5-direct-new-check",
    },
    "274": {
        "url": CAMBRIDGE + "cosmopolitan", "headword": "cosmopolitan",
        "partOfSpeech": "adjective; noun [C] (person)",
        "definitionExcerpt": "containing or having experience of people and things from many different parts of the world",
        "additionalDefinitionExcerpts": ["someone who has experience of many different parts of the world"],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; records the adjective and person-noun senses separately. Cambridge labels them usually approving.",
        "basis": "dev5-direct-new-check",
    },
    "281": {
        "url": CAMBRIDGE + "credence", "headword": "credence", "partOfSpeech": "noun [U]",
        "definitionExcerpt": "the belief that something is true", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; exact definition supports the source gloss 'sự tin tưởng'.",
        "basis": "dev5-direct-revalidation",
    },
    "283": {
        "url": CAMBRIDGE + "culminate", "headword": "culminate", "partOfSpeech": "verb",
        "definitionExcerpt": "If an event or series of events culminates in something, it ends with it, having developed until it reaches this point",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; exact definition supports the source's culminate in/with pattern.",
        "basis": "dev5-direct-revalidation",
    },
    "341": {
        "url": CAMBRIDGE + "intransigent", "headword": "intransigent",
        "partOfSpeech": "adjective (formal, disapproving)",
        "definitionExcerpt": "refusing to change your opinions or behaviour", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": [],
        "notes": "Directly re-inspected Cambridge on 2026-10-20; Cambridge labels the word formal and disapproving, supporting the corrected gloss and register/connotation.",
        "basis": "dev5-direct-revalidation",
    },
    "357": {
        "url": CAMBRIDGE + "pedantic", "headword": "pedantic", "partOfSpeech": "adjective (disapproving)",
        "definitionExcerpt": "giving too much attention to formal rules or small details", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; the definition supports the rules/details gloss and labels the adjective disapproving.",
        "basis": "dev5-direct-new-check",
    },
    "459": {
        "url": CAMBRIDGE + "check-out", "headword": "check out", "partOfSpeech": "phrasal verb (decide if true)",
        "definitionExcerpt": "(of information) to seem to be true because it agrees with other information, or to discover whether information agrees with other information and is therefore likely to be true",
        "additionalDefinitionExcerpts": [],
        "exampleExcerpts": ["Her statement checks out with most of the eyewitness reports."],
        "notes": "Directly inspected Cambridge on 2026-10-20; Cambridge labels the entry 'check out (something)' and shows 'with' in the example/complement, not in the headword.",
        "basis": "dev5-direct-new-check",
    },
    "460": {
        "url": CAMBRIDGE + "discursive", "headword": "discursive",
        "partOfSpeech": "adjective; sense 2 formal",
        "definitionExcerpt": "involving discussion",
        "additionalDefinitionExcerpts": ["talking about or dealing with subjects that are only slightly connected with the main subject for longer than necessary"],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; preserves both the general discussion sense and the marked formal, digressive sense.",
        "basis": "dev5-direct-new-check",
    },
    "565": {
        "url": CAMBRIDGE_US + "ai-slop", "headword": "AI slop",
        "partOfSpeech": "noun [U] (informal, disapproving)",
        "definitionExcerpt": "digital content (= images, video, etc.) of low quality created by artificial intelligence",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected the Cambridge US page on 2026-10-20; the exact phrase is attested and labelled informal/disapproving.",
        "basis": "dev5-direct-new-check",
    },
    "579": {
        "url": None, "headword": None, "partOfSpeech": None,
        "definitionExcerpt": None, "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "No standalone phrase headword verified. Cambridge component pages are recorded as supplemental evidence only; this record remains pending exact-phrase dictionary verification.",
        "basis": "not-dictionary-verified",
    },
    "582": {
        "url": CAMBRIDGE + "strident", "headword": "strident", "partOfSpeech": "adjective",
        "definitionExcerpt": "A strident sound is loud, unpleasant, and rough",
        "additionalDefinitionExcerpts": ["expressing or expressed in forceful language that does not try to avoid upsetting other people"],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; preserves the sound and figurative-language senses without adding aggression as a definition.",
        "basis": "dev5-direct-new-check",
    },
    "584": {
        "url": CAMBRIDGE + "streaky-bacon", "headword": "streaky bacon", "partOfSpeech": "noun [U] (UK)",
        "definitionExcerpt": "meat from the back or sides of a pig that consists of stripes of fat and stripes of meat, often eaten fried in thin slices",
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; smoking is not part of this definition, and the page says smoked streaky bacon may be used if preferred.",
        "basis": "dev5-direct-new-check",
    },
    "591": {
        "url": CAMBRIDGE + "public-purse", "headword": "public purse", "partOfSpeech": "noun [S] (mainly UK)",
        "definitionExcerpt": "money from the government", "additionalDefinitionExcerpts": [],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; supports public/government money rather than specifying tax revenue alone; Cambridge labels the phrase mainly UK.",
        "basis": "dev5-direct-new-check",
    },
    "617": {
        "url": CAMBRIDGE + "anticipate", "headword": "anticipate", "partOfSpeech": "verb [T]",
        "definitionExcerpt": "to imagine or expect that something will happen",
        "additionalDefinitionExcerpts": ["to take action in preparation for something that you think will happen"],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; the page separates EXPECT and TAKE ACTION senses, so expectation does not itself entail preparation.",
        "basis": "dev5-direct-new-check",
    },
    "913": {
        "url": CAMBRIDGE + "virtually", "headword": "virtually", "partOfSpeech": "adverb",
        "definitionExcerpt": "almost",
        "additionalDefinitionExcerpts": ["using computer technology over the internet, and not involving people physically going somewhere"],
        "exampleExcerpts": [],
        "notes": "Directly inspected Cambridge on 2026-10-20; excerpts are two distinct senses and both are represented in the source gloss.",
        "basis": "dev5-direct-revalidation",
    },
}

SUPPLEMENTAL_EVIDENCE: dict[str, list[dict[str, Any]]] = {
    "456": [
        {
            "source": "Cambridge Grammar Today", "sourceType": "grammar-reference",
            "url": GRAMMAR + "suggest", "retrievedAt": REVIEW_DATE,
            "excerpts": [
                "When we suggest an action to someone, we can use a that-clause.",
                "I suggest (that) you leave here around four o’clock.",
                "When suggest is in the past, we can use should in the that-clause:",
            ],
            "note": "Supports a suggestion/action that-clause and the should option; not a standalone dictionary entry for 'subjunctive structure'.",
        },
        {
            "source": "Cambridge Dictionary", "sourceType": "component-verb-examples",
            "url": CAMBRIDGE + "insist", "retrievedAt": REVIEW_DATE,
            "excerpts": [
                "Greg still insists (that) he did nothing wrong.",
                "They insisted that all swear words be deleted from the article.",
            ],
            "note": "Contrasts an assertive that-clause with a demand/mandative example; not counted as exact-headword dictionary verification for ID 456.",
        },
    ],
    "579": [
        {
            "source": "Cambridge Learner's Dictionary", "sourceType": "component-adjective",
            "url": LEARNER_US + "burning", "retrievedAt": REVIEW_DATE,
            "excerpts": ["burning ambition/desire, etc", "a very strong need to do something"],
            "note": "Supports intensity in the component 'burning'; does not establish a fixed phrase 'burning social conscience'.",
        },
        {
            "source": "Cambridge Dictionary", "sourceType": "component-noun-phrase",
            "url": CAMBRIDGE + "social-conscience", "retrievedAt": REVIEW_DATE,
            "excerpts": ["If you have a social conscience, you worry about people who are poor, ill, old, etc. and try to help them."],
            "note": "Supports the component 'social conscience'; the complete phrase remains compositional rather than claimed as a fixed idiom.",
        },
    ],
}

TARGETS: dict[str, dict[str, str]] = {
    "153": {"issue": "The gloss could make esoteric sound primarily profound rather than restricted to a small specialist audience.", "disposition": "Corrected the gloss to the limited-audience/specialized-knowledge sense; exact Cambridge headword directly checked."},
    "232": {"issue": "The prior alternatives conflated concealment, denial, and contradiction.", "disposition": "Separated showing something false from concealing something such as an emotion; exact Cambridge headword directly checked."},
    "256": {"issue": "The prior 'too easy to please' wording added excessiveness not required by the dictionary sense.", "disposition": "Replaced with willing-to-satisfy-others wording and added Cambridge's formal register; exact headword directly checked."},
    "271": {"issue": "The prior Vietnamese alternatives could sound clinical/euphemistic and omitted the marked register.", "disposition": "Used the concise 'fat' sense and added formal register; exact Cambridge headword directly checked."},
    "274": {"issue": "The prior adjective/noun gloss broadened cultural experience into openness or international outlook.", "disposition": "Separated the adjective and person-noun experience senses and recorded the approving connotation; exact headword directly checked."},
    "341": {"issue": "The positive-sounding 'bất khuất' conflicts with refusing to change opinions or behaviour.", "disposition": "Removed the misleading positive gloss; corrected meaning/register/connotation using a direct Cambridge recheck."},
    "357": {"issue": "'Mọt sách' means bookworm and is not equivalent to pedantic.", "disposition": "Removed the conflated word and retained the formal-rules/small-details sense plus disapproving connotation; exact headword directly checked."},
    "456": {"issue": "The bare-verb subjunctive rule could be overgeneralized to assertive uses of suggest/insist.", "disposition": "Scoped the pattern to proposals/requests and documented the should option; Cambridge grammar and examples support the correction, but this grammar row is not dictionary-verified."},
    "459": {"issue": "The headword 'check out with' could conflate a complement with the phrasal-verb headword.", "disposition": "Corrected the headword to 'check out'; Cambridge's exact sense and example show 'with' as a complement, not part of the headword."},
    "460": {"issue": "The prior gloss represented only a negative/digressive sense and omitted the general discussion sense.", "disposition": "Added the general discussion sense and qualified the formal digressive sense; exact headword directly checked."},
    "565": {"issue": "The prior gloss added mass-production and 'worthless' as objective requirements and omitted register.", "disposition": "Aligned with Cambridge's low-quality AI digital-content definition and recorded informal/disapproving labels; exact phrase directly checked."},
    "579": {"issue": "The phrase may be compositional; the prior note implied persistent compulsion and fixed-expression status.", "disposition": "Revised to a compositional meaning with component evidence; no fixed-idiom or exact-phrase dictionary claim is made."},
    "582": {"issue": "'Hùng hổ' added aggression beyond the sound and forceful-language senses.", "disposition": "Reworded both senses to the Cambridge sound and forceful-language definitions; exact headword directly checked."},
    "584": {"issue": "The prior translation assumed smoking was inherent in streaky bacon.", "disposition": "Defined the streaked meat/fat feature and typical preparation; Cambridge treats smoked bacon as an optional choice."},
    "591": {"issue": "The prior gloss narrowed public money to tax revenue.", "disposition": "Changed to government/public funds and added Cambridge's mainly UK label; exact phrase directly checked."},
    "617": {"issue": "The prior note implied expectation always includes preparation.", "disposition": "Separated the expect and take-action-in-preparation senses; exact Cambridge entry directly checked."},
}

LEGACY_OLD_EXCERPTS = {
    "1": "difficult or unlucky situation/event; compatible with 'nghịch cảnh'",
    "281": "belief/acceptance that something is true; compatible with 'sự tin tưởng'",
    "283": "to end with a particular result; 'culminate in/with' compatible",
    "341": "refusing to compromise/change; compatible",
    "448": "low value menial work; compatible with current gloss 'công việc tay chân tầm thường, ít được coi trọng'; previous app gloss historical only",
    "913": "almost; also online sense; both covered",
}
LEGACY_EXACT_REPAIRS = {"1", "281", "283", "341", "913"}
NONEXACT_TARGETS = {"448", "456", "579"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def tier_for(entry_id: str) -> str:
    number = int(entry_id)
    return "core" if number <= 300 else "extended" if number <= 613 else "word-family"


def clean(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def evidence_record(entry_id: str, old: dict[str, Any]) -> dict[str, Any]:
    if entry_id == "579":
        evidence = DIRECT_EVIDENCE[entry_id]
        return {
            "status": "pending-manual", "url": None, "headword": None, "partOfSpeech": None,
            "definitionExcerpt": None, "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
            "retrievedAt": None, "evidenceBasis": "component-only-not-an-exact-phrase-headword",
            "revalidatedInDev5": False, "notes": evidence["notes"],
        }
    if entry_id in DIRECT_EVIDENCE:
        evidence = dict(DIRECT_EVIDENCE[entry_id])
        return {
            "status": "verified", "url": evidence["url"], "headword": evidence["headword"],
            "partOfSpeech": evidence["partOfSpeech"], "definitionExcerpt": evidence["definitionExcerpt"],
            "additionalDefinitionExcerpts": evidence["additionalDefinitionExcerpts"],
            "exampleExcerpts": evidence["exampleExcerpts"], "retrievedAt": REVIEW_DATE,
            "evidenceBasis": evidence["basis"], "revalidatedInDev5": True,
            "notes": evidence["notes"],
        }
    cam = old["evidence"]["cambridge"]
    if cam.get("checked") and entry_id != "448":
        return {
            "status": "verified", "url": cam.get("url"), "headword": cam.get("headword"),
            "partOfSpeech": cam.get("cambridgePos"), "definitionExcerpt": cam.get("definitionExcerpt"),
            "additionalDefinitionExcerpts": [], "exampleExcerpts": [],
            "retrievedAt": cam.get("retrievedAt") or old.get("retrievedAt"),
            "evidenceBasis": "dev4-evidence-carried-forward-not-rechecked-in-dev5",
            "revalidatedInDev5": False,
            "notes": cam.get("notes", "Carried forward from the dev4 evidence record; not re-fetched in the dev5 pass."),
        }
    if entry_id == "448":
        return {
            "status": "pending-manual", "url": None, "candidateUrl": CAMBRIDGE + "menial-task",
            "headword": None, "partOfSpeech": None, "definitionExcerpt": None,
            "additionalDefinitionExcerpts": [], "exampleExcerpts": [], "retrievedAt": None,
            "evidenceBasis": "component-only-not-an-exact-phrase-headword", "revalidatedInDev5": False,
            "notes": "The generated exact-phrase URL returned a generic dictionary landing page. The Cambridge menial component was inspected and shows 'menial tasks' as an example, not a standalone phrase headword.",
        }
    if entry_id in {"456", "579"}:
        return {
            "status": "pending-manual", "url": None, "candidateUrl": cam.get("url"),
            "headword": None, "partOfSpeech": None, "definitionExcerpt": None,
            "additionalDefinitionExcerpts": [], "exampleExcerpts": [], "retrievedAt": None,
            "evidenceBasis": "grammar-or-component-evidence-only-not-an-exact-headword", "revalidatedInDev5": False,
            "notes": "Targeted material was inspected, but it is grammar/component evidence rather than an exact Cambridge dictionary headword; not counted as dictionary-verified.",
        }
    return {
        "status": "pending-manual", "url": None, "candidateUrl": cam.get("url"),
        "headword": None, "partOfSpeech": None, "definitionExcerpt": None,
        "additionalDefinitionExcerpts": [], "exampleExcerpts": [], "retrievedAt": None,
        "evidenceBasis": "generated-candidate-url-only-not-evidence", "revalidatedInDev5": False,
        "notes": "No direct dictionary page was inspected in this pass; a generated candidate URL is not evidence.",
    }


LEGACY_ROWS = 913


def legacy_slice(records: list[dict[str, Any]], label: str) -> list[dict[str, Any]]:
    """Keep the audited legacy block and prove the appended rows never intrude.

    beta7 appends new headwords after ID 913. This audit is a historical record of
    the 913 rows reviewed for dev5, so it audits that prefix and rejects a table
    where a later row claims a legacy ID.
    """
    if len(records) < LEGACY_ROWS:
        raise ValueError(f"{label} has {len(records)} rows, fewer than the {LEGACY_ROWS} legacy rows")
    for record in records[LEGACY_ROWS:]:
        if int(record["id"]) <= LEGACY_ROWS:
            raise ValueError(f"{label} has a row with legacy ID {record['id']} after index {LEGACY_ROWS}")
    return records[:LEGACY_ROWS]


def build_document() -> dict[str, Any]:
    source_records = legacy_slice(parse_table(SOURCE_PATH), "source")
    app_data = legacy_slice(load_json(DATA_PATH), "app JSON")
    dev4 = load_json(DEV4_PATH)
    source_by_id = {record["id"]: record for record in source_records}
    app_by_id = {record["id"]: record for record in app_data}
    dev4_by_id = {record["id"]: record for record in dev4["entries"]}
    expected_ids = [str(i) for i in range(1, 914)]
    for label, mapping in (("source", source_by_id), ("app JSON", app_by_id), ("dev4 audit", dev4_by_id)):
        if list(mapping) != expected_ids:
            raise ValueError(f"{label} must contain ordered IDs 1–913 without gaps/duplicates")
    for entry_id, source in source_by_id.items():
        app = app_by_id[entry_id]
        for field in SOURCE_FIELDS:
            if app.get(field, "" if field in {"wordFamily", "register", "connotation", "notes"} else None) != source[field]:
                raise ValueError(f"source/JSON mismatch for ID {entry_id} field {field}")

    entries: list[dict[str, Any]] = []
    for entry_id in expected_ids:
        source = source_by_id[entry_id]
        app = app_by_id[entry_id]
        old = dev4_by_id[entry_id]
        entries.append({
            "id": entry_id,
            "tier": tier_for(entry_id),
            "source": {field: source[field] for field in SOURCE_FIELDS},
            "appMetadata": {
                "examples": app.get("examples", []),
                "difficulty": app.get("difficulty"),
                "createdAt": app.get("createdAt"),
            },
            "dictionaryVerification": evidence_record(entry_id, old),
            "supplementalEvidence": SUPPLEMENTAL_EVIDENCE.get(entry_id, []),
        })

    corrections: list[dict[str, Any]] = []
    targeted_reviews: list[dict[str, Any]] = []
    for entry_id in sorted(BEFORE, key=int):
        source = source_by_id[entry_id]
        changes = [
            {"field": field, "before": before_value, "after": source[field]}
            for field, before_value in BEFORE[entry_id].items()
            if before_value != source[field]
        ]
        if not changes:
            raise ValueError(f"ID {entry_id} has no source correction despite being listed")
        evidence = DIRECT_EVIDENCE.get(entry_id)
        refs = []
        if evidence and evidence.get("url"):
            refs.append({
                "source": "Cambridge Dictionary", "sourceType": "exact-headword-dictionary",
                "url": evidence["url"], "retrievedAt": REVIEW_DATE,
                "excerpts": [evidence["definitionExcerpt"], *evidence["additionalDefinitionExcerpts"], *evidence["exampleExcerpts"]],
                "partOfSpeech": evidence["partOfSpeech"],
            })
        else:
            refs.extend(SUPPLEMENTAL_EVIDENCE.get(entry_id, []))
        status = (
            "revalidated-and-source-corrected" if entry_id == "341" else
            "corrected-with-grammar-evidence-not-dictionary-verified" if entry_id == "456" else
            "corrected-with-component-evidence-not-exact-phrase-verified" if entry_id == "579" else
            "corrected-and-exact-headword-verified"
        )
        corrections.append({
            "id": entry_id, "word": source["word"], "changes": changes,
            "evidence": refs, "dictionaryStatus": entries[int(entry_id) - 1]["dictionaryVerification"]["status"],
            "disposition": status,
        })
        targeted_reviews.append({
            "id": entry_id, "word": source["word"], "reviewed": True,
            "originalConcern": TARGETS[entry_id]["issue"],
            "disposition": TARGETS[entry_id]["disposition"],
            "sourceCorrection": True, "changedFields": [change["field"] for change in changes],
            "dictionaryVerification": entries[int(entry_id) - 1]["dictionaryVerification"]["status"],
            "evidence": refs,
        })

    legacy_repairs: list[dict[str, Any]] = []
    for entry_id in sorted(LEGACY_EXACT_REPAIRS, key=int):
        evidence = DIRECT_EVIDENCE[entry_id]
        legacy_repairs.append({
            "id": entry_id, "action": "replace-paraphrased-or-annotated-excerpt-with-direct-source-text",
            "oldExcerpt": LEGACY_OLD_EXCERPTS[entry_id],
            "newDefinitionExcerpt": evidence["definitionExcerpt"],
            "additionalDefinitionExcerpts": evidence["additionalDefinitionExcerpts"],
            "url": evidence["url"], "retrievedAt": REVIEW_DATE,
            "dictionaryStatus": "verified", "revalidatedInDev5": True,
        })
    legacy_repairs.append({
        "id": "448", "action": "reclassify-unsupported-standalone-phrase-claim-as-pending",
        "oldExcerpt": LEGACY_OLD_EXCERPTS["448"], "newDefinitionExcerpt": None,
        "attemptedExactHeadwordUrl": CAMBRIDGE + "menial-task",
        "inspectedComponentUrl": CAMBRIDGE + "menial", "retrievedAt": REVIEW_DATE,
        "componentExcerpt": "Menial work is boring, makes you feel tired, and is given a low social value",
        "exampleExcerpt": "New recruits tend to end up with the most menial tasks.",
        "dictionaryStatus": "pending-manual", "revalidatedInDev5": True,
        "reason": "The exact-phrase URL returned a generic dictionary landing page; the component page/example does not establish a separate 'menial task' headword.",
    })

    verified_count = sum(entry["dictionaryVerification"]["status"] == "verified" for entry in entries)
    pending_count = len(entries) - verified_count
    carried = sum(
        entry["dictionaryVerification"]["evidenceBasis"] == "dev4-evidence-carried-forward-not-rechecked-in-dev5"
        for entry in entries
    )
    direct_current = sum(entry["dictionaryVerification"]["revalidatedInDev5"] for entry in entries)
    unreviewed_pending = pending_count - len(NONEXACT_TARGETS)
    unique_deep_ids = {review["id"] for review in targeted_reviews} | LEGACY_EXACT_REPAIRS | {"448"}
    if (verified_count, pending_count, carried, direct_current, unreviewed_pending, len(corrections), len(targeted_reviews), len(unique_deep_ids)) != (145, 768, 127, 18, 765, 16, 16, 21):
        raise ValueError("unexpected dev5 evidence/correction totals")

    generated = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "schemaVersion": "2.0.0",
        "appVersion": "v1.0.0-dev5",
        "generatedAt": generated,
        "total": len(entries),
        "sourceReview": {
            "sourceFile": "Learned_Vocabulary_List.md",
            "sourceRowsReadInNumericOrder": 913,
            "firstId": "1", "lastId": "913",
            "completedBeforeDictionaryResearch": True,
            "comparisonBeforeSourceEdits": {
                "sourceRows": 913, "appJsonRows": 913, "dev4AuditRows": 913,
                "sourceJsonFieldDifferences": 0,
                "sourceDev4AuditFieldDifferences": 0,
                "normalization": "omitted empty register/connotation fields normalized to empty strings",
            },
            "generationParityAssertions": {
                "sourceToAppJson": "all 913 source-managed fields compared by generator",
                "sourceToDev5Entries": "all 913 records emitted from parsed canonical source",
                "embeddedHtml": "checked separately by scripts/embed_vocabulary.py --check and CI",
            },
        },
        "summary": {
            "sourceRowsReviewed": 913,
            "sourceRowsUnreviewed": 0,
            "automatedStructuralChecks": 913,
            "dictionaryVerified": verified_count,
            "dictionaryVerifiedCarriedForwardFromDev4": carried,
            "legacyExactHeadwordsDirectlyRevalidatedInDev5": len(LEGACY_EXACT_REPAIRS),
            "newExactHeadwordsDirectlyVerifiedInDev5": 13,
            "exactHeadwordsDirectlyCheckedInDev5": direct_current,
            "dictionaryPending": pending_count,
            "dictionaryPendingWithTargetedNonExactEvidence": len(NONEXACT_TARGETS),
            "dictionaryPendingNotTargetedThisPass": unreviewed_pending,
            "uniqueDeepReviewIds": len(unique_deep_ids),
            "targetedConcernsReviewed": len(targeted_reviews),
            "evidenceBackedSourceCorrections": len(corrections),
            "sourceCorrectionsWithExactHeadwordDictionaryEvidence": 14,
            "sourceCorrectionsWithGrammarOrComponentEvidenceOnly": 2,
            "legacyEvidenceCorrections": len(legacy_repairs),
            "unresolvedTargetedConcerns": 0,
            "claimsAll913DictionaryVerified": False,
        },
        "methodology": {
            "goal": "Maintain a source-aligned, evidence-led 913-record vocabulary audit while reporting structural parity, carried-forward dictionary evidence, current direct lookups, corrections, and unresolved dictionary work separately.",
            "steps": [
                "Read all 913 canonical source rows in ascending ID order before beginning dictionary research.",
                "Before source edits, compared the 913 source records, app JSON, and dev4 audit; observed zero differences after normalizing omitted empty register/connotation fields.",
                "Reviewed 16 semantic-suspicion candidates; corrected 16 source rows only where direct dictionary, grammar, or component evidence supported the wording. No source row was removed.",
                "Directly rechecked five legacy Cambridge entries, replacing five paraphrased/annotated excerpts with verbatim source fragments; reclassified ID 448 as pending because only component evidence was found.",
                "Directly verified 13 additional exact Cambridge headwords. Alongside 127 dev4 evidence records carried forward without a fresh lookup, this yields 145 evidence-led verified rows and 768 exact-headword pending rows.",
                "Kept the grammar-only ID 456 and component/compositional ID 579 pending exact-headword dictionary verification; ID 448 is also pending. These three targeted rows are not counted as dictionary verified.",
                "Generated the dev5 audit from the current canonical source and app JSON; the dev5 test compares all source-managed fields, IDs, statuses, counts, corrections and evidence. Build/embed checks separately cover the standalone HTML.",
            ],
            "evidenceRules": [
                "A generated URL, source note, dictionary search snippet, or structural check alone is not a verified dictionary entry.",
                "Exact-headword verification requires a directly inspected dictionary page, headword, POS, exact source excerpt, URL, and retrieval date.",
                "Grammar and component evidence may support a correction but is not counted as exact-headword dictionary verification.",
                "127 dev4 entries are explicitly carried forward and were not re-fetched in this dev5 pass; their presence is not a claim of independent revalidation.",
            ],
            "limitations": [
                "This report does not claim 913/913 dictionary verification.",
                "768 entries remain without exact-headword dictionary verification; 765 were not targeted for dictionary research in this pass, while IDs 448, 456, and 579 have only component/grammar or no exact-phrase evidence.",
                "127 stored Cambridge records are carried forward from dev4 and were not revalidated during this pass; five legacy excerpts were rechecked and corrected.",
                "Source-level reading of all 913 rows is distinct from dictionary-level evidence.",
            ],
            "tierCounts": {"core": 300, "extended": 313, "word-family": 300},
            "primaryDictionary": "Cambridge Dictionary",
            "reviewDate": REVIEW_DATE,
        },
        "entries": entries,
        "targetedReviews": targeted_reviews,
        "corrections": corrections,
        "legacyEvidenceRepairs": legacy_repairs,
    }


def build_markdown(doc: dict[str, Any]) -> str:
    summary = doc["summary"]
    by_id = {entry["id"]: entry for entry in doc["entries"]}
    lines = [
        "# Vocabulary audit — v1.0.0-dev5",
        "",
        f"Generated: {doc['generatedAt']} · Schema: {doc['schemaVersion']}",
        "",
        "**Scope note:** all 913 canonical source rows were read in ascending ID order before dictionary research. This is not a claim that all 913 entries were dictionary-verified.",
        "",
        "## Evidence counts",
        "",
        f"- Canonical source rows read: **{summary['sourceRowsReviewed']} / 913**; unreviewed source rows: **{summary['sourceRowsUnreviewed']}**.",
        f"- Automated structural checks: **{summary['automatedStructuralChecks']} / 913** (not dictionary verification).",
        f"- Dictionary-evidence ledger: **{summary['dictionaryVerified']} verified** = {summary['dictionaryVerifiedCarriedForwardFromDev4']} dev4 records carried forward without a fresh dev5 lookup + {summary['exactHeadwordsDirectlyCheckedInDev5']} directly checked in dev5.",
        f"- Exact-headword dictionary verification still pending: **{summary['dictionaryPending']} / 913**.",
        f"- Of those pending: **{summary['dictionaryPendingNotTargetedThisPass']}** were not targeted for dictionary research in this pass; **{summary['dictionaryPendingWithTargetedNonExactEvidence']}** targeted rows have only component/grammar or no exact-phrase evidence (IDs 448, 456, 579).",
        f"- Source corrections: **{summary['evidenceBackedSourceCorrections']}**, each with direct dictionary, grammar, or component evidence; **14** have exact-headword dictionary evidence and **2** use grammar/component evidence only.",
        "",
        "The 127 carried-forward rows retain their stored dev4 evidence, but were not individually re-fetched in this dev5 pass. The current pass directly rechecked five legacy dictionary entries, repaired five paraphrased/annotated excerpts, downgraded ID 448 to pending, and verified 13 additional exact headwords. No 913/913 dictionary-completion claim is made.",
        "",
        "## Source-level parity",
        "",
        "Before source edits, the 913-row Markdown source, app JSON, and dev4 audit were compared with zero field differences after normalizing omitted empty `register`/`connotation` values. The dev5 generator checks all current source-managed fields against app JSON and emits all 913 audit records from the canonical Markdown. `scripts/embed_vocabulary.py --check` validates the standalone HTML payload separately.",
        "",
        "## Targeted review dispositions (16 suspected source rows)",
        "",
        "| ID | Headword | Dictionary status | Disposition |",
        "| ---: | --- | --- | --- |",
    ]
    for review in doc["targetedReviews"]:
        status = by_id[review["id"]]["dictionaryVerification"]["status"]
        lines.append(f"| {review['id']} | {clean(review['word'])} | {status} | {clean(review['disposition'])} |")
    lines.extend([
        "",
        "### Source corrections",
        "",
        "| ID | Field changes | Evidence basis |",
        "| ---: | --- | --- |",
    ])
    for correction in doc["corrections"]:
        changed = "; ".join(
            f"`{change['field']}`: {clean(change['before'])} → {clean(change['after'])}"
            for change in correction["changes"]
        )
        lines.append(f"| {correction['id']} | {changed} | {clean(correction['disposition'])} |")
    lines.extend([
        "",
        "## Direct Cambridge evidence rechecked in dev5",
        "",
        "| ID | Headword | Exact excerpt(s) | URL |",
        "| ---: | --- | --- | --- |",
    ])
    for entry in doc["entries"]:
        verification = entry["dictionaryVerification"]
        if verification["evidenceBasis"] not in {"dev5-direct-new-check", "dev5-direct-revalidation"}:
            continue
        excerpts = [verification["definitionExcerpt"], *verification["additionalDefinitionExcerpts"]]
        if verification["exampleExcerpts"]:
            excerpts.extend("Example: " + item for item in verification["exampleExcerpts"])
        text = "<br>".join("“" + clean(item) + "”" for item in excerpts)
        lines.append(f"| {entry['id']} | {clean(verification['headword'])} | {text} | [{verification['url']}]({verification['url']}) |")
    lines.extend([
        "",
        "**Verbatim excerpt note:** excerpts above are copied as separate source fragments. For ID 271, Cambridge's one-word definition `fat` is retained as-is, with its example recorded separately.",
        "",
        "## Legacy evidence repair",
        "",
        "Five legacy excerpt issues (IDs 1, 281, 283, 341, 913) were corrected after direct Cambridge inspection. ID 448 was reclassified from verified to pending: Cambridge's exact `/menial-task` URL returned a generic dictionary landing page; `/menial` supports the component and contains “menial tasks” as an example, but not a standalone phrase lemma. It is therefore not counted as an exact-headword entry.",
        "",
        "## Non-dictionary evidence for pending rows",
        "",
        "- **ID 456 — Subjunctive structure (still pending dictionary verification):** Cambridge Grammar Today [suggest](https://dictionary.cambridge.org/grammar/british-grammar/suggest) states “When we suggest an action to someone, we can use a that-clause” and “When suggest is in the past, we can use should in the that-clause”; its example begins “I suggest (that) you leave here around four o’clock.” Cambridge Dictionary [insist](https://dictionary.cambridge.org/dictionary/english/insist) contrasts “Greg still insists (that) he did nothing wrong” with “They insisted that all swear words be deleted from the article.” These are grammar/component examples, not an exact dictionary headword for the grammar pattern.",
        "- **ID 579 — Burning social conscience (still pending exact-phrase verification):** Cambridge Learner’s Dictionary [burning](https://dictionary.cambridge.org/us/dictionary/learner-english/burning) gives “burning ambition/desire, etc” and “a very strong need to do something”; Cambridge Dictionary [social conscience](https://dictionary.cambridge.org/dictionary/english/social-conscience) says “If you have a social conscience, you worry about people who are poor, ill, old, etc. and try to help them.” These support a compositional gloss only; no fixed-idiom or standalone `burning social conscience` headword claim is made.",
        "- **ID 448 — Menial task (still pending exact-phrase verification):** the attempted exact URL [`menial-task`](https://dictionary.cambridge.org/dictionary/english/menial-task) returned a generic dictionary landing page. The component entry [menial](https://dictionary.cambridge.org/dictionary/english/menial) says “Menial work is boring, makes you feel tired, and is given a low social value” and gives the example “New recruits tend to end up with the most menial tasks.” This supports a compositional/example reading, not a standalone phrase headword.",
        "",
        "## Method and limitations",
        "",
        "- The verified count combines stored dev4 evidence with direct dev5 lookups; carried-forward evidence is labeled rather than presented as newly rechecked.",
        "- Current exact-headword dictionary verification is **145/913**; **768** remain pending. The broader word-family editorial review does not substitute for dictionary verification.",
        "- All 16 target concerns received a disposition, but this does not resolve the 768 dictionary-pending rows.",
        "- Test and pipeline commands: `python scripts/build_vocabulary.py --check`; `python scripts/validate_vocab.py`; `python scripts/embed_vocabulary.py --check`; `python -m unittest discover -s tests -p 'test_*.py'`; `node --test tests/static-app.test.js`.",
        "- Machine-readable entry-level evidence, corrections, dispositions, source parity accounting, and limitations: [`vocabulary-audit-dev5.json`](vocabulary-audit-dev5.json).",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate or check the source-led dev5 vocabulary audit.")
    parser.add_argument("--check", action="store_true", help="verify committed JSON/Markdown are current without writing")
    args = parser.parse_args()
    try:
        doc = build_document()
        if args.check:
            if not OUT_JSON.exists() or not OUT_MD.exists():
                raise ValueError("dev5 JSON/Markdown report is missing; run the generator once")
            current = load_json(OUT_JSON)
            generated_at = current.get("generatedAt")
            if not isinstance(generated_at, str):
                raise ValueError("committed report has no generatedAt timestamp")
            parsed = dt.datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            if parsed.date().isoformat() != REVIEW_DATE:
                raise ValueError(f"committed report generatedAt date must be {REVIEW_DATE}")
            doc["generatedAt"] = generated_at
            expected_json = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
            expected_md = build_markdown(doc)
            if OUT_JSON.read_text(encoding="utf-8") != expected_json:
                raise ValueError("dev5 JSON report is stale or does not match the current source/evidence")
            if OUT_MD.read_text(encoding="utf-8") != expected_md:
                raise ValueError("dev5 Markdown report is stale or does not match the JSON report")
            print("dev5 JSON/Markdown report is current; no files written.")
            return 0
        OUT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        OUT_MD.write_text(build_markdown(doc), encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as error:
        print(f"dev5 vocabulary audit generation/check failed: {error}", file=sys.stderr)
        return 1
    print(f"Wrote {OUT_JSON.relative_to(ROOT)} and {OUT_MD.relative_to(ROOT)}")
    print("913 source rows; 145 dictionary-evidence rows (127 carried forward + 18 directly rechecked); 768 pending; 16 source corrections.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
