SUMMARY CARDS RESTORE PATCH v7.6

Fix:
- Restores the full Summary (Özet) page cards (Balance / Totals / Category totals / Advances)
- Keeps Excel export button
- Adds localUserId + requestId safely inside the JSON body (no syntax errors)
- Button label shows credit cost (200)

Apply:
- Overwrite: app/app/summary/page.tsx
- Restart dev server
