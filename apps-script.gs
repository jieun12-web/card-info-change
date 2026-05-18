/**
 * 카드사 정보변경 신청 - 구글 시트 저장용 Apps Script (v3: 상호명 열 추가)
 *
 * 시트 1행 헤더: 접수시각 | 사업자번호 | 상호명 | 휴대폰 | 변경항목 | 기타사항 | 처리완료
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    const tz = 'Asia/Seoul';
    const submittedAt = data.submittedAt
      ? Utilities.formatDate(new Date(data.submittedAt), tz, 'yyyy-MM-dd HH:mm:ss')
      : Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

    sheet.appendRow([
      submittedAt,
      "'" + (data.biz || ''),
      data.name || '',
      "'" + (data.phone || ''),
      (data.items || []).join(', '),
      data.etc || ''
    ]);

    // 방금 추가된 행의 G열에 체크박스 삽입
    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 7).insertCheckboxes();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('카드사 정보변경 신청 엔드포인트 - 정상')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===== [내죠여왕] 자동 적재 헬퍼 (v4) =====

/** 사업자번호 문자열에서 숫자만 추출 후 4·5번째 자리(0-index 3,4)가 81~87이면 55000, 그 외 33000 */
function njyw_calcAmount(bizRaw) {
  var digits = String(bizRaw == null ? '' : bizRaw).replace(/[^0-9]/g, '');
  var pair = parseInt(digits.substring(3, 5), 10);
  return (pair >= 81 && pair <= 87) ? 55000 : 33000;
}

/** 정수를 4자리 zero-pad 문자열로 (1 → "0001") */
function njyw_pad4(n) {
  return ('000' + n).slice(-4);
}

/** Date → Asia/Seoul 기준 'MMdd' (예 5월18일 → "0518") */
function njyw_mmdd(d) {
  return Utilities.formatDate(d, 'Asia/Seoul', 'MMdd');
}

/** Date → (그 날짜 + 29일)의 Asia/Seoul 'yyyyMMdd' 8자리 문자열 */
function njyw_expiry(d) {
  var t = new Date(d.getTime());
  t.setDate(t.getDate() + 29);
  return Utilities.formatDate(t, 'Asia/Seoul', 'yyyyMMdd');
}

/**
 * 시트1 G열(처리완료) 체크 시 내죠여왕에 1행 적재. 행당 1회(H열 표식으로 중복 방지).
 * 단순 트리거: 같은 스프레드시트 작업이라 권한 승인 불필요.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var rng = e.range;
    var sh = rng.getSheet();
    if (sh.getName() !== '시트1') return;
    if (rng.getColumn() !== 7) return;                 // G열만
    if (rng.getNumColumns() !== 1 || rng.getNumRows() !== 1) return;
    var row = rng.getRow();
    if (row < 2) return;                               // 데이터 행만

    var checked = (e.value === 'TRUE') || (rng.getValue() === true);
    if (!checked) return;

    var ss = e.source || SpreadsheetApp.getActiveSpreadsheet();

    // 이미 처리된 행이면 스킵 (H=8열에 표식)
    var hCell = sh.getRange(row, 8);
    if (String(hCell.getValue()).trim() !== '') return;

    var biz    = sh.getRange(row, 2).getValue();       // B 사업자번호
    var sangho = sh.getRange(row, 3).getValue();       // C 상호명
    var phone  = sh.getRange(row, 4).getValue();       // D 휴대폰

    var target = ss.getSheetByName('내죠여왕');
    if (!target) return;

    var now = new Date();
    var prefix = 'MOBIL' + njyw_mmdd(now) + '-';

    // 순번 = 내죠여왕 C열에서 prefix로 시작하는 기존 행 수 + 1
    var lastRow = target.getLastRow();
    var count = 0;
    if (lastRow >= 1) {
      var colC = target.getRange(1, 3, lastRow, 1).getValues();
      for (var i = 0; i < colC.length; i++) {
        if (String(colC[i][0]).indexOf(prefix) === 0) count++;
      }
    }
    var mobilId = prefix + njyw_pad4(count + 1);

    var writeRow = (lastRow < 1 ? 1 : lastRow + 1);
    target.getRange(writeRow, 1, 1, 6).setValues([[
      sangho,                       // A 상호명
      "'" + String(phone),          // B 휴대폰 (텍스트 강제, 앞 0 유지)
      mobilId,                      // C MOBIL 사번
      '정보변경',                    // D 고정
      njyw_calcAmount(biz),         // E 금액
      "'" + njyw_expiry(now)        // F 만료일 8자리 (텍스트)
    ]]);

    hCell.setValue(mobilId);        // 처리 표식 (재체크 시 중복 방지)
  } catch (err) {
    console.error('njyw onEdit error: ' + err);
  }
}
