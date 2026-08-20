#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXE_PATH="${1:-}"

if ! command -v wine >/dev/null 2>&1 || ! command -v xvfb-run >/dev/null 2>&1; then
  echo "يلزم توفر wine وxvfb-run لاختبار حزمة Windows المعزولة." >&2
  exit 2
fi

if [[ -z "$EXE_PATH" ]]; then
  EXE_PATH="$(find "$PROJECT_ROOT/release" "$PROJECT_ROOT/../webdev-static-assets" -maxdepth 2 -type f -name 'TIA-Studio-1.0.3-Windows-x64*.exe' -print -quit 2>/dev/null || true)"
fi

if [[ -z "$EXE_PATH" || ! -f "$EXE_PATH" ]]; then
  echo "لم يُعثر على ملف EXE الخاص بالإصدار 1.0.3. مرّر مساره كوسيط أول." >&2
  exit 2
fi

WORK_DIR="$(mktemp -d)"
export WINEPREFIX="$WORK_DIR/wine-prefix"
export WINEARCH="win64"
LAUNCH_LOG="$WORK_DIR/wine-launch.log"
LAUNCH_PID=""

cleanup() {
  if [[ -n "$LAUNCH_PID" ]]; then
    kill "$LAUNCH_PID" 2>/dev/null || true
  fi
  wineserver -k 2>/dev/null || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "بدء اختبار Windows معزول للملف: $EXE_PATH"
xvfb-run -a wine "$EXE_PATH" >"$LAUNCH_LOG" 2>&1 &
LAUNCH_PID="$!"

for _attempt in $(seq 1 80); do
  for port in $(seq 4317 4337); do
    response="$(curl --silent --max-time 1 "http://127.0.0.1:${port}/" || true)"
    if [[ "$response" == *"TIA Studio"* ]]; then
      echo "PASS: بدأت حزمة Windows الخادم المحلي على المنفذ ${port} واستجاب بمحتوى TIA Studio."
      exit 0
    fi
  done
  sleep 0.5
done

echo "FAIL: لم يستجب خادم حزمة Windows خلال 40 ثانية." >&2
tail -n 80 "$LAUNCH_LOG" >&2 || true
exit 1
