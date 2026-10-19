/** Platform-wide browse categories (ordered for UI). */
export const PLATFORM_CATEGORIES = [
  "雜貨",
  "乾貨",
  "醬汁調味",
  "肉類",
  "海鮮",
  "菜類",
  "加工食品",
  "飲品",
  "麵粉",
  "奶蛋忌廉",
  "甜品",
  "其他",
] as const;

export type PlatformCategory = (typeof PLATFORM_CATEGORIES)[number];

/**
 * 雜貨 = kitchen utensils / tools / disposables (not food groceries).
 * Explicit overrides from the unsure-type picker, adjusted for that meaning.
 */
export const SOURCE_TYPE_OVERRIDES: Record<string, PlatformCategory> = {
  罐頭蔬果: "菜類",
  "雜貨-乾貨/海味": "乾貨",
  "加工肉/腸": "肉類",
  "雜貨-色粉/香料": "醬汁調味",
  "紫菜/壽司用品": "海鮮",
  "粉類/調味": "醬汁調味",
  "果醬/花生醬/茄汁/椰漿": "乾貨",
  罐頭肉類: "肉類",
  "一夜干/乾貨魚": "乾貨",
  "豆腐/炸物/明太子": "加工食品",
  拉麵湯底: "加工食品",
  "湯底/骨包": "加工食品",
  粉: "麵粉",
  "海藻/前菜": "海鮮",
  加工肉: "肉類",
  廚酒: "醬汁調味",
  酒類: "飲品",
  米粉: "麵粉",
  米線: "麵粉",
  油: "醬汁調味",
  // Food-like old “雜貨*” quotation labels → not utensil 雜貨
  "雜貨-粉/其他": "麵粉",
  "雜貨-豆類/芝麻/花生": "乾貨",
  清潔用品: "其他",
  梘水: "醬汁調味",
  "粥米 (珍珠米)": "乾貨",
  米類: "乾貨",
  糯米: "乾貨",
  蔬菜: "菜類",
  廚具用具: "雜貨",
  麵類: "麵粉",
  加工食品: "加工食品",
  "炸物/其他": "加工食品",
  "沙律汁/調味": "醬汁調味",
};

const RULES: Array<{ category: PlatformCategory; patterns: RegExp[] }> = [
  {
    // Kitchen utensils / tools / packaging ware — NOT dry groceries
    category: "雜貨",
    patterns: [
      /廚具|餐具|用具|工具|器皿|筷子|飯盒|刀架|砧板|鍋具|鍋鏟|瓢|碗|碟|杯|勺|匙|手套|牙籤|吸管|锡纸|鋁箔|保鮮紙|即棄餐|即棄盒|disposables?|utensil|chopstick|lunchbox|kitchenware|cookware/i,
    ],
  },
  {
    category: "飲品",
    patterns: [/飲品|茶\/|酒類|^茶$/],
  },
  {
    category: "甜品",
    patterns: [/甜品|蛋糕|和菓子|福餅/],
  },
  {
    category: "奶蛋忌廉",
    patterns: [/奶|忌廉|煉奶|植脂|牛油|馬芝蓮|芝士|蛋/],
  },
  {
    category: "麵粉",
    patterns: [
      /麵粉|^粉$|米粉|米線|麵類|^麵$|烏冬|通粉|意大利粉|麥片|麵包糠|拉麵食材|雜貨-粉/,
    ],
  },
  {
    category: "海鮮",
    patterns: [
      /海鮮|蝦|蟹|魚|鰻|Unagi|帶子|魚籽|刺身|八爪|魷|海藻|一夜干|紫菜|壽司/,
    ],
  },
  {
    category: "肉類",
    patterns: [
      /肉類|牛肉|豚肉|豬肉|豬|雞肉|羊|鵝|加工肉|腸|叉燒|串燒|雞肉串|急凍肉|罐頭肉/,
    ],
  },
  {
    category: "菜類",
    patterns: [/菜類|蔬菜|日本蔬菜|蔬果|罐頭蔬果/],
  },
  {
    category: "醬汁調味",
    patterns: [
      /醬|調味|醬油|味噌|醋|味醂|香料|糖\/鹽|^糖$|^鹽$|味精|南乳|腐乳|麻油|油\/|燒肉汁|沙律汁|沙津|雞粉|廚酒|料理酒|色粉|^油$|梘水/,
    ],
  },
  {
    category: "乾貨",
    patterns: [
      /乾貨|海味|豆類|芝麻|花生|米類|糯|粥米|飯|果醬|花生醬|茄汁|椰漿/,
    ],
  },
  {
    category: "加工食品",
    patterns: [
      /加工|炸物|可樂餅|唐揚|年糕|豆腐|明太子|沙律\/加工|漬物|醃製|拉麵湯|湯底|骨包|罐頭\/|包裝湯/,
    ],
  },
];

export function toPlatformCategory(raw: string | undefined | null): PlatformCategory {
  const text = String(raw ?? "").trim();
  if (!text) return "其他";
  if (SOURCE_TYPE_OVERRIDES[text]) return SOURCE_TYPE_OVERRIDES[text];
  // Bare “雜貨” without utensil cues → 其他 (avoid treating old grocery labels as utensils)
  if (/^雜貨$/.test(text)) return "其他";
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(text))) return rule.category;
  }
  return "其他";
}

export function sortPlatformCategories(categories: string[]): PlatformCategory[] {
  return PLATFORM_CATEGORIES.filter((c) => categories.includes(c));
}

/** Original quotation fine-type under a platform category (shop next level). */
export function subcategoryLabel(product: {
  sourceCategory?: string;
  productType?: string;
}): string {
  const raw = String(product.sourceCategory ?? "").trim();
  if (raw) return raw;
  return String(product.productType ?? "").trim() || "其他";
}

/** Distinct subcategories for one platform category, count-desc then locale. */
export function listSubcategories(
  products: Array<{ productType?: string; sourceCategory?: string }>,
  platformCategory: string,
): string[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.productType !== platformCategory) continue;
    const label = subcategoryLabel(product);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-HK"))
    .map(([label]) => label);
}
