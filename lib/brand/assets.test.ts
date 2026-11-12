import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  CANVAS_COLOR,
  HUB_THEME_COLOR,
  SELECTION_THEME_COLOR,
  SITE_ORIGIN,
  hubShareImage,
  selectionShareImage,
} from "./site.ts";

const root = new URL("../../", import.meta.url);

function read(path: string) {
  return readFileSync(new URL(path, root));
}

function pngSize(path: string) {
  const buf = read(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("brand colors come from the lawn and selection palette", () => {
  assert.equal(SITE_ORIGIN, "https://www.sakamatch.com");
  assert.equal(HUB_THEME_COLOR, "#127a3c");
  assert.equal(SELECTION_THEME_COLOR, "#2f6cb8");
  assert.equal(CANVAS_COLOR, "#f6fbf4");
  assert.equal(hubShareImage.url, "/og.png");
  assert.deepEqual(
    [hubShareImage.width, hubShareImage.height],
    [1200, 630]
  );
  assert.equal(selectionShareImage.url, "/selection/og.png");
  assert.match(hubShareImage.alt, /サカまっち/);
  assert.match(hubShareImage.alt, /練習試合マッチング/);
  assert.equal(selectionShareImage.alt, "セレクション検索");
});

test("icon and share images are the expected sizes", () => {
  assert.deepEqual(pngSize("public/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(pngSize("public/icon-512.png"), { width: 512, height: 512 });
  assert.deepEqual(pngSize("public/icon-512-maskable.png"), {
    width: 512,
    height: 512,
  });
  assert.deepEqual(pngSize("public/apple-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(pngSize("public/header-logo.png"), { width: 512, height: 512 });
  assert.deepEqual(pngSize("public/og.png"), { width: 1200, height: 630 });
  assert.deepEqual(pngSize("public/selection/og.png"), {
    width: 1200,
    height: 630,
  });
});

test("favicon.ico contains 16, 32, and 48", () => {
  const buf = read("app/favicon.ico");
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1);
  const count = buf.readUInt16LE(4);
  assert.equal(count, 3);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    sizes.push(buf[entry]);
    assert.equal(buf.subarray(buf.readUInt32LE(entry + 12), buf.readUInt32LE(entry + 12) + 8).toString("hex").slice(0, 16), "89504e470d0a1a0a");
  }
  assert.deepEqual(sizes, [16, 32, 48]);
  assert.deepEqual(buf, read("apps/selection/app/favicon.ico"));
});

test("the mark svg is the lawn ball, and the maskable version stays in the safe zone", () => {
  const mark = read("design/brand/mark.svg").toString("utf8");
  assert.match(mark, /#0c5c32/);
  assert.match(mark, /#ffd45a/);
  assert.match(mark, /#f7fff8/);
  assert.match(mark, /32,21\.4 42\.1,28\.7 38\.2,40\.6 25\.8,40\.6 21\.9,28\.7/);

  const maskable = read("design/brand/mark-maskable.svg").toString("utf8");
  assert.match(maskable, /viewBox="0 0 512 512"/);
  assert.match(maskable, /scale\(5\)/);
  const ballDiameter = 60 * 5;
  const safeDiameter = 512 * (66 / 108);
  assert.ok(ballDiameter < safeDiameter);
});

test("share artwork names the hub and the selection service", () => {
  assert.match(read("design/brand/og-hub.svg").toString("utf8"), /サカまっち/);
  assert.match(read("design/brand/og-hub.svg").toString("utf8"), /練習試合マッチング/);
  assert.match(read("design/brand/og-selection.svg").toString("utf8"), /セレクション検索/);
});

test("metadata points at the shared images and the new theme colors", () => {
  const hub = read("app/layout.tsx").toString("utf8");
  const manifest = read("app/manifest.ts").toString("utf8");
  const selection = read("apps/selection/app/layout.tsx").toString("utf8");
  const list = read("app/selection/page.tsx").toString("utf8");
  const detail = read("app/selection/[id]/page.tsx").toString("utf8");
  const publicManifest = read("public/manifest.webmanifest").toString("utf8");
  const selectionManifest = read("apps/selection/app/manifest.ts").toString("utf8");

  assert.match(hub, /metadataBase: new URL\(SITE_ORIGIN\)/);
  assert.match(hub, /images: \[hubShareImage\]/);
  assert.match(hub, /summary_large_image/);
  assert.match(hub, /HUB_THEME_COLOR/);
  assert.match(hub, /SELECTION_THEME_COLOR/);
  assert.match(manifest, /HUB_THEME_COLOR/);
  assert.match(manifest, /CANVAS_COLOR/);
  assert.match(publicManifest, /#127a3c/);
  assert.match(publicManifest, /#f6fbf4/);
  assert.match(selection, /metadataBase: new URL\(SITE_ORIGIN\)/);
  assert.match(selection, /images: \[selectionShareImage\]/);
  assert.match(list, /images: \[selectionShareImage\]/);
  assert.match(detail, /images: \[selectionShareImage\]/);
  assert.match(selectionManifest, /SELECTION_THEME_COLOR/);
  assert.match(selectionManifest, /SELECTION_CANVAS_COLOR/);
  assert.equal(existsSync(new URL("public/manifest.webmanifest", root)), true);
});
