"""导出服务

对应 TypeScript 版 server/src/services/export_service.ts
PDF 生成使用 reportlab。
"""
import io
import time

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import Collection, CollectionQuote, Quote, CustomQuote


def _build_txt(items: list) -> bytes:
    parts = []
    for item in items:
        s = item["content"]
        if item.get("author"):
            s += "\n—— " + item["author"]
        if item.get("source"):
            s += "《" + item["source"] + "》"
        parts.append(s)
    return ("\n\n" + "—" * 30 + "\n\n").join(parts).encode("utf-8")


def _build_pdf(items: list, title: str) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import os

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        # Try to register a CJK font
        font_name = "Helvetica"
        cjk_font_paths = [
            ("SimSun", "C:/Windows/Fonts/simsun.ttc"),
            ("MSYH", "C:/Windows/Fonts/msyh.ttc"),
            ("SimHei", "C:/Windows/Fonts/simhei.ttf"),
        ]
        for fname, fpath in cjk_font_paths:
            if os.path.exists(fpath):
                try:
                    pdfmetrics.registerFont(TTFont(fname, fpath))
                    font_name = fname
                    break
                except Exception:
                    continue

        y = height - 60
        c.setFont(font_name, 22)
        c.drawCentredString(width / 2, y, title)
        y -= 30

        for item in items:
            if y < 100:
                c.showPage()
                y = height - 60

            c.setFont(font_name, 14)
            content = item["content"]
            # Simple text wrapping
            max_chars = 35
            for i in range(0, len(content), max_chars):
                c.drawString(50, y, content[i:i + max_chars])
                y -= 20

            if item.get("author") or item.get("source"):
                footer = ""
                if item.get("author"):
                    footer += "—— " + item["author"]
                if item.get("source"):
                    footer += " 《" + item["source"] + "》"
                c.setFont(font_name, 10)
                c.setFillColorRGB(0.4, 0.4, 0.4)
                c.drawString(50, y, footer.strip())
                c.setFillColorRGB(0, 0, 0)
                y -= 20

            y -= 10
            c.setStrokeColorRGB(0.8, 0.8, 0.8)
            c.line(50, y, width - 50, y)
            y -= 20

        c.save()
        return buf.getvalue()
    except Exception as e:
        raise BusinessError(500, f"PDF 生成失败: {e}", 500)


def exportCollection(db: Session, userId, collectionId: int, format: str) -> dict:
    uid = int(userId)
    collection = db.query(Collection).filter(Collection.id == collectionId).first()
    if not collection or collection.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    records = (
        db.query(CollectionQuote)
        .filter(CollectionQuote.collectionId == collectionId)
        .order_by(CollectionQuote.addedAt.asc())
        .all()
    )

    # Batch load quotes and custom quotes
    quote_ids = [r.quoteId for r in records if r.quoteId]
    custom_ids = [r.customQuoteId for r in records if r.customQuoteId]

    quotes_map = {}
    if quote_ids:
        for q in db.query(Quote).filter(Quote.id.in_(quote_ids)).all():
            quotes_map[q.id] = q

    custom_map = {}
    if custom_ids:
        for cq in db.query(CustomQuote).filter(CustomQuote.id.in_(custom_ids)).all():
            custom_map[cq.id] = cq

    items = []
    for r in records:
        if r.quoteId and r.quoteId in quotes_map:
            q = quotes_map[r.quoteId]
            items.append({
                "content": q.content,
                "author": q.author or "",
                "source": q.source or "",
            })
        elif r.customQuoteId and r.customQuoteId in custom_map:
            cq = custom_map[r.customQuoteId]
            items.append({
                "content": cq.content,
                "author": cq.author or "",
                "source": cq.source or "",
            })

    if format == "txt":
        buffer = _build_txt(items)
        mime = "text/plain; charset=utf-8"
    elif format == "pdf":
        buffer = _build_pdf(items, collection.name)
        mime = "application/pdf"
    else:
        raise BusinessError(400, "不支持的导出格式")

    filename = f"{collection.name}_{int(time.time() * 1000)}.{format}"
    return {"mime": mime, "filename": filename, "buffer": buffer}


def exportCustom(db: Session, userId, format: str) -> dict:
    uid = int(userId)

    customs = (
        db.query(CustomQuote)
        .filter(CustomQuote.userId == uid)
        .order_by(CustomQuote.createdAt.asc())
        .all()
    )

    items = [
        {
            "content": c.content,
            "author": c.author or "",
            "source": c.source or "",
        }
        for c in customs
    ]

    if format == "txt":
        buffer = _build_txt(items)
        mime = "text/plain; charset=utf-8"
    elif format == "pdf":
        buffer = _build_pdf(items, "我的自定义句子")
        mime = "application/pdf"
    else:
        raise BusinessError(400, "不支持的导出格式")

    filename = f"自定义句子_{int(time.time() * 1000)}.{format}"
    return {"mime": mime, "filename": filename, "buffer": buffer}
