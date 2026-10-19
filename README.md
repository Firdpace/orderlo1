# Hearth Market

Mobile-first multi-vendor marketplace for kitchenware and cooking ingredients.

## Buyer flow

1. Start from **product type** or **vendor**
2. Add items — each vendor keeps a **separate cart**
3. Meet that vendor’s **MOQ** (amount or quantity)
4. **Confirm on WhatsApp** — message includes product number, name, quantity, and price

## Admin flow

1. Open **Admin** (demo PIN `2468`)
2. Set the sales WhatsApp number
3. Upload a new vendor quotation (Excel/CSV preferred)
4. Upload **overwrites** that vendor’s previous product list and bumps the quotation version

PDF/image quotations can be sent in chat for first-time import; self-serve overwrite works best from Excel/CSV with columns like Product Number, Name, Type, Price.

## Run

```bash
npm install
npm run dev -- --host
```
