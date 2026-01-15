PATCH v7 (Build fix + Excel export fix)

1) Fixes build error in lib/receipt/vision.ts:
   - localUserId/requestId are now defined BEFORE fetch()
   - fetch() body includes { imageDataUrl, localUserId, requestId }

2) Excel export:
   - Category -> worksheet mapping is now robust (Yemek/yemek/YEMEK -> YEMEK, etc.)
   - Fuel receipts with plate/brand hints are forced into ULAŞIM even if misclassified as DİĞER
   - When a category sheet needs more rows than the template provides, we now:
        a) add new rows copying BOTH styles AND formulas (KDV/NET keeps working)
        b) expand sheet total formulas (G2/G3/G4) to include the new rows
