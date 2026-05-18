# [내죠여왕] 자동 적재 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `시트1` G열(처리완료) 체크 시 같은 스프레드시트 `내죠여왕` 시트에 가공된 1행을 자동 추가하고, 소스 H열에 처리 표식을 남겨 행당 1회만 적재한다.

**Architecture:** 기존 `apps-script.gs`에 순수 헬퍼 함수 4개와 단순 `onEdit(e)` 트리거 1개를 추가한다. `doPost`/`doGet`은 건드리지 않는다. 같은 스프레드시트 내 작업이라 단순 트리거로 권한 승인 없이 동작.

**Tech Stack:** Google Apps Script (V8), Google Sheets, container-bound 단순 onEdit 트리거

---

## File Structure

- Modify: `apps-script.gs` — 파일 끝(`doGet` 다음)에 헬퍼 + `onEdit` 추가. 기존 함수는 불변.

테스트 러너가 없는 환경(GAS). 검증은 (a) 코드 정독 + 제시된 예시로 손계산 대조, (b) 사용자가 수행하는 실제 시트 수동 테스트.

소스 `시트1` 열: B(2)=사업자번호 `'1234567890`, C(3)=상호명, D(4)=휴대폰 `'010…`, G(7)=처리완료 체크박스, H(8)=처리표식(본 기능 기록).
타깃 `내죠여왕` 열: A=상호명, B=휴대폰, C=MOBIL사번, D=`정보변경`, E=금액, F=만료일.

---

### Task 1: 순수 헬퍼 함수 4개 추가

**Files:**
- Modify: `apps-script.gs` (파일 끝, `doGet` 함수 닫는 `}` 다음 줄에 append)

- [ ] **Step 1: 헬퍼 함수 블록 추가**

`apps-script.gs` 맨 끝(마지막 줄 `}` = `doGet`의 닫는 중괄호 다음)에 아래를 그대로 추가:

```javascript

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
```

- [ ] **Step 2: 코드 정독 검증 (손계산 대조)**

추가한 함수를 읽고 아래 예시가 코드 로직과 일치하는지 확인:
- `njyw_calcAmount("'1234567890")` → digits `"1234567890"`, substring(3,5)=`"45"`, 45 not in 81~87 → **33000** ✓
- `njyw_calcAmount("1238167890")` → `"81"` → 81 in range → **55000** ✓
- `njyw_calcAmount("5558767890")` → `"87"` → **55000** ✓
- `njyw_calcAmount("2208567890")` → `"08"` → 8 → **33000** ✓
- `njyw_pad4(1)` → `"0001"`, `njyw_pad4(23)` → `"0023"` ✓
- `njyw_expiry(new Date(2026,4,18))` (2026-05-18) → +29일 = 2026-06-16 → `"20260616"` ✓ (setDate가 월 경계 자동 처리)

GAS는 로컬 실행 불가 → 위 손계산이 본 단계의 검증이다. 불일치 발견 시 코드를 고치고 다시 대조.

- [ ] **Step 3: 커밋**

```bash
git add apps-script.gs && git -c user.name="노지은" -c user.email="jieun.noh@ishopcare.co.kr" commit -m "내죠여왕 적재 헬퍼 함수 추가 (금액/패딩/MMdd/만료일)"
```

---

### Task 2: onEdit(e) 트리거 함수 추가

**Files:**
- Modify: `apps-script.gs` (Task 1에서 추가한 헬퍼 블록 다음, 파일 끝)

- [ ] **Step 1: onEdit 함수 추가**

`apps-script.gs` 맨 끝(Task 1의 `njyw_expiry` 닫는 `}` 다음)에 그대로 추가:

```javascript

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
```

- [ ] **Step 2: 코드 정독 검증 (가드/매핑 대조)**

읽으면서 확인:
- 가드: 시트명 `시트1` 아님 / G열(7) 아님 / 다중셀 / 1행 / 미체크 / H열 이미 채워짐 → 각각 조기 `return` 되는가
- 내죠여왕 A~F가 spec 매핑(상호명, 휴대폰텍스트, MOBIL사번, 정보변경, 금액, 만료일)과 정확히 일치하는가
- `writeRow`가 `getLastRow()+1`(헤더 있으면 자연히 그 다음)인가
- `hCell.setValue(mobilId)`가 행 추가 성공 **이후**에 실행되는가 (실패 시 catch로 빠져 표식 안 남음 → 재시도 가능)
- `njyw_*` 헬퍼 이름이 Task 1 정의와 정확히 동일한가 (`njyw_calcAmount`, `njyw_pad4`, `njyw_mmdd`, `njyw_expiry`)

불일치 시 수정 후 재대조. (GAS 로컬 실행 불가 → 정독이 검증)

- [ ] **Step 3: 커밋**

```bash
git add apps-script.gs && git -c user.name="노지은" -c user.email="jieun.noh@ishopcare.co.kr" commit -m "시트1 G열 체크 시 내죠여왕 자동 적재 onEdit 추가"
```

---

### Task 3: 배포 및 실제 시트 수동 테스트 (사용자 수행)

**Files:** 없음 (Google Apps Script 편집기 / 스프레드시트에서 사용자가 직접 수행)

- [ ] **Step 1: Apps Script 코드 갱신**

구글시트 → 확장 프로그램 → Apps Script → 편집기 코드 전체를 최종 `apps-script.gs` 내용으로 교체 → 저장(Ctrl+S).
단순 `onEdit` 트리거는 별도 등록/배포가 필요 없다(함수명 `onEdit`이면 시트 편집 시 자동 실행). 웹앱 배포는 폼 저장(`doPost`)용이며 이번 변경과 무관 — 재배포 불필요.

- [ ] **Step 2: 정상 적재 테스트**

`시트1` 데이터 행 하나의 G열 체크박스를 켠다. 기대:
- `내죠여왕` 마지막 행 다음에 A=상호명, B=휴대폰(앞 0 유지), C=`MOBIL{오늘MMdd}-0001`, D=`정보변경`, E=금액, F=오늘+29일(yyyyMMdd) 추가
- `시트1` 같은 행 H열에 그 MOBIL 사번이 기록됨

- [ ] **Step 3: 중복 방지 테스트**

같은 행 G열 체크 해제 후 다시 체크. 기대: `내죠여왕`에 새 행이 **추가되지 않음**(H열에 표식이 있어 스킵).

- [ ] **Step 4: 금액 분기 테스트**

사업자번호 4·5번째 자리가 81~87인 행과 그 외인 행을 각각 체크 → E열이 각각 `55000` / `33000`인지 확인.

- [ ] **Step 5: 순번 증가 테스트**

같은 날 다른 행 2개를 연속 체크 → C열이 `…-0001`, `…-0002`로 증가하는지 확인.

- [ ] **Step 6: 결과 보고**

위 5개 테스트 결과를 보고. 실패 항목이 있으면 어떤 값이 어떻게 나왔는지 함께 보고 → 코드 수정 루프.

---

## Self-Review

**1. Spec coverage:**
- 트리거 조건(시트1 / G7 / 단일셀 / 2행+ / 체크됨 / H비어있음) → Task 2 Step 1 ✓
- 내죠여왕 A~F 매핑 → Task 2 Step 1 ✓
- C열 MOBIL+MMdd+`-`+4자리순번, 순번=prefix 일치 행수+1 → Task 2 (njyw_mmdd, njyw_pad4, count 루프) ✓
- E열 금액 81~87→55000 외 33000 → Task 1 njyw_calcAmount ✓
- F열 실행일+29일 yyyyMMdd 텍스트 → Task 1 njyw_expiry + Task 2 `"'" +` ✓
- B열 휴대폰 텍스트 강제(앞0) → Task 2 `"'" + String(phone)` ✓
- 행당 1회 = H열 표식 → Task 2 hCell 체크 + setValue ✓
- doPost/doGet 불변 → 파일 끝에만 append, 기존 함수 미수정 ✓
- 수동 테스트 6항목 → Task 3 ✓
모든 spec 요구사항이 태스크에 매핑됨. 갭 없음.

**2. Placeholder scan:** TBD/TODO/추상 지시 없음. 모든 코드 스텝에 완전한 코드 포함.

**3. Type consistency:** 헬퍼명 `njyw_calcAmount` / `njyw_pad4` / `njyw_mmdd` / `njyw_expiry`가 Task 1 정의와 Task 2 호출에서 동일. 시트명 문자열 `'시트1'`, `'내죠여왕'` 일관. 열 인덱스(B=2,C=3,D=4,G=7,H=8) 일관.

이슈 없음.
