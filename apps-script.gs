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
