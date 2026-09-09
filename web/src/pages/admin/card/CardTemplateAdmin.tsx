import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Tag,
  Space,
  Popconfirm,
  message,
  Select,
  Row,
  Col,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { adminApi } from "@/api";

const FONT_OPTIONS = [
  { label: "系统默认", value: "system" },
  { label: "PingFang SC", value: "PingFang SC" },
  { label: "Microsoft YaHei", value: "Microsoft YaHei" },
  { label: "SimHei", value: "SimHei" },
  { label: "SimSun", value: "SimSun" },
  { label: "Georgia", value: "Georgia" },
];

const DEFAULT_FORM_VALUES = {
  name: "",
  style: "classic",
  bgType: "color",
  bgValue: "#ffffff",
  fontFamily: "PingFang SC",
  fontSize: 32,
  fontColor: "#1f2937",
  lineHeight: 1.8,
  textAlign: "center",
  showAuthor: true,
  showWatermark: true,
  isMember: false,
  status: 1,
  previewUrl: "",
};

export default function CardTemplateAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.cards();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      message.error(e?.message || "加载卡片模板失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    form.setFieldsValue({
      ...item,
      showAuthor: Boolean(item.showAuthor),
      showWatermark: Boolean(item.showWatermark),
      isMember: Boolean(item.isMember),
      status: item.status ?? 1,
    });
    setOpen(true);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });

  const compressImageToDataUrl = async (file: File) => {
    const source = await readFileAsDataUrl(file);
    if (file.size <= 900 * 1024) return source;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = source;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法处理图片");

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    let quality = 0.78;

    if (mimeType === "image/png") {
      return canvas.toDataURL("image/jpeg", quality);
    }

    let result = canvas.toDataURL(mimeType, quality);
    if (result.length > 900 * 1024) {
      quality = 0.6;
      result = canvas.toDataURL(mimeType, quality);
    }

    return result;
  };

  const handleBgFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = file.size > 900 * 1024 ? await compressImageToDataUrl(file) : await readFileAsDataUrl(file);
      form.setFieldValue("bgType", "image");
      form.setFieldValue("bgValue", dataUrl);
      message.success(file.size > 900 * 1024 ? "已检测到大图，已自动压缩后保存" : "已读取本地图片");
    } catch {
      message.error("图片读取失败");
    } finally {
      event.target.value = "";
    }
  };

  const save = async () => {
    const v = await form.validateFields();
    const payload = {
      ...v,
      bgType: v.bgType || "color",
      bgValue: v.bgValue || "#ffffff",
      fontFamily: v.fontFamily || "system",
      fontSize: Number(v.fontSize || 32),
      fontColor: v.fontColor || "#1f2937",
      lineHeight: Number(v.lineHeight || 1.8),
      textAlign: v.textAlign || "center",
      showAuthor: v.showAuthor ? 1 : 0,
      showWatermark: v.showWatermark ? 1 : 0,
      isMember: v.isMember ? 1 : 0,
      status: Number(v.status ?? 1),
      previewUrl: v.previewUrl || "",
    };

    try {
      if (editing) {
        await adminApi.cardUpdate(editing.id, payload);
        message.success("模板更新成功");
      } else {
        await adminApi.cardCreate(payload);
        message.success("模板创建成功");
      }
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.message || "保存模板失败");
    }
  };

  const del = async (id: number) => {
    try {
      await adminApi.cardDelete(id);
      message.success("删除成功");
      load();
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "模板名称", dataIndex: "name", width: 160 },
    { title: "样式标识", dataIndex: "style", width: 180, render: (v: string) => <code>{v}</code> },
    { title: "背景", width: 160, render: (_: any, r: any) => r.bgType === "image" ? <Tag color="blue">图片背景</Tag> : <Tag color="gold">纯色背景</Tag> },
    { title: "字体", dataIndex: "fontFamily", width: 140 },
    { title: "是否免费", dataIndex: "isMember", width: 90, render: (v: number) => (v ? <Tag color="orange">会员</Tag> : <Tag color="green">免费</Tag>) },
    {
      title: "操作",
      fixed: "right" as const,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setPreviewItem(r); setPreviewOpen(true); }}>预览</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => del(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="卡片模板管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建模板
        </Button>
      }
    >
      <Table loading={loading} columns={columns} dataSource={list} rowKey="id" size="middle" scroll={{ x: 1000 }} />

      <Modal
        title={editing ? "编辑模板" : "新建模板"}
        open={open}
        width={900}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="保存"
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="style" label="样式标识" rules={[{ required: true }]}><Input placeholder="如 classic / gradient-purple" /></Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bgType" label="背景类型" rules={[{ required: true }]}>
                <Select options={[{ label: "纯色", value: "color" }, { label: "图片", value: "image" }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bgValue" label="背景值（支持网络 URL / 本地图片 data URL）">
                <Input.TextArea rows={3} placeholder="可填写颜色值，如 #ffffff；也可填写图片 URL 或本地图片 Base64/data URL" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="本地背景图片">
                <input type="file" accept="image/*" onChange={handleBgFileChange} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fontFamily" label="字体">
                <Select options={FONT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fontColor" label="字体颜色">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="fontSize" label="字体大小" initialValue={32}>
                <InputNumber min={12} max={80} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lineHeight" label="行高" initialValue={1.8}>
                <InputNumber min={1} max={3} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="textAlign" label="文字位置">
                <Select options={[{ label: "居中", value: "center" }, { label: "左对齐", value: "left" }, { label: "右对齐", value: "right" }]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="showAuthor" label="显示作者" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="showWatermark" label="显示水印" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isMember" label="是否会员模板" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue={1}>
                <Select options={[{ label: "启用", value: 1 }, { label: "停用", value: 0 }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="previewUrl" label="预览图 URL">
                <Input placeholder="可选，给前台展示用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={previewItem?.name ? `${previewItem.name} 预览` : "模板预览"}
        open={previewOpen}
        width={520}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
      >
        <div
          style={{
            width: 360,
            height: 520,
            margin: "0 auto",
            borderRadius: 18,
            overflow: "hidden",
            position: "relative",
            border: "1px solid #e8e8e8",
            background:
              previewItem?.bgType === "image" && previewItem?.bgValue
                ? `url(${previewItem.bgValue}) center/cover no-repeat`
                : previewItem?.bgValue || "#fff",
            boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: previewItem?.textAlign || "center",
              padding: 32,
            }}
          >
            <div style={{ width: "100%", color: previewItem?.fontColor || "#1f2937", textAlign: previewItem?.textAlign || "center" }}>
              <div
                style={{
                  fontFamily: previewItem?.fontFamily || "PingFang SC",
                  fontSize: previewItem?.fontSize || 32,
                  lineHeight: previewItem?.lineHeight || 1.8,
                  fontWeight: 600,
                  whiteSpace: "pre-wrap",
                }}
              >
                {"把每一句金句，都变成一张可分享的卡片"}
              </div>
              {previewItem?.showAuthor !== 0 && (
                <div style={{ marginTop: 24, fontSize: 16, opacity: 0.85 }}>
                  —— 拾句
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
