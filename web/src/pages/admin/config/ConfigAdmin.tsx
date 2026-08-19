import { Card, Form, Input, Button, Tabs, message, InputNumber, Switch, Divider } from "antd";
import { useEffect, useState } from "react";
import { adminApi } from "@/api";

export default function ConfigAdmin() {
  const [sysList, setSysList] = useState<any[]>([]);
  const [payList, setPayList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trialDays, setTrialDays] = useState(7);

  const load = async () => {
    setLoading(true);
    try {
      const [sys, pay]: any = await Promise.all([
        adminApi.systemConfig().catch(() => []),
        adminApi.paymentConfigs().catch(() => []),
      ]);
      setSysList(Array.isArray(sys) ? sys : []);
      setPayList(Array.isArray(pay) ? pay : []);
      const t = sys?.find((x: any) => x.key === "default_trial_days");
      if (t) setTrialDays(parseInt(t.value, 10) || 7);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveSystem = async () => {
    setSaving(true);
    try {
      const items = [
        { key: "default_trial_days", value: String(trialDays), remark: "新用户默认试用天数" },
      ];
      for (const s of sysList) {
        if (s.key !== "default_trial_days") items.push({ key: s.key, value: s.value, remark: s.remark });
      }
      await adminApi.systemConfigBatchUpdate(items);
      message.success("系统配置已保存");
    } catch { message.error("保存失败"); }
    finally { setSaving(false); }
  };

  const saveWechat = async (v: any) => {
    setSaving(true);
    try {
      await adminApi.paymentConfigUpsert({
        payChannel: "wechat",
        appId: v.appId,
        mchId: v.mchId,
        apiKey: v.apiKey,
        notifyUrl: v.notifyUrl,
        isActive: v.isActive ?? true,
        remark: v.remark,
      });
      message.success("微信支付配置已保存");
      load();
    } catch { message.error("保存失败"); }
    finally { setSaving(false); }
  };

  const wechatCfg = payList.find((p: any) => p.payChannel === "wechat");

  const tabs = [
    {
      key: "member", label: "会员 / 试用", children: (
        <Card size="small" loading={loading} style={{ maxWidth: 560 }}>
          <Form layout="vertical">
            <Form.Item label="默认试用天数">
              <InputNumber min={0} max={3650} value={trialDays} onChange={(v) => setTrialDays(v || 0)} style={{ width: 200 }} />
              <span style={{ marginLeft: 8, color: "#999" }}>天（新注册用户自动获得）</span>
            </Form.Item>
            <Form.Item label="说明">
              <div style={{ color: "#666", fontSize: 13, background: "#fafafa", padding: 12, borderRadius: 4 }}>
                · 试用到期后，非付费会员将无法使用功能<br />
                · 管理员可在「用户管理」为每个用户单独设置试用到期时间<br />
                · 会员等级：0=非会员，1=普通会员，2=高级会员
              </div>
            </Form.Item>
            <Button type="primary" loading={saving} onClick={saveSystem}>保存配置</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: "wechat", label: "微信支付", children: (
        <WechatPayForm initial={wechatCfg} onSave={saveWechat} saving={saving} />
      ),
    },
    {
      key: "jwt", label: "安全 / 部署", children: (
        <Form layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item label="JWT Secret"><Input.Password defaultValue="shiju_dev_secret_key_change_in_production_2026" /></Form.Item>
          <Form.Item label="Access Token 过期"><Input defaultValue="2h" placeholder="如 2h / 7d / 30d" /></Form.Item>
          <Form.Item label="Admin Key"><Input.Password defaultValue="shiju_admin_key" /></Form.Item>
          <Divider />
          <p style={{ color: "#faad14" }}>⚠️ 这些配置在服务端 .env 文件中修改，修改后需重启服务</p>
        </Form>
      ),
    },
  ];

  return (
    <Card title="系统配置">
      <Tabs items={tabs} />
    </Card>
  );
}

function WechatPayForm({ initial, onSave, saving }: { initial?: any; onSave: (v: any) => void; saving: boolean }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        appId: initial.appId,
        mchId: initial.mchId,
        apiKey: initial.apiKey,
        notifyUrl: initial.notifyUrl,
        isActive: initial.isActive,
        remark: initial.remark,
      });
    } else {
      form.setFieldsValue({ isActive: true });
    }
  }, [initial]);

  return (
    <Form form={form} layout="vertical" style={{ maxWidth: 520 }} onFinish={onSave}>
      <Form.Item name="appId" label="AppID"><Input placeholder="wx..." /></Form.Item>
      <Form.Item name="mchId" label="商户号 MchID"><Input /></Form.Item>
      <Form.Item name="apiKey" label="API Key"><Input.Password /></Form.Item>
      <Form.Item name="notifyUrl" label="支付回调地址"><Input placeholder="https://your.domain.com/api/v1/member/pay/callback" /></Form.Item>
      <Form.Item name="remark" label="备注"><Input /></Form.Item>
      <Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>保存微信支付配置</Button>
    </Form>
  );
}
