/**
 * RFC-4180 CSV tokenizer. Returns rows of raw (untrimmed) cell strings,
 * including the header row at index 0. Handles quoted fields (commas, quotes,
 * newlines), CRLF/LF, a leading BOM, and a trailing newline. Empty input -> [].
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  if (src.trim() === "") return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushCell();
      i += 1;
    } else if (ch === "\r") {
      // swallow; the following \n (or end) terminates the row
      i += 1;
    } else if (ch === "\n") {
      pushRow();
      i += 1;
    } else {
      cell += ch;
      i += 1;
    }
  }
  // flush the last cell/row unless the input ended exactly on a newline
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}
