# Orderlo

Mobile-first multi-vendor ordering for kitchenware and cooking ingredients.

## Buyer flow

1. Log in with Hong Kong phone + password (new signups await admin approval)
2. Start from **product type** or **vendor**
3. Add items — each vendor keeps a **separate cart**
4. Meet that vendor’s **MOQ** (amount or quantity)
5. Add shops (name + delivery address) under **個人資料**
6. **Copy WhatsApp message** from the cart (pick a shop first) and paste into WhatsApp yourself

## Admin flow

1. Only **+852 66169905** sees Admin; unlock with Admin PIN (default `1234`)
2. Approve / enable / disable users
3. Set the sales WhatsApp number and upload vendor quotations (Excel/CSV preferred)
4. Upload **overwrites** that vendor’s previous product list and bumps the quotation version

## Run

```bash
npm install
npm run dev -- --host
```
