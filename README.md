# SG골프 공략북 (1단계)

**앱 주소: https://parksunggyu130.github.io/sggolf/**

전국 골프장 코스 공략 · 기록지 · GPS 거리 · 그린 경사 측정 앱. 하나의 웹 코드(`www/`)로 URL(PWA), 아이폰(홈 화면 추가), 안드로이드 APK(Capacitor)를 모두 지원해요.

## 폴더
- `www/` 앱 본체 (빌드 과정 없는 순수 HTML/CSS/JS)
  - `js/core.js` 저장소 · 좌표 계산 · 공유
  - `js/golf.js` 스코어 · 내기 · 통계 · 자동 공략 · 퍼트 경사
  - `js/osm.js` OpenStreetMap 도면 · 고도 · 날씨
  - `js/map.js` 도면 SVG · 지도 · GPS · 기울기 센서 · 오프라인 타일
  - `js/views.js`, `js/play.js` 화면
  - `js/help.js` 앱 안 사용법
  - `js/main.js` 라우터 · 동작
  - `data/kr-courses.json` 전국 골프장 목록 (OSM, `tools/build-courses.js`로 생성)
- `android/` Capacitor 안드로이드 프로젝트
- `dist/SGgolf-1.0.0.apk` 설치 파일
- `mockup-strategy/` 공략북 목업, `mockup/` 이전 스코어카드 목업

## 실행 · 빌드
```
npm run serve          # http://localhost:8765 로컬 테스트
npm run apk            # www → android 동기화 후 APK 빌드
npm run deploy         # www 폴더를 GitHub Pages(gh-pages)에 배포
```
APK 빌드에는 JDK 21과 Android SDK가 필요해요 (`android/local.properties`).

## 데이터 출처
OpenStreetMap 기여자(ODbL) · Esri World Imagery · Open-Meteo(고도 Copernicus DEM 90m, 날씨).
