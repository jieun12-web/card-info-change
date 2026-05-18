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
