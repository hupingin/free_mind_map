"""
make_icon.py — 生成 Free Mind Map 应用图标（FMM 字母标识）

设计：圆角方块 + 品牌渐变（经典蓝 #3b6ef5 → 暗夜紫 #7c5cff）+ 白色粗体 "FMM"
输出：build/icon.png (512)、build/icon.ico (16~256 多尺寸)
用法：python tools/make_icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

# 品牌色（取自 renderer/js/themes.js：classic.rootFill / dark.rootFill）
C_TOP = (0x3B, 0x6E, 0xF5)   # 经典蓝
C_BOT = (0x7C, 0x5C, 0xFF)   # 暗夜紫

SUPER = 1024                 # 超采样画布，保证缩小后边缘平滑
OUT_PNG = 512
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuib.ttf",   # Segoe UI Bold
    r"C:\Windows\Fonts\bahnschrift.ttf",
    r"C:\Windows\Fonts\verdanab.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]


def pick_font():
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def rounded_mask(size, radius_ratio=0.24):
    """生成圆角方形 alpha 蒙版（超采样后边缘更平滑）"""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return m


def gradient(size):
    """对角线渐变：左上 C_TOP → 右下 C_BOT"""
    # 先在小画布上算，再放大（避免百万级像素的 Python 循环）
    small = 64
    g = Image.new("L", (small, small))
    px = g.load()
    for y in range(small):
        for x in range(small):
            t = (x / (small - 1) + y / (small - 1)) / 2  # 对角线进度 0→1
            px[x, y] = int(t * 255)
    g = g.resize((size, size), Image.BICUBIC)

    def ch(a, b):
        return g.point(lambda v: int(a + (b - a) * v / 255))

    r = ch(C_TOP[0], C_BOT[0])
    gg = ch(C_TOP[1], C_BOT[1])
    b = ch(C_TOP[2], C_BOT[2])
    return Image.merge("RGB", (r, gg, b))


def build(size):
    """渲染指定尺寸的 RGBA 图标"""
    img = gradient(size).convert("RGBA")
    mask = rounded_mask(size)
    img.putalpha(mask)

    d = ImageDraw.Draw(img)
    font_path = pick_font()
    text = "FMM"

    if font_path:
        # 自适应字号：让文字宽度约占画布 66%
        target_w = size * 0.66
        fs = int(size * 0.42)
        for _ in range(24):
            f = ImageFont.truetype(font_path, fs)
            box = d.textbbox((0, 0), text, font=f)
            w = box[2] - box[0]
            if abs(w - target_w) <= size * 0.01:
                break
            fs = int(fs * (target_w / max(w, 1)))
            fs = max(8, min(fs, int(size * 0.8)))
        f = ImageFont.truetype(font_path, fs)
        box = d.textbbox((0, 0), text, font=f)
        w, h = box[2] - box[0], box[3] - box[1]
        x = (size - w) / 2 - box[0]
        y = (size - h) / 2 - box[1]
        d.text((x, y), text, font=f, fill=(255, 255, 255, 255))
    else:
        # 兜底：无字体时用几何图形拼 FMM（竖条 + 横条）
        u = size / 16
        white = (255, 255, 255, 255)
        d.rectangle([3.2 * u, 5 * u, 4.4 * u, 11 * u], fill=white)      # F 竖
        d.rectangle([3.2 * u, 5 * u, 7.0 * u, 6.1 * u], fill=white)     # F 上横
        d.rectangle([3.2 * u, 7.7 * u, 6.3 * u, 8.8 * u], fill=white)   # F 中横
        for ox in (7.6, 11.3):                                          # 两个 M
            d.rectangle([ox * u, 5 * u, (ox + 1.2) * u, 11 * u], fill=white)
            d.rectangle([(ox + 2.4) * u, 5 * u, (ox + 3.6) * u, 11 * u], fill=white)
            d.polygon([(ox * u, 5 * u), ((ox + 1.2) * u, 5 * u),
                       ((ox + 2.4) * u, 8 * u), ((ox + 1.2) * u, 8 * u)], fill=white)
            d.polygon([((ox + 2.4) * u, 8 * u), ((ox + 3.6) * u, 8 * u),
                       ((ox + 1.2) * u, 11 * u), (ox * u, 11 * u)], fill=white)
    return img


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    build_dir = os.path.join(root, "build")
    os.makedirs(build_dir, exist_ok=True)

    base = build(SUPER)                       # 超采样主图
    png = base.resize((OUT_PNG, OUT_PNG), Image.LANCZOS)
    png_path = os.path.join(build_dir, "icon.png")
    png.save(png_path, "PNG")

    # ICO：各尺寸单独用 LANCZOS 从超采样图缩放，保证小尺寸也清晰
    # 注意：Pillow 的 ICO 保存器会以「底图宽度」过滤 sizes（size > 底图宽则丢弃），
    # 因此必须以最大尺寸(256)的图为底图，否则只会写入最小的一帧。
    by_size = {s: base.resize((s, s), Image.LANCZOS) for s in ICO_SIZES}
    biggest = ICO_SIZES[-1]
    ico_path = os.path.join(build_dir, "icon.ico")
    by_size[biggest].save(
        ico_path, format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=[by_size[s] for s in ICO_SIZES if s != biggest],
    )

    print("PNG:", png_path, png.size)
    print("ICO:", ico_path, "sizes:", ICO_SIZES)
    print("font:", pick_font())


if __name__ == "__main__":
    main()
