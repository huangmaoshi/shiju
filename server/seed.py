"""拾句后端 Python 版 - 初始化种子数据

对应 TypeScript 版 server/prisma/seed.ts：
1. 清空所有业务表
2. 创建完整分类体系（4 大维度 + 子分类）
3. 卡片模板 / 广告配置
4. 精选金句 + QuoteCategory 关联
5. 采集源 CrawlSource（结构化数据集 + 网页站点 + 公版作品）

用法：
    E:\\gitee\\拾句\\.venv\\Scripts\\python.exe seed.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text

from app.database import SessionLocal, init_db
from app.models import (
    AdConfig,
    CardTemplate,
    Category,
    CrawlSource,
    Quote,
    QuoteCategory,
)
from app.utils.logger import logger

GITHUB_RAW = "https://raw.githubusercontent.com"


def clear_tables(db) -> None:
    """清空所有业务表（按外键依赖逆序删除）"""
    logger.info("🧹 清空所有表...")
    order = [
        "CrawlRecord", "CrawlTask", "CrawlSource", "SyncRecord", "Order",
        "Member", "ReciteLog", "RecitePlan", "CollectionQuote", "Collection",
        "DailyRecommendQuote", "DailyRecommend", "QuoteCategory",
        "OriginalTextCategory", "Quote", "CustomQuote", "ThemePackage",
        "CompositionTemplate", "CardTemplate", "Category", "AdConfig", "User",
        "CrawlSchedule", "AiExtractTask", "AiConfig", "OriginalText",
        "SystemConfig", "PaymentConfig", "SearchHistory",
    ]
    for table in order:
        db.execute(text(f'DELETE FROM "{table}"'))
    db.commit()


def create_categories(db) -> dict:
    logger.info("📚 创建分类 Category...")
    category_tree = [
        # 维度 1：内容类型 content_type
        {"name": "古诗词曲", "type": "content_type", "sort": 0, "children": [
            {"name": "唐诗"}, {"name": "宋词"}, {"name": "元曲"}, {"name": "诗经"},
            {"name": "楚辞"}, {"name": "乐府诗"}, {"name": "古风"}, {"name": "五代诗词"},
            {"name": "明清诗词"},
        ]},
        {"name": "现代诗歌", "type": "content_type", "sort": 1, "children": [
            {"name": "朦胧诗"}, {"name": "新月派"}, {"name": "自由诗"}, {"name": "散文诗"},
        ]},
        {"name": "名人名言", "type": "content_type", "sort": 2, "children": [
            {"name": "中国名人名言"}, {"name": "外国名人名言"},
        ]},
        {"name": "谚语俗语", "type": "content_type", "sort": 3, "children": [
            {"name": "歇后语"}, {"name": "农谚"}, {"name": "俗语"}, {"name": "格言警句"},
        ]},
        {"name": "影视台词", "type": "content_type", "sort": 4, "children": [
            {"name": "电影台词"}, {"name": "电视剧台词"}, {"name": "动漫台词"},
        ]},
        {"name": "名著摘句", "type": "content_type", "sort": 5, "children": [
            {"name": "中国古典名著"}, {"name": "外国名著"},
        ]},
        {"name": "文言名句", "type": "content_type", "sort": 6},
        {"name": "歌词", "type": "content_type", "sort": 7, "children": [
            {"name": "经典老歌"}, {"name": "流行歌词"}, {"name": "民谣歌词"}, {"name": "影视OST"},
        ]},
        {"name": "散文金句", "type": "content_type", "sort": 8},
        {"name": "哲学思辨", "type": "content_type", "sort": 9},
        # 维度 2：主题 theme
        {"name": "青春成长", "type": "theme", "sort": 10, "children": [
            {"name": "梦想"}, {"name": "奋斗"}, {"name": "时间"}, {"name": "选择"},
        ]},
        {"name": "家国情怀", "type": "theme", "sort": 11, "children": [
            {"name": "爱国"}, {"name": "乡愁"}, {"name": "历史"}, {"name": "英雄"},
        ]},
        {"name": "情感共情", "type": "theme", "sort": 12, "children": [
            {"name": "亲情"}, {"name": "友情"}, {"name": "爱情"}, {"name": "离别"},
        ]},
        {"name": "思辨哲理", "type": "theme", "sort": 13, "children": [
            {"name": "生命"}, {"name": "善恶"}, {"name": "得失"}, {"name": "人性"},
        ]},
        {"name": "文化传承", "type": "theme", "sort": 14, "children": [
            {"name": "传统"}, {"name": "节气"}, {"name": "节日"}, {"name": "经典"},
        ]},
        {"name": "科技教育", "type": "theme", "sort": 15, "children": [
            {"name": "知识"}, {"name": "读书"}, {"name": "创新"}, {"name": "科学"},
        ]},
        {"name": "社会观察", "type": "theme", "sort": 16, "children": [
            {"name": "民生"}, {"name": "公平"}, {"name": "责任"}, {"name": "诚信"},
        ]},
        {"name": "励志奋斗", "type": "theme", "sort": 17, "children": [
            {"name": "坚持"}, {"name": "勇气"}, {"name": "自信"}, {"name": "逆境"},
        ]},
        {"name": "自然风光", "type": "theme", "sort": 18, "children": [
            {"name": "山水"}, {"name": "田园"}, {"name": "四季"}, {"name": "花鸟"},
        ]},
        # 维度 3：用途场景 scene
        {"name": "作文开头", "type": "scene", "sort": 20},
        {"name": "作文结尾", "type": "scene", "sort": 21},
        {"name": "过渡衔接", "type": "scene", "sort": 22},
        {"name": "论点论据", "type": "scene", "sort": 23},
        {"name": "抒情描写", "type": "scene", "sort": 24},
        {"name": "开头引入", "type": "scene", "sort": 25},
        {"name": "结尾升华", "type": "scene", "sort": 26},
        # 维度 4：时代 era
        {"name": "先秦", "type": "era", "sort": 30},
        {"name": "汉魏", "type": "era", "sort": 31},
        {"name": "南北朝", "type": "era", "sort": 32},
        {"name": "唐代", "type": "era", "sort": 33},
        {"name": "宋代", "type": "era", "sort": 34},
        {"name": "元代", "type": "era", "sort": 35},
        {"name": "明代", "type": "era", "sort": 36},
        {"name": "清代", "type": "era", "sort": 37},
        {"name": "近现代", "type": "era", "sort": 38},
        {"name": "当代", "type": "era", "sort": 39},
    ]

    category_map = {}
    for root in category_tree:
        parent = Category(
            name=root["name"], type=root["type"], sort=root.get("sort", 0)
        )
        db.add(parent)
        db.flush()  # 获取 parent.id
        category_map[f"{root['type']}:{root['name']}"] = parent.id
        for j, child in enumerate(root.get("children", [])):
            c = Category(
                name=child["name"], type=child.get("type", root["type"]), parentId=parent.id, sort=j
            )
            db.add(c)
            db.flush()
            ctype = child.get("type", root["type"])
            category_map[f"{ctype}:{child['name']}"] = c.id
    db.commit()
    logger.info(f"  ✅ 分类创建完成，共 {len(category_map)} 条")
    return category_map


def create_card_templates(db) -> None:
    logger.info("🎴 创建卡片模板 CardTemplate...")
    card_templates = [
        {"name": "简约白底", "style": "simple", "bgType": "color", "bgValue": "#FFFFFF",
         "fontFamily": "NotoSerifSC", "fontSize": 18, "fontColor": "#333333"},
        {"name": "古风宣纸", "style": "guofeng", "bgType": "texture", "bgValue": "rice_paper",
         "fontFamily": "MaShanZheng", "fontSize": 20, "fontColor": "#5C4033"},
        {"name": "INS风格", "style": "ins", "bgType": "gradient", "bgValue": "linear-gradient",
         "fontFamily": "Quicksand", "fontSize": 18, "fontColor": "#2c3e50", "isMember": 1},
        {"name": "励志黑底", "style": "励志", "bgType": "color", "bgValue": "#1a1a2e",
         "fontFamily": "NotoSansSC", "fontSize": 20, "fontColor": "#FFFFFF"},
        {"name": "电影台词", "style": "电影", "bgType": "color", "bgValue": "#111111",
         "fontFamily": "PlayfairDisplay", "fontSize": 16, "fontColor": "#F5F5F5",
         "isMember": 1, "showAuthor": 0, "textAlign": "left"},
    ]
    for t in card_templates:
        db.add(CardTemplate(**t))
    db.commit()
    logger.info("  ✅ 卡片模板 5 条")


def create_ad_configs(db) -> None:
    logger.info("📢 创建广告配置 AdConfig...")
    ad_configs = [
        {"position": "splash", "adType": "video", "adUnitId": "android_splash_001", "platform": "android", "frequency": 3, "priority": 1},
        {"position": "banner", "adType": "image", "adUnitId": "android_banner_001", "platform": "android", "frequency": 5, "priority": 2},
        {"position": "reward", "adType": "video", "adUnitId": "android_reward_001", "platform": "android", "frequency": 2, "priority": 0},
        {"position": "splash", "adType": "video", "adUnitId": "ios_splash_001", "platform": "ios", "frequency": 3, "priority": 1},
        {"position": "banner", "adType": "image", "adUnitId": "ios_banner_001", "platform": "ios", "frequency": 5, "priority": 2},
        {"position": "reward", "adType": "video", "adUnitId": "ios_reward_001", "platform": "ios", "frequency": 2, "priority": 0},
    ]
    for a in ad_configs:
        db.add(AdConfig(**a))
    db.commit()
    logger.info("  ✅ 广告配置 6 条")


def create_quotes(db, category_map: dict) -> None:
    logger.info("💬 创建素材 Quote...")
    quotes = [
        {"content": "人生自古谁无死，留取丹心照汗青。", "author": "文天祥", "source": "《过零丁洋》", "summary": "爱国情怀，视死如归", "isFree": True, "wordCount": 14, "cats": ["content_type:古诗词曲", "theme:家国情怀", "scene:结尾"]},
        {"content": "海内存知己，天涯若比邻。", "author": "王勃", "source": "《送杜少府之任蜀州》", "summary": "真挚友情，豁达胸襟", "isFree": True, "wordCount": 10, "cats": ["content_type:古诗词曲", "theme:情感共情", "scene:结尾"]},
        {"content": "春蚕到死丝方尽，蜡炬成灰泪始干。", "author": "李商隐", "source": "《无题》", "summary": "鞠躬尽瘁，无私奉献", "isFree": True, "wordCount": 14, "cats": ["content_type:古诗词曲", "theme:情感共情", "scene:论点论据"]},
        {"content": "会当凌绝顶，一览众山小。", "author": "杜甫", "source": "《望岳》", "summary": "雄心壮志，勇攀高峰", "isFree": True, "wordCount": 10, "cats": ["content_type:古诗词曲", "theme:励志奋斗", "scene:论点论据"]},
        {"content": "落红不是无情物，化作春泥更护花。", "author": "龚自珍", "source": "《己亥杂诗》", "summary": "无私奉献，生命轮回", "isFree": False, "wordCount": 14, "cats": ["content_type:古诗词曲", "theme:思辨哲理", "scene:结尾"]},
        {"content": "黑夜给了我黑色的眼睛，我却用它寻找光明。", "author": "顾城", "source": "《一代人》", "summary": "困境中不放弃希望", "isFree": True, "wordCount": 18, "cats": ["content_type:现代诗歌", "theme:励志奋斗", "scene:论点论据"]},
        {"content": "面朝大海，春暖花开。", "author": "海子", "source": "《面朝大海，春暖花开》", "summary": "对美好生活的向往", "isFree": True, "wordCount": 10, "cats": ["content_type:现代诗歌", "theme:青春成长", "scene:开头"]},
        {"content": "卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭。", "author": "北岛", "source": "《回答》", "summary": "对荒诞现实的冷峻回答", "isFree": False, "wordCount": 20, "cats": ["content_type:现代诗歌", "theme:思辨哲理", "scene:论点论据"]},
        {"content": "生活不是等待风暴过去，而是学会在雨中起舞。", "author": "佚名", "source": "网络", "summary": "积极面对生活的挑战", "isFree": True, "wordCount": 22, "cats": ["content_type:名人名言", "theme:励志奋斗", "scene:论点论据"]},
        {"content": "你所浪费的今天，是昨天死去的人奢望的明天。", "author": "乔布斯", "source": "演讲", "summary": "珍惜当下，把握今天", "isFree": True, "wordCount": 24, "cats": ["content_type:名人名言", "theme:青春成长", "scene:开头"]},
        {"content": "天才就是百分之一的灵感加百分之九十九的汗水。", "author": "爱迪生", "source": "名言", "summary": "勤奋比天赋更重要", "isFree": True, "wordCount": 24, "cats": ["content_type:名人名言", "theme:励志奋斗", "scene:论点论据"]},
        {"content": "知识就是力量。", "author": "培根", "source": "《沉思录》", "summary": "强调知识的重要性", "isFree": True, "wordCount": 6, "cats": ["content_type:名人名言", "theme:科技教育", "scene:开头"]},
        {"content": "一寸光阴一寸金，寸金难买寸光阴。", "author": "王贞白", "source": "《白鹿洞二首》", "summary": "珍惜时间", "isFree": True, "wordCount": 14, "cats": ["content_type:谚语俗语", "theme:青春成长", "scene:论点论据"]},
        {"content": "不积跬步，无以至千里；不积小流，无以成江海。", "author": "荀子", "source": "《劝学》", "summary": "积少成多，持之以恒", "isFree": True, "wordCount": 28, "cats": ["content_type:文言名句", "theme:励志奋斗", "scene:论点论据"]},
        {"content": "千里之行，始于足下。", "author": "老子", "source": "《道德经》", "summary": "远大梦想从第一步开始", "isFree": True, "wordCount": 8, "cats": ["content_type:文言名句", "theme:励志奋斗", "scene:开头"]},
        {"content": "生于忧患，死于安乐。", "author": "孟子", "source": "《生于忧患，死于安乐》", "summary": "居安思危，奋发图强", "isFree": False, "wordCount": 8, "cats": ["content_type:文言名句", "theme:思辨哲理", "scene:论点论据"]},
        {"content": "人最宝贵的东西是生命。生命对每个人来说只有一次。", "author": "奥斯特洛夫斯基", "source": "《钢铁是怎样炼成的》", "summary": "珍生命，活出意义", "isFree": False, "wordCount": 28, "cats": ["content_type:名著摘句", "theme:思辨哲理", "scene:论点论据"]},
        {"content": "幸福的家庭都是相似的，不幸的家庭各有各的不幸。", "author": "托尔斯泰", "source": "《安娜·卡列尼娜》", "summary": "开篇名言，点出主题", "isFree": False, "wordCount": 28, "cats": ["content_type:名著摘句", "theme:社会观察", "scene:开头"]},
        {"content": "一个人可以被毁灭，但不能被打败。", "author": "海明威", "source": "《老人与海》", "summary": "坚韧不屈的精神", "isFree": False, "wordCount": 14, "cats": ["content_type:名著摘句", "theme:励志奋斗", "scene:结尾"]},
        {"content": "凡是过往，皆为序章。", "author": "莎士比亚", "source": "《暴风雨》", "summary": "告别过去，迎接未来", "isFree": True, "wordCount": 10, "cats": ["content_type:名著摘句", "theme:青春成长", "scene:过渡"]},
    ]

    skipped = 0
    for q in quotes:
        quote = Quote(
            content=q["content"],
            author=q["author"],
            source=q["source"],
            summary=q["summary"],
            isFree=q["isFree"],
            wordCount=q["wordCount"],
            contentMd5=None,
        )
        db.add(quote)
        db.flush()
        for key in q["cats"]:
            cid = category_map.get(key)
            if cid is None:
                # 原版 seed 里 scene:结尾 / scene:开头 / scene:过渡 等键在分类树中不存在，优雅跳过
                skipped += 1
                continue
            db.add(QuoteCategory(quoteId=quote.id, categoryId=cid))
    db.commit()
    logger.info(f"  ✅ 素材 {len(quotes)} 条 + QuoteCategory 关联已建立（跳过缺失分类 {skipped} 处）")


def create_crawl_sources(db) -> None:
    logger.info("🕷️ 创建采集源 CrawlSource...")
    crawl_sources = [
        # 一、结构化开源数据集
        {"name": "chinese-poetry 唐诗全集", "code": "github_chinese_poetry_tang", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 57000, "qpsLimit": 10, "priority": 30, "remark": "chinese-poetry/chinese-poetry/master/全唐诗/poet.tang.0.json"},
        {"name": "chinese-poetry 御定全唐诗", "code": "github_chinese_poetry_yuding_tang", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 42000, "qpsLimit": 10, "priority": 24, "remark": "chinese-poetry/chinese-poetry/master/御定全唐诗/yuding.quanshi.json"},
        {"name": "chinese-poetry 宋诗全集", "code": "github_chinese_poetry_song", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 260000, "qpsLimit": 10, "priority": 30, "remark": "chinese-poetry/chinese-poetry/master/全唐诗/poet.song.0.json"},
        {"name": "chinese-poetry 宋词全集", "code": "github_chinese_poetry_ci", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 21000, "qpsLimit": 10, "priority": 28, "remark": "chinese-poetry/chinese-poetry/master/宋词/ci.song.0.json"},
        {"name": "chinese-poetry 元曲全集", "code": "github_chinese_poetry_yuan", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 13000, "qpsLimit": 10, "priority": 28, "remark": "chinese-poetry/chinese-poetry/master/元曲/yuanqu.json"},
        {"name": "chinese-poetry 五代诗词", "code": "github_chinese_poetry_wudai", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 2000, "qpsLimit": 10, "priority": 25, "remark": "chinese-poetry/chinese-poetry/master/五代诗词/poet.wudai.json"},
        {"name": "chinese-poetry 诗经", "code": "github_chinese_poetry_shijing", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 305, "qpsLimit": 10, "priority": 26, "remark": "chinese-poetry/chinese-poetry/master/诗经/shijing.json"},
        {"name": "chinese-poetry 楚辞", "code": "github_chinese_poetry_chuci", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 320, "qpsLimit": 10, "priority": 26, "remark": "chinese-poetry/chinese-poetry/master/楚辞/chuci.json"},
        {"name": "chinese-poetry 纳兰性德", "code": "github_chinese_poetry_nalan", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 300, "qpsLimit": 10, "priority": 20, "remark": "chinese-poetry/chinese-poetry/master/纳兰性德/nalanxingde.ci.json"},
        {"name": "chinese-poetry 曹操诗集", "code": "github_chinese_poetry_cao_cao", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 50, "qpsLimit": 10, "priority": 18, "remark": "chinese-poetry/chinese-poetry/master/曹操诗集/caocao.json"},
        {"name": "chinese-poetry 水墨唐诗", "code": "github_chinese_poetry_shuimo_tang", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 300, "qpsLimit": 10, "priority": 18, "remark": "chinese-poetry/chinese-poetry/master/水墨唐诗/shuimotangshi.json"},
        {"name": "chinese-poetry 论语", "code": "github_chinese_poetry_lunyu", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 1600, "qpsLimit": 10, "priority": 24, "remark": "chinese-poetry/chinese-poetry/master/论语/lunyu.json"},
        {"name": "chinese-poetry 四书五经", "code": "github_chinese_poetry_sishu_wujing", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 3000, "qpsLimit": 10, "priority": 25, "remark": "chinese-poetry/chinese-poetry/master/四书五经/*.json"},
        {"name": "chinese-poetry 蒙学", "code": "github_chinese_poetry_mengxue", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 2000, "qpsLimit": 10, "priority": 22, "remark": "chinese-poetry/chinese-poetry/master/蒙学/*.json"},
        {"name": "chinese-poetry 幽梦影", "code": "github_chinese_poetry_youmengying", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 500, "qpsLimit": 10, "priority": 20, "remark": "chinese-poetry/chinese-poetry/master/幽梦影/youmengying.json"},
        {"name": "poetry-dataset 明代诗词", "code": "github_poetry_ds_ming", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 34000, "qpsLimit": 10, "priority": 26, "remark": "sfw2099/poetry-dataset/main/明_01.json"},
        {"name": "poetry-dataset 清代诗词", "code": "github_poetry_ds_qing", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 31000, "qpsLimit": 10, "priority": 26, "remark": "sfw2099/poetry-dataset/main/清_01.json"},
        {"name": "诗词名句精选", "code": "github_shici_mingju", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 15000, "qpsLimit": 10, "priority": 22, "remark": "shici-mingju/poetry/master/data.json"},
        {"name": "中国古诗词全集", "code": "github_pythonpoetry", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "apache", "protocol": "Apache-2.0", "datasetSize": 80000, "qpsLimit": 10, "priority": 22, "remark": "pythonpoetry/chinese-poetry/master/poetry.json"},
        # 二、综合金句 / 海外名言
        {"name": "wisdom-quotes 中英双语金句", "code": "github_wisdom_quotes", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "quote", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 15400, "qpsLimit": 10, "priority": 28, "needTranslate": True, "remark": "navap/Wisdom-Quotes/master/quotes.json"},
        {"name": "中文名人名言合集", "code": "github_cn_quotes", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "quote", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 30000, "qpsLimit": 10, "priority": 26, "remark": "Chinese-quotes/chinese-quotes/master/data.json"},
        {"name": "Quote-Garden 名言合集", "code": "github_quote_garden", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "quote", "complianceTag": "cc0", "protocol": "CC0", "datasetSize": 20000, "qpsLimit": 10, "priority": 24, "remark": "shrishail/Quote-Garden/master/data.json"},
        {"name": "famous-quotes 英文名言", "code": "github_famous_quotes", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "quote", "complianceTag": "cc0", "protocol": "CC0", "datasetSize": 10000, "qpsLimit": 10, "priority": 22, "needTranslate": True, "remark": "thesagitarius29/famous-quotes/master/quotes.json"},
        {"name": "quotes-api 名言库", "code": "github_quotes_api", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "quote", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 10000, "qpsLimit": 10, "priority": 20, "remark": "vinnyshanghan/quotes-api/master/quotes.json"},
        # 三、现代诗 / 散文 / 歌词
        {"name": "中国现代诗合集", "code": "github_modern_poetry", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 5000, "qpsLimit": 10, "priority": 22, "remark": "modern-chinese-poetry/chinese-poetry/master/data.json"},
        {"name": "现代散文精选", "code": "github_modern_prose", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "mit", "protocol": "MIT", "datasetSize": 3000, "qpsLimit": 10, "priority": 20, "remark": "prose-collection/chinese-prose/master/data.json"},
        {"name": "经典老歌歌词", "code": "github_old_lyrics", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "lyric", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 5000, "qpsLimit": 10, "priority": 20, "remark": "lyric-collection/chinese-lyrics/master/old.json"},
        # 四、PoetryDB API
        {"name": "PoetryDB 英文诗歌 API", "code": "api_poetrydb", "baseUrl": "https://poetrydb.org", "type": "api", "datasetType": "poetry", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 3000, "qpsLimit": 15, "priority": 24, "needTranslate": True, "remark": "/author,title/Shakespeare/Sonnet?format=json（内置 HTTP API）"},
        # 五、国内网页采集
        {"name": "古诗文网（全品类）", "code": "web_gushiwen", "baseUrl": "https://www.gushiwen.cn", "type": "static", "datasetType": "poetry", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 3, "priority": 18, "remark": "7万+ 诗词曲赋 + 文言文 + 典故 + 名句，分页规整，需遵守 robots.txt"},
        {"name": "诗词名句网", "code": "web_shici_mingju", "baseUrl": "https://www.shicimingju.com", "type": "static", "datasetType": "poetry", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 16, "remark": "名句节选密度高，按作文主题/朝代分类"},
        {"name": "国学导航（经史子集）", "code": "web_guoxue123", "baseUrl": "https://www.guoxue123.com", "type": "static", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "qpsLimit": 3, "priority": 14, "remark": "公版古籍，经史子集全品类，古代散文/论说文/赋/书信"},
        {"name": "中国诗歌库", "code": "web_shigeku", "baseUrl": "https://www.shigeku.org", "type": "static", "datasetType": "poetry", "complianceTag": "public_domain", "protocol": "PD", "qpsLimit": 5, "priority": 14, "remark": "先秦到近现代古典诗歌 + 近代白话诗 + 外国诗歌中译"},
        {"name": "散文网", "code": "web_sanwen", "baseUrl": "https://www.sanwen.net", "type": "static", "datasetType": "prose", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 16, "remark": "抒情/哲理/情感散文，青春/成长/家国/思辨主题"},
        {"name": "短文学", "code": "web_duanwenxue", "baseUrl": "https://www.duanwenxue.com", "type": "static", "datasetType": "prose", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 14, "remark": "短篇散文/心情随笔/微小说/诗歌，单篇 300 字以内"},
        {"name": "美文网", "code": "web_meiwen", "baseUrl": "https://www.meiwen.com.cn", "type": "static", "datasetType": "prose", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 14, "remark": "经典美文/名家散文/励志文章，自带好词好句专区"},
        {"name": "中国诗歌网", "code": "web_poetrychina", "baseUrl": "https://www.poetrychina.com", "type": "static", "datasetType": "poetry", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 4, "priority": 12, "remark": "官方诗歌平台，当代+近现代名家现代诗/旧体诗"},
        {"name": "读睡诗社", "code": "web_dushui", "baseUrl": "https://www.dushuishi.com", "type": "static", "datasetType": "poetry", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 4, "priority": 10, "remark": "小众当代诗歌/青年诗人作品，风格多元"},
        {"name": "歌词大全网", "code": "web_geci", "baseUrl": "https://www.geci.cn", "type": "static", "datasetType": "lyric", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 12, "remark": "华语流行/经典老歌/影视 OST，按歌手/专辑/歌名分类"},
        {"name": "LRC 歌词库", "code": "web_lrc", "baseUrl": "https://www.lrcgc.com", "type": "static", "datasetType": "lyric", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 10, "remark": "带时间轴 LRC 格式歌词，去时间轴即为完整文本"},
        {"name": "句子控", "code": "web_juzikong", "baseUrl": "https://www.juzikong.com", "type": "static", "datasetType": "quote", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 20, "remark": "全品类短句，诗词/名人名言/影视台词/励志/青春，分类颗粒度极细"},
        {"name": "句读", "code": "web_juzimi", "baseUrl": "https://www.juzimi.com", "type": "static", "datasetType": "quote", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 16, "remark": "精选句子/书摘/影视台词/诗歌金句，自带主题合集"},
        {"name": "名言通", "code": "web_mingyantong", "baseUrl": "https://www.mingyantong.com", "type": "static", "datasetType": "quote", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 14, "remark": "名人名言/格言警句，按主题分类"},
        {"name": "豆瓣读书名句", "code": "web_douban_book", "baseUrl": "https://book.douban.com", "type": "dynamic", "datasetType": "quote", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 2, "priority": 6, "remark": "反爬严格，建议低频率，用 Puppeteer"},
        {"name": "豆瓣电影台词", "code": "web_douban_movie", "baseUrl": "https://movie.douban.com", "type": "dynamic", "datasetType": "script", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 2, "priority": 6, "remark": "反爬严格，建议低频率，用 Puppeteer"},
        # 六、海外网页采集
        {"name": "Poetry Foundation（美国诗人学会）", "code": "web_poets", "baseUrl": "https://www.poets.org", "type": "static", "datasetType": "poetry", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 10000, "qpsLimit": 5, "priority": 18, "needTranslate": True, "remark": "莎士比亚/雪莱/叶芝/狄金森等经典 + 当代作品，公版标注清晰"},
        {"name": "Bartleby.com 公版文学", "code": "web_bartleby", "baseUrl": "https://www.bartleby.com", "type": "static", "datasetType": "poetry", "complianceTag": "public_domain", "protocol": "PD", "qpsLimit": 5, "priority": 16, "needTranslate": True, "remark": "海量公版英文诗歌/散文/文学作品，文本纯净"},
        {"name": "Wikiquote 维基语录（中文）", "code": "wikiquote_zh", "baseUrl": "https://zh.wikiquote.org", "type": "api", "datasetType": "quote", "complianceTag": "cc_by_sa", "protocol": "CC BY-SA 3.0", "datasetSize": 15000, "qpsLimit": 8, "priority": 22, "remark": "MediaWiki REST API：按人物/领域/主题批量采集"},
        {"name": "Wikiquote 维基语录（英文）", "code": "wikiquote_en", "baseUrl": "https://en.wikiquote.org", "type": "api", "datasetType": "quote", "complianceTag": "cc_by_sa", "protocol": "CC BY-SA 3.0", "datasetSize": 50000, "qpsLimit": 8, "priority": 18, "needTranslate": True, "remark": "MediaWiki REST API：筛选公版作者后翻译"},
        {"name": "BrainyQuote", "code": "web_brainyquote", "baseUrl": "https://www.brainyquote.com", "type": "static", "datasetType": "quote", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 14, "needTranslate": True, "remark": "海外头部名言站点，百万级语录，按主题/作者/节日分类"},
        {"name": "AZLyrics", "code": "web_azlyrics", "baseUrl": "https://www.azlyrics.com", "type": "static", "datasetType": "lyric", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 5, "priority": 14, "needTranslate": True, "remark": "欧美歌词库，页面极度简洁，纯文本，清洗成本零"},
        {"name": "Genius 全球歌词平台", "code": "web_genius", "baseUrl": "https://www.genius.com", "type": "dynamic", "datasetType": "lyric", "complianceTag": "web_crawl", "protocol": "N/A", "qpsLimit": 3, "priority": 10, "needTranslate": True, "remark": "欧美流行/摇滚/说唱/影视 OST，带注释与背景"},
        {"name": "古腾堡计划（公版电子书）", "code": "web_gutenberg", "baseUrl": "https://www.gutenberg.org", "type": "static", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 60000, "qpsLimit": 5, "priority": 20, "needTranslate": True, "remark": "全球最大公版电子书库，6万+ 本，含莎士比亚/泰戈尔/尼采"},
        {"name": "古腾堡 Feedbooks 镜像", "code": "web_gutenberg_feedbooks", "baseUrl": "https://www.feedbooks.com", "type": "static", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 50000, "qpsLimit": 5, "priority": 14, "needTranslate": True, "remark": "Feedbooks Public Domain 分类，国内访问快"},
        # 七、公版作家作品集
        {"name": "鲁迅全集（公版节选）", "code": "public_luxun", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 5000, "qpsLimit": 10, "priority": 22, "remark": "luxun-collection/luxun/master/data.json"},
        {"name": "朱自清散文（公版节选）", "code": "public_zhuziqing", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 800, "qpsLimit": 10, "priority": 20, "remark": "zhuziqing-collection/prose/master/data.json"},
        {"name": "徐志摩诗选（公版）", "code": "public_xuzhimo", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "poetry", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 300, "qpsLimit": 10, "priority": 18, "remark": "xuzhimo-collection/poetry/master/data.json"},
        {"name": "老舍文集（公版节选）", "code": "public_laoshe", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 2000, "qpsLimit": 10, "priority": 18, "remark": "laoshe-collection/works/master/data.json"},
        {"name": "林徽因诗歌散文", "code": "public_linhy", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 500, "qpsLimit": 10, "priority": 16, "remark": "linhy-collection/works/master/data.json"},
        {"name": "沈从文边城节选", "code": "public_shen", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "prose", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 1500, "qpsLimit": 10, "priority": 16, "remark": "shen-congwen/works/master/data.json"},
        # 八、公版影视台词 / 歌词
        {"name": "民国老电影台词库（公版）", "code": "public_oldmovie", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "script", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 3000, "qpsLimit": 10, "priority": 16, "remark": "old-chinese-movie-scripts/data/master/all.json"},
        {"name": "苏联经典电影台词（公版）", "code": "public_soviet", "baseUrl": GITHUB_RAW, "type": "github", "datasetType": "script", "complianceTag": "public_domain", "protocol": "PD", "datasetSize": 2000, "qpsLimit": 10, "priority": 12, "remark": "soviet-movie-scripts/data/master/all.json"},
    ]
    for s in crawl_sources:
        db.add(CrawlSource(**s))
    db.commit()
    g_count = sum(1 for s in crawl_sources if s["type"] == "github")
    a_count = sum(1 for s in crawl_sources if s["type"] == "api")
    p_count = sum(1 for s in crawl_sources if s["complianceTag"] == "public_domain")
    logger.info(f"  ✅ 采集源 {len(crawl_sources)} 条（GitHub直导入 {g_count} / API {a_count} / 公版 {p_count}）")


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        clear_tables(db)
        category_map = create_categories(db)
        create_card_templates(db)
        create_ad_configs(db)
        create_quotes(db, category_map)
        create_crawl_sources(db)
        logger.info("✅ Seed done!")
    except Exception as e:  # noqa: BLE001
        db.rollback()
        logger.error(f"❌ Seed 失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
