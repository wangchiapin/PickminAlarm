# 皮克敏蘑菇討伐鬧鐘

> 皮克敏風格的鬧鐘小工具

- **網址：** https://wangchiapin.github.io/PickminAlarm/
- **Firebase 專案：** pickminalarm
- **登入方式：** —
- **狀態：** 閒置（舊作）
- **備註：** 2026-10-24 做過一次安全整理（程式不再放金鑰）。2026-10-28 起 Gratitude（感謝日記）共用此專案的 **Firestore**（鬧鐘用的是 Realtime Database，兩者互不影響）；要刪除這個專案、或改 Firestore 規則之前，請先確認 Gratitude。

## LINE 通知（2026-10-24 改版）
- 網頁只送出「哪一個鬧鐘、什麼類型」（`confirmed`／`warning`／`destroyed`）給 Google Apps Script（`apps-script/pickminalarm-line.gs`），**前端不再放任何金鑰**。
- Apps Script 自己去 Firebase 查：鬧鐘存在、類型相符、時間真的到了、頁面上「LINE 通知」開關有開，才會發 LINE；訊息內容由 Apps Script 組，網頁不能指定。
- 有發送上限：整個服務每分鐘 10 則、同一鬧鐘同一種通知最多 5 則。
- 指令碼屬性只需要 `LINE_CHANNEL_TOKEN`；舊的 `MY_API_KEY` 已不用，可以刪掉。
- 鬧鐘的地點改成純文字顯示。

## Firebase 規則
正本是本 repo 的 `pickminalarm-database.rules.json`（Realtime Database）：`alarms`（地點最多 30 字、類型只能是 exact／delayed／ding1／ding2、時間限制在合理範圍）、`logs`、`settings/notificationEnabled`。改規則後要到 Firebase 主控台貼上發佈。
