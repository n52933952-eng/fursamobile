/**
 * Generates Android mipmaps, Android splash drawable, Android notification small icons,
 * iOS AppIcon set, and iOS splash images from assets/branding/app-icon.png
 *
 * Run: npm run generate-branding
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'branding', 'app-icon.png');

if (!fs.existsSync(src)) {
  console.error('Missing source:', src);
  process.exit(1);
}

const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');

const androidMipmaps = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

/** iOS AppIcon: logical size in points -> pixel size at scale */
const iosAppIcon = [
  { name: 'Icon-20@2x.png', px: 40 },
  { name: 'Icon-20@3x.png', px: 60 },
  { name: 'Icon-29@2x.png', px: 58 },
  { name: 'Icon-29@3x.png', px: 87 },
  { name: 'Icon-40@2x.png', px: 80 },
  { name: 'Icon-40@3x.png', px: 120 },
  { name: 'Icon-60@2x.png', px: 120 },
  { name: 'Icon-60@3x.png', px: 180 },
  { name: 'Icon-Store.png', px: 1024 },
];

const iosAppIconDir = path.join(
  root,
  'ios',
  'fursa',
  'Images.xcassets',
  'AppIcon.appiconset',
);

const iosSplashDir = path.join(
  root,
  'ios',
  'fursa',
  'Images.xcassets',
  'SplashLogo.imageset',
);

const ICON_BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function resizePng(outPath, size) {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(src)
    .resize(size, size, {
      fit: 'contain',
      position: 'centre',
      background: ICON_BG,
    })
    .png()
    .toFile(outPath);
}

async function resizeContainPng(outPath, maxSide) {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(src)
    .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toFile(outPath);
}

/**
 * Android status-bar / tray small icon: white glyph on transparent (not the colored launcher).
 * Drops near-white background pixels from the source art so the orange F reads as a silhouette.
 */
async function writeNotificationSmallIcon(outPath, px) {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const { data, info } = await sharp(src)
    .resize(px, px, {
      fit: 'contain',
      position: 'centre',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const aIn = data[i + 3];
    const sum = r + g + b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const chroma = mx - mn;
    const nearNeutralWhite =
      (chroma < 28 && mx > 232) || (r > 238 && g > 238 && b > 238) || sum > 745;
    if (nearNeutralWhite) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = Math.min(255, Math.round((aIn * (mx / 255 + 0.35))));
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(outPath);
}

/** mdpi 24dp … xxxhdpi 96dp @ 1x mapping */
const androidNotifDrawables = [
  ['drawable-mdpi', 24],
  ['drawable-hdpi', 36],
  ['drawable-xhdpi', 48],
  ['drawable-xxhdpi', 72],
  ['drawable-xxxhdpi', 96],
];

async function main() {
  for (const [folder, size] of androidMipmaps) {
    const dir = path.join(androidRes, folder);
    await resizePng(path.join(dir, 'ic_launcher.png'), size);
    await resizePng(path.join(dir, 'ic_launcher_round.png'), size);
    console.log('Wrote', folder);
  }

  const splashAndroid = path.join(androidRes, 'drawable', 'splash_logo.png');
  await resizeContainPng(splashAndroid, 512);
  console.log('Wrote drawable/splash_logo.png');

  for (const [folder, px] of androidNotifDrawables) {
    const dir = path.join(androidRes, folder);
    await writeNotificationSmallIcon(path.join(dir, 'ic_stat_fursa.png'), px);
    console.log('Wrote', folder, '/ic_stat_fursa.png');
  }

  for (const { name, px } of iosAppIcon) {
    await resizePng(path.join(iosAppIconDir, name), px);
    console.log('Wrote AppIcon', name);
  }

  await fs.promises.mkdir(iosSplashDir, { recursive: true });
  await resizeContainPng(path.join(iosSplashDir, 'splash-logo@1x.png'), 200);
  await resizeContainPng(path.join(iosSplashDir, 'splash-logo@2x.png'), 400);
  await resizeContainPng(path.join(iosSplashDir, 'splash-logo@3x.png'), 600);
  console.log('Wrote SplashLogo.imageset');

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
