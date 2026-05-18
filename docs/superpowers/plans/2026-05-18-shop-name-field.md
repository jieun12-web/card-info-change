# 상호명 필드 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드사 정보변경 신청 폼에 필수 입력 "상호명" 필드를 추가하고 구글시트 C열에 저장한다.

**Architecture:** 정적 HTML 페이지(`index.html`)에 입력 필드 + 검증 로직 + payload 추가, Google Apps Script(`apps-script.gs`)의 시트 저장 순서·체크박스 열을 신규 시트 레이아웃에 맞게 조정. 테스트 프레임워크가 없으므로 브라우저 수동 검증으로 확인한다.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script, Google Sheets

---

## File Structure

- Modify: `index.html` — 폼 필드, 검증, payload (단일 파일에 마크업+스크립트 공존, 기존 패턴 유지)
- Modify: `apps-script.gs` — appendRow 순서, 체크박스 열, 헤더 주석

신규 시트 레이아웃(사용자가 C열을 이미 추가):

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| 접수시각 | 사업자번호 | 상호명 | 휴대폰 | 변경항목 | 기타사항 | 처리완료 |

---

### Task 1: index.html에 상호명 입력 필드 추가

**Files:**
- Modify: `index.html` (마크업: `#f-biz` 블록과 `#f-phone` 블록 사이)

- [ ] **Step 1: 사업자번호 필드와 휴대폰 필드 사이에 상호명 필드 삽입**

`index.html`에서 `#f-biz` div의 닫는 `</div>`(라인 304 부근, `<div class="err-msg">사업자번호는...` 다음)와 `<div class="field" id="f-phone">` 사이에 아래 블록을 추가:

```html
          <div class="field" id="f-name">
            <label class="label" for="name">상호명<span class="req">*</span></label>
            <input
              id="name"
              name="name"
              type="text"
              autocomplete="off"
              placeholder="상호명을 입력해주세요"
            />
            <div class="err-msg">상호명을 입력해주세요.</div>
          </div>
```

- [ ] **Step 2: 브라우저에서 마크업 확인**

`index.html`을 브라우저로 열기(파일 더블클릭 또는 `start index.html`).
Expected: 사업자번호 칸 바로 아래에 "상호명 *" 라벨과 빈 텍스트 입력 칸이 보이고, 그 아래 휴대폰 번호 칸이 위치한다. 한글·영문·숫자 입력이 모두 그대로 들어간다(필터 없음).

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "상호명 입력 필드 추가 (사업자번호 아래, 자유 텍스트)"
```

---

### Task 2: 상호명 필수 검증 + payload 추가

**Files:**
- Modify: `index.html` (스크립트: 요소 참조, `validate()`, submit payload)

- [ ] **Step 1: 상호명 요소 참조 추가**

`index.html` 스크립트의 요소 참조 부분(`const bizEl = document.getElementById("biz");` 부근, 라인 391)에 아래 줄 추가:

```javascript
    const nameEl   = document.getElementById("name");
```

`onlyDigits(nameEl)`는 **추가하지 않는다** (상호명은 한글·영문·숫자 자유 입력).

- [ ] **Step 2: validate()에 상호명 필수 체크 추가**

`validate()` 함수 안, 휴대폰 검증 블록 다음·"변경 항목 최소 1개" 블록 앞(라인 485 부근)에 추가:

```javascript
      // 상호명
      const nameValid = nameEl.value.trim().length > 0;
      setError("f-name", !nameValid);
      if (!nameValid) ok = false;
```

- [ ] **Step 3: 제출 payload에 name 추가**

submit 핸들러의 `payload` 객체(라인 515 부근)에 `name` 키 추가:

```javascript
      const payload = {
        biz: bizEl.value,
        name: nameEl.value.trim(),
        phone: phoneEl.value,
        items: getCheckedItems(),
        etc: chkEtc.checked ? etcEl.value.trim() : "",
        submittedAt: new Date().toISOString(),
      };
```

- [ ] **Step 4: 브라우저에서 검증 동작 확인**

`index.html`을 브라우저로 다시 열고:
1. 상호명을 비운 채(공백만 입력 포함) 다른 칸 채우고 "제출하기" 클릭
   - Expected: 제출이 차단되고 상호명 칸 테두리가 빨개지며 "상호명을 입력해주세요." 오류 메시지 표시, 해당 칸으로 스크롤
2. 상호명에 "테스트상호 ABC 123" 입력 후 나머지 정상 입력하고 제출
   - Expected: 완료 화면으로 전환됨

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "상호명 필수 검증 및 제출 payload에 name 추가"
```

---

### Task 3: apps-script.gs 시트 저장 순서 조정

**Files:**
- Modify: `apps-script.gs`

- [ ] **Step 1: 헤더 주석 갱신**

`apps-script.gs` 상단 주석(라인 4)을 신규 레이아웃으로 변경:

```javascript
 * 시트 1행 헤더: 접수시각 | 사업자번호 | 상호명 | 휴대폰 | 변경항목 | 기타사항 | 처리완료
```

그리고 1행 `(v2: 체크박스 자동 생성)` 옆 또는 주석에 `v3: 상호명 열 추가` 표기:

```javascript
 * 카드사 정보변경 신청 - 구글 시트 저장용 Apps Script (v3: 상호명 열 추가)
```

- [ ] **Step 2: appendRow 배열에 상호명 삽입**

`sheet.appendRow([...])` 블록(라인 17-23)을 아래로 교체:

```javascript
    sheet.appendRow([
      submittedAt,
      "'" + (data.biz || ''),
      data.name || '',
      "'" + (data.phone || ''),
      (data.items || []).join(', '),
      data.etc || ''
    ]);
```

(상호명은 텍스트이므로 `'` 강제 텍스트 접두어를 붙이지 않는다.)

- [ ] **Step 3: 처리완료 체크박스 열을 G(7)로 변경**

라인 27을 변경:

```javascript
    sheet.getRange(newRow, 7).insertCheckboxes();
```

- [ ] **Step 4: Apps Script 배포 갱신 (사용자 작업)**

`apps-script.gs` 내용을 Google Apps Script 편집기에 붙여넣고 기존 웹앱 배포를 **새 버전으로 갱신**(배포 관리 → 편집 → 새 버전).
Expected: 배포 URL(`WEB_APP_URL`)은 동일하게 유지된다.

- [ ] **Step 5: 엔드투엔드 확인**

배포된 페이지(또는 로컬 `index.html`에서 `WEB_APP_URL` 그대로)에서 상호명 "엔드투엔드 Test 999" 포함 전체 폼 제출 후 구글시트 확인.
Expected:
- C열에 "엔드투엔드 Test 999" 저장
- B열 사업자번호, D열 휴대폰, E열 변경항목, F열 기타사항이 밀림 없이 각 위치에 정확히 저장
- G열에 처리완료 체크박스 생성

- [ ] **Step 6: 커밋**

```bash
git add apps-script.gs
git commit -m "Apps Script: 상호명 C열 저장 및 체크박스 G열로 이동 (v3)"
```

---

## Self-Review

**1. Spec coverage:**
- 위치(사업자번호 아래) → Task 1 Step 1 ✓
- 자유 텍스트·길이 제한 없음·한글영문숫자 → Task 1 (maxlength 없음, onlyDigits 미적용) ✓
- 필수 입력 + 오류 메시지 → Task 2 Step 2 ✓
- payload 추가 → Task 2 Step 3 ✓
- 시트 C열 저장 → Task 3 Step 2 ✓
- 체크박스 F→G → Task 3 Step 3 ✓
- 헤더 주석 갱신 → Task 3 Step 1 ✓
- 수동 테스트 항목 → Task 2 Step 4, Task 3 Step 5 ✓
모든 스펙 요구사항이 태스크에 매핑됨. 갭 없음.

**2. Placeholder scan:** TBD/TODO/추상 지시 없음. 모든 코드 스텝에 실제 코드 포함.

**3. Type consistency:** `nameEl` / `name` / `data.name` 키 이름이 Task 2~3 전반에서 일관됨. payload 키 `name`과 apps-script `data.name` 일치.

이슈 없음.
