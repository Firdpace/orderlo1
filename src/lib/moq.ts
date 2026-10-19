import type { MoqRule } from "../data/types";
import { formatPrice } from "../data/seed";

export function cartQuantity(
  lines: Array<{ quantity: number }>,
) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function moqProgress(args: {
  moq: MoqRule;
  quantity: number;
  amount: number;
}) {
  const current = args.moq.type === "amount" ? args.amount : args.quantity;
  const target = args.moq.value;
  const ratio = target <= 0 ? 1 : Math.min(1, current / target);
  const met = current >= target;
  const remaining = Math.max(0, target - current);
  const label =
    args.moq.type === "amount"
      ? met
        ? `MOQ 已達標（${formatPrice(args.amount)}）`
        : `再買 ${formatPrice(remaining)} 可達 MOQ ${formatPrice(target)}`
      : met
        ? `MOQ 已達標（${args.quantity} pcs）`
        : `再買 ${remaining} pcs 可達 MOQ ${target}`;

  return { current, target, ratio, met, remaining, label };
}
