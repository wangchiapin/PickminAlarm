/**
 * 皮克敏蘑菇討伐鬧鐘 — LINE 通知（不需要金鑰版）
 *
 * 網頁只會送來 { alarmId, type }。
 * 這支程式會自己去 Firebase 查：
 *   1. 這個鬧鐘是否存在
 *   2. 類型是否相符、時間是否真的到了
 *   3. 「LINE 通知」開關是否開著
 * 全部通過才發 LINE，訊息內容也是這支程式自己組的，網頁不能指定。
 *
 * 需要的指令碼屬性（原本就有，不用新增）：
 *   LINE_CHANNEL_TOKEN  = LINE Messaging API 的 Channel access token
 * 舊的 MY_API_KEY 已經不再使用，可以刪掉。
 */

const DB_URL = 'https://pickminalarm-default-rtdb.asia-southeast1.firebasedatabase.app';

// 整個服務每分鐘最多發幾則（多台裝置各發一次，所以不要設太小）
const MAX_PER_MINUTE = 10;
// 同一個鬧鐘、同一種通知，最多發幾則
const MAX_PER_ALARM_TYPE = 5;
// 「已摧毀」「1 分鐘」的通知，允許比預定時間晚多久送來（毫秒）
const LATE_TOLERANCE_MS = 10 * 60 * 1000;
// 允許比預定時間早多久送來（毫秒，網頁計時有些微誤差）
const EARLY_TOLERANCE_MS = 5 * 1000;

/***********************
 * WEB APP HANDLER
 ***********************/
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const alarmId = String(body.alarmId || '');
    const type = String(body.type || '');

    if (!/^[-\w]{15,30}$/.test(alarmId)) return reply('bad id');
    if (['confirmed', 'destroyed', 'warning'].indexOf(type) < 0) return reply('bad type');

    // LINE 通知開關（網頁上的勾選框）
    if (readDb('settings/notificationEnabled') === false) {
      console.log('LINE 通知目前已由網頁設定關閉');
      return reply('disabled');
    }

    // 鬧鐘必須真的存在於 Firebase
    const alarm = readDb('alarms/' + alarmId);
    if (!alarm || typeof alarm !== 'object') return reply('no such alarm');

    const now = Date.now();
    const ts = Number(alarm.timestamp);
    if (!isFinite(ts)) return reply('bad alarm');

    const location = String(alarm.location || '').slice(0, 30);
    let message;

    if (type === 'confirmed') {
      if (alarm.type !== 'exact') return reply('type mismatch');
      message = `✅ [通知]\n${location}\n預計於 ${formatTime(ts)} 摧毀`;
    } else if (type === 'destroyed') {
      if (alarm.type !== 'exact' || !timeReached(now, ts)) return reply('not yet');
      message = `🍄 [注意]\n${location} 已摧毀！`;
    } else {
      if (alarm.type !== 'delayed' || !timeReached(now, ts)) return reply('not yet');
      message = `⚠️ [提醒]\n${location} 還有 1 分鐘出現！`;
    }

    // 頻率限制
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      if (!bump('min_' + Math.floor(now / 60000), MAX_PER_MINUTE, 120)) return reply('rate limited');
      if (!bump('alarm_' + alarmId + '_' + type, MAX_PER_ALARM_TYPE, 21600)) return reply('too many for this alarm');
    } finally {
      lock.releaseLock();
    }

    sendLineMessage(message);
    return reply('Success');
  } catch (err) {
    return reply('Error: ' + err.toString());
  }
}

/***********************
 * LINE BROADCAST MESSAGE
 ***********************/
function sendLineMessage(message) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      messages: [{ type: 'text', text: message }]
    }),
    muteHttpExceptions: true
  });
}

/***********************
 * 小工具
 ***********************/
function timeReached(now, ts) {
  return now >= ts - EARLY_TOLERANCE_MS && now <= ts + LATE_TOLERANCE_MS;
}

function readDb(path) {
  const res = UrlFetchApp.fetch(DB_URL + '/' + path + '.json', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

// 計數器加一；超過上限回傳 false
function bump(key, limit, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key) || 0);
  if (n >= limit) return false;
  cache.put(key, String(n + 1), ttlSeconds);
  return true;
}

function formatTime(ms) {
  return Utilities.formatDate(new Date(ms), 'Asia/Taipei', 'HH:mm:ss');
}

function reply(msg) {
  return ContentService.createTextOutput(msg);
}
