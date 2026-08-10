#!/usr/bin/env python3
"""Validate extracted procedure updates before generating a migration."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


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
ALLOWED_ALIGNMENT_METHODS = {"sequence", "strong-title-fallback"}
ALLOWED_TECHNICAL_METHODS = {
    "source-code",
    "embedded-source-code",
    "unique-title-same-specialty",
}
FORBIDDEN_CONTENT = {
    "reference-heading": re.compile(
        r"(?im)^\s*(?:tài liệu tham khảo|tham khảo)\s*:?\s*$"
    ),
    "next-procedure": re.compile(r"(?im)^\s*quy trình\s+\d{1,4}\b"),
    "page-header": re.compile(
        r"(?im)^\s*(?:hướng dẫn )?quy trình kỹ thuật .+ \d+\s*$"
    ),
    "roman-page-number": re.compile(r"(?im)^\s*[ivxlcdm]{2,8}\s*$"),
}


def fold_text(value: object) -> str:
    text = (
        str(value or "")
        .translate(str.maketrans({"Ƣ": "Ư", "ƣ": "ư"}))
        .replace("Đ", "D")
        .replace("đ", "d")
    )
    text = "".join(
        character
        for character in text
        if character in "\n\t" or unicodedata.category(character)[0] != "C"
    )
    text = "".join(
        character
        for character in unicodedata.normalize("NFD", text)
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def load_json(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path}: dữ liệu gốc phải là một mảng JSON")
    return payload


def assert_unique(rows: list[dict], label: str) -> set[str]:
    codes = [str(row.get("code", "")).strip() for row in rows]
    if any(not code for code in codes):
        raise ValueError(f"{label}: có mã trống")
    if len(set(codes)) != len(codes):
        duplicates = [code for code, count in Counter(codes).items() if count > 1]
        raise ValueError(f"{label}: mã trùng {duplicates[:10]}")
    return set(codes)


def is_placeholder_source(value: object) -> bool:
    folded = fold_text(value)
    return (
        folded in {"", "0", "n a", "bhyt"}
        or "can qtkt" in folded
        or "thieu qtkt" in folded
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--documents", type=Path, required=True)
    parser.add_argument("--technical", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    documents = load_json(args.documents)
    technical = load_json(args.technical)
    document_updates = load_json(args.output_dir / "byt-document-updates.json")
    technical_updates = load_json(args.output_dir / "technical-updates.json")
    extraction_audit = load_json(args.output_dir / "extraction-audit.json")
    technical_audit = load_json(args.output_dir / "technical-mapping-audit.json")
    reports = load_json(args.output_dir / "extraction-report.json")

    document_catalog = {row["code"]: row for row in documents}
    technical_catalog = {row["code"]: row for row in technical}
    document_codes = assert_unique(document_updates, "Cập nhật hồ sơ BYT")
    technical_codes = assert_unique(technical_updates, "Cập nhật danh mục kỹ thuật")
    extraction_audit_codes = assert_unique(extraction_audit, "Nhật ký trích xuất")
    technical_audit_codes = assert_unique(technical_audit, "Nhật ký ánh xạ kỹ thuật")

    if document_codes != extraction_audit_codes:
        raise ValueError("Mã cập nhật hồ sơ và nhật ký trích xuất không khớp")
    if technical_codes != technical_audit_codes:
        raise ValueError("Mã cập nhật kỹ thuật và nhật ký ánh xạ không khớp")
    if len(reports) != 43 or len({row.get("source_code") for row in reports}) != 43:
        raise ValueError("Báo cáo phải chứa đúng 43 nhóm quyết định duy nhất")

    for row in document_updates:
        code = row["code"]
        if code not in document_catalog:
            raise ValueError(f"{code}: không có trong danh mục hồ sơ BYT")
        if not any(str(row.get(field, "")).strip() for field in DOCUMENT_FIELDS):
            raise ValueError(f"{code}: không có trường nào được trích xuất")
        if len(str(row.get("duration", ""))) > 300:
            raise ValueError(f"{code}: trường thời gian dài bất thường")
        for field in DOCUMENT_FIELDS:
            value = str(row.get(field, ""))
            for label, pattern in FORBIDDEN_CONTENT.items():
                if pattern.search(value):
                    raise ValueError(f"{code}.{field}: lẫn {label}")

    for row in extraction_audit:
        code = row["code"]
        if row.get("alignment_method") not in ALLOWED_ALIGNMENT_METHODS:
            raise ValueError(f"{code}: phương pháp căn chỉnh không hợp lệ")
        if float(row.get("title_score", 0)) < 0.50:
            raise ValueError(f"{code}: điểm tiêu đề dưới ngưỡng")
        start = row.get("start", {})
        end = row.get("end", {})
        if int(start.get("page", 0)) < 1 or int(end.get("page", 0)) < 1:
            raise ValueError(f"{code}: số trang kiểm toán không hợp lệ")

    title_index: dict[tuple[str, str], list[str]] = {}
    for document in documents:
        key = (document["code"][:2], fold_text(document.get("name")))
        if key[1]:
            title_index.setdefault(key, []).append(document["code"])

    technical_update_map = {row["code"]: row for row in technical_updates}
    for row in technical_audit:
        code = row["code"]
        technical_row = technical_catalog.get(code)
        source_code = row.get("source_document_code", "")
        method = row.get("match_method")
        if not technical_row or source_code not in document_catalog:
            raise ValueError(f"{code}: ánh xạ đến mã không tồn tại")
        if method not in ALLOWED_TECHNICAL_METHODS:
            raise ValueError(f"{code}: phương pháp ánh xạ không hợp lệ")
        if method == "source-code" and technical_row.get("source_code") != source_code:
            raise ValueError(f"{code}: ánh xạ mã nguồn trực tiếp không khớp")
        if method == "embedded-source-code":
            if code[:2] != source_code[:2]:
                raise ValueError(f"{code}: ánh xạ mã nhúng sai chuyên khoa")
            if source_code not in str(technical_row.get("source_code", "")):
                raise ValueError(f"{code}: không tìm thấy mã nguồn nhúng")
        if method == "unique-title-same-specialty":
            if code[:2] != source_code[:2]:
                raise ValueError(f"{code}: ánh xạ tên sai chuyên khoa")
            if not is_placeholder_source(technical_row.get("source_code")):
                raise ValueError(f"{code}: nguồn hiện có không phải trạng thái chờ")
            key = (code[:2], fold_text(technical_row.get("name")))
            if title_index.get(key) != [source_code]:
                raise ValueError(f"{code}: tiêu đề không duy nhất trong chuyên khoa")
        changed_fields = sorted(
            field
            for field in TECHNICAL_FIELDS
            if str(technical_update_map[code].get(field, "")).strip()
        )
        if changed_fields != sorted(row.get("fields", [])):
            raise ValueError(f"{code}: danh sách trường thay đổi không khớp")

    print(
        json.dumps(
            {
                "documents": len(document_updates),
                "technical": len(technical_updates),
                "fallback_alignments": sum(
                    row.get("alignment_method") == "strong-title-fallback"
                    for row in extraction_audit
                ),
                "technical_match_methods": dict(
                    sorted(Counter(row["match_method"] for row in technical_audit).items())
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
