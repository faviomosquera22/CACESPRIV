from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from pypdf import PdfReader


QUESTION_BANK_DIR = Path("BASE DE PREGUNTAS CACES")

LEGACY_CORRECT_FIRST_PDFS = [
    (
        QUESTION_BANK_DIR / "BANCO DE PRENGUNTAS ENFERMERIA - CONVOCATORIA I 2023 (1).pdf",
        "CACES 2023",
    ),
    (
        QUESTION_BANK_DIR / "CACES_Banco_Preguntas_Carrera_Enfermeria_Jun_2022.pdf.pdf",
        "CACES 2022",
    ),
]

CORRECT_FIRST_DOCX = [
    (
        QUESTION_BANK_DIR / "BANCO PREGUNTAS  CACES  OCT 2023 (Autoguardado).docx",
        "CACES Octubre 2023",
    ),
]

BOLD_CORRECT_DOCX = [
    (
        QUESTION_BANK_DIR / "REACTIVOS CACES MAYO 2025.docx",
        "CACES Mayo 2025",
    ),
]

EXPLICIT_ANSWER_PDFS = [
    (
        QUESTION_BANK_DIR
        / "PREGUNTAS FILTRADAS ENFERMERIA CACES 2026 _20260529_194953_0000.pdf",
        "CACES 2025/2026",
    ),
]

LITERAL_ANSWER_PDFS = [
    (
        QUESTION_BANK_DIR / "Preguntas Octubre 2025 V1.4.1.pdf",
        "CACES Octubre 2025",
    ),
]

SKIPPED_SOURCES = [
    "banco_500_preguntas_psicologia_clinica_caces.pdf",
    "FILTRADO CACES ENFERMERIA MAYO 2026.pdf",
    "MAIS.pdf",
    "939648360-SCORE-MAMA-2025.pdf",
]

NURSING_AREAS = [
    "Cuidado y Procedimientos Clínicos de Enfermería",
    "Cuidados de la Mujer, Recién Nacido, Niño y Adolescente",
    "Cuidados del Adulto y Adulto Mayor",
    "Cuidado Familiar, Comunitario e Intercultural",
    "Bases Educativas, Administrativas, Investigativas y Epidemiológicas",
]

OPTION_LETTERS = ["A", "B", "C", "D"]
DEFAULT_EXPLANATION = (
    "Respuesta importada del banco CACES. Las opciones fueron reorganizadas "
    "para el simulador manteniendo la respuesta correcta marcada."
)

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


@dataclass
class ParsedParagraph:
    text: str
    is_bold: bool


def clean_line(line: str) -> str:
    line = line.replace("\u00a0", " ")
    line = line.replace("●", " ").replace("⚫", " ").replace("•", " ")
    return re.sub(r"\s+", " ", line).strip()


def normalize_text(value: str) -> str:
    value = value.lower()
    value = value.replace("á", "a").replace("é", "e").replace("í", "i")
    value = value.replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    return re.sub(r"[^a-z0-9]+", "", value)


def clean_question_text(question_text: str) -> str:
    question_text = clean_line(question_text)
    question_text = re.sub(r"^\d+\s*[-.)]\s*", "", question_text).strip()
    question_text = re.sub(r"^\d+\s*-\s*[A-Z]{1,4}\s*-\s*", "", question_text).strip()
    question_text = re.sub(r"^[A-Z]{1,4}\s*-\s*", "", question_text).strip()
    question_text = re.sub(r"^Pregunta\s+\d+\s*[-.)]?\s*", "", question_text, flags=re.I).strip()
    question_text = re.sub(r"\s+PREGUNTA\s+\d+\s*-\s*CACES\s+\d{4}\s*$", "", question_text, flags=re.I)
    return clean_line(question_text)


def clean_option(option: str) -> str:
    option = clean_line(option)
    option = re.sub(r"^[-–—]\s*", "", option).strip()
    option = re.sub(r"^[oO]\s+", "", option).strip()
    option = re.sub(r"^[a-dA-D]\s*[\).:-]\s*", "", option).strip()
    option = re.sub(r"\s+(?:\d+\.\s*){2,}.*$", "", option).strip()
    option = re.sub(
        r"\s+(?:Complete el enunciado|Seleccione|Identifique|Relacione|Ordene):?.*$",
        "",
        option,
        flags=re.I,
    ).strip()
    return clean_line(option)


def is_code_option(option: str) -> bool:
    option = clean_option(option)
    return bool(
        re.match(r"^\d+[a-z]{1,4}\s*,", option, flags=re.I)
        or re.match(r"^\d+\s*,\s*\d+", option)
        or re.match(r"^\d+[a-z]{1,4}$", option, flags=re.I)
    )


def is_question_usable(question_text: str, options: list[str]) -> bool:
    lower = question_text.lower()
    blocked_phrases = [
        "relacione",
        "ordene",
        "gráfico",
        "grafico",
        "figura",
        "imagen",
        "tabla",
        "cuadro",
        "de acuerdo al gráfico",
        "pregunta confusa",
        "entró a revisión",
        "entro a revision",
    ]

    if any(phrase in lower for phrase in blocked_phrases):
        return False

    if re.search(r"(?:\d+\.\s*){2,}", question_text):
        return False

    if any(is_code_option(option) for option in options):
        return False

    if any(
        re.search(
            r"(?:\d+\.\s*){2,}|complete el enunciado|seleccione|identifique|relacione|ordene",
            option,
            flags=re.I,
        )
        for option in options
    ):
        return False

    normalized_options = {normalize_text(option) for option in options}
    if len(normalized_options) < 4:
        return False

    return True


def classify_nursing_area(question_text: str) -> str:
    text = question_text.lower()
    woman_child_keywords = [
        "embaraz",
        "gestante",
        "prenatal",
        "parto",
        "puerper",
        "placenta",
        "recién nacido",
        "recien nacido",
        "neonato",
        "neonatal",
        "lactancia",
        "leche materna",
        "materna",
        "niño",
        "niña",
        "pediatr",
        "adolescente",
        "vacuna",
        "inmunización",
        "inmunizacion",
    ]
    adult_keywords = [
        "adulto mayor",
        "geriatr",
        "anciano",
        "alzheimer",
        "diabetes",
        "hipertensión",
        "hipertension",
        "insuficiencia cardi",
        "insuficiencia renal",
        "epoc",
        "enfermedad pulmonar",
        "medicina interna",
        "parkinson",
        "hemodiálisis",
        "hemodialisis",
    ]
    community_keywords = [
        "familia",
        "familiar",
        "comunit",
        "intercultural",
        "mais",
        "ficha familiar",
        "dispensarización",
        "dispensarizacion",
        "ciudadanía",
        "ciudadania",
        "derechos sexuales",
        "salud sexual",
        "participación",
        "participacion",
    ]
    bases_keywords = [
        "investig",
        "hipótesis",
        "hipotesis",
        "muestra",
        "muestreo",
        "variable",
        "epidemiol",
        "administr",
        "planificación",
        "planificacion",
        "organización",
        "organizacion",
        "dirección",
        "direccion",
        "control",
        "liderazgo",
        "calidad",
        "bioética",
        "bioetica",
        "teórica",
        "teorica",
        "teoría",
        "teoria",
        "florence",
        "nightingale",
        "peplau",
        "nanda",
        "diagnóstico enfermero",
        "diagnostico enfermero",
    ]

    if any(keyword in text for keyword in woman_child_keywords):
        return NURSING_AREAS[1]
    if any(keyword in text for keyword in adult_keywords):
        return NURSING_AREAS[2]
    if any(keyword in text for keyword in community_keywords):
        return NURSING_AREAS[3]
    if any(keyword in text for keyword in bases_keywords):
        return NURSING_AREAS[4]

    return NURSING_AREAS[0]


def skip_line(line: str) -> bool:
    lower = line.lower()

    if not line:
        return True

    skip_starts = [
        "este documento se encuentra sujeto",
        "consentimiento informado.",
        "banco de preguntas",
        "banco de preguntas y respuestas",
        "carrera de enfermeria",
        "carrera de enfermería",
        "examen de habilitación",
        "de conformidad con",
        "por lo tanto",
        "estos deberes",
        "educación médica",
        "educacion medica",
        "componente ",
        "subcomponente:",
        "tema:",
        "bibliografía:",
        "bibliografia:",
        "versión ",
        "version ",
        "hecho por",
        "contenido gratuito",
    ]

    if any(lower.startswith(value) for value in skip_starts):
        return True

    if re.fullmatch(r"\d+", line):
        return True

    if re.fullmatch(r"(?:\d+\.\s*){2,}", line):
        return True

    if line.startswith("http://") or line.startswith("https://"):
        return True

    return False


def looks_like_new_question(line: str) -> bool:
    line = clean_question_text(line)
    starts = (
        "¿",
        "Relacione",
        "Seleccione",
        "Identifique",
        "Según",
        "Segun",
        "De ",
        "Al ",
        "El ",
        "La ",
        "Los ",
        "Las ",
        "Paciente",
        "Una ",
        "Un ",
        "En ",
        "Durante ",
        "Luego ",
        "Tras ",
        "Cuál",
        "Cual",
        "Cuáles",
        "Cuales",
        "Qué",
        "Que",
        "Caso Clínico",
        "Caso Clinico",
    )

    if line.startswith(starts):
        return True

    return False


def looks_like_legacy_question_boundary(line: str) -> bool:
    if looks_like_new_question(line):
        return True

    line = clean_question_text(line)
    return bool(re.match(r"^[A-ZÁÉÍÓÚÑ][^\.]{25,}", line))


def trim_question_context(lines: list[str]) -> str:
    filtered = [clean_line(line) for line in lines if not skip_line(clean_line(line))]
    if not filtered:
        return ""

    start_index = max(0, len(filtered) - 8)
    for index in range(len(filtered) - 1, -1, -1):
        candidate = clean_question_text(filtered[index])
        if looks_like_new_question(candidate):
            start_index = index
            break

    return clean_question_text(" ".join(filtered[start_index:]))


def make_question(
    question_text: str,
    options: list[str],
    correct_index: int,
    source: str,
    explanation: str | None = None,
) -> dict[str, object] | None:
    question_text = clean_question_text(question_text)
    option_values = [clean_option(option) for option in options[:4]]

    if (
        len(option_values) != 4
        or not 30 < len(question_text) <= 3000
        or not all(0 < len(option) <= 500 for option in option_values)
        or not 0 <= correct_index < 4
        or not is_question_usable(question_text, option_values)
    ):
        return None

    return {
        "question_text": question_text,
        "options": option_values,
        "correct_index": correct_index,
        "area": classify_nursing_area(question_text),
        "source": source,
        "explanation": clean_line(explanation or DEFAULT_EXPLANATION),
    }


def split_inline_options(option_line: str) -> list[str]:
    pieces = re.split(r"\s+[•●⚫]\s+", option_line)
    return [clean_line(piece) for piece in pieces if clean_line(piece)]


def parse_legacy_pdf(path: Path, source: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    questions: list[dict[str, object]] = []
    question_lines: list[str] = []
    options: list[str] = []
    current_option: str | None = None
    collecting_options = False

    def finish_option() -> None:
        nonlocal current_option

        if current_option is not None:
            options.append(clean_line(current_option))
            current_option = None

    def finish_question() -> None:
        nonlocal question_lines, options

        finish_option()

        if len(options) >= 4:
            question = make_question(
                " ".join(question_lines),
                options[:4],
                0,
                source,
            )
            if question:
                questions.append(question)

        question_lines = []
        options = []

    for page_index, page in enumerate(reader.pages):
        if page_index < 2:
            continue

        text = page.extract_text() or ""

        for raw_line in text.splitlines():
            line = clean_line(raw_line)

            if skip_line(line):
                continue

            if line.lower().startswith("respuestas"):
                collecting_options = True
                options = []
                current_option = None
                continue

            if collecting_options:
                if line.startswith("-"):
                    finish_option()
                    current_option = line.lstrip("-").strip()
                    continue

                if current_option is not None:
                    if len(options) >= 3 and looks_like_legacy_question_boundary(line):
                        finish_question()
                        collecting_options = False
                        question_lines.append(line)
                    else:
                        current_option += " " + line
                    continue

                question_lines.append(line)
                collecting_options = False
                continue

            question_lines.append(line)

    if collecting_options:
        finish_question()

    return questions


def read_docx_paragraphs(path: Path) -> list[ParsedParagraph]:
    with ZipFile(path) as archive:
        document = archive.read("word/document.xml")

    root = ET.fromstring(document)
    paragraphs: list[ParsedParagraph] = []

    for paragraph in root.findall(".//w:p", WORD_NS):
        text_parts: list[str] = []
        bold_chars = 0
        total_chars = 0

        for run in paragraph.findall(".//w:r", WORD_NS):
            text = "".join(node.text or "" for node in run.findall(".//w:t", WORD_NS))
            if not text:
                continue

            text_parts.append(text)
            total_chars += len(text.strip())
            run_props = run.find("w:rPr", WORD_NS)
            if run_props is not None and run_props.find("w:b", WORD_NS) is not None:
                bold_chars += len(text.strip())

        text = clean_line("".join(text_parts))
        if text:
            paragraphs.append(
                ParsedParagraph(
                    text=text,
                    is_bold=total_chars > 0 and bold_chars / total_chars >= 0.6,
                )
            )

    return paragraphs


def parse_docx_correct_first(path: Path, source: str) -> list[dict[str, object]]:
    paragraphs = read_docx_paragraphs(path)
    questions: list[dict[str, object]] = []
    pending_question_lines: list[str] = []
    index = 0

    while index < len(paragraphs):
        line = paragraphs[index].text

        if line.lower().startswith("respuestas"):
            options: list[str] = []
            correct_indices: list[int] = []
            index += 1

            while index < len(paragraphs) and len(options) < 4:
                option_line = paragraphs[index].text
                if skip_line(option_line):
                    index += 1
                    continue

                is_correct = option_line.startswith("-")
                option_pieces = split_inline_options(option_line)
                for option_piece in option_pieces:
                    if is_correct and len(option_pieces) == 1:
                        correct_indices.append(len(options))
                    options.append(option_piece)
                    if len(options) >= 4:
                        break
                index += 1

            question = make_question(
                trim_question_context(pending_question_lines),
                options,
                correct_indices[0] if len(correct_indices) == 1 else 0,
                source,
            )
            if question:
                questions.append(question)

            pending_question_lines = []
            continue

        if not skip_line(line):
            pending_question_lines.append(line)

        index += 1

    return questions


def parse_docx_bold_correct(path: Path, source: str) -> list[dict[str, object]]:
    paragraphs = read_docx_paragraphs(path)
    questions: list[dict[str, object]] = []
    pending_question_lines: list[str] = []
    index = 0

    while index < len(paragraphs):
        line = paragraphs[index].text

        if line.lower().startswith("opciones"):
            options: list[str] = []
            correct_indices: list[int] = []
            index += 1

            while index < len(paragraphs) and len(options) < 4:
                option = paragraphs[index]
                if skip_line(option.text):
                    index += 1
                    continue

                option_pieces = split_inline_options(option.text)
                for option_piece in option_pieces:
                    if option.is_bold and len(option_pieces) == 1:
                        correct_indices.append(len(options))
                    options.append(option_piece)
                    if len(options) >= 4:
                        break
                index += 1

            if len(correct_indices) == 1:
                question = make_question(
                    trim_question_context(pending_question_lines),
                    options,
                    correct_indices[0],
                    source,
                )
                if question:
                    questions.append(question)

            pending_question_lines = []
            continue

        if not skip_line(line):
            pending_question_lines.append(line)

        index += 1

    return questions


def is_pdf_option_start(line: str) -> bool:
    return bool(re.match(r"^(?:[oO]\s+|[A-Da-d]\)\s+|[A-Da-d]\.\s+)", line))


def strip_pdf_option_marker(line: str) -> str:
    line = clean_line(line)
    line = re.sub(r"^[oO]\s+", "", line).strip()
    line = re.sub(r"^[A-Da-d]\s*[\).]\s*", "", line).strip()
    return line


def collect_pdf_options(lines: list[str]) -> tuple[list[str], int]:
    options: list[str] = []
    current: str | None = None
    first_option_index = -1

    for index, line in enumerate(lines):
        if is_pdf_option_start(line):
            if current is not None:
                options.append(current)

            if first_option_index == -1:
                first_option_index = index
            current = strip_pdf_option_marker(line)
            continue

        if current is not None:
            current += " " + line

    if current is not None:
        options.append(current)

    return options, first_option_index


def parse_explicit_answer_pdf(path: Path, source: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    all_lines: list[str] = []

    for page in reader.pages:
        for raw_line in (page.extract_text() or "").splitlines():
            line = clean_line(raw_line)
            if line:
                all_lines.append(line)

    blocks: list[list[str]] = []
    current_block: list[str] = []

    for line in all_lines:
        current_block.append(line)
        if re.search(r"PREGUNTA\s+\d+\s*-\s*CACES", line, flags=re.I):
            blocks.append(current_block)
            current_block = []

    questions: list[dict[str, object]] = []

    for block in blocks:
        filtered = [line for line in block if not skip_line(line)]
        answer_index = next(
            (
                index
                for index, line in enumerate(filtered)
                if line.lower().startswith("respuesta correcta")
            ),
            -1,
        )

        if answer_index <= 0:
            continue

        before_answer = filtered[:answer_index]
        after_answer = filtered[answer_index + 1 :]
        options, first_option_index = collect_pdf_options(before_answer)

        if first_option_index <= 0 or len(options) < 4:
            continue

        question_text = trim_question_context(before_answer[:first_option_index])

        correct_lines: list[str] = []
        explanation_lines: list[str] = []
        reading_explanation = False

        for line in after_answer:
            lower = line.lower()
            if lower.startswith("justificación") or lower.startswith("justificacion"):
                reading_explanation = True
                continue
            if lower.startswith(("bibliografía", "bibliografia", "subcomponente:", "tema:", "pregunta ")):
                if reading_explanation:
                    break
                continue
            if skip_line(line):
                continue
            if reading_explanation:
                explanation_lines.append(line)
            elif not correct_lines or not lower.startswith(("justificación", "justificacion")):
                correct_lines.append(line)

        correct_text = clean_option(" ".join(correct_lines))
        normalized_correct = normalize_text(correct_text)
        correct_index = -1

        for option_index, option in enumerate(options[:4]):
            normalized_option = normalize_text(clean_option(option))
            if normalized_correct and (
                normalized_correct == normalized_option
                or normalized_correct in normalized_option
                or normalized_option in normalized_correct
            ):
                correct_index = option_index
                break

        if correct_index == -1:
            continue

        question = make_question(
            question_text,
            options[:4],
            correct_index,
            source,
            " ".join(explanation_lines) if explanation_lines else None,
        )
        if question:
            questions.append(question)

    return questions


def parse_literal_answer_pdf(path: Path, source: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages[2:])
    text = clean_line(text)
    text = re.sub(r"\s+", " ", text)
    pattern = re.compile(r"Literal\s+correcto\s*:\s*([a-dA-D])", flags=re.I)
    matches = list(pattern.finditer(text))
    questions: list[dict[str, object]] = []
    block_start = 0

    for match in matches:
        block = text[block_start : match.start()].strip()
        correct_letter = match.group(1).upper()
        block_start = match.end()

        if "Justificación" not in block and "Justificacion" not in block:
            continue

        option_match = re.search(
            r"\ba\.\s+(.*?)\s+\bb\.\s+(.*?)\s+\bc\.\s+(.*?)\s+\bd\.\s+(.*?)\s+Justificaci[oó]n\s*:",
            block,
            flags=re.I,
        )
        if not option_match:
            continue

        question_text = block[: option_match.start()]
        question_text = re.sub(r"^.*?(?=(?:¿|Paciente|Una|Un|El|La|Los|Las|En|Durante|Luego|De|Al)\s)", "", question_text)
        options = [option_match.group(index) for index in range(1, 5)]
        correct_index = OPTION_LETTERS.index(correct_letter)

        explanation_text = block[option_match.end() :]
        explanation_text = re.sub(r"\s+VERSI[ÓO]N.*$", "", explanation_text, flags=re.I)

        question = make_question(
            question_text,
            options,
            correct_index,
            source,
            explanation_text,
        )
        if question:
            questions.append(question)

    return questions


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def question_key(question: dict[str, object]) -> str:
    normalized = normalize_text(str(question["question_text"]))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def build_answer_layout(question: dict[str, object]) -> dict[str, str]:
    options = [str(option) for option in question["options"]]
    correct_index = int(question["correct_index"])
    key = str(question["key"])
    ordered_indices = sorted(
        range(4),
        key=lambda index: hashlib.sha256(f"{key}:{index}".encode("utf-8")).hexdigest(),
    )
    arranged = [options[index] for index in ordered_indices]
    new_correct_index = ordered_indices.index(correct_index)

    return {
        "option_a": arranged[0],
        "option_b": arranged[1],
        "option_c": arranged[2],
        "option_d": arranged[3],
        "correct_option": OPTION_LETTERS[new_correct_index],
    }


def load_questions() -> tuple[list[dict[str, object]], dict[str, int]]:
    deduped: list[dict[str, object]] = []
    seen: set[str] = set()
    source_counts: dict[str, int] = {}
    sources: list[tuple[str, list[dict[str, object]]]] = []

    for path, source in LEGACY_CORRECT_FIRST_PDFS:
        sources.append((source, parse_legacy_pdf(path, source)))

    for path, source in CORRECT_FIRST_DOCX:
        sources.append((source, parse_docx_correct_first(path, source)))

    for path, source in BOLD_CORRECT_DOCX:
        sources.append((source, parse_docx_bold_correct(path, source)))

    for path, source in EXPLICIT_ANSWER_PDFS:
        sources.append((source, parse_explicit_answer_pdf(path, source)))

    for path, source in LITERAL_ANSWER_PDFS:
        sources.append((source, parse_literal_answer_pdf(path, source)))

    for source, questions in sources:
        source_counts[f"{source} extraídas"] = len(questions)
        for question in questions:
            key = question_key(question)

            if key in seen:
                continue

            seen.add(key)
            question["key"] = key
            deduped.append(question)
            source_counts[source] = source_counts.get(source, 0) + 1

    return deduped, source_counts


def build_sql(questions: list[dict[str, object]]) -> str:
    header = f"""-- Generated by scripts/extract_enfermeria_questions.py
-- Source: local files in BASE DE PREGUNTAS CACES
-- Questions: {len(questions)}
-- Skipped as non-question/unsupported/non-nursing sources: {", ".join(SKIPPED_SOURCES)}

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text check (role in ('student', 'teacher')),
  career text,
  created_at timestamp with time zone default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  category text,
  difficulty text,
  created_at timestamp with time zone default now()
);

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  total_questions integer,
  correct_answers integer,
  incorrect_answers integer,
  score numeric,
  time_used_seconds integer,
  status text,
  created_at timestamp with time zone default now()
);

create table if not exists public.simulation_answers (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  answered_at timestamp with time zone
);

create unique index if not exists questions_seed_hash_idx
on public.questions ((md5(question_text || option_a || option_b || option_c || option_d)));

create unique index if not exists questions_seed_question_text_hash_idx
on public.questions ((md5(question_text)));

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_answers enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "Teachers can read profiles" on public.profiles;
create policy "Teachers can read profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.current_profile_role() = 'teacher'
);

drop policy if exists "Students can update own profile" on public.profiles;
create policy "Students can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id and role = 'student')
with check (auth.uid() = id and role = 'student');

drop policy if exists "Authenticated users can read questions" on public.questions;
create policy "Authenticated users can read questions"
on public.questions for select to authenticated
using (true);

drop policy if exists "Students can read own simulations" on public.simulations;
create policy "Students can read own simulations"
on public.simulations for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own simulations" on public.simulations;
create policy "Students can insert own simulations"
on public.simulations for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can read simulations" on public.simulations;
create policy "Teachers can read simulations"
on public.simulations for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

drop policy if exists "Students can read own simulation answers" on public.simulation_answers;
create policy "Students can read own simulation answers"
on public.simulation_answers for select to authenticated
using (
  exists (
    select 1 from public.simulations
    where simulations.id = simulation_answers.simulation_id
      and simulations.student_id = auth.uid()
  )
);

drop policy if exists "Students can insert own simulation answers" on public.simulation_answers;
create policy "Students can insert own simulation answers"
on public.simulation_answers for insert to authenticated
with check (
  exists (
    select 1 from public.simulations
    where simulations.id = simulation_answers.simulation_id
      and simulations.student_id = auth.uid()
  )
);

drop policy if exists "Teachers can read simulation answers" on public.simulation_answers;
create policy "Teachers can read simulation answers"
on public.simulation_answers for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

insert into public.questions (
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  explanation,
  category,
  difficulty
) values
"""

    rows = []
    for question in questions:
        layout = build_answer_layout(question)
        rows.append(
            "("
            + ", ".join(
                [
                    sql_literal(str(question["question_text"])),
                    sql_literal(layout["option_a"]),
                    sql_literal(layout["option_b"]),
                    sql_literal(layout["option_c"]),
                    sql_literal(layout["option_d"]),
                    sql_literal(layout["correct_option"]),
                    sql_literal(str(question["explanation"])),
                    sql_literal(f"Enfermería - {question['area']}"),
                    sql_literal(str(question["source"])),
                ]
            )
            + ")"
        )

    return header + ",\n".join(rows) + "\non conflict do nothing;\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("supabase/caces_schema_and_enfermeria_seed.sql"),
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path("src/data/enfermeriaQuestions.json"),
    )
    args = parser.parse_args()

    questions, source_counts = load_questions()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_sql(questions), encoding="utf-8")

    local_questions = []
    for index, question in enumerate(questions, start=1):
        layout = build_answer_layout(question)
        local_questions.append(
            {
                "id": f"local-enfermeria-{index:04d}-{str(question['key'])[:12]}",
                "question_text": question["question_text"],
                "option_a": layout["option_a"],
                "option_b": layout["option_b"],
                "option_c": layout["option_c"],
                "option_d": layout["option_d"],
                "correct_option": layout["correct_option"],
                "explanation": question["explanation"],
                "category": f"Enfermería - {question['area']}",
                "difficulty": question["source"],
                "created_at": None,
            }
        )

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(local_questions, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Generated {args.output} and {args.json_output} with {len(questions)} questions"
    )
    print(json.dumps(source_counts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
