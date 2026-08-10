#!/usr/bin/env python3
"""Extract structured procedure fields from official decision PDF text.

The script deliberately separates extraction from database writes. It aligns each
known procedure to a PDF page using monotonic sequence matching, rejects weak
title matches, and emits an audit report alongside JSON rows that can be turned
into a privileged Supabase migration.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


LEGACY_TRANSLATION = str.maketrans(
    {
        "Ƣ": "Ư",
        "ƣ": "ư",
    }
)

MISSING_VALUES = {"", "0", "#N/A"}
DOCUMENT_FIELDS = (
    "indication",
    "contraindication",
    "performer",
    "equipment",
    "duration",
    "general_content",
    "procedure_content",
    "monitoring",
    "complications",
)
TECHNICAL_FIELDS = (
    "indication",
    "contraindication",
    "performer",
    "equipment",
    "duration",
)

GENERIC_TITLE_TOKENS = {
    "quy",
    "trinh",
    "ky",
    "thuat",
    "phau",
    "thu",
    "huong",
    "dan",
    "thuc",
    "hien",
    "cua",
    "bang",
    "cho",
    "tai",
    "va",
    "co",
}

SECTION_RANK = {
    "general_content": 1,
    "indication": 2,
    "combined_indications": 2,
    "contraindication": 3,
    "preparation": 4,
    "procedure_content": 5,
    "monitoring": 6,
    "complications": 7,
    "references": 8,
}


@dataclass(frozen=True)
class Page:
    source_id: str
    local_number: int
    text: str


@dataclass(frozen=True)
class PageFeatures:
    folded_top: str
    tokens: frozenset[str]
    section_signal: bool
    ordinal: int | None


@dataclass(frozen=True)
class Match:
    document_index: int
    page_index: int
    score: float
    method: str = "sequence"


def repair_text(value: str) -> str:
    value = value.translate(LEGACY_TRANSLATION).replace("\x00", "")
    return "".join(
        character
        for character in value
        if character in "\n\t" or unicodedata.category(character)[0] != "C"
    )


def fold_text(value: str) -> str:
    value = repair_text(value).replace("Đ", "D").replace("đ", "d")
    value = unicodedata.normalize("NFD", value)
    value = "".join(
        character
        for character in value
        if unicodedata.category(character) != "Mn"
    )
    value = re.sub(r"[^A-Za-z0-9]+", " ", value).lower()
    return re.sub(r"\s+", " ", value).strip()


def is_missing(value: object) -> bool:
    return str(value or "").strip() in MISSING_VALUES


def title_core(value: str) -> str:
    value = fold_text(value)
    return re.sub(r"^(huong dan )?(quy trinh )?(ky thuat )?", "", value)


def meaningful_title_tokens(value: str) -> frozenset[str]:
    return frozenset(
        token
        for token in title_core(value).split()
        if len(token) > 1 and token not in GENERIC_TITLE_TOKENS
    )


def clean_page_lines(value: str) -> list[str]:
    lines = [re.sub(r"\s+", " ", repair_text(line)).strip() for line in value.splitlines()]
    return [
        line
        for line in lines
        if line
        and not re.fullmatch(r"\d+|[ivxlcdm]{1,8}", line, re.IGNORECASE)
        and not re.match(
            r"^(?:huong dan )?quy trinh ky thuat .+ \d+$",
            fold_text(line),
        )
    ]


def page_features(page: Page) -> PageFeatures:
    lines = clean_page_lines(page.text)
    folded_top = fold_text(" ".join(lines[:18]))
    ordinal = None
    for line in lines[:5]:
        match = re.match(r"^(\d{1,4})\s*[.)-]\s*\D", line)
        if match:
            ordinal = int(match.group(1))
            break
    return PageFeatures(
        folded_top=folded_top,
        tokens=frozenset(folded_top.split()),
        section_signal=bool(
            re.search(
                r"\b(dai cuong|dinh nghia|chi dinh|chuan bi|nguyen ly)\b",
                folded_top,
            )
        ),
        ordinal=ordinal,
    )


def opening_heading(line: str) -> bool:
    parsed = normalized_heading_label(line)
    if not parsed:
        return False
    number, _ = parsed
    return number.upper() in {"I", "1"} and section_key(line) in {
        "general_content",
        "indication",
    }


def fallback_start_candidates(pages: Sequence[Page]) -> list[tuple[int, PageFeatures]]:
    """Return body starts with a title-only feature for conservative fallback.

    The title can be immediately above section I or at the bottom of the prior
    PDF page. Only a section-I start is considered; later pages beginning with
    sections II-IV must never become fallback procedure starts.
    """

    lines_by_page = [clean_page_lines(page.text) for page in pages]
    candidates: list[tuple[int, PageFeatures]] = []
    for page_index, lines in enumerate(lines_by_page):
        heading_index = next(
            (
                index
                for index, line in enumerate(lines[:14])
                if opening_heading(line)
            ),
            None,
        )
        if heading_index is None:
            continue
        if heading_index > 0:
            title_lines = lines[:heading_index]
        elif page_index > 0:
            title_lines = lines_by_page[page_index - 1][-12:]
        else:
            title_lines = []
        folded_title = fold_text(" ".join(title_lines))
        if not folded_title:
            continue
        candidates.append(
            (
                page_index,
                PageFeatures(
                    folded_top=folded_title,
                    tokens=frozenset(folded_title.split()),
                    section_signal=True,
                    ordinal=None,
                ),
            )
        )
    return candidates


def title_score(
    title: str,
    features: PageFeatures,
    expected_ordinal: int,
) -> float:
    title_tokens = meaningful_title_tokens(title)
    if not title_tokens:
        return 0.95 if features.ordinal == expected_ordinal and expected_ordinal >= 5 else 0.0

    recall = len(title_tokens & features.tokens) / len(title_tokens)
    exact = float(title_core(title) in features.folded_top)
    score = 0.70 * recall + 0.20 * exact + 0.10 * float(features.section_signal)
    if features.ordinal == expected_ordinal and (expected_ordinal >= 5 or recall >= 0.30):
        score = max(score, 0.95)
    return score


def align_documents(
    documents: Sequence[dict],
    pages: Sequence[Page],
    threshold: float,
    fallback_threshold: float,
) -> tuple[list[Match], list[list[float]]]:
    """Align catalog rows to procedure starts, rejecting list-only entries.

    Most source files preserve catalog order, so monotonic sequence alignment is
    the safest primary strategy. A few Ministry decisions arrange their full
    procedure bodies in a different order than the issued catalog. For rows left
    unmatched by the primary pass, a conservative one-to-one fallback accepts
    only strong title matches on pages that also contain a major body heading.
    This prevents a title found only in a table of contents from being imported.
    """

    features = [page_features(page) for page in pages]
    scores = [
        [title_score(document.get("name", ""), feature, index + 1) for feature in features]
        for index, document in enumerate(documents)
    ]
    page_count = len(pages)
    previous = [0.0] * (page_count + 1)
    decisions = [bytearray(page_count + 1)]

    for document_index in range(len(documents)):
        current = [0.0] * (page_count + 1)
        decision = bytearray(page_count + 1)
        for page_number in range(1, page_count + 1):
            options = [
                (current[page_number - 1], 0),  # Skip a PDF page.
                (previous[page_number], 1),  # The catalog row has no body text.
            ]
            score = scores[document_index][page_number - 1]
            if score >= threshold:
                options.append((previous[page_number - 1] + score - threshold, 2))
            value, action = max(options, key=lambda item: (item[0], item[1]))
            current[page_number] = value
            decision[page_number] = action
        previous = current
        decisions.append(decision)

    matched_by_document: dict[int, Match] = {}
    document_index = len(documents)
    page_number = page_count
    while document_index > 0 and page_number >= 0:
        action = decisions[document_index][page_number]
        if action == 0:
            page_number -= 1
        elif action == 1:
            document_index -= 1
        else:
            matched_by_document[document_index - 1] = Match(
                document_index=document_index - 1,
                page_index=page_number - 1,
                score=scores[document_index - 1][page_number - 1],
                method="sequence",
            )
            document_index -= 1
            page_number -= 1

    used_pages = {match.page_index for match in matched_by_document.values()}
    fallback_candidates: list[tuple[float, int, int]] = []
    start_candidates = fallback_start_candidates(pages)
    for current_document_index in range(len(documents)):
        if current_document_index in matched_by_document:
            continue
        for current_page_index, title_feature in start_candidates:
            score = title_score(
                documents[current_document_index].get("name", ""),
                title_feature,
                current_document_index + 1,
            )
            if (
                current_page_index not in used_pages
                and score >= fallback_threshold
            ):
                fallback_candidates.append(
                    (score, current_document_index, current_page_index)
                )

    used_documents = set(matched_by_document)
    for score, current_document_index, current_page_index in sorted(
        fallback_candidates,
        key=lambda item: (-item[0], item[1], item[2]),
    ):
        if (
            current_document_index in used_documents
            or current_page_index in used_pages
        ):
            continue
        matched_by_document[current_document_index] = Match(
            document_index=current_document_index,
            page_index=current_page_index,
            score=score,
            method="strong-title-fallback",
        )
        used_documents.add(current_document_index)
        used_pages.add(current_page_index)

    return [matched_by_document[index] for index in sorted(matched_by_document)], scores


def normalized_heading_label(line: str) -> tuple[str, str] | None:
    match = re.match(
        r"^\s*(?P<number>[IVXLCDM]{1,7}|\d{1,2})\s*"
        r"(?:[.)-]\s*|\s+)(?P<label>.+?)\s*$",
        line,
        re.IGNORECASE,
    )
    if not match:
        return None
    return match.group("number"), fold_text(match.group("label").strip(" :-–—"))


def section_key(line: str) -> str | None:
    parsed = normalized_heading_label(line)
    if not parsed:
        return None
    _, label = parsed

    if label.startswith("tai lieu tham khao") or label.startswith("tham khao"):
        return "references"
    if (
        label.startswith("chi dinh") or label.startswith("cac chi dinh")
    ) and "chong chi din" in label:
        return "combined_indications"
    if "chong chi din" in label:
        return "contraindication"
    if label.startswith("chi dinh") or label.startswith("cac chi dinh"):
        return "indication"
    if any(
        label.startswith(prefix)
        for prefix in (
            "dai cuong",
            "dinh nghia",
            "khai niem",
            "nguyen ly",
            "nguyen tac",
            "muc dich va nguyen ly",
            "muc dich nguyen ly",
        )
    ):
        return "general_content"
    if "chuan bi" in label or label.startswith("chuan b"):
        return "preparation"
    if any(
        phrase in label
        for phrase in (
            "cac buoc tien hanh",
            "buoc tien hanh",
            "quy trinh tien hanh",
            "quy trinh ky thuat",
            "quy trinh thuc hien",
            "tien hanh ky thuat",
            "thuc hien ky thuat",
            "cac buoc thuc hien",
            "ky thuat tien hanh",
        )
    ) or label == "tien hanh":
        return "procedure_content"
    if label.startswith("theo doi"):
        return "monitoring"
    if any(
        phrase in label
        for phrase in (
            "tai bien",
            "bien chung",
            "xu tri bien chung",
            "xu tri tai bien",
            "sai sot va xu tri",
            "yeu to anh huong va xu tri",
            "nhung sai sot",
            "nhung yeu to anh huong",
        )
    ):
        return "complications"
    return None


def heading_is_plausible(line: str, key: str, last_rank: int) -> bool:
    parsed = normalized_heading_label(line)
    if not parsed:
        return False
    number, label = parsed
    rank = SECTION_RANK[key]
    if rank < last_rank:
        return False
    if len(label) > 100:
        return False

    letters = [character for character in repair_text(line) if character.isalpha()]
    uppercase_ratio = (
        sum(character.isupper() for character in letters) / len(letters) if letters else 0
    )
    return bool(re.fullmatch(r"[IVXLCDM]+", number, re.IGNORECASE)) or uppercase_ratio >= 0.55


def looks_like_major_heading(line: str) -> bool:
    parsed = normalized_heading_label(line)
    if parsed:
        number, label = parsed
        letters = [character for character in repair_text(line) if character.isalpha()]
        uppercase_ratio = (
            sum(character.isupper() for character in letters) / len(letters)
            if letters
            else 0
        )
        return (
            len(label) <= 100
            and (
                bool(re.fullmatch(r"[IVXLCDM]+", number, re.IGNORECASE))
                or uppercase_ratio >= 0.70
            )
        )

    folded = fold_text(line)
    letters = [character for character in repair_text(line) if character.isalpha()]
    uppercase_ratio = (
        sum(character.isupper() for character in letters) / len(letters) if letters else 0
    )
    return (
        len(folded) <= 100
        and uppercase_ratio >= 0.80
        and any(
            folded.startswith(prefix)
            for prefix in ("tai lieu tham khao", "ghi chu", "nhan dinh ket qua")
        )
    )


def looks_like_next_procedure_title(line: str) -> bool:
    folded = fold_text(line)
    letters = [character for character in repair_text(line) if character.isalpha()]
    uppercase_ratio = (
        sum(character.isupper() for character in letters) / len(letters) if letters else 0
    )
    return (
        12 <= len(folded) <= 180
        and uppercase_ratio >= 0.75
        and any(
            folded.startswith(prefix)
            for prefix in (
                "phau thuat",
                "ky thuat",
                "chup ",
                "dieu tri",
                "xet nghiem",
                "dinh luong",
                "dinh tinh",
                "noi soi",
                "sieu am",
                "xa tri",
            )
        )
    )


def remove_repeated_page_lines(pages: Sequence[Page]) -> list[list[str]]:
    page_lines = [clean_page_lines(page.text) for page in pages]
    frequencies: dict[str, int] = {}
    for lines in page_lines:
        for line in set(lines[:4] + lines[-4:]):
            key = fold_text(line)
            if len(key) >= 12:
                frequencies[key] = frequencies.get(key, 0) + 1

    repeated = {
        key
        for key, count in frequencies.items()
        if count >= max(4, len(page_lines) // 3)
    }
    return [
        [line for line in lines if fold_text(line) not in repeated]
        for lines in page_lines
    ]


def tidy_lines(lines: Iterable[str]) -> str:
    result: list[str] = []
    blank = False
    for raw_line in lines:
        line = re.sub(r"\s+", " ", repair_text(raw_line)).strip()
        if not line or re.fullmatch(r"\d+", line):
            if result:
                blank = True
            continue
        if blank and result and result[-1] != "":
            result.append("")
        result.append(line)
        blank = False
    while result and result[-1] == "":
        result.pop()
    return "\n".join(result).strip()


def split_major_sections(pages: Sequence[Page]) -> tuple[dict[str, str], list[str]]:
    page_lines = remove_repeated_page_lines(pages)
    lines = [line for current_page in page_lines for line in current_page]
    sections: dict[str, list[str]] = {}
    warnings: list[str] = []
    current_key: str | None = None
    last_rank = 0

    for line_index, line in enumerate(lines):
        folded_line = fold_text(line)
        if folded_line in {"tai lieu tham khao", "tham khao"}:
            if sections:
                break
            current_key = None
            continue
        if re.match(r"^quy trinh\s+\d{1,4}\b", folded_line):
            if sections:
                if (
                    current_key
                    and sections.get(current_key)
                    and looks_like_next_procedure_title(
                        sections[current_key][-1]
                    )
                ):
                    sections[current_key].pop()
                break
            current_key = None
            continue
        if (
            sections
            and looks_like_next_procedure_title(line)
            and (
                current_key in {"monitoring", "complications", "references"}
                or line_index == len(lines) - 1
            )
        ):
            break
        candidate = section_key(line)
        if candidate == "references" and sections:
            break
        if candidate and heading_is_plausible(line, candidate, last_rank):
            current_key = candidate
            last_rank = SECTION_RANK[candidate]
            sections.setdefault(candidate, [])
            continue
        if looks_like_major_heading(line):
            current_key = None
            continue
        if current_key:
            sections[current_key].append(line)

    if not sections:
        warnings.append("Không nhận diện được tiêu đề mục chuyên môn")
    return {key: tidy_lines(value) for key, value in sections.items()}, warnings


def subsection_label(line: str) -> tuple[str, str] | None:
    match = re.match(
        r"^\s*(?P<number>(?:\d+(?:\.\d+){0,2}|[a-z]))\s*"
        r"(?:[.)-]\s*|\s+)(?P<label>.+?)\s*$",
        line,
        re.IGNORECASE,
    )
    if not match:
        return None
    return match.group("number"), fold_text(match.group("label").strip(" :-–—"))


def prep_subsection_key(line: str) -> str | None:
    parsed = subsection_label(line)
    if not parsed:
        return None
    _, label = parsed
    if len(label) > 100:
        return None
    if any(
        label.startswith(prefix)
        for prefix in (
            "nguoi thuc hien",
            "can bo thuc hien",
            "can bo chuyen khoa",
            "kip thuc hien",
            "nhan su",
            "nhan luc",
            "ekip",
        )
    ):
        return "performer"
    if any(
        label.startswith(prefix)
        for prefix in (
            "phuong tien",
            "dung cu",
            "trang thiet bi",
            "thiet bi",
            "may moc",
            "vat tu",
            "vat tu tieu hao",
            "hoa chat",
            "hoa chat va vat tu",
            "thuoc",
            "thuoc va dung cu",
            "phuong tien va thuoc",
        )
    ):
        return "equipment"
    if any(
        label.startswith(prefix)
        for prefix in (
            "du kien thoi gian",
            "thoi gian du kien",
            "thoi gian thuc hien",
            "thoi gian tien hanh",
            "thoi gian ky thuat",
            "thoi gian phau thuat",
            "thoi luong thuc hien",
        )
    ):
        return "duration"
    if any(
        label.startswith(prefix)
        for prefix in (
            "nguoi benh",
            "ho so benh an",
            "dia diem",
            "tu the nguoi benh",
            "chuan bi nguoi benh",
            "kiem tra nguoi benh",
        )
    ):
        return "boundary"
    return None


def split_preparation(value: str, full_text: str) -> dict[str, str]:
    lines = value.splitlines()
    sections: dict[str, list[str]] = {}
    current_key: str | None = None

    for line in lines:
        candidate = prep_subsection_key(line)
        if candidate:
            current_key = candidate if candidate != "boundary" else None
            if current_key:
                sections.setdefault(current_key, []).append(line)
            continue
        if current_key:
            sections[current_key].append(line)

    result = {key: tidy_lines(section_lines) for key, section_lines in sections.items()}
    if not result.get("duration"):
        lines = full_text.splitlines()
        for index, line in enumerate(lines):
            folded = fold_text(line)
            folded = re.sub(r"^(?:\d+(?:\.\d+)*|[a-z])\s+", "", folded)
            if not re.match(
                r"^(?:du kien thoi gian(?: phau thuat| thuc hien)?|"
                r"thoi gian (?:du kien|thuc hien|tien hanh|ky thuat|phau thuat|"
                r"dieu tri)|thoi luong thuc hien|dat thoi gian dieu tri)\b",
                folded,
            ):
                continue
            candidate_lines = [line]
            if index + 1 < len(lines):
                candidate_lines.append(lines[index + 1])
            candidate = tidy_lines(candidate_lines)
            if re.search(
                r"\b\d+(?:[.,]\d+)?\s*"
                r"(?:(?:den\s+)?\d+(?:[.,]\d+)?\s*)?"
                r"(?:phut|gio|ngay|tuan|thang)\b",
                fold_text(candidate),
            ):
                result["duration"] = candidate[:300].strip()
                break
    return result


def split_combined_indications(value: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current_key: str | None = None
    for line in value.splitlines():
        folded = fold_text(line).strip(" :-")
        folded = re.sub(r"^(?:\d+(?:\.\d+)*|[a-z])\s+", "", folded)
        if re.match(r"^(?:cac )?chi dinh(?: chinh)?\b", folded):
            current_key = "indication"
            sections.setdefault(current_key, [])
            continue
        if folded.startswith("chong chi dinh"):
            current_key = "contraindication"
            sections.setdefault(current_key, [])
            continue
        if current_key:
            sections[current_key].append(line)
    return {key: tidy_lines(lines) for key, lines in sections.items()}


def extract_fields(pages: Sequence[Page]) -> tuple[dict[str, str], list[str]]:
    major, warnings = split_major_sections(pages)
    full_text = "\n".join(page.text for page in pages)
    preparation = split_preparation(major.get("preparation", ""), full_text)
    combined = split_combined_indications(
        major.get("combined_indications", "")
    )

    fields = {
        "indication": major.get("indication", "") or combined.get("indication", ""),
        "contraindication": major.get("contraindication", "")
        or combined.get("contraindication", ""),
        "performer": preparation.get("performer", ""),
        "equipment": preparation.get("equipment", ""),
        "duration": preparation.get("duration", ""),
        "general_content": major.get("general_content", ""),
        "procedure_content": major.get("procedure_content", ""),
        "monitoring": major.get("monitoring", ""),
        "complications": major.get("complications", ""),
    }

    # A combined "Theo dõi và xử trí tai biến" section is valid source text
    # for both fields when the document does not separate the two concepts.
    monitoring_heading = next(
        (
            line
            for page in pages
            for line in clean_page_lines(page.text)
            if section_key(line) == "monitoring"
        ),
        "",
    )
    folded_heading = fold_text(monitoring_heading)
    if (
        fields["monitoring"]
        and not fields["complications"]
        and ("tai bien" in folded_heading or "bien chung" in folded_heading)
    ):
        fields["complications"] = fields["monitoring"]

    return fields, warnings


def text_files_for_source(text_dir: Path, source_code: str) -> list[Path]:
    candidates = sorted(text_dir.glob(f"source_group_{source_code}_*.txt"))
    by_stem: dict[str, Path] = {}
    for candidate in candidates:
        base = candidate.name.replace(".ocr.txt", ".txt")
        previous = by_stem.get(base)
        if previous is None or candidate.name.endswith(".ocr.txt"):
            by_stem[base] = candidate
    return sorted(by_stem.values())


def read_source_pages(paths: Sequence[Path]) -> list[Page]:
    pages: list[Page] = []
    for path in paths:
        source_id = path.name.removesuffix(".ocr.txt").removesuffix(".txt")
        text = path.read_text(encoding="utf-8", errors="replace")
        for local_number, page_text in enumerate(text.split("\f"), start=1):
            pages.append(Page(source_id=source_id, local_number=local_number, text=page_text))
    return pages


def file_digest(paths: Sequence[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def extract_source_group(
    source_code: str,
    documents: Sequence[dict],
    text_paths: Sequence[Path],
    threshold: float,
    fallback_threshold: float,
) -> tuple[list[dict], dict]:
    pages = read_source_pages(text_paths)
    matches, _ = align_documents(
        documents,
        pages,
        threshold,
        fallback_threshold,
    )
    match_by_document = {match.document_index: match for match in matches}
    ordered_matches = sorted(matches, key=lambda match: match.page_index)
    end_page_by_document = {
        match.document_index: (
            ordered_matches[index + 1].page_index - 1
            if index + 1 < len(ordered_matches)
            else len(pages) - 1
        )
        for index, match in enumerate(ordered_matches)
    }
    rows: list[dict] = []
    warnings: list[dict] = []
    digest = file_digest(text_paths)

    for document_index, document in enumerate(documents):
        match = match_by_document.get(document_index)
        if not match:
            warnings.append(
                {
                    "code": document["code"],
                    "kind": "unmatched-title",
                    "name": document.get("name", ""),
                }
            )
            continue

        end_page_index = end_page_by_document[document_index]
        segment = pages[match.page_index : end_page_index + 1]
        fields, field_warnings = extract_fields(segment)
        populated = sum(not is_missing(fields[field]) for field in DOCUMENT_FIELDS)
        if populated == 0:
            warnings.append(
                {
                    "code": document["code"],
                    "kind": "no-fields",
                    "name": document.get("name", ""),
                    "start": {
                        "source": segment[0].source_id,
                        "page": segment[0].local_number,
                    },
                }
            )
            continue

        rows.append(
            {
                "code": document["code"],
                **fields,
                "_audit": {
                    "source_code": source_code,
                    "text_sources": [path.name for path in text_paths],
                    "text_sha256": digest,
                    "start": {
                        "source": segment[0].source_id,
                        "page": segment[0].local_number,
                    },
                    "end": {
                        "source": segment[-1].source_id,
                        "page": segment[-1].local_number,
                    },
                    "title_score": round(match.score, 4),
                    "alignment_method": match.method,
                    "warnings": field_warnings,
                },
            }
        )

    report = {
        "source_code": source_code,
        "documents": len(documents),
        "pages": len(pages),
        "matched_titles": len(matches),
        "sequence_matches": sum(match.method == "sequence" for match in matches),
        "fallback_matches": sum(
            match.method == "strong-title-fallback" for match in matches
        ),
        "extracted_rows": len(rows),
        "warnings": warnings,
        "text_sources": [path.name for path in text_paths],
        "text_sha256": digest,
    }
    return rows, report


def build_technical_updates(
    technical_rows: Sequence[dict],
    extracted_documents: Sequence[dict],
    document_catalog: Sequence[dict],
    match_by_title: bool,
) -> tuple[list[dict], list[dict]]:
    document_map = {row["code"]: row for row in extracted_documents}
    catalog_map = {row["code"]: row for row in document_catalog}
    title_index: dict[tuple[str, str], list[str]] = {}
    for code, catalog in catalog_map.items():
        folded_name = fold_text(catalog.get("name", ""))
        if folded_name:
            title_index.setdefault((code[:2], folded_name), []).append(code)

    updates: list[dict] = []
    audit: list[dict] = []
    for technical in technical_rows:
        document = document_map.get(technical.get("source_code", ""))
        match_method = "source-code" if document else ""
        source_status = str(technical.get("source_code", "") or "").strip()

        if not document:
            embedded_codes = re.findall(r"\b\d{2}\.\d{4}\.\d{3}\b", source_status)
            embedded = [
                document_map[code]
                for code in embedded_codes
                if code in document_map and code[:2] == technical.get("code", "")[:2]
            ]
            if len(embedded) > 1:
                folded_technical_name = fold_text(technical.get("name", ""))
                embedded = [
                    candidate
                    for candidate in embedded
                    if fold_text(
                        catalog_map.get(candidate["code"], {}).get("name", "")
                    )
                    == folded_technical_name
                ]
            if len(embedded) == 1:
                document = embedded[0]
                match_method = "embedded-source-code"

        placeholder_status = (
            is_missing(source_status)
            or fold_text(source_status) == "bhyt"
            or "can qtkt" in fold_text(source_status)
            or "thieu qtkt" in fold_text(source_status)
        )
        if not document and match_by_title and placeholder_status:
            candidate_codes = title_index.get(
                (
                    technical.get("code", "")[:2],
                    fold_text(technical.get("name", "")),
                ),
                [],
            )
            if len(candidate_codes) == 1 and candidate_codes[0] in document_map:
                document = document_map[candidate_codes[0]]
                match_method = "unique-title-same-specialty"

        if not document:
            continue
        changes = {
            field: document[field]
            for field in TECHNICAL_FIELDS
            if is_missing(technical.get(field)) and not is_missing(document.get(field))
        }
        if changes:
            updates.append({"code": technical["code"], **changes})
            audit.append(
                {
                    "code": technical["code"],
                    "source_document_code": document["code"],
                    "match_method": match_method,
                    "source_status": source_status,
                    "fields": sorted(changes),
                }
            )
    return updates, audit


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--documents", type=Path, required=True)
    parser.add_argument("--technical", type=Path, required=True)
    parser.add_argument("--pdf-sources", type=Path, required=True)
    parser.add_argument("--text-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-code", action="append", default=[])
    parser.add_argument("--min-title-score", type=float, default=0.50)
    parser.add_argument("--min-fallback-title-score", type=float, default=0.72)
    parser.add_argument("--match-technical-by-title", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    documents = json.loads(args.documents.read_text(encoding="utf-8"))
    technical = json.loads(args.technical.read_text(encoding="utf-8"))
    pdf_sources = json.loads(args.pdf_sources.read_text(encoding="utf-8"))
    selected = set(args.source_code)
    known_groups = {
        source["target_code"]
        for source in pdf_sources
        if source.get("target_type") == "source_group"
    }

    documents_by_group: dict[str, list[dict]] = {}
    for document in documents:
        documents_by_group.setdefault(document.get("source_code", ""), []).append(document)

    extracted: list[dict] = []
    reports: list[dict] = []
    for source_code in sorted(known_groups):
        if selected and source_code not in selected:
            continue
        text_paths = text_files_for_source(args.text_dir, source_code)
        group_documents = documents_by_group.get(source_code, [])
        if not text_paths:
            reports.append(
                {
                    "source_code": source_code,
                    "documents": len(group_documents),
                    "pages": 0,
                    "matched_titles": 0,
                    "extracted_rows": 0,
                    "warnings": [{"kind": "missing-source-text"}],
                    "text_sources": [],
                }
            )
            continue
        rows, report = extract_source_group(
            source_code,
            group_documents,
            text_paths,
            args.min_title_score,
            args.min_fallback_title_score,
        )
        extracted.extend(rows)
        reports.append(report)

    document_updates = [
        {key: value for key, value in row.items() if key != "_audit"}
        for row in extracted
    ]
    technical_updates, technical_audit = build_technical_updates(
        technical,
        document_updates,
        documents,
        args.match_technical_by_title,
    )
    audit_rows = [
        {"code": row["code"], **row["_audit"]}
        for row in extracted
    ]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "byt-document-updates.json": document_updates,
        "technical-updates.json": technical_updates,
        "technical-mapping-audit.json": technical_audit,
        "extraction-audit.json": audit_rows,
        "extraction-report.json": reports,
    }
    for filename, payload in outputs.items():
        (args.output_dir / filename).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    summary = {
        "source_groups": len(reports),
        "documents_extracted": len(document_updates),
        "technical_rows_fillable": len(technical_updates),
        "technical_match_methods": {
            method: sum(row["match_method"] == method for row in technical_audit)
            for method in sorted({row["match_method"] for row in technical_audit})
        },
        "field_counts": {
            field: sum(not is_missing(row.get(field)) for row in document_updates)
            for field in DOCUMENT_FIELDS
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
