// 有料老人ホーム簡易経営診断 受信スクリプト（Google Apps Script）
// 設置手順は README.md「回答を集める設定」を参照してください。
//
// このファイルは Apps Script エディタに貼り付けて使います。
// 複数行にまたがるブロックコメントは使っていません。コピーの際に開始行が
// 欠けると、以降の行がコードとして読まれて構文エラーになるためです。

// 通知先はこのファイルではなく、Apps Script 側で書き換えてください。
// このリポジトリは公開されているため、メールアドレスは記載しません。
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
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const header = ['受信日時'].concat(data.cols);

  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.setFrozenRows(1);
  } else {
    // 設問が変わるとヘッダーと列がずれるため、一致しない場合は旧シートを退避して作り直す
    const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (cur.join('') !== header.join('')) {
      sh.setName(SHEET_NAME + '_旧' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss'));
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(header);
      sh.setFrozenRows(1);
    }
  }
  sh.appendRow([new Date()].concat(data.row));
}

// 集計シートを空にして作り直す（Apps Script エディタから手動で実行します）。
// 旧レイアウトのヘッダーやテスト行が残っている場合に一度だけ実行してください。
function resetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tmp = ss.insertSheet('__reset_tmp');      // 最後の1枚は削除できないため先に作る
  const sh = ss.getSheetByName(SHEET_NAME);
  if (sh) ss.deleteSheet(sh);
  tmp.setName(SHEET_NAME);                        // 空のシートを「回答」として使う
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
