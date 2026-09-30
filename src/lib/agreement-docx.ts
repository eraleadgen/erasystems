import {
  AlignmentType, BorderStyle, Document, Footer, LevelFormat, Packer, PageNumber, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType, ShadingType,
} from "docx";

import { buildAgreement, type AgreementInput } from "./agreement";

const W = 9360;
const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, width: number, bold = false, fill?: string) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    ...(fill ? { shading: { fill, type: ShadingType.CLEAR, color: "auto" } } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

function signatureBlock(party: string, name: string) {
  const line = (label: string) =>
    new Paragraph({ keepNext: true, keepLines: true, spacing: { before: 280 }, children: [new TextRun(`${label}: ______________________________________`)] });
  return [
    new Paragraph({ keepNext: true, spacing: { before: 360 }, children: [new TextRun({ text: party, bold: true })] }),
    new Paragraph({ keepNext: true, children: [new TextRun(name)] }),
    line("Signature"), line("Printed name"), line("Title"), line("Date"),
  ];
}

export function buildAgreementDocument(input: AgreementInput): Document {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "ERA SYSTEMS LLC", bold: true, size: 32, color: "0F766E" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: "Client Services and Purchase Agreement", bold: true, size: 28 })] }),
  ];
  for (const block of buildAgreement(input)) {
    if (block.kind === "heading") {
      children.push(new Paragraph({ spacing: { before: 280, after: 120 }, keepNext: true, children: [new TextRun({ text: block.text, bold: true, size: 24, color: "0F766E" })] }));
    } else if (block.kind === "para") {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun(block.text)] }));
    } else if (block.kind === "bullet") {
      children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: [new TextRun(block.text)] }));
    } else {
      children.push(new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: [5200, 4160],
        rows: block.rows.map(([a, v], i) =>
          new TableRow({ children: [cell(a, 5200, i === block.rows.length - 1, "F1F5F4"), cell(v, 4160, i === block.rows.length - 1)] }),
        ),
      }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }
  children.push(...signatureBlock("ERA SYSTEMS LLC", "Authorized representative"));
  children.push(...signatureBlock("CLIENT", input.clientName ?? "Business name: ______________________"));

  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    numbering: {
      config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: "ERA Systems LLC · Client Services and Purchase Agreement · Page ", size: 16, color: "777777" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "777777" }),
        ] })] }),
      },
      children,
    }],
  });
}

/** Browser download. */
export async function downloadAgreementDocx(input: AgreementInput) {
  const blob = await Packer.toBlob(buildAgreementDocument(input));
  const safe = (input.clientName ?? "template").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ERA-Agreement-${safe}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
