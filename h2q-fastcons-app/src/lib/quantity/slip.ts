/** Quantity gate for field slips. Thực hiện counts against the contract. Nghiệm thu counts against approved thực hiện. */

export type QuantityPreview = {
  action: "ok" | "warn" | "block";
  over: boolean;
  message: string;
  room: number | null;
  column: "thực hiện" | "nghiệm thu";
};

export function previewQuantitySlip(input: {
  kind: "thuc_hien" | "nghiem_thu";
  qty: number;
  contract: number;
  executed: number;
  accepted: number;
  pendingExecuted?: number;
  pendingAccepted?: number;
  policy?: string | null;
  hasNote?: boolean;
}): QuantityPreview {
  const contractQty = Number(input.contract) || 0;
  const executedQty = Number(input.executed) || 0;
  const acceptedQty = Number(input.accepted) || 0;
  const pendingQty = Number(input.pendingExecuted) || 0;
  const pendingAccepted = Number(input.pendingAccepted) || 0;
  const thisQty = Number(input.qty) || 0;
  const mode = input.policy || "Warn";

  let already: number;
  let cap: number;
  let basis: string;
  let column: QuantityPreview["column"];

  if (input.kind === "thuc_hien") {
    already = executedQty + pendingQty;
    cap = contractQty;
    basis = "khối lượng hợp đồng";
    column = "thực hiện";
  } else {
    already = acceptedQty + pendingAccepted;
    if (executedQty > 0) {
      cap = executedQty;
      basis = "thực hiện đã duyệt";
    } else {
      cap = contractQty;
      basis = "khối lượng hợp đồng, vì chưa có thực hiện đã duyệt";
    }
    column = "nghiệm thu";
  }

  const total = already + thisQty;
  const over = cap > 0 && total > cap + 1e-9;
  let action: QuantityPreview["action"] = "ok";
  let message = "";
  if (over) {
    message = `Khối lượng ${column} lũy kế ${fmtQty(total)} vượt ${basis} ${fmtQty(cap)}.`;
    if (mode === "Block" || (mode === "Warn Require Note" && !input.hasNote)) {
      action = "block";
      if (mode === "Warn Require Note" && !input.hasNote) {
        message += " Cần ghi chú trước khi gửi.";
      } else {
        message += " Phiếu này sẽ không được gửi.";
      }
    } else {
      action = "warn";
      message += " Vẫn gửi được. Người duyệt sẽ thấy cờ vượt mức.";
    }
  }

  return {
    action,
    over,
    message,
    room: cap <= 0 ? null : cap - already,
    column,
  };
}

export function bucketForSlip(
  kind: string | null | undefined,
  approval: string | null | undefined,
): "executed" | "executed_pending" | "accepted" | "accepted_pending" | null {
  if (approval !== "Approved" && approval !== "Pending Approval") return null;
  const acceptance = kind === "nghiem_thu";
  if (approval === "Approved") return acceptance ? "accepted" : "executed";
  return acceptance ? "accepted_pending" : "executed_pending";
}

export function cleanRemarks(remarks?: string | null) {
  const kept: string[] = [];
  for (const line of (remarks || "").split("\n")) {
    if (line.startsWith("H2Q_ENTRY_KIND:")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function fmtQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const text = Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return text || "0";
}
