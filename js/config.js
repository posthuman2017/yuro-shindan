/* 送信先の設定
   SUBMIT_ENDPOINT に Google Apps Script ウェブアプリのURLを設定すると、
   回答が集計用スプレッドシートに追記され、担当者宛にメール通知されます。
   空欄のままの場合、回答は送信されず端末内のみで完結します（README参照）。 */

const SUBMIT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxw4lSRjAAlvIoYy6gzkB0pxzHHql5BEdrtJ4pqMd9plQYD0rCkF0lOu-L9660_9QGRwg/exec';

const SUBMIT_RECIPIENT = 'あいおいニッセイ同和損害保険株式会社';
