/* 有料老人ホーム簡易経営診断 受信スクリプト（Google Apps Script）
   設置手順は README.md「回答を集める設定」を参照してください。 */

/* 通知先はこのファイルではなく、Apps Script 側で書き換えてください。
   このリポジトリは公開されているため、メールアドレスは記載しません。 */
const NOTIFY_TO = 'CHANGE_ME@example.com';
const NOTIFY_CC = '';
const SHEET_NAME = '回答';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    appendRow_(data);
    notify_(data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'yuro-shindan' });
}

function appendRow_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['受信日時'].concat(data.cols));
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date()].concat(data.row));
}

function notify_(data) {
  const name = data.ref ? '整理番号 ' + data.ref : '整理番号なし';
  MailApp.sendEmail({
    to: NOTIFY_TO,
    cc: NOTIFY_CC || undefined,
    subject: '【有料老人ホーム簡易経営診断】回答1件（' + name + '）',
    body: data.summary +
      '\n\n----------------------------------------\n' +
      '全回答は集計シートに追記されています。\n' +
      SpreadsheetApp.getActiveSpreadsheet().getUrl() + '\n',
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
