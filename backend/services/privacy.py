import re
import pandas as pd

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")


def mask_email_match(match: re.Match) -> str:
    full_email = match.group(0)
    if "@" in full_email:
        user, domain = full_email.split("@", 1)
        first_char = user[0] if user else ""
        return f"{first_char}***@{domain}"
    return full_email


def mask_phone_match(match: re.Match) -> str:
    phone_str = match.group(0)
    digits = [c for c in phone_str if c.isdigit()]
    if len(digits) < 4:
        return phone_str
    last_four = "".join(digits[-4:])

    if phone_str.startswith("+"):
        prefix_part = phone_str.split()[0] if " " in phone_str else phone_str.split("-")[0]
        prefix = prefix_part if prefix_part.startswith("+") else "+1"
        return f"{prefix}-***-***-{last_four}"
    return f"***-***-{last_four}"


def scan_pii(df: pd.DataFrame) -> list[dict]:
    """
    Scan string/object columns for Email and Phone PII.
    Returns list of dicts with:
      column_name, emails_found, phones_found, total_pii
    """
    results = []
    for col in df.columns:
        if not (df[col].dtype == object or pd.api.types.is_string_dtype(df[col])):
            continue

        emails_count = 0
        phones_count = 0

        for val in df[col].dropna():
            str_val = str(val)
            emails = list(EMAIL_REGEX.finditer(str_val))
            emails_count += len(emails)

            phones = list(PHONE_REGEX.finditer(str_val))
            phones_count += len(phones)

        total_pii = emails_count + phones_count
        results.append({
            "column_name": str(col),
            "emails_found": emails_count,
            "phones_found": phones_count,
            "total_pii": total_pii,
        })

    return results


def mask_pii(df: pd.DataFrame) -> pd.DataFrame:
    """
    Mask Email and Phone numbers in string/object columns:
    - Emails: keep first char + '***@' + domain
    - Phones: keep last 4 digits
    Returns modified copy of DataFrame.
    """
    df_masked = df.copy()

    def mask_cell(val):
        if not isinstance(val, str):
            return val
        masked_val = EMAIL_REGEX.sub(mask_email_match, val)
        masked_val = PHONE_REGEX.sub(mask_phone_match, masked_val)
        return masked_val

    for col in df_masked.columns:
        if df_masked[col].dtype == object or pd.api.types.is_string_dtype(df_masked[col]):
            df_masked[col] = df_masked[col].apply(
                lambda x: mask_cell(x) if pd.notna(x) else x
            )

    return df_masked
